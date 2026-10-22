/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** API 基地址。必须是同源相对路径，见 src/api/http.ts 顶部契约说明 */
  readonly VITE_API_BASE: string;
  /** 契约版本号。构建期经 vite define 注入，单一来源：vite.config.ts 的 API_CONTRACT_VERSION */
  readonly VITE_API_CONTRACT_VERSION: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
