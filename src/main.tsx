import { StrictMode, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { QueryClientProvider } from '@tanstack/react-query';
import { App as AntdApp, ConfigProvider, theme } from 'antd';
import zhCN from 'antd/locale/zh_CN';
import { queryClient } from '@/api/query';
import {
  installUnauthenticatedHandler,
  startHeartbeat,
  stopHeartbeat,
  useAuthStore,
} from '@/api/session';
import { getBackendVersion } from '@/api/modules/meta';
import { NotifyHolder } from '@/components/NotifyHolder';
import { AppRoutes } from '@/routes/AppRoutes';
import { APP_BASE, CONTEXT_PATH } from '@/api/config';
import '@/styles/global.css';

// 全局未登录处理：跳登录 + 记住当前路由
installUnauthenticatedHandler();

// favicon 与老菜单图标字体 CSS：按 CONTEXT_PATH 运行时注入（index.html 不写死 /console，
// 否则 /MES 上下文部署全 404）。icons.min.css = remixicon/MDI/FA5（L1 图标全类名）；
// font-awesome.css = FA3 icon-*（L2 图标 icon-{menu_img}）——菜单图标与老壳逐字一致的关键，勿删。
for (const link of [
  { rel: 'shortcut icon', href: `${CONTEXT_PATH}/html/assets/images/favicon.ico` },
  { rel: 'stylesheet', href: `${CONTEXT_PATH}/html/assets/css/icons.min.css` },
  { rel: 'stylesheet', href: `${CONTEXT_PATH}/html/bootstrap/2.3.1/awesome/font-awesome.css` },
]) {
  const el = document.createElement('link');
  el.rel = link.rel;
  el.href = link.href;
  document.head.appendChild(el);
}

function Bootstrap() {
  const ready = useAuthStore((s) => s.ready);
  const user = useAuthStore((s) => s.user);
  const checkSession = useAuthStore((s) => s.checkSession);

  // 启动即校验会话（避免先渲染外壳再被踢，产生闪烁）
  useEffect(() => {
    void checkSession().catch(() => {
      /* 网络错误不阻塞进入，具体错误由页面自己展示 */
    });
  }, [checkSession]);

  // 浏览器标签页标题对位老系统（${pw:getConfig('productName')}）：
  // index.html 里是静态兜底，meta/version 返回后校正为后端配置的产品名
  useEffect(() => {
    getBackendVersion()
      .then((v) => {
        if (v.productName) document.title = v.productName;
      })
      .catch(() => {
        /* meta/version 未实现或网络异常时保持 index.html 的静态标题 */
      });
  }, []);

  // ★ 登录后才开心跳：5 分钟一次，远小于后端 30 分钟 session 超时
  useEffect(() => {
    if (ready && user) {
      startHeartbeat();
      return () => stopHeartbeat();
    }
    return undefined;
  }, [ready, user]);

  return <AppRoutes />;
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ConfigProvider
      locale={zhCN}
      button={{ autoInsertSpace: false }}
      theme={{
        algorithm: theme.defaultAlgorithm,
        token: { colorPrimary: '#1677ff', borderRadius: 4 },
        // MES 是长时间盯屏的作业系统，默认 compact 更合适
        components: { Table: { cellPaddingBlockSM: 6 } },
      }}
    >
      {/* AntdApp 提供 message/modal/notification 的静态方法上下文 */}
      <AntdApp>
        <NotifyHolder />
        <QueryClientProvider client={queryClient}>
          <BrowserRouter basename={APP_BASE}>
            <Bootstrap />
          </BrowserRouter>
        </QueryClientProvider>
      </AntdApp>
    </ConfigProvider>
  </StrictMode>,
);
