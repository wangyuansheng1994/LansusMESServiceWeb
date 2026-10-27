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

export { compareVersions, getVersionIncompatibility } from './version';

/** 契约与最低后端版本的唯一来源是根 api-contract.json；unknown 提交必须阻断。 */
export const FRONTEND_API_CONTRACT_VERSION: string =
  import.meta.env.VITE_API_CONTRACT_VERSION ?? '0.0.0';
export const FRONTEND_MIN_BACKEND_VERSION: string =
  import.meta.env.VITE_MIN_BACKEND_VERSION ?? '0.0.0';

export function getBackendVersion(): Promise<BackendVersion> {
  return get<BackendVersion>(`${API_V1}/meta/version`);
}
