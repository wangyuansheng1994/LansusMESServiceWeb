/**
 * 错误呈现决策层 —— 回答"这个错误谁来提示、怎么提示"。
 *
 * 核心原则：
 *   拦截器只处理【框架级】错误（网络/超时/认证/权限/5xx），
 *   业务错误（business）绝不抢 —— 交给组件自己决定展示方式。
 *
 * 为什么：如果全局拦截器把业务错误也弹成顶部 toast，会出现
 * "表单提交失败只飘了个 toast，用户不知道是哪个字段错了"。
 */
import { message as antdMessage } from 'antd';
import { MutationCache, QueryCache, QueryClient } from '@tanstack/react-query';
import { ApiError } from './types';
import { reportApiError } from './errorReport';

/**
 * 错误码 → 用户文案。
 *
 * ★ 前端映射优先，未命中才用后端 msg。
 *   原因：后端大量地方是 `throw new RuntimeException("操作异常！")` 这种裸消息，
 *   msg 不可靠、不可枚举、还可能带内部信息（表名、SQL）。
 *
 * 目前后端 errors.properties 只有 3 个码（实测），先对齐它，
 * 后续按模块补 BIZ- / VALID-。
 */
const ERROR_MESSAGES: Record<string, string> = {
  'SYS-0001': '登录已超时，请重新登录',
  'SYS-0002': '您没有该操作的权限',
  'SYS-0003': '系统异常，请联系管理员',
};

export function resolveErrorMessage(e: unknown): string {
  if (!(e instanceof ApiError)) return '操作失败';

  if (e.code && ERROR_MESSAGES[e.code]) return ERROR_MESSAGES[e.code];

  switch (e.kind) {
    case 'network':
      return '网络连接失败，请检查网络后重试';
    case 'timeout':
      // 不用"失败"措辞 —— 这个项目有大量慢接口，超时是常态不是错误
      return '请求超时，请稍后重试或缩小查询范围';
    case 'unauthenticated':
      return '登录已超时，请重新登录';
    case 'forbidden':
      return '您没有该操作的权限';
    case 'server':
      return '系统异常，请联系管理员';
    case 'business':
      return e.message || '操作失败';
    case 'badResponse':
      return '服务器返回了无法识别的数据';
    case 'canceled':
      return '';
  }
}

/** 全局"未登录"回调，由 App 注入（跳登录 + 记住当前路由） */
let onUnauthenticated: (() => void) | null = null;
export function setUnauthenticatedHandler(fn: () => void): void {
  onUnauthenticated = fn;
}

/** 错误上报回调，由 App 注入；未覆盖时用下面的默认实现 */
let onReport: ((e: ApiError) => void) | null = null;
export function setErrorReporter(fn: (e: ApiError) => void): void {
  onReport = fn;
}

/** ★ 默认上报实现（打点到后端 /api/v1/error-report，未就绪时静默） */
setErrorReporter((e) => {
  reportApiError({
    kind: e.kind,
    code: e.code,
    httpStatus: e.httpStatus,
    url: e.url,
    message: e.message,
    traceId: e.traceId,
  });
});

/** ★ 只有框架级错误才全局提示；business 直接 return，把提示权留给组件 */
export function handleGlobalError(e: unknown): void {
  if (!(e instanceof ApiError)) return;

  switch (e.kind) {
    case 'canceled':
      return; // 静默
    case 'unauthenticated':
      onUnauthenticated?.();
      return;
    case 'business':
      return; // ★ 组件自己处理，不抢
    case 'server':
      onReport?.(e); // 先上报再提示
      antdMessage.error(resolveErrorMessage(e));
      return;
    default:
      antdMessage.error(resolveErrorMessage(e));
  }
}

export const queryClient = new QueryClient({
  // ★ 用 Cache 级回调，而不是每个 useQuery 手写 onError —— 避免漏写
  queryCache: new QueryCache({ onError: handleGlobalError }),
  mutationCache: new MutationCache({ onError: handleGlobalError }),

  defaultOptions: {
    queries: {
      retry: (count, e) => {
        if (e instanceof ApiError) {
          // 业务错误/无权限/未登录重试没意义，只会放大问题
          if (
            e.kind === 'business' ||
            e.kind === 'forbidden' ||
            e.kind === 'unauthenticated' ||
            e.kind === 'canceled'
          ) {
            return false;
          }
        }
        return count < 2;
      },
      staleTime: 30_000,
      // MES 是内网常驻页面，切窗口就重新拉数据会造成无谓压力
      refetchOnWindowFocus: false,
      // 取消的请求不算错误，不要重试
      retryOnMount: false,
    },
  },
});
