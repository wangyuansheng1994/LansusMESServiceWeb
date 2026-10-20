/**
 * 传输层：axios 实例 + 拦截器。
 *
 * 这一层只负责"把任何失败都变成一个可分类的 ApiError"，
 * 不做任何用户提示 —— 提示决策在 query.ts / 组件层。
 */
import axios, { AxiosError, type AxiosInstance, type AxiosResponse } from 'axios';
import { ApiError } from './types';

/**
 * ⚠️ baseURL 契约（写死在注释里，防止后人改坏）
 *
 * 必须是【同源相对路径】，通过 Vite proxy（开发）或 Nginx 反代（生产）到 Tomcat。
 *
 * 一旦改成跨域绝对地址（如 http://10.x.x.x:8080/console），会出现：
 *   Shiro 1.2.6（2015 年发布，早于 SameSite 规范）不会写 SameSite 属性
 *   → 浏览器按 SameSite=Lax 处理
 *   → 跨站 XHR 不携带 pw.session.id
 *   → 表现为"登录成功了，但每个请求都提示未登录"
 * 这不是配置错误，是浏览器安全模型决定的。
 */
const BASE_URL = import.meta.env.VITE_API_BASE ?? '/console';

export const http: AxiosInstance = axios.create({
  baseURL: BASE_URL,

  // ★ 携带 Shiro 的 session cookie（pw.session.id）
  withCredentials: true,

  // 默认 60s。报表/导出/打印类接口天然慢，用 RequestConfig.timeout 单独覆写。
  timeout: 60_000,

  headers: {
    // ★★ 这一个头是打通老后端的关键。
    //
    // 老前端用 jQuery，$.ajax 默认就带 X-Requested-With: XMLHttpRequest，
    // 后端 500.jsp 依赖 Servlets.isAjaxRequest(request) 决定行为：
    //   带 → out.print(堆栈文本)
    //   不带 → 渲染一整页 HTML 错误页
    // 老前端"无意间"满足了这个条件。新前端如果不带，同样一个接口
    // 老页面调没事、React 调就返回 HTML —— 极难排查。
    'X-Requested-With': 'XMLHttpRequest',
  },
});

// ── 响应拦截器：只做分类，不做提示 ────────────────────────────
http.interceptors.response.use(
  (res: AxiosResponse) => res,
  (err: AxiosError) => Promise.reject(classifyTransportError(err)),
);

function classifyTransportError(err: AxiosError): ApiError {
  const url = err.config?.url;
  const res = err.response;
  const httpStatus = res?.status;
  const traceId = headerString(res, 'x-trace-id');

  // ① 主动取消 —— 表格切页/重复查询会大量产生，必须静默
  if (err.code === 'ERR_CANCELED') {
    return new ApiError({ kind: 'canceled', url });
  }

  // ② 超时
  if (err.code === 'ECONNABORTED' || err.code === 'ETIMEDOUT') {
    return new ApiError({ kind: 'timeout', url, httpStatus, traceId });
  }

  // ③ 网络层失败（断网 / 后端未启动）
  if (err.code === 'ERR_NETWORK' || !res) {
    return new ApiError({ kind: 'network', url });
  }

  // ④ 认证 / 授权
  if (httpStatus === 401) {
    return new ApiError({ kind: 'unauthenticated', url, httpStatus, traceId });
  }
  if (httpStatus === 403) {
    return new ApiError({ kind: 'forbidden', url, httpStatus, traceId });
  }

  // ⑤ 5xx：后端返回纯文本 Java 堆栈（500.jsp 的 out.print(sb)）或 HTML 错误页。
  //    绝不把堆栈透给用户，只留 url + httpStatus 供上报。
  if (httpStatus !== undefined && httpStatus >= 500) {
    return new ApiError({ kind: 'server', url, httpStatus, traceId });
  }

  return new ApiError({
    kind: 'badResponse',
    url,
    httpStatus,
    traceId,
    raw: res.data,
  });
}

function headerString(res: AxiosResponse | undefined, name: string): string | undefined {
  const v = res?.headers?.[name];
  return typeof v === 'string' ? v : undefined;
}

/**
 * 嗅探：这个 body 是不是被 302 重定向到了 Shiro 登录页。
 *
 * 为什么需要：Shiro 的 authc 过滤器对未认证请求不是返回 401，而是 302 到
 * loginUrl。XHR 会自动跟随重定向，最终 axios 拿到的是【200 + 登录页 HTML】。
 * 如果不嗅探，前端会把它当成成功响应，然后在解 JSON 时抛出
 * "Unexpected token '<'" 这种毫无指向性的错误。
 */
export function isLoginPageBody(body: unknown): boolean {
  if (typeof body !== 'string') return false;
  return (
    body.includes('loginForm') ||
    body.includes('name="username"') ||
    body.includes('请填写用户名') ||
    body.includes('/aspanse/login')
  );
}

/** 嗅探：这个字符串 body 是不是 HTML（后端错误页兜底） */
export function looksLikeHtml(body: unknown): boolean {
  if (typeof body !== 'string') return false;
  const head = body.slice(0, 200).toLowerCase();
  return head.includes('<!doctype html') || head.includes('<html');
}

/** 嗅探：这个字符串 body 是不是 Java 堆栈（后端 500.jsp 对 Ajax 的输出） */
export function looksLikeStackTrace(body: unknown): boolean {
  if (typeof body !== 'string') return false;
  return (
    body.includes('错误信息：') ||
    /at [a-z0-9_$.]+\.[A-Za-z0-9_$]+\(/.test(body) ||
    body.includes('java.lang.')
  );
}
