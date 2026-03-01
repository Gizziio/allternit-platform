import { createEnv } from "@t3-oss/env-nextjs";
import { z } from "zod";

export const env = createEnv({
  server: {
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
    // External API Keys
    FIRECRAWL_API_KEY: z.string().optional(),
    TAVILY_API_KEY: z.string().optional(),
    LANGFUSE_API_KEY: z.string().optional(),
    LANGFUSE_SECRET_KEY: z.string().optional(),
    LANGFUSE_BASE_URL: z.string().url().optional(),
  },
  client: {
    NEXT_PUBLIC_APP_URL: z.string().url().default("http://localhost:3000"),
    NEXT_PUBLIC_KERNEL_URL: z.string().url().default("http://127.0.0.1:3004"),
  },
  runtimeEnv: {
    DATABASE_URL: process.env.DATABASE_URL,
    AUTH_SECRET: process.env.AUTH_SECRET,
    AUTH_GOOGLE_ID: process.env.AUTH_GOOGLE_ID,
    AUTH_GOOGLE_SECRET: process.env.AUTH_GOOGLE_SECRET,
    AUTH_GITHUB_ID: process.env.AUTH_GITHUB_ID,
    AUTH_GITHUB_SECRET: process.env.AUTH_GITHUB_SECRET,
    KERNEL_URL: process.env.KERNEL_URL,
    WEBVM_URL: process.env.WEBVM_URL,
    NODE_ENV: process.env.NODE_ENV,
    VERCEL_URL: process.env.VERCEL_URL,
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
    APP_URL: process.env.APP_URL,
    NEXT_PUBLIC_KERNEL_URL: process.env.NEXT_PUBLIC_KERNEL_URL,
    FIRECRAWL_API_KEY: process.env.FIRECRAWL_API_KEY,
    TAVILY_API_KEY: process.env.TAVILY_API_KEY,
    LANGFUSE_API_KEY: process.env.LANGFUSE_API_KEY,
    LANGFUSE_SECRET_KEY: process.env.LANGFUSE_SECRET_KEY,
    LANGFUSE_BASE_URL: process.env.LANGFUSE_BASE_URL,
  },
});
