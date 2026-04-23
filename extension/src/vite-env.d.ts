/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly BRIEFTUBE_PROD?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
