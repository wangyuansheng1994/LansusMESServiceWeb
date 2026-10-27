/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** API 基地址。必须是同源相对路径，见 src/api/http.ts 顶部契约说明 */
  readonly VITE_API_BASE: string;
  /** 契约与最低后端版本，构建期从根 api-contract.json 注入 */
  readonly VITE_API_CONTRACT_VERSION: string;
  readonly VITE_MIN_BACKEND_VERSION: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
