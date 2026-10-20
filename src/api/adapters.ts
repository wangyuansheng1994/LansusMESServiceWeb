/**
 * 信封适配器 —— 本工程最关键的文件。
 *
 * 为什么需要它：这个后端至少有 4 种响应信封，都是实测出来的，不是推测：
 *
 *   ① { retCode: "0", retMsg: "Success", page: {...} }
 *      来源：BaseMdCustomerController.mdCustLookUp（mes/md/customer）
 *      特点：分页对象整体塞在 page 字段里，不是平铺的 rows/total
 *
 *   ② { result: true, data: T, code, msg }
 *      来源：entity 模块自带的 RestResult<T>
 *      被 WmsInventoryController / PmRepairController / LotController 等使用
 *
 *   ③ { rows: [], total: n, records: n, page: n }
 *      来源：jqGrid 经典分页格式
 *
 *   ④ 裸 JSON
 *      来源：大量 @ResponseBody 直接返回 List / Map / 实体
 *      甚至包括后端 `return restResult.getResult() ? "Y" : "N";` 这种裸字符串标量
 *
 * 设计要点：用【注册表 + 优先级】而不是 if/else 链。
 * 以后遇到第 5、6 种信封，只加一个适配器对象 + 一行注册，
 * 调用层（request.ts）和所有业务接口代码零改动。
 */
import type { PageResult, RetCodeEnvelope, RestEnvelope, TableColumn } from './types';

export interface EnvelopeAdapter {
  /** 名字，仅用于排障日志 */
  name: string;
  /** 越小的越先尝试 */
  priority: number;
  /** 能否处理这个 body */
  test(body: unknown): boolean;
  /**
   * 归一化。业务失败时 throw EnvelopeBusinessError，
   * 由调用层统一转成 ApiError（保持适配器与错误类型解耦）。
   */
  normalize(body: unknown): unknown;
}

/** 适配器用它表达"业务失败" */
export class EnvelopeBusinessError extends Error {
  readonly code: string;
  readonly raw?: unknown;

  constructor(code: string, message?: string, raw?: unknown) {
    super(message ?? code);
    this.name = 'EnvelopeBusinessError';
    this.code = code;
    this.raw = raw;
  }
}

// ─────────────────────────────────────────────────────────────
// ① RetCodeEnvelope —— 本项目特有，优先级最高
// ─────────────────────────────────────────────────────────────
export const retCodeAdapter: EnvelopeAdapter = {
  name: 'retCode',
  priority: 10,

  test: (b) =>
    isPlainObject(b) && 'retCode' in b && ('retMsg' in b || 'page' in b || 'data' in b),

  normalize(body) {
    const b = body as unknown as RetCodeEnvelope;
    const code = String(b.retCode ?? '');

    // "0" 是成功；同时容忍历史写法 0 / "success" / "200"
    const ok = code === '0' || code === '' || code === 'success' || code === '200';
    if (!ok) {
      throw new EnvelopeBusinessError(code, b.retMsg ?? '操作失败', body);
    }

    // ★ 分页对象在 page 字段里，需要拆出来归一化
    if (isPlainObject(b.page)) {
      return normalizeLegacyPage(b.page);
    }
    return b.data !== undefined ? b.data : body;
  },
};

// ─────────────────────────────────────────────────────────────
// ② RestResultEnvelope
// ─────────────────────────────────────────────────────────────
export const restResultAdapter: EnvelopeAdapter = {
  name: 'restResult',
  priority: 20,

  test: (b) =>
    isPlainObject(b) && typeof (b as { result?: unknown }).result === 'boolean',

  normalize(body) {
    const env = body as unknown as RestEnvelope;
    if (!env.result) {
      throw new EnvelopeBusinessError(env.code ?? '', env.msg, body);
    }
    return env.data;
  },
};

// ─────────────────────────────────────────────────────────────
// ③ JqGridEnvelope
// ─────────────────────────────────────────────────────────────
export const jqGridAdapter: EnvelopeAdapter = {
  name: 'jqGrid',
  priority: 30,

  test: (b) =>
    isPlainObject(b) && Array.isArray((b as { rows?: unknown }).rows) && 'records' in b,

  normalize(body) {
    const b = body as Record<string, unknown> & {
      rows: unknown[];
      records?: unknown;
      page?: unknown;
      rowsPerPage?: unknown;
      colModel?: unknown;
    };
    const out: PageResult<unknown> = {
      list: b.rows ?? [],
      total: toNumber(b.records),
      pageNum: toNumber(b.page, 1),
      pageSize: toNumber(b.rowsPerPage, Array.isArray(b.rows) ? b.rows.length : 15),
    };
    if (Array.isArray(b.colModel)) {
      out.columns = normalizeColModel(b.colModel as Array<Record<string, unknown>>);
    }
    return out;
  },
};

// ─────────────────────────────────────────────────────────────
// ④ 兜底：裸 JSON / 裸标量 / 裸数组
// ─────────────────────────────────────────────────────────────
export const rawAdapter: EnvelopeAdapter = {
  name: 'raw',
  priority: 1000,
  test: () => true,
  normalize: (body) => body,
};

/** ★ 注册表：按 priority 升序尝试 */
export const ENVELOPE_ADAPTERS: EnvelopeAdapter[] = [
  retCodeAdapter,
  restResultAdapter,
  jqGridAdapter,
  rawAdapter,
];

export function resolveAdapter(body: unknown): EnvelopeAdapter {
  return ENVELOPE_ADAPTERS.find((a) => a.test(body)) ?? rawAdapter;
}

// ─────────────────────────────────────────────────────────────
// 工具
// ─────────────────────────────────────────────────────────────

/**
 * 归一化后端老 Page 对象。
 *
 * ⚠️ 待运行时确认：老 Page 类（com.pwsmart.common.persistence.Page）不在工作区
 *    源码里，也不在 common/entity/dao/service 的 sources jar 里，所以字段名
 *    无法从源码确定。这里用多候选兼容 —— 好处是猜错也不崩，代价是不确定
 *    哪个真生效。
 *
 *    确认方法（5 分钟）：Tomcat 起来后，浏览器直接访问
 *      /console/aspanse/md/mdCustomer/mdCustLookUp
 *    看 page 字段的真实结构，然后把下面的候选收窄成一个。
 */
function normalizeLegacyPage(p: Record<string, unknown>): PageResult<unknown> {
  return {
    list: pickArray(p, ['list', 'result', 'rows', 'data']) ?? [],
    total: toNumber(pick(p, ['count', 'total', 'totalCount', 'records'])),
    pageNum: toNumber(pick(p, ['pageNo', 'pageNum', 'page']), 1),
    pageSize: toNumber(pick(p, ['pageSize', 'size', 'limit']), 15),
  };
}

function normalizeColModel(colModel: Array<Record<string, unknown>>): TableColumn[] {
  return colModel.map((c) => ({
    name: String(c.name ?? ''),
    label: typeof c.label === 'string' ? c.label : undefined,
    width: typeof c.width === 'number' ? c.width : undefined,
    hidden: c.hidden === true,
  }));
}

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function pick(o: Record<string, unknown>, keys: string[]): unknown {
  for (const k of keys) {
    if (o[k] !== undefined && o[k] !== null) return o[k];
  }
  return undefined;
}

function pickArray(o: Record<string, unknown>, keys: string[]): unknown[] | undefined {
  for (const k of keys) {
    if (Array.isArray(o[k])) return o[k] as unknown[];
  }
  return undefined;
}

function toNumber(v: unknown, fallback = 0): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}
