import { ModelDefinition } from "./router-adapter.js";

export interface ProviderPlugin {
  id: string; // e.g. "anthropic"
  name: string;
  
  initialize(config: Record<string, any>): Promise<void>;
  listModels(): Promise<ModelDefinition[]>;
  
  generate(modelId: string, prompt: string, options?: any): Promise<ProviderResponse>;
  stream(modelId: string, prompt: string, options?: any): AsyncIterable<ProviderChunk>;
}

export interface ProviderResponse {
  content: string;
  usage: {
    input_tokens: number;
    output_tokens: number;
  };
  metadata?: Record<string, any>;
}

export interface ProviderChunk {
  delta: string;
  stop_reason?: string | null;
}
