# ProviderAdapter Interface Specification

**Version:** 1.0  
**Date:** March 6, 2026  
**Status:** Draft

---

## Overview

This document specifies the `ProviderAdapter` interface — the **only** allowed abstraction for interacting with AI providers in Gizzi-Code.

All provider-specific logic (Anthropic, OpenAI, Google, etc.) must be implemented behind this interface.

---

## Design Principles

1. **Provider Agnostic:** Runtime code should not know which provider is being used
2. **Streaming First:** All providers support streaming; interface reflects this
3. **Auth Abstraction:** Auth is provider-specific but accessed uniformly
4. **Model Discovery:** Providers expose their models dynamically
5. **Error Handling:** Errors are normalized across providers
6. **Type Safe:** Full TypeScript types for all operations

---

## Core Interface

### ProviderAdapter

```typescript
// cmd/gizzi-code/src/runtime/providers/types.ts

/**
 * ProviderAdapter is the unified interface for all AI providers.
 * 
 * All provider-specific logic must be implemented behind this interface.
 * No code outside runtime/providers/*/ should import provider SDKs directly.
 */
export interface ProviderAdapter {
  /**
   * Provider identifier
   * @example "anthropic", "openai", "google", "qwen", "kimi"
   */
  readonly id: ProviderId;
  
  /**
   * Human-readable provider name
   * @example "Anthropic", "OpenAI", "Google"
   */
  readonly name: string;
  
  /**
   * Authentication operations
   */
  readonly auth: ProviderAuth;
  
  /**
   * Model discovery and resolution
   */
  readonly models: ModelCatalog;
  
  /**
   * Chat completion (streaming and non-streaming)
   */
  readonly chat: ChatInterface;
  
  /**
   * Optional: Embeddings (if supported by provider)
   */
  readonly embeddings?: EmbeddingsInterface;
  
  /**
   * Optional: Image generation (if supported by provider)
   */
  readonly images?: ImagesInterface;
}
```

### ProviderId

```typescript
export type ProviderId = 
  | "anthropic"
  | "openai"
  | "google"
  | "qwen"
  | "kimi"
  | "bedrock"
  | "vertex"
  | "azure";
```

---

## Authentication

### ProviderAuth

```typescript
export interface ProviderAuth {
  /**
   * Connect to provider with credentials
   * 
   * @param input - Provider-specific credentials (API key, OAuth token, etc.)
   * @throws {AuthError} if credentials are invalid
   */
  connect(input?: AuthInput): Promise<void>;
  
  /**
   * Get current authentication status
   */
  status(): Promise<AuthStatus>;
  
  /**
   * Refresh credentials (for OAuth tokens that expire)
   * 
   * @throws {AuthError} if refresh fails
   */
  refresh(): Promise<void>;
  
  /**
   * Disconnect and clear stored credentials
   */
  disconnect(): Promise<void>;
}
```

### AuthInput

```typescript
/**
 * Provider-specific authentication input
 * 
 * Union type - each provider implements only what it needs
 */
export type AuthInput = 
  | { type: "api-key"; apiKey: string }
  | { type: "oauth"; accessToken: string; refreshToken?: string }
  | { type: "service-account"; credentials: Record<string, string> }
  | { type: "environment" }; // Use env vars
```

### AuthStatus

```typescript
export interface AuthStatus {
  /**
   * Whether currently authenticated
   */
  authenticated: boolean;
  
  /**
   * Auth method used
   */
  type?: AuthType;
  
  /**
   * When credentials expire (if applicable)
   */
  expiresAt?: Date;
  
  /**
   * OAuth scopes (if applicable)
   */
  scopes?: string[];
  
  /**
   * User/account identifier
   */
  userId?: string;
  
  /**
   * Organization/team identifier
   */
  organizationId?: string;
}

export type AuthType = 
  | "api-key"
  | "oauth"
  | "service-account"
  | "enterprise-proxy";
```

---

## Model Discovery

### ModelCatalog

```typescript
export interface ModelCatalog {
  /**
   * List all available models from provider
   * 
   * @throws {ProviderError} if provider API fails
   */
  list(): Promise<DiscoveredModel[]>;
  
  /**
   * Get canonical ID for a provider-specific model ID
   * 
   * Maps provider model strings to Gizzi canonical IDs.
   * 
   * @example
   * getCanonicalId("claude-sonnet-4-20250514") 
   *   → "gizzi.anthropic.sonnet"
   * getCanonicalId("gpt-4o-2024-05-13")
   *   → "gizzi.openai.gpt-4o"
   */
  getCanonicalId(providerModelId: string): string;
  
  /**
   * Resolve a canonical ID back to provider-specific ID
   * 
   * @example
   * resolveCanonicalId("gizzi.anthropic.sonnet")
   *   → "claude-sonnet-4-20250514"
   */
  resolveCanonicalId(canonicalId: string): string;
  
  /**
   * Get model by canonical ID
   */
  get(canonicalId: string): Promise<DiscoveredModel | null>;
}
```

### DiscoveredModel

```typescript
export interface DiscoveredModel {
  /**
   * Provider-specific model ID
   * @example "claude-sonnet-4-20250514"
   */
  id: string;
  
  /**
   * Gizzi canonical model ID
   * @example "gizzi.anthropic.sonnet"
   */
  canonicalId: string;
  
  /**
   * Human-readable model name
   * @example "Claude Sonnet 4"
   */
  name: string;
  
  /**
   * Model capabilities
   */
  capabilities: ModelCapabilities;
  
  /**
   * Context window size (tokens)
   */
  contextWindow: number;
  
  /**
   * Pricing information (if available)
   */
  pricing?: ModelPricing;
  
  /**
   * Whether model is currently available
   */
  available: boolean;
  
  /**
   * Model deprecation date (if applicable)
   */
  deprecationDate?: Date;
}
```

### ModelCapabilities

```typescript
export interface ModelCapabilities {
  /**
   * Supports text input/output
   */
  text: boolean;
  
  /**
   * Supports tool/function calling
   */
  tools: boolean;
  
  /**
   * Supports image input
   */
  vision: boolean;
  
  /**
   * Supports audio input/output
   */
  audio: boolean;
  
  /**
   * Maximum output tokens
   */
  maxOutputTokens: number;
  
  /**
   * Supported tool schemas
   */
  toolSchemas?: string[];
}
```

### ModelPricing

```typescript
export interface ModelPricing {
  /**
   * Price per 1M input tokens (USD)
   */
  inputTokens: number;
  
  /**
   * Price per 1M output tokens (USD)
   */
  outputTokens: number;
  
  /**
   * Price per 1M cached tokens (if applicable)
   */
  cachedTokens?: number;
  
  /**
   * Pricing tier (for display purposes)
   */
  tier?: "economy" | "standard" | "premium" | "ultra";
}
```

---

## Chat Interface

### ChatInterface

```typescript
export interface ChatInterface {
  /**
   * Stream a chat completion
   * 
   * Yields events as they arrive from provider.
   * 
   * @example
   * for await (const event of provider.chat.stream(request)) {
   *   if (event.type === "text-delta") {
   *     console.log(event.textDelta);
   *   } else if (event.type === "tool-call") {
   *     await handleToolCall(event);
   *   }
   * }
   */
  stream(request: ChatRequest): AsyncIterable<ProviderEvent>;
  
  /**
   * Non-streaming chat completion
   * 
   * Waits for complete response before returning.
   */
  complete(request: ChatRequest): Promise<ChatResponse>;
}
```

### ChatRequest

```typescript
export interface ChatRequest {
  /**
   * Model to use (canonical ID or provider-specific ID)
   * @example "gizzi.anthropic.sonnet" or "claude-sonnet-4-20250514"
   */
  model: string;
  
  /**
   * Messages in conversation
   */
  messages: Message[];
  
  /**
   * Available tools (if any)
   */
  tools?: Tool[];
  
  /**
   * Tool choice strategy
   * @default "auto"
   */
  toolChoice?: ToolChoice;
  
  /**
   * Maximum tokens to generate
   */
  maxTokens?: number;
  
  /**
   * Temperature (0-2)
   * @default 1.0
   */
  temperature?: number;
  
  /**
   * Top-p sampling
   */
  topP?: number;
  
  /**
   * Top-k sampling
   */
  topK?: number;
  
  /**
   * Stop sequences
   */
  stopSequences?: string[];
  
  /**
   * System prompt (if provider supports it)
   */
  system?: string;
  
  /**
   * Request metadata (for tracing, etc.)
   */
  metadata?: Record<string, string>;
}
```

### Message

```typescript
export type Message = 
  | UserMessage
  | AssistantMessage
  | ToolMessage
  | SystemMessage;

export interface UserMessage {
  role: "user";
  content: string | ContentBlock[];
}

export interface AssistantMessage {
  role: "assistant";
  content: string | ContentBlock[];
  toolCalls?: ToolCall[];
}

export interface ToolMessage {
  role: "tool";
  toolCallId: string;
  content: string;
  isError?: boolean;
}

export interface SystemMessage {
  role: "system";
  content: string;
}

export type ContentBlock = 
  | { type: "text"; text: string }
  | { type: "image"; data: string; mimeType: string }
  | { type: "tool-result"; toolCallId: string; result: unknown };
```

### Tool

```typescript
export interface Tool {
  /**
   * Unique tool identifier
   */
  id: string;
  
  /**
   * Tool name (as called by model)
   */
  name: string;
  
  /**
   * Tool description
   */
  description: string;
  
  /**
   * JSON Schema for tool parameters
   */
  parameters: JsonSchema;
}

export interface JsonSchema {
  type: string;
  properties?: Record<string, JsonSchema>;
  required?: string[];
  additionalProperties?: boolean;
  [key: string]: unknown;
}

export type ToolChoice = 
  | "auto"      // Model decides
  | "none"      // No tools allowed
  | "required"  // Must use a tool
  | { type: "tool"; toolId: string }; // Force specific tool
```

### ProviderEvent (Streaming)

```typescript
/**
 * Events emitted during streaming
 */
export type ProviderEvent =
  | TextDeltaEvent
  | ToolCallEvent
  | ToolResultEvent
  | FinishEvent
  | ErrorEvent
  | MetadataEvent;

export interface TextDeltaEvent {
  type: "text-delta";
  /**
   * Incremental text to append
   */
  textDelta: string;
}

export interface ToolCallEvent {
  type: "tool-call";
  /**
   * Unique tool call identifier
   */
  toolCallId: string;
  /**
   * Tool name
   */
  name: string;
  /**
   * Tool arguments (may be partial during streaming)
   */
  args: unknown;
  /**
   * Whether tool call is complete
   */
  isComplete?: boolean;
}

export interface ToolResultEvent {
  type: "tool-result";
  toolCallId: string;
  result: unknown;
}

export interface FinishEvent {
  type: "finish";
  /**
   * Why generation finished
   */
  finishReason: FinishReason;
  /**
   * Token usage
   */
  usage: TokenUsage;
  /**
   * Model fingerprint (for reproducibility)
   */
  modelFingerprint?: string;
}

export interface ErrorEvent {
  type: "error";
  error: Error;
  isRetryable?: boolean;
}

export interface MetadataEvent {
  type: "metadata";
  /**
   * Provider-specific metadata
   */
  metadata: Record<string, unknown>;
}

export type FinishReason = 
  | "stop"           // Natural stopping point
  | "length"         // Max tokens reached
  | "tool-calls"     // Tools requested
  | "content-filter" // Content policy violation
  | "error"          // Error occurred
  | "unknown";

export interface TokenUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  cachedTokens?: number;
}
```

### ChatResponse (Non-Streaming)

```typescript
export interface ChatResponse {
  /**
   * Generated text content
   */
  text: string;
  
  /**
   * Tool calls (if any)
   */
  toolCalls: ToolCall[];
  
  /**
   * Token usage
   */
  usage: TokenUsage;
  
  /**
   * Why generation finished
   */
  finishReason: FinishReason;
  
  /**
   * Model used (provider-specific ID)
   */
  model: string;
  
  /**
   * Provider-specific metadata
   */
  metadata?: Record<string, unknown>;
}

export interface ToolCall {
  id: string;
  name: string;
  args: unknown;
}
```

---

## Error Handling

### ProviderError

```typescript
/**
 * Base error for all provider-related errors
 */
export class ProviderError extends Error {
  constructor(
    message: string,
    public readonly provider: ProviderId,
    public readonly cause?: unknown,
    public readonly isRetryable: boolean = false,
  ) {
    super(message);
    this.name = "ProviderError";
  }
}

/**
 * Authentication failed
 */
export class AuthError extends ProviderError {
  constructor(
    message: string,
    provider: ProviderId,
    cause?: unknown,
  ) {
    super(message, provider, cause, false);
    this.name = "AuthError";
  }
}

/**
 * Rate limit exceeded
 */
export class RateLimitError extends ProviderError {
  constructor(
    message: string,
    provider: ProviderId,
    cause?: unknown,
    public readonly retryAfter?: number, // seconds
  ) {
    super(message, provider, cause, true);
    this.name = "RateLimitError";
  }
}

/**
 * Model not found or unavailable
 */
export class ModelNotFoundError extends ProviderError {
  constructor(
    message: string,
    provider: ProviderId,
    public readonly modelId: string,
  ) {
    super(message, provider, undefined, false);
    this.name = "ModelNotFoundError";
  }
}

/**
 * Content policy violation
 */
export class ContentFilterError extends ProviderError {
  constructor(
    message: string,
    provider: ProviderId,
    cause?: unknown,
    public readonly reason?: string,
  ) {
    super(message, provider, cause, false);
    this.name = "ContentFilterError";
  }
}
```

---

## Implementation Example: AnthropicAdapter

```typescript
// cmd/gizzi-code/src/runtime/providers/anthropic/adapter.ts

import Anthropic from "@anthropic-ai/sdk";
import type {
  ProviderAdapter,
  ProviderId,
  ProviderAuth,
  ModelCatalog,
  ChatInterface,
  ChatRequest,
  ProviderEvent,
  ChatResponse,
  AuthInput,
  AuthStatus,
  DiscoveredModel,
} from "../types";
import {
  AuthError,
  RateLimitError,
  ModelNotFoundError,
  ContentFilterError,
} from "../errors";
import { AuthStore } from "@/runtime/auth/store";

export class AnthropicAdapter implements ProviderAdapter {
  readonly id: ProviderId = "anthropic";
  readonly name = "Anthropic";
  
  constructor(private authStore: AuthStore) {}
  
  private async getClient(): Promise<Anthropic> {
    const credentials = await this.authStore.getCredentials("anthropic");
    if (!credentials?.apiKey) {
      throw new AuthError("No API key found", "anthropic");
    }
    return new Anthropic({ apiKey: credentials.apiKey });
  }
  
  readonly auth: ProviderAuth = {
    connect: async (input?: AuthInput) => {
      const apiKey = input?.type === "api-key" 
        ? input.apiKey 
        : process.env.ANTHROPIC_API_KEY;
      
      if (!apiKey) {
        throw new AuthError("API key required", "anthropic");
      }
      
      await this.authStore.setCredentials("anthropic", {
        type: "api-key",
        apiKey,
      });
    },
    
    status: async (): Promise<AuthStatus> => {
      const credentials = await this.authStore.getCredentials("anthropic");
      return {
        authenticated: !!credentials?.apiKey,
        type: "api-key",
      };
    },
    
    refresh: async () => {
      // API keys don't expire
    },
    
    disconnect: async () => {
      await this.authStore.clearCredentials("anthropic");
    },
  };
  
  readonly models: ModelCatalog = {
    list: async (): Promise<DiscoveredModel[]> => {
      try {
        const client = await this.getClient();
        const response = await client.models.list();
        
        return response.data.map(model => ({
          id: model.id,
          canonicalId: this.models.getCanonicalId(model.id),
          name: model.display_name ?? model.id,
          capabilities: {
            text: true,
            tools: model.capabilities?.tools === true,
            vision: model.capabilities?.image_input === true,
            audio: false,
            maxOutputTokens: 4096, // Default, may vary by model
          },
          contextWindow: model.context_window,
          pricing: {
            inputTokens: model.pricing?.input_tokens ?? 0,
            outputTokens: model.pricing?.output_tokens ?? 0,
            tier: this.getPricingTier(model.id),
          },
          available: true,
        }));
      } catch (error) {
        throw this.wrapError(error);
      }
    },
    
    getCanonicalId: (providerModelId: string): string => {
      // Map Anthropic model IDs to Gizzi canonical IDs
      const mapping: Record<string, string> = {
        "claude-sonnet": "gizzi.anthropic.sonnet",
        "claude-opus": "gizzi.anthropic.opus",
        "claude-haiku": "gizzi.anthropic.haiku",
      };
      
      for (const [key, canonical] of Object.entries(mapping)) {
        if (providerModelId.includes(key)) {
          return canonical;
        }
      }
      
      return `gizzi.anthropic.${providerModelId}`;
    },
    
    resolveCanonicalId: (canonicalId: string): string => {
      // Reverse mapping
      const mapping: Record<string, string> = {
        "gizzi.anthropic.sonnet": "claude-sonnet-4-20250514",
        "gizzi.anthropic.opus": "claude-opus-20240229",
        "gizzi.anthropic.haiku": "claude-haiku-20240307",
      };
      
      return mapping[canonicalId] ?? canonicalId.replace("gizzi.anthropic.", "");
    },
    
    get: async (canonicalId: string): Promise<DiscoveredModel | null> => {
      const models = await this.models.list();
      return models.find(m => m.canonicalId === canonicalId) ?? null;
    },
  };
  
  readonly chat: ChatInterface = {
    stream: async function* (req: ChatRequest): AsyncIterable<ProviderEvent> {
      try {
        const client = await this.getClient();
        const providerModelId = this.models.resolveCanonicalId(req.model);
        
        const stream = client.messages.stream({
          model: providerModelId,
          messages: this.mapMessages(req.messages),
          tools: req.tools?.map(t => this.mapTool(t)),
          tool_choice: this.mapToolChoice(req.toolChoice),
          max_tokens: req.maxTokens ?? 4096,
          temperature: req.temperature,
          top_p: req.topP,
          top_k: req.topK,
          stop_sequences: req.stopSequences,
          system: req.system,
        });
        
        for await (const event of stream) {
          if (event.type === "content_block_delta") {
            if (event.delta.type === "text_delta") {
              yield {
                type: "text-delta",
                textDelta: event.delta.text,
              };
            }
          } else if (event.type === "content_block_start") {
            if (event.content_block.type === "tool_use") {
              yield {
                type: "tool-call",
                toolCallId: event.content_block.id,
                name: event.content_block.name,
                args: event.content_block.input,
                isComplete: false,
              };
            }
          } else if (event.type === "content_block_stop") {
            if (event.content_block?.type === "tool_use") {
              yield {
                type: "tool-call",
                toolCallId: event.content_block.id,
                name: event.content_block.name,
                args: event.content_block.input,
                isComplete: true,
              };
            }
          } else if (event.type === "message_delta") {
            yield {
              type: "finish",
              finishReason: this.mapFinishReason(event.delta.stop_reason),
              usage: {
                promptTokens: event.usage?.input_tokens ?? 0,
                completionTokens: event.usage?.output_tokens ?? 0,
                totalTokens: (event.usage?.input_tokens ?? 0) + (event.usage?.output_tokens ?? 0),
              },
            };
          }
        }
      } catch (error) {
        yield {
          type: "error",
          error: this.wrapError(error),
        };
      }
    },
    
    complete: async (req: ChatRequest): Promise<ChatResponse> => {
      try {
        const client = await this.getClient();
        const providerModelId = this.models.resolveCanonicalId(req.model);
        
        const response = await client.messages.create({
          model: providerModelId,
          messages: this.mapMessages(req.messages),
          tools: req.tools?.map(t => this.mapTool(t)),
          tool_choice: this.mapToolChoice(req.toolChoice),
          max_tokens: req.maxTokens ?? 4096,
          temperature: req.temperature,
          top_p: req.topP,
          top_k: req.topK,
          stop_sequences: req.stopSequences,
          system: req.system,
        });
        
        const textBlock = response.content.find(c => c.type === "text");
        const toolBlocks = response.content.filter(c => c.type === "tool_use");
        
        return {
          text: textBlock?.text ?? "",
          toolCalls: toolBlocks.map(tb => ({
            id: tb.id,
            name: tb.name,
            args: tb.input,
          })),
          usage: {
            promptTokens: response.usage.input_tokens,
            completionTokens: response.usage.output_tokens,
            totalTokens: response.usage.input_tokens + response.usage.output_tokens,
          },
          finishReason: this.mapFinishReason(response.stop_reason),
          model: response.model,
        };
      } catch (error) {
        throw this.wrapError(error);
      }
    },
  };
  
  // Helper methods
  
  private mapMessages(messages: Message[]): any[] {
    // Map Gizzi Message format to Anthropic format
    return messages.map(msg => {
      if (msg.role === "user") {
        return { role: "user", content: msg.content };
      } else if (msg.role === "assistant") {
        return { role: "assistant", content: msg.content };
      } else if (msg.role === "tool") {
        return {
          role: "user",
          content: [
            {
              type: "tool_result",
              tool_use_id: msg.toolCallId,
              content: msg.content,
              is_error: msg.isError,
            },
          ],
        };
      }
      return msg;
    });
  }
  
  private mapTool(tool: Tool): any {
    return {
      name: tool.name,
      description: tool.description,
      input_schema: tool.parameters,
    };
  }
  
  private mapToolChoice(choice?: ToolChoice): any {
    if (!choice) return undefined;
    if (choice === "auto") return { type: "auto" };
    if (choice === "none") return { type: "none" };
    if (choice === "required") return { type: "any" };
    if (typeof choice === "object") {
      return { type: "tool", name: choice.toolId };
    }
    return undefined;
  }
  
  private mapFinishReason(reason: string | null): FinishReason {
    switch (reason) {
      case "end_turn":
      case "stop_sequence":
        return "stop";
      case "max_tokens":
        return "length";
      case "tool_use":
        return "tool-calls";
      case "content_filter":
        return "content-filter";
      default:
        return "unknown";
    }
  }
  
  private getPricingTier(modelId: string): "economy" | "standard" | "premium" | "ultra" {
    if (modelId.includes("opus")) return "ultra";
    if (modelId.includes("sonnet")) return "premium";
    if (modelId.includes("haiku")) return "economy";
    return "standard";
  }
  
  private wrapError(error: unknown): Error {
    if (error instanceof Anthropic.AuthenticationError) {
      return new AuthError("Invalid API key", "anthropic", error);
    }
    if (error instanceof Anthropic.RateLimitError) {
      return new RateLimitError(
        "Rate limit exceeded",
        "anthropic",
        error,
        error.retry_after,
      );
    }
    if (error instanceof Anthropic.NotFoundError) {
      return new ModelNotFoundError("Model not found", "anthropic", error.message);
    }
    if (error instanceof Anthropic.ContentFilterViolation) {
      return new ContentFilterError(
        "Content policy violation",
        "anthropic",
        error,
        error.message,
      );
    }
    return new ProviderError(
      error instanceof Error ? error.message : "Unknown error",
      "anthropic",
      error,
      true, // Assume retryable for unknown errors
    );
  }
}
```

---

## Provider Registry

```typescript
// cmd/gizzi-code/src/runtime/providers/registry.ts

import type { ProviderAdapter, ProviderId } from "./types";
import { AnthropicAdapter } from "./anthropic/adapter";
import { AuthStore } from "@/runtime/auth/store";

export class ProviderRegistry {
  private static adapters: Map<ProviderId, ProviderAdapter> = new Map();
  
  static register(adapter: ProviderAdapter): void {
    this.adapters.set(adapter.id, adapter);
  }
  
  static async get(providerId: ProviderId): Promise<ProviderAdapter> {
    const adapter = this.adapters.get(providerId);
    if (!adapter) {
      throw new Error(`Provider not registered: ${providerId}`);
    }
    return adapter;
  }
  
  static async list(): Promise<ProviderId[]> {
    return Array.from(this.adapters.keys());
  }
  
  static async getAll(): Promise<ProviderAdapter[]> {
    return Array.from(this.adapters.values());
  }
}

// Initialize providers
export function initializeProviders(authStore: AuthStore): void {
  ProviderRegistry.register(new AnthropicAdapter(authStore));
  // Register other providers as they're implemented
  // ProviderRegistry.register(new OpenAIAdapter(authStore));
  // ProviderRegistry.register(new GoogleAdapter(authStore));
}
```

---

## Usage Examples

### Streaming Chat

```typescript
import { ProviderRegistry } from "@/runtime/providers/registry";

const provider = await ProviderRegistry.get("anthropic");

const stream = provider.chat.stream({
  model: "gizzi.anthropic.sonnet",
  messages: [
    { role: "user", content: "Hello, how are you?" },
  ],
});

let fullText = "";
for await (const event of stream) {
  if (event.type === "text-delta") {
    fullText += event.textDelta;
    console.log(event.textDelta);
  } else if (event.type === "tool-call") {
    console.log("Tool call:", event.name, event.args);
  } else if (event.type === "finish") {
    console.log("Finished:", event.usage);
  } else if (event.type === "error") {
    console.error("Error:", event.error);
  }
}
```

### Non-Streaming Chat

```typescript
const provider = await ProviderRegistry.get("anthropic");

const response = await provider.chat.complete({
  model: "gizzi.anthropic.sonnet",
  messages: [
    { role: "user", content: "What's the weather?" },
  ],
  tools: [
    {
      id: "get_weather",
      name: "get_weather",
      description: "Get current weather",
      parameters: {
        type: "object",
        properties: {
          location: { type: "string" },
        },
        required: ["location"],
      },
    },
  ],
});

console.log("Response:", response.text);
console.log("Tool calls:", response.toolCalls);
console.log("Usage:", response.usage);
```

### Model Discovery

```typescript
const provider = await ProviderRegistry.get("anthropic");

const models = await provider.models.list();
for (const model of models) {
  console.log(`${model.canonicalId}: ${model.name}`);
  console.log(`  Context: ${model.contextWindow} tokens`);
  console.log(`  Tools: ${model.capabilities.tools}`);
  console.log(`  Vision: ${model.capabilities.vision}`);
}
```

---

## Testing

### Unit Test Example

```typescript
// test/providers/anthropic-adapter.test.ts

import { describe, test, expect, mock } from "bun:test";
import { AnthropicAdapter } from "@/runtime/providers/anthropic/adapter";
import { MockAuthStore } from "../mocks/auth-store";

describe("AnthropicAdapter", () => {
  test("should stream text deltas", async () => {
    const authStore = new MockAuthStore({ apiKey: "test-key" });
    const adapter = new AnthropicAdapter(authStore);
    
    const stream = adapter.chat.stream({
      model: "gizzi.anthropic.sonnet",
      messages: [{ role: "user", content: "Hello" }],
    });
    
    const events: any[] = [];
    for await (const event of stream) {
      events.push(event);
    }
    
    expect(events.some(e => e.type === "text-delta")).toBe(true);
    expect(events.some(e => e.type === "finish")).toBe(true);
  });
  
  test("should handle tool calls", async () => {
    // Test tool call handling
  });
  
  test("should map canonical IDs correctly", () => {
    const authStore = new MockAuthStore({ apiKey: "test-key" });
    const adapter = new AnthropicAdapter(authStore);
    
    expect(adapter.models.getCanonicalId("claude-sonnet-4-20250514"))
      .toBe("gizzi.anthropic.sonnet");
  });
});
```

---

## Migration Guide

### From Direct SDK Usage

**Before:**
```typescript
import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic({ apiKey });
const response = await client.messages.create({ /* ... */ });
```

**After:**
```typescript
import { ProviderRegistry } from "@/runtime/providers/registry";

const provider = await ProviderRegistry.get("anthropic");
const response = await provider.chat.complete({ /* ... */ });
```

### From Vercel AI SDK

**Before:**
```typescript
import { streamText } from "ai";
import { createAnthropic } from "@ai-sdk/anthropic";

const anthropic = createAnthropic({ apiKey });
const result = streamText({ model: anthropic("claude-sonnet"), messages });
```

**After:**
```typescript
import { ProviderRegistry } from "@/runtime/providers/registry";

const provider = await ProviderRegistry.get("anthropic");
const stream = provider.chat.stream({ model: "gizzi.anthropic.sonnet", messages });
```

---

## Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0 | 2026-03-06 | Initial specification |

---

**Owner:** [Assign]  
**Review Date:** [Set date]  
**Next Version:** 1.1 (planned: add embeddings, images interfaces)
