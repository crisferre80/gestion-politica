/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_MAPBOX_ACCESS_TOKEN: string;
  readonly EMAIL_HOST: string;
  readonly EMAIL_PORT: string;
  readonly EMAIL_USER: string;
  readonly EMAIL_PASSWORD: string;
  readonly EMAIL_SECURE: string;
  readonly EMAIL_FROM: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
