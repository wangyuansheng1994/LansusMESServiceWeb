/**
 * 错误上报。
 *
 * 为什么必须有：后端 500 对 Ajax 请求返回的是【纯文本 Java 堆栈、没有 traceId】，
 * 前端拿不到任何结构化信息。不给一个上报通道，线上问题只能靠用户口述"点了某个
 * 按钮报错了"，你无法定位。
 *
 * ★ 后端待实现（见 README 的"后端待办"）：
 *     POST ${adminPath}/api/v1/error-report
 *   在它落地前，本模块只打 console，不产生失败噪音。
 */
import { post } from './request';

export interface ErrorReport {
  kind: string;
  code?: string;
  httpStatus?: number;
  url?: string;
  message?: string;
  traceId?: string;
  routeKey?: string;
}

/** 同一错误短时间内只上报一次，避免异常风暴打爆后端 */
const reported = new Set<string>();
const DEDUP_WINDOW_MS = 60_000;

function shouldReport(key: string): boolean {
  if (reported.has(key)) return false;
  reported.add(key);
  window.setTimeout(() => reported.delete(key), DEDUP_WINDOW_MS);
  return true;
}

function basePayload() {
  return {
    href: window.location.href,
    userAgent: navigator.userAgent,
    ts: new Date().toISOString(),
  };
}

function send(payload: ErrorReport): void {
  const key = `${payload.kind}|${payload.code ?? ''}|${payload.url ?? ''}|${payload.message ?? ''}`;
  if (!shouldReport(key)) return;

  const body = { ...payload, ...basePayload() };

  // 上报本身失败必须完全静默，绝不能引发二次弹窗或循环
  void post('/aspanse/api/v1/error-report', body, { raw: true }).catch(() => {
    // eslint-disable-next-line no-console
    console.warn('[error-report] 上报接口未就绪或失败，已忽略', body);
  });
}

export function reportApiError(e: {
  kind: string;
  code?: string;
  httpStatus?: number;
  url?: string;
  message?: string;
  traceId?: string;
}): void {
  send(e);
}

export function reportRenderError(e: {
  routeKey?: string;
  message: string;
  stack: string;
}): void {
  send({
    kind: 'render',
    routeKey: e.routeKey,
    message: e.message,
    url: window.location.href,
  });
}
