/**
 * AllternitHarness
 * Core SDK implementation for unified AI provider access
 */

import {
  HarnessConfig,
  HarnessMode,
  StreamRequest,
  HarnessStreamChunk,
  HarnessError,
  HarnessErrorCode,
  Message,
  Tool,
} from './types.js';
import {
  injectSystemPrompt,
  injectProviderPrompt,
  validateMessages,
} from './prompts.js';

/**
 * AllternitHarness provides a unified interface for streaming
 * AI completions across multiple providers and deployment modes.
 */
export class AllternitHarness {
  private config: HarnessConfig;

  /**
   * Creates a new AllternitHarness instance
   * 
   * @param config - Harness configuration including mode and credentials
   * @throws HarnessError if configuration is invalid
   */
  constructor(config: HarnessConfig) {
    this.validateConfig(config);
    this.config = config;
  }

  /**
   * Validates the harness configuration
   * 
   * @param config - Configuration to validate
   * @throws HarnessError if invalid
   */
  private validateConfig(config: HarnessConfig): void {
    if (!config) {
      throw new HarnessError(
        HarnessErrorCode.CONFIG_INVALID,
        'Configuration is required'
      );
    }

    if (!config.mode) {
      throw new HarnessError(
        HarnessErrorCode.CONFIG_INVALID,
        'Mode is required (byok, cloud, local, subprocess)'
      );
    }

    const validModes: HarnessMode[] = ['byok', 'cloud', 'local', 'subprocess'];
    if (!validModes.includes(config.mode)) {
      throw new HarnessError(
        HarnessErrorCode.MODE_UNSUPPORTED,
        `Unsupported mode: ${config.mode}. Must be one of: ${validModes.join(', ')}`
      );
    }

    // Validate mode-specific configuration
    switch (config.mode) {
      case 'byok':
        if (!config.byok) {
          throw new HarnessError(
            HarnessErrorCode.CONFIG_INVALID,
            'BYOK mode requires byok configuration with at least one provider API key'
          );
        }
        if (
          !config.byok.anthropic?.apiKey &&
          !config.byok.openai?.apiKey &&
          !config.byok.google?.apiKey
        ) {
          throw new HarnessError(
            HarnessErrorCode.CONFIG_INVALID,
            'BYOK mode requires at least one provider API key (anthropic, openai, or google)'
          );
        }
        break;

      case 'cloud':
        if (!config.cloud?.baseURL || !config.cloud?.accessToken) {
          throw new HarnessError(
            HarnessErrorCode.CONFIG_INVALID,
            'Cloud mode requires baseURL and accessToken'
          );
        }
        break;

      case 'local':
        if (!config.local?.baseURL) {
          throw new HarnessError(
            HarnessErrorCode.CONFIG_INVALID,
            'Local mode requires baseURL'
          );
        }
        break;

      case 'subprocess':
        if (!config.subprocess?.command) {
          throw new HarnessError(
            HarnessErrorCode.CONFIG_INVALID,
            'Subprocess mode requires command'
          );
        }
        break;
    }
  }

  /**
   * Main streaming interface for AI completions
   * 
   * Routes to the appropriate mode implementation based on configuration.
   * Always injects system prompts regardless of mode.
   * 
   * @param request - Stream request with messages, model, and options
   * @yields HarnessStreamChunk - Text, tool calls, errors, or done events
   * @throws HarnessError for configuration or routing errors
   */
  async *stream(
    request: StreamRequest
  ): AsyncGenerator<HarnessStreamChunk> {
    // Validate request
    if (!request) {
      throw new HarnessError(
        HarnessErrorCode.CONFIG_INVALID,
        'Stream request is required'
      );
    }

    if (!request.provider || !request.model) {
      throw new HarnessError(
        HarnessErrorCode.CONFIG_INVALID,
        'Provider and model are required'
      );
    }

    // Validate and inject system prompts
    validateMessages(request.messages);
    
    const hasTools = !!request.tools && request.tools.length > 0;
    let messages = injectSystemPrompt(request.messages, hasTools);
    messages = injectProviderPrompt(messages, request.provider);

    // Create modified request with injected prompts
    const modifiedRequest: StreamRequest = {
      ...request,
      messages,
    };

    // Route to appropriate mode
    try {
      switch (this.config.mode) {
        case 'cloud':
          yield* this.streamFromCloud(modifiedRequest);
          break;
        case 'byok':
          yield* this.streamFromBYOK(modifiedRequest);
          break;
        case 'local':
          yield* this.streamFromLocal(modifiedRequest);
          break;
        case 'subprocess':
          yield* this.streamFromSubprocess(modifiedRequest);
          break;
        default:
          throw new HarnessError(
            HarnessErrorCode.MODE_UNSUPPORTED,
            `Mode ${this.config.mode} is not implemented`
          );
      }
    } catch (error) {
      // Re-wrap errors for consistent handling
      if (error instanceof HarnessError) {
        throw error;
      }

      throw new HarnessError(
        HarnessErrorCode.UNKNOWN_ERROR,
        error instanceof Error ? error.message : 'Unknown error during streaming',
        error
      );
    }
  }

  /**
   * Complete a request and return the full response text
   * Collects all stream chunks into a single string
   * 
   * @param request - Stream request with messages, model, and options
   * @returns Full response text
   * @throws HarnessError for configuration or routing errors
   */
  async complete(request: StreamRequest): Promise<string> {
    const chunks: string[] = [];
    for await (const chunk of this.stream(request)) {
      if (chunk.type === 'text' && chunk.text) {
        chunks.push(chunk.text);
      }
    }
    return chunks.join('');
  }

  /**
   * Stream from Allternit Cloud service
   * 
   * @param request - Modified stream request with injected prompts
   * @yields HarnessStreamChunk
   */
  private async *streamFromCloud(
    request: StreamRequest
  ): AsyncGenerator<HarnessStreamChunk> {
    // TODO: Implement cloud streaming
    // This will connect to Allternit Cloud API using the configured
    // baseURL and accessToken, handling authentication, streaming,
    // and response transformation.
    
    throw new HarnessError(
      HarnessErrorCode.API_ERROR,
      'Cloud streaming not yet implemented'
    );
  }

  /**
   * Stream from BYOK (Bring Your Own Key) providers
   * 
   * Routes to Anthropic, OpenAI, or Google based on request.provider
   * 
   * @param request - Modified stream request with injected prompts
   * @yields HarnessStreamChunk
   */
  private async *streamFromBYOK(
    request: StreamRequest
  ): AsyncGenerator<HarnessStreamChunk> {
    const provider = request.provider.toLowerCase();

    switch (provider) {
      case 'anthropic':
        yield* this.streamFromAnthropic(request);
        break;
      case 'openai':
        yield* this.streamFromOpenAI(request);
        break;
      case 'google':
        yield* this.streamFromGoogle(request);
        break;
      default:
        throw new HarnessError(
          HarnessErrorCode.PROVIDER_NOT_FOUND,
          `Provider "${provider}" not supported in BYOK mode. Supported: anthropic, openai, google`
        );
    }
  }

  /**
   * Stream from Anthropic API
   * 
   * @param request - Stream request configured for Anthropic
   * @yields HarnessStreamChunk
   */
  private async *streamFromAnthropic(
    request: StreamRequest
  ): AsyncGenerator<HarnessStreamChunk> {
    const apiKey = this.config.byok?.anthropic?.apiKey;
    
    if (!apiKey) {
      throw new HarnessError(
        HarnessErrorCode.AUTHENTICATION_ERROR,
        'Anthropic API key not configured'
      );
    }

    // TODO: Implement Anthropic streaming
    // - Use Messages API
    // - Handle streaming responses
    // - Transform to HarnessStreamChunk format
    // - Support tool use

    throw new HarnessError(
      HarnessErrorCode.API_ERROR,
      'Anthropic streaming not yet implemented'
    );
  }

  /**
   * Stream from OpenAI API
   * 
   * @param request - Stream request configured for OpenAI
   * @yields HarnessStreamChunk
   */
  private async *streamFromOpenAI(
    request: StreamRequest
  ): AsyncGenerator<HarnessStreamChunk> {
    const apiKey = this.config.byok?.openai?.apiKey;
    
    if (!apiKey) {
      throw new HarnessError(
        HarnessErrorCode.AUTHENTICATION_ERROR,
        'OpenAI API key not configured'
      );
    }

    // TODO: Implement OpenAI streaming
    // - Use Chat Completions API with streaming
    // - Handle streaming responses
    // - Transform to HarnessStreamChunk format
    // - Support function calling

    throw new HarnessError(
      HarnessErrorCode.API_ERROR,
      'OpenAI streaming not yet implemented'
    );
  }

  /**
   * Stream from Google (Gemini) API
   * 
   * @param request - Stream request configured for Google
   * @yields HarnessStreamChunk
   */
  private async *streamFromGoogle(
    request: StreamRequest
  ): AsyncGenerator<HarnessStreamChunk> {
    const apiKey = this.config.byok?.google?.apiKey;
    
    if (!apiKey) {
      throw new HarnessError(
        HarnessErrorCode.AUTHENTICATION_ERROR,
        'Google API key not configured'
      );
    }

    // TODO: Implement Google streaming
    // - Use Gemini API
    // - Handle streaming responses
    // - Transform to HarnessStreamChunk format
    // - Support function calling

    throw new HarnessError(
      HarnessErrorCode.API_ERROR,
      'Google streaming not yet implemented'
    );
  }

  /**
   * Stream from local model (e.g., Ollama)
   * 
   * @param request - Modified stream request with injected prompts
   * @yields HarnessStreamChunk
   */
  private async *streamFromLocal(
    request: StreamRequest
  ): AsyncGenerator<HarnessStreamChunk> {
    const baseURL = this.config.local?.baseURL;
    
    if (!baseURL) {
      throw new HarnessError(
        HarnessErrorCode.CONFIG_INVALID,
        'Local baseURL not configured'
      );
    }

    // TODO: Implement local streaming
    // - Connect to local model server (Ollama, etc.)
    // - Handle streaming responses
    // - Transform to HarnessStreamChunk format
    // - Support tool calling if available

    throw new HarnessError(
      HarnessErrorCode.API_ERROR,
      'Local streaming not yet implemented'
    );
  }

  /**
   * Stream from custom subprocess
   * 
   * @param request - Modified stream request with injected prompts
   * @yields HarnessStreamChunk
   */
  private async *streamFromSubprocess(
    request: StreamRequest
  ): AsyncGenerator<HarnessStreamChunk> {
    const command = this.config.subprocess?.command;
    
    if (!command) {
      throw new HarnessError(
        HarnessErrorCode.CONFIG_INVALID,
        'Subprocess command not configured'
      );
    }

    // TODO: Implement subprocess streaming
    // - Spawn subprocess with configured command
    // - Send request via stdin
    // - Parse streaming responses from stdout
    // - Handle errors from stderr
    // - Transform to HarnessStreamChunk format

    throw new HarnessError(
      HarnessErrorCode.API_ERROR,
      'Subprocess streaming not yet implemented'
    );
  }

  /**
   * Gets the current harness configuration (sanitized)
   * 
   * @returns Copy of config with sensitive data redacted
   */
  getConfig(): Omit<HarnessConfig, 'byok' | 'cloud' | 'local' | 'subprocess'> & {
    byok?: { configured: boolean };
    cloud?: { baseURL: string; authenticated: boolean };
    local?: { baseURL: string };
    subprocess?: { command: string };
  } {
    return {
      mode: this.config.mode,
      byok: this.config.byok
        ? {
            configured: !!(
              this.config.byok.anthropic?.apiKey ||
              this.config.byok.openai?.apiKey ||
              this.config.byok.google?.apiKey
            ),
          }
        : undefined,
      cloud: this.config.cloud
        ? {
            baseURL: this.config.cloud.baseURL,
            authenticated: !!this.config.cloud.accessToken,
          }
        : undefined,
      local: this.config.local,
      subprocess: this.config.subprocess,
    };
  }

  /**
   * Creates a new harness instance with the same configuration
   * 
   * @returns New AllternitHarness instance
   */
  clone(): AllternitHarness {
    return new AllternitHarness(this.config);
  }
}

// Re-export types for convenience
export * from './types.js';
export * from './prompts.js';

// Default export
export default AllternitHarness;
