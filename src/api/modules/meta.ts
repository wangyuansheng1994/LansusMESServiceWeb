/**
 * 后端版本契约接口（后端 MetaApiController）。
 *
 * GET ${adminPath}/api/v1/meta/version → RestResult<BackendVersion>
 * 与构建产物 version.json 的 apiContractVersion 必须一致（方案 v3.1 §4.7）。
 */
import { get } from '@/api/request';
import { API_V1 } from '@/api/config';

export interface BackendVersion {
  backendVersion: string;
  backendCommit: string;
  apiContractVersion: string;
  /** 老登录页标题 ${pw:getConfig('productName')} 的同源配置值 */
  productName?: string | null;
}

/** 前端契约版本——单一来源是 vite.config.ts 的 API_CONTRACT_VERSION（经 define 注入），勿另写常量 */
export const FRONTEND_API_CONTRACT_VERSION: string =
  import.meta.env.VITE_API_CONTRACT_VERSION ?? '1.0.0';

export function getBackendVersion(): Promise<BackendVersion> {
  return get<BackendVersion>(`${API_V1}/meta/version`);
}
