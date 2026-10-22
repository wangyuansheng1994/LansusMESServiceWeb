/**
 * antd 6 全局提示通道（F4 纪律的落点）。
 *
 * F4：禁止 `import { message } from 'antd'` 静态调用——静态方法拿不到
 * ConfigProvider 上下文（主题/国际化失效，v6 开发态 warnContext）。
 * 正确做法：`App.useApp()` 拿实例。但 query.ts 这类非组件模块拿不到 hook，
 * 所以由 NotifyHolder（挂在 <AntdApp> 内）把实例注册到本模块，
 * 非组件代码统一从 notify* 走。
 */
import type { MessageInstance } from 'antd/es/message/interface';

let messageApi: MessageInstance | null = null;

/** 由 NotifyHolder 注册/注销；应用外调用不生效 */
export function registerMessageApi(api: MessageInstance | null): void {
  messageApi = api;
}

export function notifyError(content: string): void {
  if (messageApi) {
    messageApi.error(content);
  } else {
    // holder 尚未挂载（理论上的启动早期）：静默降级到 console，不引入静态 message
    console.error('[notify]', content);
  }
}

export function notifyInfo(content: string): void {
  if (messageApi) {
    messageApi.info(content);
  } else {
    console.info('[notify]', content);
  }
}

export function notifyWarning(content: string): void {
  if (messageApi) {
    messageApi.warning(content);
  } else {
    console.warn('[notify]', content);
  }
}
