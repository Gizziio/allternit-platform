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
  extensionApiKey?: string;
  extensionBaseUrl?: string;
  extensionModel?: string;
  extensionMaxSteps?: number | null;
  extensionSystemInstruction?: string;
  extensionExperimentalLlmsTxt?: boolean;
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
  return {
    apiKey: source.extensionApiKey,
    baseURL: source.extensionBaseUrl,
    model: source.extensionModel,
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

  return [
    config.apiKey,
    config.baseURL,
    config.model,
    config.language,
    config.maxSteps,
    config.systemInstruction,
  ].some((value) => value !== undefined) || typeof config.experimentalLlmsTxt === "boolean";
}
