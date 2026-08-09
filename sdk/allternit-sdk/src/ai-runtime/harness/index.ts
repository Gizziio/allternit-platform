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
  HarnessResponse,
  Citation,
} from './types.js';
import { mapStopReason, toAnthropicRequest } from './provider-request.js';
import { RETRYABLE_STATUS_CODES } from './retry.js';
import {
  injectSystemPrompt,
  injectProviderPrompt,
  validateMessages,
} from './prompts.js';
import {
  applyAfterResponse,
  applyBeforeRequest,
  createRefusalFallbackMiddleware,
  createRetryMiddleware,
  normalizeMiddleware,
} from './middleware.js';
import type { HarnessMiddleware } from './types.js';

/**
 * AllternitHarness provides a unified interface for streaming
 * AI completions across multiple providers and deployment modes.
 */
export class AllternitHarness {
  private config: HarnessConfig;
  private middleware: HarnessMiddleware[];

  /**
   * Creates a new AllternitHarness instance
   * 
   * @param config - Harness configuration including mode and credentials
   * @throws HarnessError if configuration is invalid
   */
  constructor(config: HarnessConfig) {
    this.validateConfig(config);
    this.config = config;
    this.middleware = this.buildMiddleware();
  }

  /**
   * Builds the middleware chain. Fallback is first so it can intercept refusals
   * before the retry middleware, followed by user middleware, then the default
   * retry middleware for backward compatibility with the legacy retry option.
   */
  private buildMiddleware(): HarnessMiddleware[] {
    const list: HarnessMiddleware[] = [];
    if (this.config.fallbackModels && this.config.fallbackModels.length > 0) {
      list.push(createRefusalFallbackMiddleware(this.config.fallbackModels));
    }
    list.push(...normalizeMiddleware(this.config.middleware));
    list.push(createRetryMiddleware(this.config.retry));
    return list;
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
          !config.byok.google?.apiKey &&
          !config.byok.kimi?.apiKey
        ) {
          throw new HarnessError(
            HarnessErrorCode.CONFIG_INVALID,
            'BYOK mode requires at least one provider API key (anthropic, openai, google, or kimi)'
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

    // Apply beforeRequest middleware before provider-specific prompt injection.
    const middlewareRequest = await applyBeforeRequest(this.middleware, request);

    const hasTools = !!middlewareRequest.tools && middlewareRequest.tools.length > 0;
    let messages = injectSystemPrompt(middlewareRequest.messages, hasTools);
    messages = injectProviderPrompt(messages, middlewareRequest.provider);

    // Create modified request with injected prompts
    const modifiedRequest: StreamRequest = {
      ...middlewareRequest,
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
      const harnessError =
        error instanceof HarnessError
          ? error
          : new HarnessError(
              HarnessErrorCode.UNKNOWN_ERROR,
              error instanceof Error ? error.message : 'Unknown error during streaming',
              error
            );

      // Allow middleware to recover from the error.
      const replacement = await this.applyOnError(harnessError, middlewareRequest);
      if (replacement) {
        yield* replacement;
        return;
      }

      throw harnessError;
    }
  }

  /**
   * Invokes onError middleware. Returns a replacement stream if any middleware
   * yields one; otherwise returns undefined so the original error is thrown.
   */
  private async applyOnError(
    error: HarnessError,
    request: StreamRequest
  ): Promise<AsyncGenerator<HarnessStreamChunk> | undefined> {
    for (const middleware of this.middleware) {
      if (!middleware.onError) continue;
      const result = await middleware.onError(error, {
        request,
        harness: this,
      });
      if (result && typeof (result as AsyncIterable<HarnessStreamChunk>)[Symbol.asyncIterator] === 'function') {
        return result as AsyncGenerator<HarnessStreamChunk>;
      }
      // Undefined result means try the next middleware; thrown errors propagate.
    }
    return undefined;
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
    return (await this.run(request)).content;
  }

  /** Collect a stream into a response while retaining citations, usage, and stop reason. */
  async run(request: StreamRequest): Promise<HarnessResponse> {
    const chunks: string[] = [];
    const citations: Citation[] = [];
    let usage: HarnessResponse['usage'];
    let stopReason: HarnessResponse['stopReason'];
    for await (const chunk of this.stream(request)) {
      if (chunk.type === 'text' && chunk.text) {
        chunks.push(chunk.text);
      } else if (chunk.type === 'citation') {
        citations.push(chunk.citation);
      } else if (chunk.type === 'done') {
        usage = chunk.usage;
        stopReason = chunk.stopReason;
      }
    }
    const response: HarnessResponse = {
      content: chunks.join(''),
      ...(citations.length ? { citations } : {}),
      ...(usage ? { usage } : {}),
      ...(stopReason ? { stopReason } : {}),
    };
    return applyAfterResponse(this.middleware, response);
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
      case 'kimi':
      case 'moonshot':
        yield* this.streamFromKimi(request);
        break;
      default:
        throw new HarnessError(
          HarnessErrorCode.PROVIDER_NOT_FOUND,
          `Provider "${provider}" not supported in BYOK mode. Supported: anthropic, openai, google, kimi`
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

    const baseURL = this.config.byok?.anthropic?.baseURL ?? 'https://api.anthropic.com';

    let response: Response;
    try {
      response = await fetch(
        `${baseURL.replace(/\/$/, '')}/v1/messages`,
        {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            'x-api-key': apiKey,
            'anthropic-version': '2023-06-01',
          },
          body: JSON.stringify(toAnthropicRequest({ ...request, stream: true })),
        }
      );
    } catch (error) {
      throw new HarnessError(
        HarnessErrorCode.NETWORK_ERROR,
        error instanceof Error ? error.message : 'Network error during Anthropic request',
        error
      );
    }

    if (!response.ok) {
      let bodyText = '';
      try {
        bodyText = await response.text();
      } catch {
        // Ignore body-read failures.
      }
      const isRetryable = RETRYABLE_STATUS_CODES.has(response.status);
      throw new HarnessError(
        HarnessErrorCode.API_ERROR,
        `Anthropic request failed with ${isRetryable ? 'retryable ' : ''}status ${response.status}${bodyText ? `: ${bodyText}` : ''}`,
        { status: response.status, body: bodyText }
      );
    }

    if (!response.body) {
      throw new HarnessError(
        HarnessErrorCode.API_ERROR,
        'Anthropic response missing body'
      );
    }

    let inputTokens = 0;
    let outputTokens = 0;
    let stopReason: import('./types.js').HarnessStopReason | undefined;
    for await (const event of readSseJson(response.body)) {
      const message = event as Record<string, any>;
      if (message.type === 'message_start') inputTokens = message.message?.usage?.input_tokens ?? 0;
      if (message.type === 'message_delta') {
        outputTokens = message.usage?.output_tokens ?? outputTokens;
        stopReason = mapStopReason('anthropic', message.delta?.stop_reason ?? message.stop_reason) ?? stopReason;
      }
      if (message.type === 'message_stop') {
        stopReason = mapStopReason('anthropic', message.message?.stop_reason) ?? stopReason;
      }
      if (message.type === 'content_block_delta' && message.delta?.type === 'text_delta') {
        yield { type: 'text', text: message.delta.text ?? '' };
      }
      if (message.type === 'content_block_delta' && message.delta?.type === 'citations_delta') {
        yield { type: 'citation', citation: anthropicCitation(message.delta.citation ?? {}) };
      }
      if (message.type === 'error') {
        throw new HarnessError(HarnessErrorCode.API_ERROR, message.error?.message ?? 'Anthropic stream error');
      }
    }
    yield { type: 'done', usage: {
      promptTokens: inputTokens,
      completionTokens: outputTokens,
      totalTokens: inputTokens + outputTokens,
    }, stopReason };
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

  private async *streamFromKimi(
    request: StreamRequest
  ): AsyncGenerator<HarnessStreamChunk> {
    if (!this.config.byok?.kimi?.apiKey) {
      throw new HarnessError(HarnessErrorCode.AUTHENTICATION_ERROR, 'Kimi API key not configured');
    }
    throw new HarnessError(HarnessErrorCode.API_ERROR, 'Kimi streaming not yet implemented');
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
              this.config.byok.google?.apiKey ||
              this.config.byok.kimi?.apiKey
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
export * from './provider-request.js';
export * from './retry.js';
export * from './middleware.js';

// Default export
export default AllternitHarness;

async function* readSseJson(body: ReadableStream<Uint8Array>): AsyncGenerator<unknown> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  try {
    while (true) {
      const { done, value } = await reader.read();
      buffer += decoder.decode(value, { stream: !done });
      let boundary: number;
      while ((boundary = buffer.indexOf('\n\n')) >= 0) {
        const frame = buffer.slice(0, boundary);
        buffer = buffer.slice(boundary + 2);
        const data = frame.split('\n').filter(line => line.startsWith('data:'))
          .map(line => line.slice(5).trimStart()).join('\n');
        if (data && data !== '[DONE]') yield JSON.parse(data);
      }
      if (done) break;
    }
  } finally {
    reader.releaseLock();
  }
}

function anthropicCitation(value: Record<string, unknown>): Citation {
  const known = new Set(['cited_text', 'document_title', 'url', 'document_index', 'start_char_index', 'end_char_index']);
  return {
    type: 'citation',
    citedText: value.cited_text as string | undefined,
    title: value.document_title as string | undefined,
    url: value.url as string | undefined,
    documentIndex: value.document_index as number | undefined,
    startCharIndex: value.start_char_index as number | undefined,
    endCharIndex: value.end_char_index as number | undefined,
    providerData: Object.fromEntries(Object.entries(value).filter(([key]) => !known.has(key))),
  };
}
