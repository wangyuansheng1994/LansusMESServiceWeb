import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { readFileSync } from 'node:fs';
import { fileURLToPath, URL } from 'node:url';
import { captureSourceProvenance } from './scripts/source-provenance.mjs';

const contract = JSON.parse(
  readFileSync(new URL('./api-contract.json', import.meta.url), 'utf8'),
) as {
  apiContractVersion: string;
  minBackendVersion: string;
  frontendVersion: string;
};
const API_CONTRACT_VERSION = contract.apiContractVersion;
const source = captureSourceProvenance(fileURLToPath(new URL('.', import.meta.url)));

function versionJsonPlugin(): Plugin {
  return {
    name: 'emit-version-json',
    apply: 'build',
    generateBundle() {
      const version = {
        frontendVersion: contract.frontendVersion,
        frontendCommit: source.displayCommit,
        sourceDiffHash: source.diffHash,
        buildTime: new Date().toISOString(),
        apiContractVersion: API_CONTRACT_VERSION,
        minBackendVersion: contract.minBackendVersion,
      };
      this.emitFile({
        type: 'asset',
        fileName: 'version.json',
        source: JSON.stringify(version, null, 2),
      });
      this.emitFile({
        type: 'asset',
        fileName: 'api-contract.json',
        source: `${JSON.stringify(contract, null, 2)}\n`,
      });
    },
  };
}

/**
 * 开发环境：Vite dev server 只服务前端，接口通过 proxy 打到本地 Tomcat。
 *
 * ⚠️ 三条铁律，改坏任何一条都会出现"登录了却一直未登录"：
 *
 *  1. 必须用 http://127.0.0.1:5173 访问前端，不要用 http://localhost:5173。
 *     因为 target 是 127.0.0.1，如果页面 origin 是 localhost，浏览器会判定
 *     cookie 的站点不一致，Shiro 的 pw.session.id 会被丢弃。
 *
 *  2. changeOrigin 必须为 false。
 *     设为 true 会把 Host 头改写成 127.0.0.1:8080，后端生成的 Set-Cookie
 *     domain / 重定向地址会和浏览器看到的不一致。
 *
 *  3. 不要用 CORS 方式直连后端（不要配 axios 绝对地址）。
 *     Shiro 1.2.6 不写 SameSite 属性，浏览器按 SameSite=Lax 处理，
 *     跨站 XHR 不会携带 pw.session.id。
 */
export default defineConfig(({ mode }) => ({
  // 部署基址按构建模式绝对化（2026-10-22 负责人裁决）：
  // 原先的相对 base './' 配合 BrowserRouter，多段路由深链接刷新时
  // （如 /console/app/demo/customer）会把 ./assets/... 解析到当前路径段之下 → 404 白屏。
  //   dev                   → /
  //   production（默认构建） → /console/app/（本地 unit 与 uat/pro 通用，同为 /console 上下文）
  //   mes（pnpm build:mes）  → /MES/app/（嘉辰测试服）
  // 代价：/MES 需单独构建；运行时配置（CONTEXT_PATH/ADMIN_PATH/APP_BASE）仍由 dist/env.js 注入。
  base: mode === 'mes' ? '/MES/app/' : mode === 'development' ? '/' : '/console/app/',
  plugins: [react(), versionJsonPlugin()],
  define: {
    // 契约版本号单一来源注入：meta.ts 的 FRONTEND_API_CONTRACT_VERSION 读这里
    'import.meta.env.VITE_API_CONTRACT_VERSION': JSON.stringify(API_CONTRACT_VERSION),
    'import.meta.env.VITE_MIN_BACKEND_VERSION': JSON.stringify(contract.minBackendVersion),
  },
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: {
    host: '127.0.0.1',
    port: 5173,
    strictPort: true,
    proxy: {
      // 后端 context path 是 /console，adminPath 是 /aspanse
      // 所以老接口实际路径形如 /console/aspanse/md/mdCustomer/mdCustLookUp
      '/console': {
        target: 'http://127.0.0.1:8080',
        changeOrigin: false,
        // ws: false,  // 老系统无 websocket，保持关闭
      },
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: true,
    // 显式锁定浏览器基线（方案 v3.1 §3.4）：不吃 Vite 默认值的版本漂移
    // （Vite 8 已把默认基线抬到 Chrome 111/Firefox 114/Safari 16.4）
    target: ['chrome107', 'edge107', 'firefox104', 'safari16'],
    // 产物文件名带内容哈希 → 可以放心强缓存 1 年
    // （index.html 必须走 no-cache，否则永远拿不到新的哈希文件名）
    rollupOptions: {
      output: {
        entryFileNames: 'assets/[name]-[hash].js',
        chunkFileNames: 'assets/[name]-[hash].js',
        assetFileNames: 'assets/[name]-[hash].[ext]',
        /**
         * 手动分包：把体积大的第三方库拆出去。
         *
         * 注意图表库故意【不拆】：echarts 只在图表页用到，
         * 拆成独立 chunk 后 Vite 会为动态依赖注入 modulepreload，
         * 导致 ~1.1MB 的图表库在首屏就被预加载，反而抵消了懒加载。
         * 不拆时它跟着 ChartLabPage 的懒加载 chunk 走，进图表页才下载。
         */
        manualChunks: {
          'vendor-react': ['react', 'react-dom', 'react-router-dom'],
          'vendor-antd': ['antd', '@ant-design/icons'],
          'vendor-http': ['axios', '@tanstack/react-query', 'zustand'],
        },
      },
    },
    // 图表库天然大，调高阈值避免无意义的告警
    chunkSizeWarningLimit: 1500,
  },
}));
