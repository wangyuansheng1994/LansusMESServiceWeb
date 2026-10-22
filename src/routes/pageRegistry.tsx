/**
 * 页面登记表 —— 路由表（AppRoutes）与多标签 keep-alive 渲染（AppLayout）
 * 共用的单一数据源。
 *
 * 为什么需要它：react-router 的 <Routes> 只渲染当前匹配的一个页面，
 * 而多标签外壳要求所有打开的标签常驻 DOM（display:none 切换，
 * iframe 标签保留不重载 —— 对位老壳 jerichoTab 的 loadOnce:true）。
 * 因此 AppLayout 不再依赖 <Outlet/>，而是按 tabStore 里的标签清单
 * 逐个查本表渲染；AppRoutes 用同一份表生成路由，保证两边不错位。
 *
 * 新增 React 页面时在这里登记一行，路由与标签行为自动生效。
 */
import { lazy, Suspense, type ReactNode } from 'react';
import { Spin } from 'antd';
import { RouteErrorBoundary } from '@/components/RouteErrorBoundary';
import { LegacyPage } from '@/pages/LegacyPage';
import { HomePage } from '@/pages/HomePage';

// 代码分割：每个页面独立 chunk，避免页面全塞进首屏（沿用骨架既有策略）
const CustomerDemoPage = lazy(() =>
  import('@/pages/md/CustomerDemoPage').then((m) => ({ default: m.CustomerDemoPage })),
);
const ErrorLabPage = lazy(() =>
  import('@/pages/devtools/ErrorLabPage').then((m) => ({ default: m.ErrorLabPage })),
);
const ChartLabPage = lazy(() =>
  import('@/pages/devtools/ChartLabPage').then((m) => ({ default: m.ChartLabPage })),
);
const ApiDocPage = lazy(() =>
  import('@/pages/devtools/ApiDocPage').then((m) => ({ default: m.ApiDocPage })),
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

/** 把每个页面包在 ErrorBoundary + Suspense 里，一个页面崩不影响外壳与其他标签 */
function Page({ routeKey, children }: { routeKey: string; children: ReactNode }) {
  return (
    <RouteErrorBoundary routeKey={routeKey}>
      <Suspense fallback={<RouteFallback />}>{children}</Suspense>
    </RouteErrorBoundary>
  );
}

export interface PageDef {
  /** 匹配的 pathname（不含查询串） */
  path: string;
  /** 标签标题；/legacy 从查询串的 name 取（菜单名） */
  title: (search: URLSearchParams) => string;
  /** keep-alive 渲染入口：每个标签用自己的查询串渲染，不读当前 URL */
  render: (search: URLSearchParams, tabKey: string) => ReactNode;
}

export const PAGE_DEFS: PageDef[] = [
  {
    path: '/home',
    title: () => '首页',
    render: (_s, tabKey) => (
      <Page routeKey={tabKey}>
        <HomePage />
      </Page>
    ),
  },
  {
    path: '/legacy',
    title: (s) => s.get('name') ?? '老页面',
    render: (s, tabKey) => (
      <Page routeKey={tabKey}>
        <LegacyPage src={s.get('src')} name={s.get('name')} />
      </Page>
    ),
  },
  {
    path: '/demo/customer',
    title: () => '客户查询（真接口）',
    render: (_s, tabKey) => (
      <Page routeKey={tabKey}>
        <CustomerDemoPage />
      </Page>
    ),
  },
  {
    path: '/demo/errors',
    title: () => '错误处理验证',
    render: (_s, tabKey) => (
      <Page routeKey={tabKey}>
        <ErrorLabPage />
      </Page>
    ),
  },
  {
    path: '/placeholder/chart',
    title: () => '图表演示',
    render: (_s, tabKey) => (
      <Page routeKey={tabKey}>
        <ChartLabPage />
      </Page>
    ),
  },
  {
    path: '/placeholder/api',
    title: () => '接口文档',
    render: (_s, tabKey) => (
      <Page routeKey={tabKey}>
        <ApiDocPage />
      </Page>
    ),
  },
];

/** 按 pathname 查页面定义；查不到（如通配路由）返回 undefined —— 不开标签 */
export function matchPageDef(pathname: string): PageDef | undefined {
  return PAGE_DEFS.find((d) => d.path === pathname);
}
