interface ImportMetaEnv {
  readonly VITE_HOUSOU_URL?: string
  readonly VITE_HOUSOU_PORT?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
