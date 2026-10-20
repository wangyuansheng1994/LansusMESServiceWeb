import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath, URL } from 'node:url';

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
export default defineConfig({
  plugins: [react()],
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
         * 注意 vendor-charts 故意【不拆】：@ant-design/charts 只在图表页用到，
         * 拆成独立 chunk 后 Vite 会为动态依赖注入 modulepreload，
         * 导致 1.4 MB 的图表库在首屏就被预加载，反而抵消了懒加载。
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
});
