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
  /** 拿到响应头时的回调（下载需要从 Content-Disposition 解析文件名） */
  onHeaders?: (headers: Record<string, unknown>) => void;
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

// ── 防重复提交（方案 v3.1 §7.2 / F13）───────────────────────────
// POST/PUT 以 method+url+body 为 key，2s 内相同请求合并复用同一 Promise。
// 对位老 default.jsp 禁用 submit 10s 的防抖；MES 现场网络抖动 +
// 用户连点是常态，重复提交直接造脏数据（重复单据）。
const DEDUPE_WINDOW_MS = 2_000;
const inflightWrites = new Map<string, { promise: Promise<unknown>; start: number }>();

function dedupeKey(cfg: RequestConfig): string | null {
  const method = (cfg.method ?? 'GET').toUpperCase();
  if (method !== 'POST' && method !== 'PUT') return null;
  const data = cfg.data;
  // FormData（上传）/ Blob / ArrayBuffer 不参与合并——内容不可枚举，误合并会丢文件
  if (typeof FormData !== 'undefined' && data instanceof FormData) return null;
  if (typeof Blob !== 'undefined' && data instanceof Blob) return null;
  if (typeof ArrayBuffer !== 'undefined' && data instanceof ArrayBuffer) return null;
  let bodyHash: string;
  try {
    bodyHash = typeof data === 'string' ? data : JSON.stringify(data ?? null);
  } catch {
    return null; // 循环引用等不可序列化场景：放弃合并，正常发请求
  }
  return `${method} ${buildUrl(cfg)} ${bodyHash}`;
}

function applyDedupe<T>(cfg: RequestConfig, send: () => Promise<T>): Promise<T> {
  const key = dedupeKey(cfg);
  if (!key) return send();

  const now = Date.now();
  const existing = inflightWrites.get(key);
  if (existing && now - existing.start < DEDUPE_WINDOW_MS) {
    return existing.promise as Promise<T>;
  }

  const promise = send();
  const entry = { promise, start: now };
  inflightWrites.set(key, entry);
  // 结算后仍保留到 2s 窗口结束（窗口内同请求复用同一 Promise，不再打后端）。
  // ★ 用 then(cleanup, cleanup) 而不是 finally：finally 派生的新 Promise 在
  //   原 Promise reject 时也会 reject 且无人 catch → 控制台 unhandledrejection。
  const cleanup = () => {
    const remain = DEDUPE_WINDOW_MS - (Date.now() - entry.start);
    if (remain <= 0) {
      if (inflightWrites.get(key) === entry) inflightWrites.delete(key);
    } else {
      setTimeout(() => {
        if (inflightWrites.get(key) === entry) inflightWrites.delete(key);
      }, remain);
    }
  };
  void promise.then(cleanup, cleanup);
  return promise;
}

export async function request<T = unknown>(cfg: RequestConfig): Promise<T> {
  applyLane(cfg);
  return applyDedupe(cfg, () => sendRequest<T>(cfg));
}

async function sendRequest<T = unknown>(cfg: RequestConfig): Promise<T> {
  // 注意：applyLane 只在 request() 入口调一次，这里不再重复
  // （重复调用会 abort 掉上一次刚创建的 controller）
  const url = buildUrl(cfg);
  const res = await http.request(cfg);
  cfg.onHeaders?.(res.headers as Record<string, unknown>);
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
 * ★ 文件名优先从响应头 Content-Disposition 解析（方案 v3.1 §7.2），
 *   解析不到再用调用方传入的 filename。
 */
export async function download(
  url: string,
  params: object | undefined,
  filename?: string,
  timeout = 300_000,
): Promise<void> {
  let disposition: string | undefined;
  const blob = await request<Blob>({
    url,
    params,
    method: 'GET',
    responseType: 'blob',
    timeout,
    onHeaders: (h) => {
      const v = h['content-disposition'];
      if (typeof v === 'string') disposition = v;
    },
  });
  const href = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = href;
  a.download = filename ?? parseDispositionFilename(disposition) ?? 'download';
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(href);
}

/** 解析 Content-Disposition 的文件名（兼容 filename*=UTF-8'' 与 filename="..." 两种形态） */
function parseDispositionFilename(disposition: string | undefined): string | undefined {
  if (!disposition) return undefined;
  const star = /filename\*=UTF-8''([^;]+)/i.exec(disposition);
  if (star) {
    try {
      return decodeURIComponent(star[1].trim());
    } catch {
      /* 编码非法时落到普通形态 */
    }
  }
  const plain = /filename="?([^";]+)"?/i.exec(disposition);
  return plain ? plain[1].trim() : undefined;
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
