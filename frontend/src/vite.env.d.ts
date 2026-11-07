/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_CARTO_API_KEY: string;
  // add any other VITE_ variables you create here
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}