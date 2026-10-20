/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** API 基地址。必须是同源相对路径，见 src/api/http.ts 顶部契约说明 */
  readonly VITE_API_BASE: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
