import { ProviderPlugin } from './provider-plugin.js';
import { AnthropicPlugin } from './anthropic-plugin.js';
import { OpenAIPlugin } from './openai-plugin.js';
import type { A2RKernel } from "@a2r/governor";

export interface ModelCapability {
  vision?: boolean;
  tool_use?: boolean;
  reasoning?: boolean;
  context_window: number;
}

export interface ModelProvider {
  id: string; // e.g. "anthropic"
  models: ModelDefinition[];
}

export interface ModelDefinition {
  id: string; // e.g. "claude-3-5-sonnet"
  capabilities: ModelCapability;
  costs: {
    input_1k: number;
    output_1k: number;
  };
}

export interface RoutingRequest {
  intent: string;
  requirements: {
    vision?: boolean;
    reasoning?: boolean;
    min_context?: number;
  };
  budget?: {
    max_cost?: number;
  };
  session_id?: string;
}

export interface RoutingResult {
  provider: string;
  model: string;
  reason: string;
  estimated_cost?: number;
}

export class RouterAdapter {
  private plugins: Map<string, ProviderPlugin> = new Map();
  // @ts-ignore
  private kernel: A2RKernel;
  // @ts-ignore
  private policy: any; // Will load G0200 contract

  constructor(kernel: A2RKernel) {
    this.plugins.set('anthropic', new AnthropicPlugin());
    this.plugins.set('openai', new OpenAIPlugin());
    this.kernel = kernel;
  }

  async loadPolicy(): Promise<void> {
    // In a real impl, this would load from .a2r/artifacts/G0200/router-policy-contract.json
    // via the kernel filesystem access
    this.policy = {
      allowlists: { global: ["claude-3-5-sonnet", "gpt-4o"] }
    };
  }

  async route(request: RoutingRequest): Promise<RoutingResult> {
    // 1. Filter by Capabilities
    // 2. Filter by Allowlist (Policy)
    // 3. Sort by Cost/Performance (Logic)
    
    // Stub implementation for G0201
    if (request.requirements.vision) {
      return {
        provider: "anthropic",
        model: "claude-3-5-sonnet",
        reason: "Best vision capability in allowlist"
      };
    }

    return {
      provider: "anthropic",
      model: "claude-3-5-sonnet", 
      reason: "Default high-performance model"
    };
  }
}
