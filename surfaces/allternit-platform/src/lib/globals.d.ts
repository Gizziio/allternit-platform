export {};

declare global {
  interface Window {
    allternitSidecar?: {
      getStatus?: () => Promise<'stopped' | 'starting' | 'running' | 'error' | 'crashed'>;
      getApiUrl?: () => Promise<string | undefined>;
      getBasicAuth?: () => Promise<{ username: string; password: string; header: string } | undefined>;
      getPersistedConfig?: () => Promise<{ apiUrl: string; password: string; port: number } | null>;
      clearPersistedConfig?: () => Promise<boolean>;
    };
    allternitExtension?: any;
    electron?: {
      fs?: any;
      kernel?: any;
      python?: any;
      browser?: any;
      computerUse?: any;
    };
  }
}
