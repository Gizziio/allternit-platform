import { z } from "zod";

const envSchema = z.object({
  DATABASE_URL: z.string().optional(),
  AUTH_SECRET: z.string().min(1).default("dev-secret-change-in-production-min-32-chars"),
  AUTH_GOOGLE_ID: z.string().optional(),
  AUTH_GOOGLE_SECRET: z.string().optional(),
  AUTH_GITHUB_ID: z.string().optional(),
  AUTH_GITHUB_SECRET: z.string().optional(),
  KERNEL_URL: z.string().url().default("http://127.0.0.1:3004"),
  WEBVM_URL: z.string().url().optional(),
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  VERCEL_URL: z.string().optional(),
  APP_URL: z.string().url().optional(),
  EXA_API_KEY: z.string().optional(),
  FIRECRAWL_API_KEY: z.string().optional(),
  TAVILY_API_KEY: z.string().optional(),
  LANGFUSE_API_KEY: z.string().optional(),
  LANGFUSE_SECRET_KEY: z.string().optional(),
  LANGFUSE_BASE_URL: z.string().url().optional(),
  // Vite client env (must be prefixed with VITE_)
  VITE_APP_URL: z.string().url().default("http://localhost:3013"),
  VITE_KERNEL_URL: z.string().url().default("http://127.0.0.1:3004"),
});

const rawEnv = {
  DATABASE_URL: (import.meta.env as any).DATABASE_URL,
  AUTH_SECRET: (import.meta.env as any).AUTH_SECRET,
  AUTH_GOOGLE_ID: (import.meta.env as any).AUTH_GOOGLE_ID,
  AUTH_GOOGLE_SECRET: (import.meta.env as any).AUTH_GOOGLE_SECRET,
  AUTH_GITHUB_ID: (import.meta.env as any).AUTH_GITHUB_ID,
  AUTH_GITHUB_SECRET: (import.meta.env as any).AUTH_GITHUB_SECRET,
  KERNEL_URL: (import.meta.env as any).KERNEL_URL,
  WEBVM_URL: (import.meta.env as any).WEBVM_URL,
  NODE_ENV: (import.meta.env as any).NODE_ENV,
  VERCEL_URL: (import.meta.env as any).VERCEL_URL,
  APP_URL: (import.meta.env as any).APP_URL,
  EXA_API_KEY: (import.meta.env as any).EXA_API_KEY,
  FIRECRAWL_API_KEY: (import.meta.env as any).FIRECRAWL_API_KEY,
  TAVILY_API_KEY: (import.meta.env as any).TAVILY_API_KEY,
  LANGFUSE_API_KEY: (import.meta.env as any).LANGFUSE_API_KEY,
  LANGFUSE_SECRET_KEY: (import.meta.env as any).LANGFUSE_SECRET_KEY,
  LANGFUSE_BASE_URL: (import.meta.env as any).LANGFUSE_BASE_URL,
  VITE_APP_URL: (import.meta.env as any).VITE_APP_URL,
  VITE_KERNEL_URL: (import.meta.env as any).VITE_KERNEL_URL,
};

const parsed = envSchema.parse(rawEnv);

// Backward-compatible aliases for Next.js → Vite migration
export const env = {
  ...parsed,
  NEXT_PUBLIC_APP_URL: parsed.VITE_APP_URL,
  NEXT_PUBLIC_KERNEL_URL: parsed.VITE_KERNEL_URL,
};
