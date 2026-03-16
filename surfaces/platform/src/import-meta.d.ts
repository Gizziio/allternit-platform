interface ImportMetaEnv {
  [key: string]: string | boolean | undefined;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
  readonly glob: <T>(pattern: string) => Record<string, () => Promise<T>>;
}
