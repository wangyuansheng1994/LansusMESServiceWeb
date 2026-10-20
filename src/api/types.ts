/**
 * 错误分类 —— 决定"谁来提示、怎么提示"。
 *
 * 分类依据来自对后端真实行为的地毯式排查，不是猜的：
 *   - Shiro 未登录会 302 到 ${adminPath}/login，axios 自动跟随重定向后
 *     拿到 200 + HTML 登录页（不是 401）
 *   - 后端没有全局异常处理器，未捕获异常走 web.xml 的 500.jsp；
 *     该页面对 Ajax 请求 (Servlets.isAjaxRequest) 直接 out.print(堆栈)
 *     → 前端收到的是【纯文本 Java 堆栈】
 *   - 大量 @ResponseBody 接口返回裸 List/Map/实体，没有信封
 */
export type ApiErrorKind =
  | 'network' // 断网 / 后端未启动 —— 内网 MES 高频
  | 'timeout' // 超时
  | 'canceled' // 主动取消（表格切页/重复查询），必须静默
  | 'unauthenticated' // 未登录 / session 失效（含被 302 到登录页）
  | 'forbidden' // 无权限
  | 'server' // 5xx（后端返回纯文本堆栈或 HTML 错误页）
  | 'business' // 业务失败，有 code —— 交给组件自己处理
  | 'badResponse'; // 响应无法解析

export interface ApiErrorInit {
  kind: ApiErrorKind;
  message?: string;
  code?: string;
  httpStatus?: number;
  traceId?: string;
  url?: string;
  raw?: unknown;
}

export class ApiError extends Error {
  readonly kind: ApiErrorKind;
  /** 后端错误码，如 SYS-0001 / BIZ-xxxx */
  readonly code?: string;
  readonly httpStatus?: number;
  readonly traceId?: string;
  /** 本次请求的 URL，排障必备 */
  readonly url?: string;
  /** 原始响应，仅用于上报，绝不渲染 */
  readonly raw?: unknown;

  constructor(init: ApiErrorInit) {
    super(init.message ?? init.kind);
    this.name = 'ApiError';
    this.kind = init.kind;
    this.code = init.code;
    this.httpStatus = init.httpStatus;
    this.traceId = init.traceId;
    this.url = init.url;
    this.raw = init.raw;
  }

  /** 组件层用这个判断"该不该我自己处理" */
  get isBusiness(): boolean {
    return this.kind === 'business';
  }

  get isCanceled(): boolean {
    return this.kind === 'canceled';
  }
}

export function isApiError(e: unknown): e is ApiError {
  return e instanceof ApiError;
}

/** 前端统一分页模型 —— 所有适配器都归一到它 */
export interface PageResult<T> {
  list: T[];
  total: number;
  pageNum: number;
  pageSize: number;
  /** 后端若返回列定义（jqGrid colModel），带出来供表格直接渲染 */
  columns?: TableColumn[];
}

export interface TableColumn {
  name: string;
  label?: string;
  width?: number;
  hidden?: boolean;
}

export function emptyPage<T>(): PageResult<T> {
  return { list: [], total: 0, pageNum: 1, pageSize: 15 };
}

/** 后端 RestResult<T> 的信封形状（entity 模块已有该类，此处只做类型映射） */
export interface RestEnvelope<T = unknown> {
  result: boolean;
  data: T;
  code?: string;
  msg?: string;
}

/** 后端 { retCode, retMsg, page } 信封形状（本项目特有） */
export interface RetCodeEnvelope {
  retCode: string | number;
  retMsg?: string;
  page?: unknown;
  data?: unknown;
}
