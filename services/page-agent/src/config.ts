/**
 * Page-agent configuration schema.
 *
 * Shared between the browser extension, desktop surface, and API proxy.
 */

export interface PageAgentBridgeConfig {
  apiKey?: string;
  baseURL?: string;
  model?: string;
  language?: "en-US" | "zh-CN" | null;
  maxSteps?: number | null;
  systemInstruction?: string | null;
  experimentalLlmsTxt?: boolean;
}

export interface BrowserPageAgentConfigSource {
  language?: string;
  /** @deprecated Extension API keys are not a brain. Use Gizzi runtime selection. */
  extensionApiKey?: string;
  extensionBaseUrl?: string;
  extensionModel?: string;
  extensionMaxSteps?: number | null;
  extensionSystemInstruction?: string;
  extensionExperimentalLlmsTxt?: boolean;
  gizziProviderId?: string;
  gizziModelId?: string;
}

export function normalizePageAgentLanguage(
  language?: string,
): PageAgentBridgeConfig["language"] {
  if (language === "zh" || language === "zh-CN") return "zh-CN";
  if (language === "en" || language === "en-US") return "en-US";
  if (language === "system" || language === "") return null;
  return undefined;
}

export function buildPageAgentBridgeConfig(
  source: BrowserPageAgentConfigSource,
): PageAgentBridgeConfig {
  const gizziModel =
    source.gizziProviderId && source.gizziModelId
      ? `${source.gizziProviderId}/${source.gizziModelId}`
      : source.extensionModel;

  return {
    // Never copy an extension API key into the brain. Gizzi owns credentials.
    model: gizziModel,
    language: normalizePageAgentLanguage(source.language),
    maxSteps: source.extensionMaxSteps ?? null,
    systemInstruction:
      source.extensionSystemInstruction && source.extensionSystemInstruction.length > 0
        ? source.extensionSystemInstruction
        : null,
    experimentalLlmsTxt: source.extensionExperimentalLlmsTxt ?? false,
  };
}

export function hasPageAgentBridgeConfig(
  config: PageAgentBridgeConfig | null | undefined,
): config is PageAgentBridgeConfig {
  if (!config) return false;

  return (
    [
      config.model,
      config.language,
      config.maxSteps,
      config.systemInstruction,
    ].some((value) => value !== undefined && value !== null) ||
    typeof config.experimentalLlmsTxt === "boolean"
  );
}
