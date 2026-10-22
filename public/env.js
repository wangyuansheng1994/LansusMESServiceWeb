/**
 * 运行时环境配置（方案 v3.1 §2.3 的 env.js 机制）。
 *
 * 为什么不用 .env 构建期注入：形态 B 要同一个 dist 能部署到
 * /console/app/（本地/uat）和 /MES/app/（嘉辰测试服）——构建期写死就做不到。
 * 本文件在 public/ 下、不打包不 hash，部署时按服务器实际上下文改写。
 *
 * 可覆盖项（全部可选，缺省=本地/unit 值）：
 *   CONTEXT_PATH  应用上下文：/console（默认）或 /MES
 *   ADMIN_PATH    Shiro adminPath：/aspanse（unit/默认）或 /jssi（uat/pro）
 *   APP_BASE      SPA 挂载点：/（开发）或 /console/app/、/MES/app/（形态 B）
 */
window.__ENV__ = {
  // CONTEXT_PATH: '/console',
  // ADMIN_PATH: '/aspanse',
  // APP_BASE: '/',
};
