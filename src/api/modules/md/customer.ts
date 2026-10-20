/**
 * 客户（BaseMdCustomer）接口 —— 复用老后端已有的 JSON 接口，零后端改动。
 *
 * 这是本 Demo 唯一真实可调的接口，选自：
 *   BaseMdCustomerController.mdCustLookUp
 *
 * 后端签名（console/.../mes/md/customer/BaseMdCustomerController.java:127）：
 *   @RequestMapping(value = "mdCustLookUp")
 *   @ResponseBody
 *   public JSONObject mdCustLookUp(BaseMdCustomer baseMdCustomer, String custType, ...) {
 *       baseMdCustomer.setActiveFlag("Y");
 *       Page<BaseMdCustomer> page = mdCustomerService.getPage(new Page<>(request, response), baseMdCustomer);
 *       JSONObject resultMap = new JSONObject();
 *       resultMap.put("retCode", "0");
 *       resultMap.put("retMsg", "Success");
 *       resultMap.put("page", page);     // ★ 分页对象整体塞在 page 字段
 *       return resultMap;
 *   }
 *
 * 注意两点：
 *  ① 它是"客户选择器"（LookUp）接口，路径在 mdCustomer 下而非 customer 下
 *  ② 返回信封是 { retCode, retMsg, page }，由 adapters.ts 的 retCodeAdapter 处理
 */
import { get } from '@/api/request';
import type { PageResult } from '@/api/types';

export interface MdCustomer {
  rowId: string;
  custCode?: string;
  custName?: string;
  custType?: string;
  activeFlag?: string;
  [key: string]: unknown;
}

export interface MdCustomerQuery {
  /** 模糊查询字段名待运行时确认（Page 从 request 取分页参数） */
  custCode?: string;
  custName?: string;
  custType?: string;
  pageNo?: number;
  pageSize?: number;
}

const BASE = '/aspanse/md/mdCustomer';

export const mdCustomerApi = {
  /**
   * 客户查询（真接口，可直接跑通）
   *
   * lane: 搜索场景只保留最后一次请求，避免快速输入时请求风暴 + 竞态
   */
  lookup: (q: MdCustomerQuery, signal?: AbortSignal) =>
    get<PageResult<MdCustomer>>(`${BASE}/mdCustLookUp`, q, {
      signal,
      lane: 'md-customer-lookup',
    }),

  /**
   * 慢接口示例：给导出/报表类接口单独放宽超时。
   * 这个项目连 Maven 构建都要十几分钟，报表只会更慢 ——
   * 全局 60s 超时对这类接口是错的。
   */
  slowProbe: (q: MdCustomerQuery) =>
    get<PageResult<MdCustomer>>(`${BASE}/mdCustLookUp`, q, {
      timeout: 300_000,
    }),
};
