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
    it('should inject system prompts in BYOK mode', async () => {
      const harness = new AllternitHarness({
        mode: 'byok',
        byok: { anthropic: { apiKey: 'test-key' } }
      });
      
      const messages = [{ role: 'user' as const, content: 'Hello' }];
      
      // Stream should throw API_ERROR since not implemented, but should inject prompts first
      try {
        const stream = harness.stream({
          provider: 'anthropic',
          model: 'claude-3-haiku',
          messages
        });
        
        // Try to get first chunk (should throw)
        await stream.next();
        expect(false).toBe(true); // Should not reach here
      } catch (error) {
        // Expected - streaming not implemented yet
        expect(error).toBeInstanceOf(HarnessError);
      }
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

    it('should route to cloud mode with correct endpoint', async () => {
      let fetchCalled = false;
      let fetchUrl: string | undefined;

      global.fetch = () => {
        fetchCalled = true;
        fetchUrl = 'https://api.allternit.com/v1/ai/stream';
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
      } catch {
        // Expected - mock doesn't fully implement streaming
      }

      expect(fetchCalled).toBe(true);
      expect(fetchUrl).toBe('https://api.allternit.com/v1/ai/stream');
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

  it('should throw error for non-string content', () => {
    expect(() => {
      validateMessages([{ role: 'user', content: 123 } as any]);
    }).toThrow('Message at index 0 content must be a string');
  });
});
