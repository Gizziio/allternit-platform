/**
 * AIModel - Local interface to erase AI SDK types.
 *
 * Implements LAW-TSC-002: Type Boundary Erasing.
 * This prevents @ai-sdk/provider types from leaking past the service layer.
 */

export interface AIModel {
  id: string;
  providerID: string;
  api: {
    id: string;
    url: string;
    npm: string;
  };
  // Simplified capability and cost info can be added here if needed,
  // but the goal is to provide a clean interface for callers.
}

/**
 * Type-erased language model.
 * At the boundary, we cast the SDK's LanguageModelV2 to this opaque type.
 */
export type LanguageModel = {
  readonly specificationVersion: "v1";
  readonly modelId: string;
  readonly provider: string;
} & Record<string, any>;

export interface ModelSetting {
  model?: string
  provider?: string
}

export type NullableModelSetting = ModelSetting | null | undefined
