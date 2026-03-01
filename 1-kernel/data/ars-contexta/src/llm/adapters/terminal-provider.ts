/**
 * Terminal Provider Adapter
 * Bridges ars-contexta LLM module to terminal's ai-sdk provider system
 * 
 * This adapter allows ars-contexta to use the terminal's comprehensive
 * provider infrastructure (20+ providers, auth, rate limiting, etc.)
 * 
 * WIH: GAP-78 Integration, Owner: T3-A1
 */

import type { LlmClient, LlmConfig, LlmRequest, LlmResponse, LlmStreamChunk } from '../types.js';

// Terminal imports (available when running in terminal context)
// These are dynamically imported to avoid errors when running standalone
let TerminalProvider: typeof import('@a2rchitect/tui/provider/provider.js').Provider | null = null;
let AI: typeof import('ai') | null = null;

/**
 * Initialize terminal module references
 * Call this before using the adapter in terminal context
 */
export async function initTerminalModules(): Promise<boolean> {
  try {
    // Dynamic imports - will fail gracefully if not in terminal context
    const providerMod = await import('@a2rchitect/tui/provider/provider.js');
    TerminalProvider = providerMod.Provider;
    
    const aiMod = await import('ai');
    AI = aiMod;
    
    return true;
  } catch (e) {
    console.warn('[TerminalProviderAdapter] Not in terminal context, falling back to stub');
    TerminalProvider = null;
    AI = null;
    return false;
  }
}

/**
 * Check if terminal modules are available
 */
export function isTerminalContext(): boolean {
  return TerminalProvider !== null && AI !== null;
}

/**
 * Terminal Provider Adapter
 * Wraps terminal's ai-sdk providers for ars-contexta compatibility
 */
export class TerminalProviderAdapter implements LlmClient {
  readonly provider = 'terminal';
  readonly config: LlmConfig;
  private providerID: string;
  private modelID: string;
  private initialized = false;

  constructor(config: LlmConfig) {
    this.config = config;
    
    // Parse provider and model from config
    // Format: "providerID/modelID" or just use config defaults
    const [p, m] = (config.model || 'openai/gpt-4o-mini').split('/');
    this.providerID = p;
    this.modelID = m || 'gpt-4o-mini';
    
    this.config = {
      ...config,
      provider: 'terminal',
      model: `${this.providerID}/${this.modelID}`,
    };
  }

  /**
   * Initialize the adapter
   */
  private async ensureInitialized(): Promise<void> {
    if (this.initialized) return;
    
    if (!isTerminalContext()) {
      await initTerminalModules();
    }
    
    if (!isTerminalContext()) {
      throw new Error(
        'TerminalProviderAdapter not in terminal context. ' +
        'Use StubProvider for standalone mode.'
      );
    }
    
    this.initialized = true;
  }

  /**
   * Send completion request using terminal's provider system
   */
  async complete(request: LlmRequest): Promise<LlmResponse> {
    await this.ensureInitialized();
    
    if (!TerminalProvider || !AI) {
      throw new Error('Terminal modules not available');
    }

    try {
      // Get model info from terminal
      const model = await TerminalProvider.getModel(this.providerID, this.modelID);
      
      // Get language model instance
      const languageModel = await TerminalProvider.getLanguage(model);
      
      // Convert messages to ai-sdk format
      const messages = this.convertMessages(request.messages);
      
      // Use ai-sdk generateText
      const result = await AI.generateText({
        model: languageModel,
        messages,
        maxTokens: request.maxTokens,
        temperature: request.temperature,
        // @ts-ignore - tool support
        tools: request.tools ? this.convertTools(request.tools) : undefined,
      });

      // Map to ars-contexta format
      return {
        id: result.id || `term_${Date.now()}`,
        content: result.text,
        usage: {
          promptTokens: result.usage?.promptTokens || 0,
          completionTokens: result.usage?.completionTokens || 0,
          totalTokens: result.usage?.totalTokens || 0,
        },
        model: this.config.model,
        finishReason: result.finishReason as 'stop' | 'length' | 'tool_calls' | null,
        toolCalls: result.toolCalls ? this.convertToolCalls(result.toolCalls) : undefined,
      };
    } catch (error) {
      console.error('[TerminalProviderAdapter] Completion failed:', error);
      throw error;
    }
  }

  /**
   * Stream completion using terminal's provider system
   */
  async *stream(request: LlmRequest): AsyncGenerator<LlmStreamChunk> {
    await this.ensureInitialized();
    
    if (!TerminalProvider || !AI) {
      throw new Error('Terminal modules not available');
    }

    try {
      // Get model info from terminal
      const model = await TerminalProvider.getModel(this.providerID, this.modelID);
      
      // Get language model instance
      const languageModel = await TerminalProvider.getLanguage(model);
      
      // Convert messages to ai-sdk format
      const messages = this.convertMessages(request.messages);
      
      // Use ai-sdk streamText
      const result = await AI.streamText({
        model: languageModel,
        messages,
        maxTokens: request.maxTokens,
        temperature: request.temperature,
      });

      // Stream chunks
      let id = `term_stream_${Date.now()}`;
      for await (const chunk of result.textStream) {
        yield {
          id,
          delta: chunk,
          finishReason: null,
        };
      }

      // Final chunk
      yield {
        id,
        delta: '',
        finishReason: 'stop',
        usage: result.usage ? await result.usage : undefined,
      };
    } catch (error) {
      console.error('[TerminalProviderAdapter] Streaming failed:', error);
      throw error;
    }
  }

  /**
   * Health check - verify provider is available
   */
  async health(): Promise<boolean> {
    try {
      await this.ensureInitialized();
      
      if (!TerminalProvider) return false;
      
      // Check if provider exists
      const provider = await TerminalProvider.getProvider(this.providerID);
      return provider !== null && provider.models[this.modelID] !== undefined;
    } catch {
      return false;
    }
  }

  /**
   * Convert ars-contexta messages to ai-sdk format
   */
  private convertMessages(messages: LlmRequest['messages']): Array<{ role: string; content: string }> {
    return messages.map(m => ({
      role: m.role,
      content: m.content,
    }));
  }

  /**
   * Convert ars-contexta tools to ai-sdk format
   */
  private convertTools(tools: NonNullable<LlmRequest['tools']>): Record<string, any> {
    const result: Record<string, any> = {};
    
    for (const tool of tools) {
      if (tool.type === 'function') {
        result[tool.function.name] = {
          description: tool.function.description,
          parameters: tool.function.parameters,
        };
      }
    }
    
    return result;
  }

  /**
   * Convert ai-sdk tool calls to ars-contexta format
   */
  private convertToolCalls(toolCalls: any[]): LlmResponse['toolCalls'] {
    return toolCalls.map(tc => ({
      id: tc.id || `tc_${Date.now()}`,
      type: 'function',
      function: {
        name: tc.name,
        arguments: JSON.stringify(tc.args),
      },
    }));
  }

  /**
   * Get available providers from terminal
   */
  static async listAvailableProviders(): Promise<Array<{ id: string; name: string; models: string[] }>> {
    if (!isTerminalContext()) {
      await initTerminalModules();
    }
    
    if (!TerminalProvider) {
      return [];
    }

    const providers = await TerminalProvider.list();
    
    return Object.entries(providers).map(([id, info]) => ({
      id,
      name: info.name,
      models: Object.keys(info.models),
    }));
  }

  /**
   * Get provider info
   */
  static async getProviderInfo(providerID: string): Promise<{ id: string; name: string; models: string[] } | null> {
    if (!isTerminalContext()) {
      await initTerminalModules();
    }
    
    if (!TerminalProvider) {
      return null;
    }

    try {
      const provider = await TerminalProvider.getProvider(providerID);
      if (!provider) return null;
      
      return {
        id: provider.id,
        name: provider.name,
        models: Object.keys(provider.models),
      };
    } catch {
      return null;
    }
  }
}

/**
 * Create adapter from terminal's default provider
 */
export async function createTerminalAdapter(preferredModel?: string): Promise<TerminalProviderAdapter> {
  await initTerminalModules();
  
  if (!isTerminalContext()) {
    throw new Error('Cannot create TerminalProviderAdapter: not in terminal context');
  }

  // Use preferred model or default to openai
  const model = preferredModel || 'openai/gpt-4o-mini';
  
  return new TerminalProviderAdapter({
    provider: 'terminal',
    model,
    apiKey: undefined, // Terminal handles auth internally
  });
}

/**
 * Factory function for creating terminal adapter with auto-fallback
 */
export async function createLlmClientWithFallback(
  preferredModel?: string
): Promise<LlmClient> {
  // Try terminal adapter first
  const isTerminal = await initTerminalModules();
  
  if (isTerminal) {
    console.log('[LLM] Using TerminalProviderAdapter');
    return createTerminalAdapter(preferredModel);
  }
  
  // Fall back to stub
  console.log('[LLM] Terminal not available, using StubProvider');
  const { StubProvider } = await import('../providers/stub.js');
  return new StubProvider({
    provider: 'stub',
    model: preferredModel || 'stub-model',
  });
}
