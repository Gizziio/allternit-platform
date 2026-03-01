/**
 * Application configuration
 */
import { env } from "@/lib/env";

export const config = {
  appUrl: env.NEXT_PUBLIC_APP_URL,
  kernelUrl: env.KERNEL_URL,
  nodeEnv: env.NODE_ENV,
  appPrefix: "a2r",
  
  // Model configuration
  models: {
    disabledModels: [] as string[],
    providerOrder: ["openai", "anthropic", "google", "alibaba", "amazon"],
    curatedDefaults: [
      "openai/gpt-5-mini",
      "openai/gpt-5-nano",
      "anthropic/claude-haiku-4.5",
      "google/gemini-2.5-flash-lite",
    ] as string[],
    defaults: {
      image: "openai/dall-e-3" as string,
      followupSuggestions: "google/gemini-2.5-flash-lite" as string,
    },
  },
  
  // Integrations configuration
  integrations: {
    urlRetrieval: true,
    webSearch: true,
    sandbox: true, // Enabled via Docker sandbox
    imageGeneration: true,
    mcp: true,
    agentBrowser: true,
  },
  
  // API Keys (server-side only)
  firecrawlApiKey: process.env.FIRECRAWL_API_KEY,
  tavilyApiKey: process.env.TAVILY_API_KEY,
  
  // Feature flags
  enableWebSearch: true, // Now using A2R Operator instead of external APIs
  enableCodeExecution: true, // Enabled via Docker/WebAssembly sandbox
};

export default config;
