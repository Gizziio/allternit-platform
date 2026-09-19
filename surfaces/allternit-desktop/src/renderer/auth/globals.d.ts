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
      onStatus?: (handler: (message: string) => void) => (() => void);
    };
  }
}

export {};
