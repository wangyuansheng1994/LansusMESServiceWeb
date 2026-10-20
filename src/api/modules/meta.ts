/**
 * 后端版本契约接口（后端 MetaApiController）。
 *
 * GET ${adminPath}/api/v1/meta/version → RestResult<BackendVersion>
 * 与构建产物 version.json 的 apiContractVersion 必须一致（方案 v3.1 §4.7）。
 */
import { get } from '@/api/request';

export interface BackendVersion {
  backendVersion: string;
  backendCommit: string;
  apiContractVersion: string;
}

/** 前端构建时随 version.json 一起产出的契约版本（vite.config.ts 内同名常量） */
export const FRONTEND_API_CONTRACT_VERSION = '1.0.0';

export function getBackendVersion(): Promise<BackendVersion> {
  return get<BackendVersion>('/aspanse/api/v1/meta/version');
}
