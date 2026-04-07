export type { HarnessErrorCode } from './errors.js';
export { HarnessError } from './errors.js';

/**
 * Allternit Harness - Main Entry Point
 * Unified AI interface for BYOK, Cloud, Local, and Subprocess modes
 */

import { AllternitError, APIUserAbortError } from '../providers/anthropic/core/error';
import type {
  HarnessConfig,
  StreamRequest,
  HarnessStreamChunk,
  HarnessResponse,
  ProviderInfo,
  ModelInfo,
  Message,
} from './types';

import {
  streamFromBYOK,
  streamFromCloud,
  streamFromLocal,
  streamFromSubprocess,
  completeViaCloud,
  completeViaLocal,
  executeSubprocess,
  listCloudModels,
  listLocalModels,
} from './modes';

export * from './types';
export * from './modes';

/**
 * AllternitHarness - Main class for AI interactions
 * Provides a unified interface across all operation modes
 */
export class AllternitHarness {
  private config: HarnessConfig;

  constructor(config: HarnessConfig) {
    this.validateConfig(config);
    this.config = config;
  }

  /**
   * Validate the harness configuration
   */
  private validateConfig(config: HarnessConfig): void {
    if (!config.mode) {
      throw new AllternitError('HarnessConfig.mode is required');
    }

    const validModes = ['byok', 'cloud', 'local', 'subprocess'];
    if (!validModes.includes(config.mode)) {
      throw new AllternitError(
        `Invalid mode: ${config.mode}. Must be one of: ${validModes.join(', ')}`
      );
    }

    // Validate mode-specific config
    switch (config.mode) {
      case 'byok':
        if (!config.byok?.keys) {
          throw new AllternitError('BYOK mode requires config.byok.keys');
        }
        break;
      case 'cloud':
        if (!config.cloud?.accessToken) {
          throw new AllternitError('Cloud mode requires config.cloud.accessToken');
        }
        break;
      case 'local':
        if (!config.local?.baseURL) {
          throw new AllternitError('Local mode requires config.local.baseURL');
        }
        break;
      case 'subprocess':
        if (!config.subprocess?.command) {
          throw new AllternitError('Subprocess mode requires config.subprocess.command');
        }
        break;
    }
  }

  /**
   * Main streaming interface
   * Routes to the appropriate mode handler
   */
  async *stream(request: StreamRequest): AsyncGenerator<HarnessStreamChunk> {
    // Inject system prompt if needed
    const enrichedRequest = this.enrichRequest(request);

    switch (this.config.mode) {
      case 'byok':
        if (!this.config.byok) {
          throw new AllternitError('BYOK config not provided');
        }
        yield* streamFromBYOK(this.config.byok, enrichedRequest);
        break;

      case 'cloud':
        if (!this.config.cloud) {
          throw new AllternitError('Cloud config not provided');
        }
        yield* streamFromCloud(this.config.cloud, enrichedRequest);
        break;

      case 'local':
        if (!this.config.local) {
          throw new AllternitError('Local config not provided');
        }
        yield* streamFromLocal(this.config.local, enrichedRequest);
        break;

      case 'subprocess':
        if (!this.config.subprocess) {
          throw new AllternitError('Subprocess config not provided');
        }
        yield* streamFromSubprocess(this.config.subprocess, enrichedRequest);
        break;

      default:
        throw new AllternitError(`Unknown mode: ${this.config.mode}`);
    }
  }

  /**
   * Non-streaming completion
   */
  async complete(request: StreamRequest): Promise<HarnessResponse> {
    const enrichedRequest = this.enrichRequest(request);

    switch (this.config.mode) {
      case 'cloud': {
        if (!this.config.cloud) {
          throw new AllternitError('Cloud config not provided');
        }
        const result = await completeViaCloud(this.config.cloud, enrichedRequest);
        return {
          id: `cloud_${Date.now()}`,
          model: request.model,
          content: result.tool_calls?.length
            ? [
                { type: 'text', text: result.content },
                ...result.tool_calls.map((tc) => ({
                  type: 'tool_use' as const,
                  id: tc.id,
                  name: tc.name,
                  input: tc.arguments,
                })),
              ]
            : [{ type: 'text', text: result.content }],
          role: 'assistant',
          stop_reason: result.tool_calls?.length ? 'tool_use' : 'end_turn',
          usage: result.usage,
        };
      }

      case 'local': {
        if (!this.config.local) {
          throw new AllternitError('Local config not provided');
        }
        const result = await completeViaLocal(this.config.local, enrichedRequest);
        return {
          id: `local_${Date.now()}`,
          model: request.model,
          content: result.tool_calls?.length
            ? [
                { type: 'text', text: result.content },
                ...result.tool_calls.map((tc) => ({
                  type: 'tool_use' as const,
                  id: tc.id,
                  name: tc.name,
                  input: tc.arguments,
                })),
              ]
            : [{ type: 'text', text: result.content }],
          role: 'assistant',
          stop_reason: result.tool_calls?.length ? 'tool_use' : 'end_turn',
          usage: result.usage,
        };
      }

      case 'subprocess': {
        if (!this.config.subprocess) {
          throw new AllternitError('Subprocess config not provided');
        }
        const result = await executeSubprocess(
          this.config.subprocess,
          enrichedRequest.messages,
          enrichedRequest.signal
        );
        return {
          id: `subprocess_${Date.now()}`,
          model: request.model,
          content: [{ type: 'text', text: result.content }],
          role: 'assistant',
          stop_reason: 'end_turn',
          usage: result.usage,
        };
      }

      case 'byok': {
        // For BYOK, collect stream into a single response
        const chunks: HarnessStreamChunk[] = [];
        for await (const chunk of this.stream(enrichedRequest)) {
          chunks.push(chunk);
        }

        // Aggregate text and tool calls
        let text = '';
        const toolCalls: Array<{ id: string; name: string; input: Record<string, unknown> }> = [];
        let usage = { input_tokens: 0, output_tokens: 0 };

        for (const chunk of chunks) {
          if (chunk.type === 'text') {
            text += chunk.text;
          } else if (chunk.type === 'tool_call') {
            toolCalls.push({ id: chunk.id, name: chunk.name, input: chunk.arguments });
          } else if (chunk.type === 'usage') {
            usage = { input_tokens: chunk.input_tokens, output_tokens: chunk.output_tokens };
          }
        }

        return {
          id: `byok_${Date.now()}`,
          model: request.model,
          content: toolCalls.length
            ? [
                { type: 'text', text },
                ...toolCalls.map((tc) => ({
                  type: 'tool_use' as const,
                  id: tc.id,
                  name: tc.name,
                  input: tc.input,
                })),
              ]
            : [{ type: 'text', text }],
          role: 'assistant',
          stop_reason: toolCalls.length ? 'tool_use' : 'end_turn',
          usage,
        };
      }

      default:
        throw new AllternitError(`Unknown mode: ${this.config.mode}`);
    }
  }

  /**
   * List available providers for current mode
   */
  async listProviders(): Promise<ProviderInfo[]> {
    const providers: ProviderInfo[] = [
      {
        id: 'anthropic',
        name: 'Anthropic',
        description: 'Claude models from Anthropic',
        modes: ['byok', 'cloud'],
      },
      {
        id: 'openai',
        name: 'OpenAI',
        description: 'GPT models from OpenAI',
        modes: ['byok', 'cloud'],
      },
      {
        id: 'google',
        name: 'Google',
        description: 'Gemini models from Google',
        modes: ['byok', 'cloud'],
      },
      {
        id: 'ollama',
        name: 'Ollama',
        description: 'Local models via Ollama',
        modes: ['local'],
      },
    ];

    // Filter providers available in current mode
    return providers.filter((p) => p.modes.includes(this.config.mode));
  }

  /**
   * List available models for a provider
   */
  async listModels(provider: string): Promise<ModelInfo[]> {
    switch (this.config.mode) {
      case 'cloud':
        if (!this.config.cloud) {
          throw new AllternitError('Cloud config not provided');
        }
        const cloudModels = await listCloudModels(this.config.cloud, provider);
        return cloudModels.map((m) => ({
          id: m.id,
          name: m.name,
          provider: m.provider,
          capabilities: m.capabilities,
          context_window: 200000, // Default, should come from API
        }));

      case 'local':
        if (!this.config.local) {
          throw new AllternitError('Local config not provided');
        }
        const localModels = await listLocalModels(this.config.local);
        return localModels.map((m) => ({
          id: m.name,
          name: m.name,
          provider: 'ollama',
          capabilities: ['text'],
          context_window: 128000, // Varies by model
        }));

      case 'byok':
        // Return known models for BYOK providers
        return this.getKnownModels(provider);

      case 'subprocess':
        // Subprocess mode doesn't have a model list
        return [];

      default:
        return [];
    }
  }

  /**
   * Get known models for BYOK providers
   */
  private getKnownModels(provider: string): ModelInfo[] {
    const models: Record<string, ModelInfo[]> = {
      anthropic: [
        {
          id: 'claude-3-7-sonnet-20250219',
          name: 'Claude 3.7 Sonnet',
          provider: 'anthropic',
          capabilities: ['text', 'vision', 'tools'],
          context_window: 200000,
          max_output_tokens: 8192,
        },
        {
          id: 'claude-3-opus-20240229',
          name: 'Claude 3 Opus',
          provider: 'anthropic',
          capabilities: ['text', 'vision', 'tools'],
          context_window: 200000,
          max_output_tokens: 4096,
        },
        {
          id: 'claude-3-5-haiku-20241022',
          name: 'Claude 3.5 Haiku',
          provider: 'anthropic',
          capabilities: ['text', 'vision', 'tools'],
          context_window: 200000,
          max_output_tokens: 8192,
        },
      ],
      openai: [
        {
          id: 'gpt-4o',
          name: 'GPT-4o',
          provider: 'openai',
          capabilities: ['text', 'vision', 'tools'],
          context_window: 128000,
          max_output_tokens: 4096,
        },
        {
          id: 'gpt-4-turbo',
          name: 'GPT-4 Turbo',
          provider: 'openai',
          capabilities: ['text', 'vision', 'tools'],
          context_window: 128000,
          max_output_tokens: 4096,
        },
        {
          id: 'gpt-3.5-turbo',
          name: 'GPT-3.5 Turbo',
          provider: 'openai',
          capabilities: ['text', 'tools'],
          context_window: 16385,
          max_output_tokens: 4096,
        },
      ],
      google: [
        {
          id: 'gemini-2.0-flash',
          name: 'Gemini 2.0 Flash',
          provider: 'google',
          capabilities: ['text', 'vision', 'tools'],
          context_window: 1000000,
          max_output_tokens: 8192,
        },
        {
          id: 'gemini-2.0-pro',
          name: 'Gemini 2.0 Pro',
          provider: 'google',
          capabilities: ['text', 'vision', 'tools'],
          context_window: 2000000,
          max_output_tokens: 8192,
        },
      ],
    };

    return models[provider] || [];
  }

  /**
   * Enrich the request with system prompts and defaults
   */
  private enrichRequest(request: StreamRequest): StreamRequest {
    // Check if system message already exists
    const hasSystemMessage = request.messages.some((m) => m.role === 'system');

    if (hasSystemMessage) {
      // Augment existing system message
      return {
        ...request,
        messages: request.messages.map((m) =>
          m.role === 'system'
            ? { ...m, content: `${ALLTERNIT_SYSTEM_PROMPT}\n\n${m.content}` }
            : m
        ),
      };
    }

    // Prepend Allternit system prompt
    return {
      ...request,
      messages: [
        { role: 'system', content: ALLTERNIT_SYSTEM_PROMPT },
        ...request.messages,
      ],
    };
  }

  /**
   * Get current mode
   */
  getMode(): HarnessConfig['mode'] {
    return this.config.mode;
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<HarnessConfig>): void {
    const newConfig = { ...this.config, ...config };
    this.validateConfig(newConfig);
    this.config = newConfig;
  }
}

/**
 * Allternit system prompt injected into all conversations
 */
const ALLTERNIT_SYSTEM_PROMPT = `You are Allternit, an advanced AI assistant integrated into the Allternit development platform.

CAPABILITIES:
- Write, edit, and analyze code across all major languages
- Execute terminal commands safely with user approval
- Manage files and projects intelligently
- Use tools to extend your capabilities

PERSONALITY:
- Direct and technical - get to the solution quickly
- Ask clarifying questions when requirements are ambiguous
- Always explain your reasoning for complex decisions
- Use markdown formatting for code and structured data

SAFETY:
- Never execute destructive commands without explicit approval
- Respect .gitignore and sensitive file patterns
- Warn about potential security issues in code

CONTEXT:
- You have access to the current working directory
- You can read files, execute commands, and edit code
- Sessions persist across conversations`;
