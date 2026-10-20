/**
 * 适配器说明数据 —— 供界面上展示，避免后人接手时误删或改坏顺序。
 * 与 adapters.ts 的注册表保持一致。
 */
export interface AdapterDoc {
  name: string;
  priority: number;
  test: string;
  source: string;
  normalize: string;
}

export const ADAPTERS_DOC: AdapterDoc[] = [
  {
    name: 'retCodeAdapter',
    priority: 10,
    test: `'retCode' in body && ('retMsg' in body || 'page' in body || 'data' in body)`,
    source:
      'BaseMdCustomerController.mdCustLookUp（console/.../mes/md/customer/BaseMdCustomerController.java:127）',
    normalize:
      'retCode==="0" 视为成功；page 字段拆出来归一化为 PageResult。这是本 Demo 用的接口。',
  },
  {
    name: 'restResultAdapter',
    priority: 20,
    test: `typeof body.result === 'boolean'`,
    source:
      'entity 模块自带的 com.pwsmart.entity.base.util.RestResult<T>，被 WmsInventoryController / PmRepairController / LotController / InvController 等使用',
    normalize: 'result===true 返回 data，否则抛业务错误并带上 code/msg',
  },
  {
    name: 'jqGridAdapter',
    priority: 30,
    test: `Array.isArray(body.rows) && 'records' in body`,
    source: 'jqGrid 经典分页格式（老列表页大量使用）',
    normalize: 'rows→list，records→total，顺带把 colModel 转成 columns',
  },
  {
    name: 'rawAdapter',
    priority: 1000,
    test: '恒为 true（兜底）',
    source:
      '大量 @ResponseBody 直接返回 List/Map/实体；甚至包括 WmsInventoryController:654 的 `return restResult.getResult() ? "Y" : "N";` 这种裸字符串标量',
    normalize: '原样返回。裸字符串在 request.ts 里被 safeJson 判定后直接透传',
  },
];
