import { Navigate, Route, Routes } from 'react-router-dom';
import { AppLayout } from '@/layouts/AppLayout';
import { LoginPage } from '@/pages/LoginPage';
import { RequireAuth } from '@/routes/RequireAuth';
import { PAGE_DEFS } from '@/routes/pageRegistry';

/**
 * 路由表。
 *
 * ★ 用 BrowserRouter 而不是 HashRouter 的前提：部署侧有 SPA fallback
 *   （形态 B 的 SpaCacheAndFallbackFilter / 形态 A 的 nginx try_files）。
 *
 * ★ 子路由只负责"让 URL 合法地匹配进 AppLayout"，页面本体由 AppLayout
 *   按 tabStore + pageRegistry 做多标签 keep-alive 渲染（不用 <Outlet/>），
 *   这样所有打开的标签常驻 DOM、iframe 标签保留不重载（对齐老壳
 *   jerichoTab 的 loadOnce:true）。
 *
 * ★ 新增 React 页面只需在 pageRegistry 登记，无需改本文件。
 */
export function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />

      <Route
        element={
          <RequireAuth>
            <AppLayout />
          </RequireAuth>
        }
      >
        <Route index element={<Navigate to="/home" replace />} />
        {PAGE_DEFS.map((d) => (
          <Route key={d.path} path={d.path.slice(1)} element={null} />
        ))}
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
