import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import { AllternitHarness } from '../index';
import { injectSystemPrompt, injectProviderPrompt, validateMessages } from '../prompts';
import { ALLTERNIT_SYSTEM_PROMPT } from '../prompts';
import { HarnessError, HarnessErrorCode } from '../types';

describe('AllternitHarness', () => {
  describe('Configuration', () => {
    it('should create harness with BYOK mode', () => {
      const harness = new AllternitHarness({
        mode: 'byok',
        byok: { anthropic: { apiKey: 'test-key' } }
      });
      
      expect(harness).toBeDefined();
      const config = harness.getConfig();
      expect(config.mode).toBe('byok');
      expect(config.byok?.configured).toBe(true);
    });

    it('should create harness with cloud mode', () => {
      const harness = new AllternitHarness({
        mode: 'cloud',
        cloud: { 
          baseURL: 'https://api.allternit.com',
          accessToken: 'test-token' 
        }
      });
      
      expect(harness).toBeDefined();
      const config = harness.getConfig();
      expect(config.mode).toBe('cloud');
      expect(config.cloud?.authenticated).toBe(true);
      expect(config.cloud?.baseURL).toBe('https://api.allternit.com');
    });

    it('should create harness with local mode', () => {
      const harness = new AllternitHarness({
        mode: 'local',
        local: { baseURL: 'http://localhost:11434' }
      });
      
      expect(harness).toBeDefined();
      const config = harness.getConfig();
      expect(config.mode).toBe('local');
      expect(config.local?.baseURL).toBe('http://localhost:11434');
    });

    it('should create harness with subprocess mode', () => {
      const harness = new AllternitHarness({
        mode: 'subprocess',
        subprocess: { command: 'python model.py' }
      });
      
      expect(harness).toBeDefined();
      const config = harness.getConfig();
      expect(config.mode).toBe('subprocess');
      expect(config.subprocess?.command).toBe('python model.py');
    });

    it('should throw error for invalid mode', () => {
      expect(() => {
        new AllternitHarness({
          mode: 'invalid' as any
        });
      }).toThrow(HarnessError);
    });

    it('should throw error for missing BYOK config', () => {
      expect(() => {
        new AllternitHarness({
          mode: 'byok'
        });
      }).toThrow(HarnessError);
    });

    it('should throw error for missing cloud config', () => {
      expect(() => {
        new AllternitHarness({
          mode: 'cloud'
        });
      }).toThrow(HarnessError);
    });

    it('should throw error for missing local config', () => {
      expect(() => {
        new AllternitHarness({
          mode: 'local'
        });
      }).toThrow(HarnessError);
    });

    it('should throw error for missing subprocess config', () => {
      expect(() => {
        new AllternitHarness({
          mode: 'subprocess'
        });
      }).toThrow(HarnessError);
    });
  });

  describe('BYOK Mode Streaming', () => {
    const originalFetch = globalThis.fetch;

    afterEach(() => {
      globalThis.fetch = originalFetch;
    });

    function sseBody(events: string[]) {
      const encoder = new TextEncoder();
      return new ReadableStream({
        start(controller) {
          for (const event of events) {
            controller.enqueue(encoder.encode(event));
          }
          controller.close();
        },
      });
    }

    it('should inject system prompts in BYOK mode and stream text', async () => {
      const harness = new AllternitHarness({
        mode: 'byok',
        byok: { anthropic: { apiKey: 'test-key' } }
      });

      let fetchUrl: string | undefined;
      globalThis.fetch = (async (input: RequestInfo | URL) => {
        fetchUrl = input.toString();
        return new Response(sseBody([
          'data: {"type":"message_start","message":{"usage":{"input_tokens":10}}}\n\n',
          'data: {"type":"content_block_delta","delta":{"type":"text_delta","text":"Hi"}}\n\n',
          'data: {"type":"message_delta","usage":{"output_tokens":5},"delta":{"stop_reason":"end_turn"}}\n\n',
          'data: {"type":"message_stop"}\n\n',
        ]), { status: 200 });
      }) as typeof fetch;

      const response = await harness.run({
        provider: 'anthropic',
        model: 'claude-3-haiku',
        messages: [{ role: 'user', content: 'Hello' }]
      });

      expect(fetchUrl).toContain('/v1/messages');
      expect(response.content).toBe('Hi');
      expect(response.usage).toEqual({
        promptTokens: 10,
        completionTokens: 5,
        totalTokens: 15,
      });
      expect(response.stopReason).toBe('end_turn');
    });

    it('falls back to registry max_output_tokens when maxTokens is omitted', async () => {
      const harness = new AllternitHarness({
        mode: 'byok',
        byok: { anthropic: { apiKey: 'test-key' } }
      });

      let requestBody: Record<string, unknown> | undefined;
      globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
        requestBody = JSON.parse(init?.body as string);
        return new Response(sseBody([
          'data: {"type":"message_start","message":{"usage":{"input_tokens":10}}}\n\n',
          'data: {"type":"message_stop"}\n\n',
        ]), { status: 200 });
      }) as typeof fetch;

      await harness.run({
        provider: 'anthropic',
        model: 'claude-3-5-sonnet-20241022',
        messages: [{ role: 'user', content: 'Hello' }]
      });

      expect(requestBody?.max_tokens).toBe(8_192);
    });

    it('does not override an explicitly supplied maxTokens', async () => {
      const harness = new AllternitHarness({
        mode: 'byok',
        byok: { anthropic: { apiKey: 'test-key' } }
      });

      let requestBody: Record<string, unknown> | undefined;
      globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
        requestBody = JSON.parse(init?.body as string);
        return new Response(sseBody([
          'data: {"type":"message_start","message":{"usage":{"input_tokens":10}}}\n\n',
          'data: {"type":"message_stop"}\n\n',
        ]), { status: 200 });
      }) as typeof fetch;

      await harness.run({
        provider: 'anthropic',
        model: 'claude-3-5-sonnet-20241022',
        messages: [{ role: 'user', content: 'Hello' }],
        maxTokens: 512,
      });

      expect(requestBody?.max_tokens).toBe(512);
    });

    it('streams thinking_delta and signature_delta chunks', async () => {
      const harness = new AllternitHarness({
        mode: 'byok',
        byok: { anthropic: { apiKey: 'test-key' } }
      });

      globalThis.fetch = (async () => new Response(sseBody([
        'data: {"type":"content_block_delta","delta":{"type":"thinking_delta","thinking":"Thinking "}}\n\n',
        'data: {"type":"content_block_delta","delta":{"type":"thinking_delta","thinking":"continues"}}\n\n',
        'data: {"type":"content_block_delta","delta":{"type":"signature_delta","signature":"sig123"}}\n\n',
        'data: {"type":"message_delta","usage":{"output_tokens":5},"delta":{"stop_reason":"end_turn"}}\n\n',
        'data: {"type":"message_stop"}\n\n',
      ]), { status: 200 })) as typeof fetch;

      const chunks = [];
      for await (const chunk of harness.stream({
        provider: 'anthropic',
        model: 'claude-3-5-sonnet-20241022',
        messages: [{ role: 'user', content: 'Hello' }]
      })) {
        chunks.push(chunk);
      }

      const thinking = chunks.filter((c) => c.type === 'thinking_delta');
      expect(thinking).toHaveLength(2);
      expect((thinking[0] as any).thinking).toBe('Thinking ');
      expect((thinking[1] as any).thinking).toBe('continues');

      const signature = chunks.find((c) => c.type === 'signature_delta');
      expect(signature).toBeDefined();
      expect((signature as any).signature).toBe('sig123');
    });

    it('should require API key for anthropic provider', async () => {
      const harness = new AllternitHarness({
        mode: 'byok',
        byok: { openai: { apiKey: 'test-key' } } // Only OpenAI key
      });
      
      try {
        const stream = harness.stream({
          provider: 'anthropic',
          model: 'claude-3-haiku',
          messages: [{ role: 'user', content: 'Hello' }]
        });
        await stream.next();
        expect(false).toBe(true);
      } catch (error) {
        expect(error).toBeInstanceOf(HarnessError);
        if (error instanceof HarnessError) {
          expect(error.code).toBe(HarnessErrorCode.AUTHENTICATION_ERROR);
        }
      }
    });

    it('should require API key for openai provider', async () => {
      const harness = new AllternitHarness({
        mode: 'byok',
        byok: { anthropic: { apiKey: 'test-key' } }
      });
      
      try {
        const stream = harness.stream({
          provider: 'openai',
          model: 'gpt-4',
          messages: [{ role: 'user', content: 'Hello' }]
        });
        await stream.next();
        expect(false).toBe(true);
      } catch (error) {
        expect(error).toBeInstanceOf(HarnessError);
        if (error instanceof HarnessError) {
          expect(error.code).toBe(HarnessErrorCode.AUTHENTICATION_ERROR);
        }
      }
    });

    it('should throw error for unsupported provider', async () => {
      const harness = new AllternitHarness({
        mode: 'byok',
        byok: { anthropic: { apiKey: 'test-key' } }
      });
      
      try {
        const stream = harness.stream({
          provider: 'unsupported',
          model: 'model',
          messages: [{ role: 'user', content: 'Hello' }]
        });
        await stream.next();
        expect(false).toBe(true);
      } catch (error) {
        expect(error).toBeInstanceOf(HarnessError);
        if (error instanceof HarnessError) {
          expect(error.code).toBe(HarnessErrorCode.PROVIDER_NOT_FOUND);
        }
      }
    });
  });

  describe('Cloud Mode Routing', () => {
    let originalFetch: typeof global.fetch;

    beforeEach(() => {
      originalFetch = global.fetch;
    });

    afterEach(() => {
      global.fetch = originalFetch;
    });

    it('should route to cloud mode and report not implemented', async () => {
      let fetchCalled = false;

      global.fetch = () => {
        fetchCalled = true;
        return Promise.resolve({
          ok: true,
          body: new ReadableStream(),
        } as Response);
      };

      const harness = new AllternitHarness({
        mode: 'cloud',
        cloud: {
          baseURL: 'https://api.allternit.com',
          accessToken: 'test-token'
        }
      });

      try {
        const stream = harness.stream({
          provider: 'anthropic',
          model: 'claude-3-haiku',
          messages: [{ role: 'user', content: 'Hello' }]
        });
        await stream.next();
        expect(false).toBe(true); // Should not reach here
      } catch (error) {
        expect(error).toBeInstanceOf(HarnessError);
        if (error instanceof HarnessError) {
          expect(error.code).toBe(HarnessErrorCode.API_ERROR);
        }
      }

      expect(fetchCalled).toBe(false);
    });
  });

  describe('Stream Request Validation', () => {
    it('should throw error for missing request', async () => {
      const harness = new AllternitHarness({
        mode: 'byok',
        byok: { anthropic: { apiKey: 'test-key' } }
      });

      try {
        const stream = harness.stream(undefined as any);
        await stream.next();
        expect(false).toBe(true);
      } catch (error) {
        expect(error).toBeInstanceOf(HarnessError);
        if (error instanceof HarnessError) {
          expect(error.code).toBe(HarnessErrorCode.CONFIG_INVALID);
        }
      }
    });

    it('should throw error for missing provider', async () => {
      const harness = new AllternitHarness({
        mode: 'byok',
        byok: { anthropic: { apiKey: 'test-key' } }
      });

      try {
        const stream = harness.stream({
          model: 'claude-3-haiku',
          messages: [{ role: 'user', content: 'Hello' }]
        } as any);
        await stream.next();
        expect(false).toBe(true);
      } catch (error) {
        expect(error).toBeInstanceOf(HarnessError);
        if (error instanceof HarnessError) {
          expect(error.code).toBe(HarnessErrorCode.CONFIG_INVALID);
        }
      }
    });

    it('should throw error for missing model', async () => {
      const harness = new AllternitHarness({
        mode: 'byok',
        byok: { anthropic: { apiKey: 'test-key' } }
      });

      try {
        const stream = harness.stream({
          provider: 'anthropic',
          messages: [{ role: 'user', content: 'Hello' }]
        } as any);
        await stream.next();
        expect(false).toBe(true);
      } catch (error) {
        expect(error).toBeInstanceOf(HarnessError);
        if (error instanceof HarnessError) {
          expect(error.code).toBe(HarnessErrorCode.CONFIG_INVALID);
        }
      }
    });
  });

  describe('Clone', () => {
    it('should create a clone with same configuration', () => {
      const harness = new AllternitHarness({
        mode: 'byok',
        byok: { anthropic: { apiKey: 'test-key' } }
      });

      const clone = harness.clone();
      
      expect(clone).toBeDefined();
      expect(clone).not.toBe(harness);
      
      const cloneConfig = clone.getConfig();
      expect(cloneConfig.mode).toBe('byok');
      expect(cloneConfig.byok?.configured).toBe(true);
    });
  });
});

describe('System Prompt Injection', () => {
  it('should add system prompt to messages without one', () => {
    const messages = [{ role: 'user' as const, content: 'Hello' }];
    const result = injectSystemPrompt(messages);
    
    expect(result).toHaveLength(2);
    expect(result[0].role).toBe('system');
    expect(result[0].content).toContain('Allternit');
    expect(result[0].content).toContain(ALLTERNIT_SYSTEM_PROMPT);
    expect(result[1]).toEqual(messages[0]);
  });

  it('should augment existing system prompt', () => {
    const messages = [
      { role: 'system' as const, content: 'Custom instructions' },
      { role: 'user' as const, content: 'Hello' }
    ];
    const result = injectSystemPrompt(messages);
    
    expect(result).toHaveLength(2);
    expect(result[0].content).toContain('Allternit');
    expect(result[0].content).toContain('Custom instructions');
    expect(result[0].content).toContain('---');
  });

  it('should add tool use addendum when tools are present', () => {
    const messages = [{ role: 'user' as const, content: 'Hello' }];
    const result = injectSystemPrompt(messages, true);
    
    expect(result[0].content).toContain('Allternit');
    expect(result[0].content).toContain('tools');
  });

  it('should throw error for non-array messages', () => {
    expect(() => {
      injectSystemPrompt(null as any);
    }).toThrow('Messages must be an array');
  });

  it('should not mutate original messages array', () => {
    const messages = [{ role: 'user' as const, content: 'Hello' }];
    const result = injectSystemPrompt(messages);
    
    expect(messages).toHaveLength(1);
    expect(result).toHaveLength(2);
  });
});

describe('Provider Prompt Injection', () => {
  it('should return messages unchanged for unknown provider', () => {
    const messages = [
      { role: 'system' as const, content: 'System prompt' },
      { role: 'user' as const, content: 'Hello' }
    ];
    const result = injectProviderPrompt(messages, 'unknown');
    
    expect(result).toEqual(messages);
  });

  it('should return messages unchanged for anthropic provider', () => {
    const messages = [
      { role: 'system' as const, content: 'System prompt' },
      { role: 'user' as const, content: 'Hello' }
    ];
    const result = injectProviderPrompt(messages, 'anthropic');
    
    expect(result).toEqual(messages);
  });

  it('should return messages unchanged when no system message exists', () => {
    const messages = [
      { role: 'user' as const, content: 'Hello' }
    ];
    const result = injectProviderPrompt(messages, 'anthropic');
    
    expect(result).toEqual(messages);
  });
});

describe('Message Validation', () => {
  it('should validate correct messages', () => {
    const messages = [
      { role: 'system' as const, content: 'System' },
      { role: 'user' as const, content: 'Hello' },
      { role: 'assistant' as const, content: 'Hi!' },
      { role: 'tool' as const, content: 'Result', tool_call_id: '123' }
    ];
    
    expect(validateMessages(messages)).toBe(true);
  });

  it('should throw error for non-array messages', () => {
    expect(() => {
      validateMessages(null as any);
    }).toThrow('Messages must be an array');
  });

  it('should throw error for empty messages array', () => {
    expect(() => {
      validateMessages([]);
    }).toThrow('Messages array cannot be empty');
  });

  it('should throw error for message missing role', () => {
    expect(() => {
      validateMessages([{ content: 'Hello' } as any]);
    }).toThrow('Message at index 0 missing required fields');
  });

  it('should throw error for message missing content', () => {
    expect(() => {
      validateMessages([{ role: 'user' } as any]);
    }).toThrow('Message at index 0 missing required fields');
  });

  it('should throw error for invalid role', () => {
    expect(() => {
      validateMessages([{ role: 'invalid', content: 'Hello' } as any]);
    }).toThrow('Message at index 0 has invalid role');
  });

  it('should throw error for non-string and non-array content', () => {
    expect(() => {
      validateMessages([{ role: 'user', content: 123 } as any]);
    }).toThrow('Message at index 0 content must be a string or array of content blocks');
  });

  it('should validate content block arrays', () => {
    const messages = [
      {
        role: 'user' as const,
        content: [
          { type: 'text', text: 'Hello' },
          { type: 'vision', source: { type: 'url', url: 'https://example.com/image.png' } },
        ],
      },
    ];
    expect(validateMessages(messages)).toBe(true);
  });

  it('should throw error for content blocks missing type', () => {
    expect(() => {
      validateMessages([{ role: 'user', content: [{ text: 'Hello' }] } as any]);
    }).toThrow('Message at index 0 content block 0 missing type');
  });
});
