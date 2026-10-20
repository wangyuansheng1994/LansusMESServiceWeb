/**
 * 调用层：信封解包 + Blob + 取消分组 + 便捷方法。
 *
 * 业务代码只用 get/post/put/del/download/upload，
 * 不直接碰 axios，也不需要知道后端有几种信封。
 */
import type { AxiosRequestConfig } from 'axios';
import { http, isLoginPageBody, looksLikeHtml, looksLikeStackTrace } from './http';
import { ApiError } from './types';
import { EnvelopeBusinessError, resolveAdapter } from './adapters';

export interface ExtraOptions {
  /** 跳过信封解包，直接拿原始 body（对接怪异老接口时用） */
  raw?: boolean;
  /**
   * 取消分组：同一 lane 只保留最后一次请求，前一个自动 abort。
   * 用于搜索框输入、表格快速翻页等场景，替代手写 debounce + abort。
   */
  lane?: string;
}

export type RequestConfig = AxiosRequestConfig & ExtraOptions;

/** 每个 lane 只保留最后一次请求 */
const lanes = new Map<string, AbortController>();

function applyLane(cfg: RequestConfig): void {
  if (!cfg.lane) return;
  // 取消同组上一个（若已结束，abort 是 no-op）
  lanes.get(cfg.lane)?.abort();
  const ctrl = new AbortController();
  lanes.set(cfg.lane, ctrl);
  cfg.signal = ctrl.signal;
}

export async function request<T = unknown>(cfg: RequestConfig): Promise<T> {
  applyLane(cfg);

  const url = buildUrl(cfg);
  const res = await http.request(cfg);
  const body: unknown = res.data;
  const traceId = readHeader(res.headers, 'x-trace-id');

  // ── ① session 失效：302 被自动跟随 → 200 + 登录页 HTML
  if (isLoginPageBody(body)) {
    throw new ApiError({ kind: 'unauthenticated', url, httpStatus: res.status });
  }

  if (cfg.raw) return body as T;

  // ── ② Blob / ArrayBuffer：附件下载。后端报错时可能把 JSON 塞进 blob
  if (typeof Blob !== 'undefined' && body instanceof Blob) {
    if (body.type.includes('application/json')) {
      const text = await body.text();
      return unwrap<T>(safeJson(text), url, res.status, traceId);
    }
    return body as T;
  }

  // ── ③ 字符串 body：JSON 字符串 / 纯文本堆栈 / HTML / 裸标量（如 "Y"）
  if (typeof body === 'string') {
    if (looksLikeHtml(body)) {
      throw new ApiError({ kind: 'server', url, httpStatus: res.status, traceId });
    }
    if (looksLikeStackTrace(body)) {
      // 后端 500.jsp 对 Ajax 请求的输出：完整 Java 堆栈
      throw new ApiError({ kind: 'server', url, httpStatus: res.status, traceId });
    }
    const parsed = safeJson(body);
    if (parsed === undefined) {
      // 真的是裸文本（后端 `return "Y"` 这类），原样返回
      return body as unknown as T;
    }
    return unwrap<T>(parsed, url, res.status, traceId);
  }

  // ── ④ 正常 JSON
  return unwrap<T>(body, url, res.status, traceId);
}

/** 信封解包：把适配器抛的业务失败转成 ApiError */
function unwrap<T>(body: unknown, url: string, status: number, traceId?: string): T {
  const adapter = resolveAdapter(body);
  try {
    return adapter.normalize(body) as T;
  } catch (e) {
    if (e instanceof EnvelopeBusinessError) {
      throw new ApiError({
        kind: 'business',
        code: e.code,
        message: e.message,
        url,
        httpStatus: status,
        traceId,
        raw: e.raw,
      });
    }
    throw new ApiError({
      kind: 'badResponse',
      url,
      httpStatus: status,
      traceId,
      raw: body,
    });
  }
}

function buildUrl(cfg: RequestConfig): string {
  const base = cfg.baseURL ?? http.defaults.baseURL ?? '';
  return `${base}${cfg.url ?? ''}`;
}

function readHeader(headers: unknown, name: string): string | undefined {
  const v = (headers as Record<string, unknown> | undefined)?.[name];
  return typeof v === 'string' ? v : undefined;
}

function safeJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}

// ── 便捷方法 ──────────────────────────────────────────────────
export function get<T>(url: string, params?: object, cfg?: RequestConfig): Promise<T> {
  return request<T>({ ...cfg, url, params, method: 'GET' });
}

export function post<T>(url: string, data?: unknown, cfg?: RequestConfig): Promise<T> {
  return request<T>({ ...cfg, url, data, method: 'POST' });
}

export function put<T>(url: string, data?: unknown, cfg?: RequestConfig): Promise<T> {
  return request<T>({ ...cfg, url, data, method: 'PUT' });
}

export function del<T>(url: string, params?: object, cfg?: RequestConfig): Promise<T> {
  return request<T>({ ...cfg, url, params, method: 'DELETE' });
}

/**
 * 文件下载。
 * ★ 报表/导出类接口走 5 分钟超时，别用默认 60s ——
 *   这个项目连构建都要十几分钟，报表只会更慢。
 */
export async function download(
  url: string,
  params: object | undefined,
  filename: string,
  timeout = 300_000,
): Promise<void> {
  const blob = await request<Blob>({
    url,
    params,
    method: 'GET',
    responseType: 'blob',
    timeout,
  });
  const href = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = href;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(href);
}

/** 文件上传（带进度）。不手动设 Content-Type，让浏览器带 boundary */
export function upload<T = unknown>(
  url: string,
  file: File,
  data?: Record<string, unknown>,
  onProgress?: (percent: number) => void,
  timeout = 300_000,
): Promise<T> {
  const fd = new FormData();
  fd.append('file', file);
  Object.entries(data ?? {}).forEach(([k, v]) => fd.append(k, String(v)));

  return request<T>({
    url,
    method: 'POST',
    data: fd,
    timeout,
    onUploadProgress: (e) => {
      if (e.total) onProgress?.(Math.round((e.loaded / e.total) * 100));
    },
  });
}
