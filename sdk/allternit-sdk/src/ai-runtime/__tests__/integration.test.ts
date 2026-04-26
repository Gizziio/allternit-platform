import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import { AllternitHarness } from '../harness';
import { AllternitOllama } from '../providers/ollama';
import { HarnessError, HarnessErrorCode } from '../harness/types';

/**
 * Integration Tests for Allternit SDK
 * 
 * These tests verify end-to-end workflows and interactions between
 * different components of the SDK.
 */

describe('Integration Tests', () => {
  let originalFetch: typeof global.fetch;

  beforeEach(() => {
    originalFetch = global.fetch;
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  describe('Harness with Ollama Provider', () => {
    it('should create harness with local mode pointing to Ollama', () => {
      const harness = new AllternitHarness({
        mode: 'local',
        local: { baseURL: 'http://localhost:11434' }
      });

      const config = harness.getConfig();
      expect(config.mode).toBe('local');
      expect(config.local?.baseURL).toBe('http://localhost:11434');
    });

    it('should use Ollama client directly for local development', async () => {
      global.fetch = () => Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ 
          models: [{ name: 'llama2', size: 1000000 }] 
        }),
      } as Response);

      const ollama = new AllternitOllama({ baseURL: 'http://localhost:11434' });
      const models = await ollama.listModels();

      expect(models).toHaveLength(1);
      expect(models[0].name).toBe('llama2');
    });
  });

  describe('End-to-End Streaming Workflow', () => {
    it('should handle complete streaming workflow with local provider', async () => {
      // Mock streaming response
      const mockChunks = [
        JSON.stringify({ message: { role: 'assistant', content: 'Hello' }, done: false }),
        JSON.stringify({ message: { role: 'assistant', content: ' from' }, done: false }),
        JSON.stringify({ message: { role: 'assistant', content: ' Ollama!' }, done: true }),
      ];

      const stream = new ReadableStream({
        start(controller) {
          mockChunks.forEach(chunk => {
            controller.enqueue(new TextEncoder().encode(chunk + '\n'));
          });
          controller.close();
        }
      });

      global.fetch = () => Promise.resolve({
        ok: true,
        body: stream,
      } as Response);

      // Create Ollama client
      const ollama = new AllternitOllama({ baseURL: 'http://localhost:11434' });

      // Start chat
      const generator = ollama.chat({
        model: 'llama2',
        messages: [{ role: 'user', content: 'Say hello' }]
      });

      // Collect all chunks
      const responses: string[] = [];
      for await (const chunk of generator) {
        responses.push(chunk);
      }

      // Verify complete response
      const fullResponse = responses.join('');
      expect(fullResponse).toBe('Hello from Ollama!');
    });

    it('should handle error recovery in workflow', async () => {
      let requestCount = 0;

      global.fetch = () => {
        requestCount++;
        if (requestCount === 1) {
          return Promise.resolve({
            ok: false,
            status: 503,
            statusText: 'Service Unavailable',
          } as Response);
        }
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ models: [] }),
        } as Response);
      };

      const ollama = new AllternitOllama({ baseURL: 'http://localhost:11434' });

      // First attempt fails
      try {
        await ollama.listModels();
        expect(false).toBe(true);
      } catch (error) {
        expect(error).toBeInstanceOf(Error);
      }

      // Second attempt succeeds
      const models = await ollama.listModels();
      expect(models).toHaveLength(0);
    });
  });

  describe('Provider Switching', () => {
    it('should support switching between BYOK providers', () => {
      // Create harness with multiple provider keys
      const harness = new AllternitHarness({
        mode: 'byok',
        byok: {
          anthropic: { apiKey: 'anthropic-key' },
          openai: { apiKey: 'openai-key' },
          google: { apiKey: 'google-key' }
        }
      });

      const config = harness.getConfig();
      expect(config.mode).toBe('byok');
      expect(config.byok?.configured).toBe(true);
    });

    it('should reject requests to unconfigured providers', async () => {
      const harness = new AllternitHarness({
        mode: 'byok',
        byok: {
          anthropic: { apiKey: 'test-key' }
          // OpenAI not configured
        }
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
  });

  describe('Message Flow Integration', () => {
    it('should maintain conversation context across messages', async () => {
      const mockResponses = [
        JSON.stringify({ message: { role: 'assistant', content: 'Nice to meet you, Alice!' }, done: true }),
      ];

      let capturedMessages: any[] = [];

      global.fetch = (url: any, options: any) => {
        if (options.body) {
          const body = JSON.parse(options.body);
          capturedMessages = body.messages;
        }

        const stream = new ReadableStream({
          start(controller) {
            mockResponses.forEach(chunk => {
              controller.enqueue(new TextEncoder().encode(chunk + '\n'));
            });
            controller.close();
          }
        });

        return Promise.resolve({
          ok: true,
          body: stream,
        } as Response);
      };

      const ollama = new AllternitOllama({ baseURL: 'http://localhost:11434' });

      // Multi-turn conversation
      const messages = [
        { role: 'user', content: 'My name is Alice' },
        { role: 'assistant', content: 'Hello Alice!' },
        { role: 'user', content: 'What is my name?' }
      ];

      const generator = ollama.chat({
        model: 'llama2',
        messages
      });

      await generator.next();

      // Verify all messages were sent
      expect(capturedMessages).toHaveLength(3);
      expect(capturedMessages[0].content).toBe('My name is Alice');
      expect(capturedMessages[2].content).toBe('What is my name?');
    });
  });

  describe('Error Handling Integration', () => {
    it('should handle network errors gracefully', async () => {
      global.fetch = () => Promise.reject(new Error('Network error'));

      const ollama = new AllternitOllama({ baseURL: 'http://localhost:11434' });
      const available = await ollama.isAvailable();

      expect(available).toBe(false);
    });

    it('should handle timeout scenarios', async () => {
      global.fetch = () => new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Timeout')), 100);
      });

      const ollama = new AllternitOllama({ baseURL: 'http://localhost:11434' });
      
      try {
        const generator = ollama.generate({
          model: 'llama2',
          prompt: 'Test'
        });
        await generator.next();
        expect(false).toBe(true);
      } catch (error) {
        expect(error).toBeInstanceOf(Error);
      }
    });
  });

  describe('Configuration Validation', () => {
    it('should validate complete BYOK configuration', () => {
      const harness = new AllternitHarness({
        mode: 'byok',
        byok: {
          anthropic: { apiKey: 'key1', baseURL: 'https://custom.anthropic.com' },
          openai: { apiKey: 'key2' },
          google: { apiKey: 'key3' }
        }
      });

      const config = harness.getConfig();
      expect(config.mode).toBe('byok');
      expect(config.byok?.configured).toBe(true);
    });

    it('should validate cloud configuration', () => {
      const harness = new AllternitHarness({
        mode: 'cloud',
        cloud: {
          baseURL: 'https://api.allternit.com',
          accessToken: 'token',
          refreshToken: 'refresh'
        }
      });

      const config = harness.getConfig();
      expect(config.mode).toBe('cloud');
      expect(config.cloud?.authenticated).toBe(true);
    });
  });

  describe('Tool Integration', () => {
    it('should handle tool definitions in chat requests', async () => {
      let requestBody: any;

      global.fetch = (url: any, options: any) => {
        requestBody = JSON.parse(options.body);
        return Promise.resolve({
          ok: true,
          body: new ReadableStream({
            start(controller) {
              controller.enqueue(new TextEncoder().encode(
                '{"message": {"role": "assistant", "content": "Tool result"}, "done": true}\n'
              ));
              controller.close();
            }
          }),
        } as Response);
      };

      const ollama = new AllternitOllama({ baseURL: 'http://localhost:11434' });

      const tools = [
        {
          name: 'calculator',
          description: 'Perform calculations',
          parameters: {
            type: 'object',
            properties: {
              expression: { type: 'string', description: 'Math expression' }
            },
            required: ['expression']
          }
        }
      ];

      const generator = ollama.chat({
        model: 'llama2',
        messages: [{ role: 'user', content: 'Calculate 2+2' }],
        tools
      });

      await generator.next();

      expect(requestBody.tools).toBeDefined();
      expect(requestBody.tools[0].name).toBe('calculator');
    });
  });
});
