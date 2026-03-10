export interface ModelDefinition {
  id: string; // Canonical stable ID e.g. gizzi.anthropic.sonnet
  provider: string;
  providerModelIds: string[]; // List of IDs/aliases supported by provider
  name: string;
  capabilities: {
    vision: boolean;
    toolUse: boolean;
    contextWindow: number;
  };
  maxOutputTokens: number;
  costTier: "free" | "base" | "pro" | "enterprise";
  rank: number; // Higher is better within same tier/class
}

export const ModelCatalog: ModelDefinition[] = [
  {
    id: "gizzi.anthropic.sonnet",
    provider: "anthropic",
    providerModelIds: ["claude-3-5-sonnet-latest", "claude-3-5-sonnet-20241022"],
    name: "Claude 3.5 Sonnet",
    capabilities: { vision: true, toolUse: true, contextWindow: 200000 },
    maxOutputTokens: 8192,
    costTier: "pro",
    rank: 100
  },
  {
    id: "gizzi.openai.gpt-4o",
    provider: "openai",
    providerModelIds: ["gpt-4o", "gpt-4o-2024-08-06"],
    name: "GPT-4o",
    capabilities: { vision: true, toolUse: true, contextWindow: 128000 },
    maxOutputTokens: 4096,
    costTier: "pro",
    rank: 90
  },
  {
    id: "gizzi.google.gemini-pro",
    provider: "google",
    providerModelIds: ["gemini-1.5-pro", "gemini-1.5-pro-latest"],
    name: "Gemini 1.5 Pro",
    capabilities: { vision: true, toolUse: true, contextWindow: 1000000 },
    maxOutputTokens: 8192,
    costTier: "pro",
    rank: 80
  }
];

export function getCanonicalModel(id: string): ModelDefinition | undefined {
  return ModelCatalog.find(m => m.id === id);
}
