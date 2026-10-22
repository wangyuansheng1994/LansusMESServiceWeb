/**
 * 运行时环境配置（方案 v3.1 §2.3 的 env.js 机制）。
 *
 * 职责边界（2026-10-22 深链接修复后）：
 *   - 资源路径（assets/env.js 自身的 URL）= 构建期按模式绝对化
 *     （默认构建 /console/app/；嘉辰 /MES 用 `pnpm build:mes` 产出 /MES/app/）；
 *   - 本文件只管运行时配置注入，在 public/ 下不打包不 hash，部署时可改。
 *
 * 可覆盖项（全部可选，缺省=跟随构建基址/本地 unit 值）：
 *   CONTEXT_PATH  应用上下文：/console（默认）或 /MES（mes 构建）
 *   ADMIN_PATH    Shiro adminPath：/aspanse（unit/默认）或 /jssi（uat/pro 部署时改成它）
 *   APP_BASE      SPA 挂载点：默认跟随构建基址（/console/app/ 或 /MES/app/），一般无需再设
 */
window.__ENV__ = {
  // CONTEXT_PATH: '/console',
  // ADMIN_PATH: '/aspanse',
  // APP_BASE: '/console/app/',
};
