export interface ClerkTokenPayload {
  token: string;
  userId: string;
  email: string;
}

declare global {
  interface Window {
    allternitAuth?: {
      onClerkToken: (payload: ClerkTokenPayload) => Promise<void>;
      onClerkError: (message: string) => Promise<void>;
      startOAuth?: (startUrl: string) => Promise<string>;
      onStatus?: (handler: (message: string) => void) => (() => void);
    };
  }
}

export {};
