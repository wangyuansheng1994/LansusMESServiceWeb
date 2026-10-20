import { Suspense, lazy } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { Spin } from 'antd';
import { AppLayout } from '@/layouts/AppLayout';
import { RouteErrorBoundary } from '@/components/RouteErrorBoundary';
import { LoginPage } from '@/pages/LoginPage';
import { RequireAuth } from '@/routes/RequireAuth';

// 代码分割：每个模块独立 chunk，避免 626 个 Controller 对应的页面全塞进首屏
const CustomerDemoPage = lazy(() =>
  import('@/modules/md/pages/CustomerDemoPage').then((m) => ({ default: m.CustomerDemoPage })),
);
const ErrorLabPage = lazy(() =>
  import('@/modules/devtools/pages/ErrorLabPage').then((m) => ({ default: m.ErrorLabPage })),
);
const ChartLabPage = lazy(() =>
  import('@/modules/devtools/pages/ChartLabPage').then((m) => ({ default: m.ChartLabPage })),
);
const ApiDocPage = lazy(() =>
  import('@/modules/devtools/pages/ApiDocPage').then((m) => ({ default: m.ApiDocPage })),
);

/** 路由级 loading —— 每个懒加载页面的兜底 */
function RouteFallback() {
  return (
    <div style={{ display: 'flex', justifyContent: 'center', padding: 80 }}>
      <Spin size="large" tip="加载中…">
        <div style={{ width: 120, height: 40 }} />
      </Spin>
    </div>
  );
}

/** 把每个页面包在 ErrorBoundary + Suspense 里，一个页面崩不影响外壳 */
function Page({ routeKey, children }: { routeKey: string; children: React.ReactNode }) {
  return (
    <RouteErrorBoundary routeKey={routeKey}>
      <Suspense fallback={<RouteFallback />}>{children}</Suspense>
    </RouteErrorBoundary>
  );
}

/**
 * 路由表。
 *
 * ★ 用 BrowserRouter 而不是 HashRouter 的前提：部署侧（Nginx）有
 *   `try_files $uri $uri/ /index.html` 回退。同源反代正好支持这一点。
 *   如果改用纯静态托管且无法配回退，就退回 HashRouter。
 *
 * ★ 路由结构镜像后端 controller 包结构（mes / qms / spc / edc / emap / base ...），
 *   一个业务域一个目录，人对齐代码也对齐。
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
        <Route index element={<Navigate to="/demo/customer" replace />} />

        <Route
          path="/demo/customer"
          element={
            <Page routeKey="/demo/customer">
              <CustomerDemoPage />
            </Page>
          }
        />
        <Route
          path="/demo/errors"
          element={
            <Page routeKey="/demo/errors">
              <ErrorLabPage />
            </Page>
          }
        />
        <Route
          path="/placeholder/chart"
          element={
            <Page routeKey="/placeholder/chart">
              <ChartLabPage />
            </Page>
          }
        />
        <Route
          path="/placeholder/api"
          element={
            <Page routeKey="/placeholder/api">
              <ApiDocPage />
            </Page>
          }
        />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
