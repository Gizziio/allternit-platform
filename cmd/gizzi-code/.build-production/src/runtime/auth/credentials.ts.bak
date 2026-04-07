export type AuthMethod = 
  | "api_key" 
  | "oauth" 
  | "oauth_pkce" 
  | "service_account" 
  | "enterprise_proxy" 
  | "adc";

export interface Credential {
  id: string; // Unique fingerprint for this specific credential
  provider: string;
  method: AuthMethod;
  value: string; // API key or token
  expiresAt?: number;
  metadata?: Record<string, any>; // e.g. orgId, userId
}

export interface AuthStatus {
  connected: boolean;
  provider: string;
  user?: string;
  credentialId?: string;
}
