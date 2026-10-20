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
import { AppRoutes } from '@/routes/AppRoutes';
import '@/styles/global.css';

// 全局未登录处理：跳登录 + 记住当前路由
installUnauthenticatedHandler();

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
      theme={{
        algorithm: theme.defaultAlgorithm,
        token: { colorPrimary: '#1677ff', borderRadius: 4 },
        // MES 是长时间盯屏的作业系统，默认 compact 更合适
        components: { Table: { cellPaddingBlockSM: 6 } },
      }}
    >
      {/* AntdApp 提供 message/modal/notification 的静态方法上下文 */}
      <AntdApp>
        <QueryClientProvider client={queryClient}>
          <BrowserRouter>
            <Bootstrap />
          </BrowserRouter>
        </QueryClientProvider>
      </AntdApp>
    </ConfigProvider>
  </StrictMode>,
);
