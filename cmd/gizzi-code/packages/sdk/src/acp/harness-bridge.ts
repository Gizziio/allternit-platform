/**
 * ACP (Agent Capability Protocol) Harness Bridge
 * 
 * Bridge connecting ACP sessions to the AllternitHarness for unified AI interactions.
 * Uses official ACP types from @agentclientprotocol/sdk.
 */

import { AllternitHarness } from '../harness/index.js';
import { ACPRegistry } from './registry.js';
import type { 
  AllternitACPSession,
  Content,
  TextContent,
  ToolCall,
  ACPRegistryEntry,
  ValidationResult,
} from './types.js';

export interface BridgeOptions {
  harness: AllternitHarness;
  registry: ACPRegistry;
}

export interface BridgeStreamChunk {
  type: 'content' | 'tool_call' | 'error' | 'done';
  content?: Content;
  toolCall?: ToolCall;
  error?: string;
}

export class ACPHarnessBridge {
  private harness: AllternitHarness;
  private registry: ACPRegistry;

  constructor(options: BridgeOptions) {
    this.harness = options.harness;
    this.registry = options.registry;
  }

  /**
   * Convert ACP session to harness stream
   */
  async *streamSession(session: AllternitACPSession): AsyncGenerator<BridgeStreamChunk> {
    const provider = this.registry.get(session.model.provider);
    if (!provider) {
      throw new Error(`Unknown provider: ${session.model.provider}`);
    }

    const model = provider.models.find((m) => m.id === session.model.model);
    if (!model) {
      throw new Error(`Unknown model: ${session.model.model}`);
    }

    // Convert ACP messages to harness format
    // Note: ACP messages are stored differently, this is a simplified conversion
    const messages: Array<{ role: string; content: string }> = [];
    
    // Add system prompt if configured
    if (session.config?.systemPrompt) {
      messages.push({ role: 'system', content: session.config.systemPrompt });
    }

    const request = {
      provider: session.model.provider,
      model: session.model.model,
      messages,
      temperature: session.config?.temperature,
      maxTokens: session.config?.maxTokens,
    };

    try {
      for await (const chunk of this.harness.stream(request)) {
        switch (chunk.type) {
          case 'text': {
            const content: TextContent = {
              type: 'text',
              text: chunk.text,
            };
            yield { type: 'content', content };
            break;
          }
          
          case 'tool_call': {
            const toolCall: ToolCall = {
              toolCallId: chunk.callID || crypto.randomUUID(),
              title: chunk.name,
              status: 'in_progress',
            };
            yield { type: 'tool_call', toolCall };
            break;
          }
          
          case 'error': {
            yield { type: 'error', error: chunk.error.message };
            break;
          }
          
          case 'done': {
            yield { type: 'done' };
            break;
          }
        }
      }
    } catch (error) {
      yield {
        type: 'error',
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Create a new session with the harness
   */
  createSession(
    agentId: string,
    model: { provider: string; model: string },
    config?: AllternitACPSession['config']
  ): AllternitACPSession {
    const now = new Date().toISOString();
    
    const session: AllternitACPSession = {
      id: crypto.randomUUID(),
      agentId,
      status: 'active',
      model,
      config,
      createdAt: now,
      updatedAt: now,
    };

    // Store in registry
    this.registry.setSession(session);
    
    return session;
  }

  /**
   * Update a session
   */
  updateSession(
    sessionId: string,
    updates: Partial<AllternitACPSession>
  ): AllternitACPSession | undefined {
    const session = this.registry.getSession(sessionId);
    if (!session) return undefined;

    const updated = {
      ...session,
      ...updates,
      id: sessionId,
      updatedAt: new Date().toISOString(),
    };

    this.registry.setSession(updated);
    return updated;
  }

  /**
   * Register a provider from harness-compatible config
   */
  registerProvider(entry: ACPRegistryEntry): void {
    this.registry.register(entry);
  }

  /**
   * List available providers
   */
  listProviders(): ACPRegistryEntry[] {
    return this.registry.list();
  }

  /**
   * Get provider by ID
   */
  getProvider(id: string): ACPRegistryEntry | undefined {
    return this.registry.get(id);
  }
}

export { ACPHarnessBridge as default };
