import { useEffect } from 'react';
import { App } from 'antd';
import { registerMessageApi } from '@/api/notify';

/**
 * 把 antd App 上下文的 message 实例注册到模块级通道（api/notify.ts）。
 * 挂在 <AntdApp> 内部、路由外，应用生命周期内常驻。
 */
export function NotifyHolder() {
  const { message } = App.useApp();
  useEffect(() => {
    registerMessageApi(message);
    return () => registerMessageApi(null);
  }, [message]);
  return null;
}
