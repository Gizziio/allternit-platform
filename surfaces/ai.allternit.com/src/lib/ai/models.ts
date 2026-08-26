import type { ModelData } from "@/lib/ai/types";
import { models as generatedModels } from "@/lib/ai/models.generated";
import { getProviderMeta } from "@/lib/providers/provider-registry";

const CLI_PROVIDER_IDS = new Set<string>([
  "claude-cli",
  "codex-cli",
  "kimi-cli",
  "qwen-cli",
  "cursor-agent",
  "copilot",
  "opencode",
  "openclaw",
  "hermes",
  "pi",
  "codebuddy",
  "deveco",
  "kiro-cli",
  "qodercli",
  "qoderclicn",
  "qwenpaw",
  "reasonix",
  "traecli",
  "dsh",
  "omp",
  "mcode",
  "dim",
]);

function inferRuntimeType(ownedBy: string): ModelData["runtimeType"] {
  const normalized = ownedBy.toLowerCase();
  if (CLI_PROVIDER_IDS.has(normalized)) return "cli";
  if (
    normalized === "ollama" ||
    normalized === "allternit-local-engine" ||
    normalized === "allternit-sidecar"
  ) {
    return "local";
  }
  return "api";
}

function modelToModelData(m: {
  readonly id: string;
  readonly name: string;
  readonly owned_by: string;
  readonly description: string;
  readonly tags?: readonly string[] | undefined;
}): ModelData {
  const provider = getProviderMeta(m.owned_by);
  const tags = m.tags ?? [];
  return {
    id: m.id,
    name: m.name,
    provider: provider.name,
    description: m.description,
    logo: provider.icon ? `/assets/runtime-logos/${provider.icon}` : undefined,
    runtimeType: inferRuntimeType(m.owned_by),
    modelId: m.id,
    features: {
      reasoning: tags.includes("reasoning"),
      vision: tags.includes("vision"),
      webSearch: tags.includes("web-search"),
      codeExecution: tags.includes("code-execution"),
      fileUpload: tags.includes("file-input"),
    },
  };
}

export const ALL_MODELS: ModelData[] = (generatedModels as readonly {
  readonly id: string;
  readonly name: string;
  readonly owned_by: string;
  readonly description: string;
  readonly tags?: readonly string[] | undefined;
}[]).map(modelToModelData);

export const DEFAULT_MODEL = "anthropic/claude-sonnet-4-20250514";

export function getModelById(id: string): ModelData | undefined {
  return ALL_MODELS.find((m) => m.id === id);
}
