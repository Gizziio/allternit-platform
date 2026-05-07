/**
 * Browser-safe environment configuration
 * 
 * This is a stub for browser environments where process.env is not available.
 */

export const env = {
  // Server env (not available in browser)
  DATABASE_URL: undefined,
  AUTH_SECRET: undefined,
  AUTH_GOOGLE_ID: undefined,
  AUTH_GOOGLE_SECRET: undefined,
  AUTH_GITHUB_ID: undefined,
  AUTH_GITHUB_SECRET: undefined,
  KERNEL_URL: undefined,
  WEBVM_URL: undefined,
  NODE_ENV: typeof process !== 'undefined' ? process.env.NODE_ENV || 'production' : 'production',
  VERCEL_URL: undefined,
  APP_URL: undefined,
  FIRECRAWL_API_KEY: undefined,
  TAVILY_API_KEY: undefined,
  LANGFUSE_API_KEY: undefined,
  LANGFUSE_SECRET_KEY: undefined,
  LANGFUSE_BASE_URL: undefined,
  
  // Client env
  NEXT_PUBLIC_APP_URL: typeof window !== 'undefined' ? window.location.origin : undefined,
  NEXT_PUBLIC_KERNEL_URL: undefined,
};
