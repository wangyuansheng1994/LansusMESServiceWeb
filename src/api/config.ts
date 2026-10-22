/**
 * 部署环境常量（单一来源）。
 *
 * 优先级：运行时 `public/env.js`（window.__ENV__，部署时可改、不打包不 hash）
 *        → 构建期 `.env.*`（VITE_API_BASE）
 *        → 默认值（本地/unit）
 *
 * ── adminPath ─────────────────────────────────────────────────
 * 后端 `filter_{env}.properties` 的 `adminPath`：unit=`/aspanse`、uat/pro=`/jssi`。
 *
 * ── 为什么老 JSP 的 URL 都带这一截 ─────────────────────────────
 * 老 JSP 的 `${ctx}` = `contextPath + pw:getAdminPath()`（taglib.jsp:11），
 * 即 `/console/aspanse`；数据库 `ad_menu.menu_url` 存的是【不含 adminPath】
 * 的相对路径（如 `/lot/define/lotFutureHoldDefine/list`），拼出来才是
 * `/console/aspanse/lot/...`。漏掉 adminPath 就是 404。
 */

interface RuntimeEnv {
  CONTEXT_PATH?: string;
  ADMIN_PATH?: string;
  APP_BASE?: string;
}

declare global {
  interface Window {
    __ENV__?: RuntimeEnv;
  }
}

const env: RuntimeEnv = typeof window === 'undefined' ? {} : (window.__ENV__ ?? {});

/** 应用上下文（= vite proxy / 反代的前缀，axios baseURL 同值） */
export const CONTEXT_PATH: string = env.CONTEXT_PATH ?? import.meta.env.VITE_API_BASE ?? '/console';

/** Shiro adminPath（unit=/aspanse，uat/pro=/jssi） */
export const ADMIN_PATH: string = env.ADMIN_PATH ?? '/aspanse';

/** 老 JSP 的 ${ctx} 等价物：contextPath + adminPath */
export const CTX = `${CONTEXT_PATH}${ADMIN_PATH}`;

/** 新适配层统一前缀：${adminPath}/api/v1 */
export const API_V1 = `${ADMIN_PATH}/api/v1`;

/** SPA 挂载点（BrowserRouter basename）：开发=/，形态 B=/console/app/ 或 /MES/app/ */
export const APP_BASE: string = env.APP_BASE ?? '/';

/** SPA 站内地址：补挂载点前缀（全页跳转场景用，如 /login） */
export function appUrl(path: string): string {
  const base = APP_BASE.endsWith('/') ? APP_BASE.slice(0, -1) : APP_BASE;
  return `${base}${path.startsWith('/') ? path : `/${path}`}`;
}
