/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_URL?: string;
  readonly VITE_POLL_INTERVAL?: string;
  readonly VITE_POLL_TIMEOUT?: string;
  readonly VITE_SHOW_NODES?: string;
  readonly VITE_DEBUG_MODE?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
