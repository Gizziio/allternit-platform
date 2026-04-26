import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import { AllternitOllama } from '../../providers/ollama';

describe('AllternitOllama Provider', () => {
  let originalFetch: typeof global.fetch;

  beforeEach(() => {
    originalFetch = global.fetch;
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  describe('Configuration', () => {
    it('should create client with baseURL', () => {
      const client = new AllternitOllama({ baseURL: 'http://localhost:11434' });
      expect(client).toBeDefined();
    });

    it('should remove trailing slash from baseURL', () => {
      const client = new AllternitOllama({ baseURL: 'http://localhost:11434/' });
      expect(client).toBeDefined();
    });

    it('should use default model when not specified', () => {
      const client = new AllternitOllama({ baseURL: 'http://localhost:11434' });
      expect(client).toBeDefined();
    });

    it('should accept custom default model', () => {
      const client = new AllternitOllama({ 
        baseURL: 'http://localhost:11434',
        defaultModel: 'mistral'
      });
      expect(client).toBeDefined();
    });
  });

  describe('listModels', () => {
    it('should list available models', async () => {
      const mockModels = {
        models: [
          { name: 'llama2', size: 3825819519, digest: 'fe938a131f3' },
          { name: 'mistral', size: 4113301824, digest: '61e6e7f29bd7' }
        ]
      };

      global.fetch = () => Promise.resolve({
        ok: true,
        json: () => Promise.resolve(mockModels),
      } as Response);

      const client = new AllternitOllama({ baseURL: 'http://localhost:11434' });
      const models = await client.listModels();

      expect(models).toHaveLength(2);
      expect(models[0].name).toBe('llama2');
      expect(models[1].name).toBe('mistral');
    });

    it('should handle empty model list', async () => {
      global.fetch = () => Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ models: [] }),
      } as Response);

      const client = new AllternitOllama({ baseURL: 'http://localhost:11434' });
      const models = await client.listModels();

      expect(models).toHaveLength(0);
    });

    it('should throw error when server returns error', async () => {
      global.fetch = () => Promise.resolve({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
      } as Response);

      const client = new AllternitOllama({ baseURL: 'http://localhost:11434' });

      try {
        await client.listModels();
        expect(false).toBe(true);
      } catch (error) {
        expect(error).toBeInstanceOf(Error);
        expect((error as Error).message).toContain('Failed to list models');
      }
    });
  });

  describe('isAvailable', () => {
    it('should return true when server is responsive', async () => {
      global.fetch = () => Promise.resolve({
        ok: true,
      } as Response);

      const client = new AllternitOllama({ baseURL: 'http://localhost:11434' });
      const available = await client.isAvailable();

      expect(available).toBe(true);
    });

    it('should return false when server is down', async () => {
      global.fetch = () => Promise.reject(new Error('Connection refused'));

      const client = new AllternitOllama({ baseURL: 'http://localhost:11434' });
      const available = await client.isAvailable();

      expect(available).toBe(false);
    });

    it('should return false on non-ok response', async () => {
      global.fetch = () => Promise.resolve({
        ok: false,
        status: 503,
      } as Response);

      const client = new AllternitOllama({ baseURL: 'http://localhost:11434' });
      const available = await client.isAvailable();

      expect(available).toBe(false);
    });
  });

  describe('generate', () => {
    it('should stream generation chunks', async () => {
      const mockChunks = [
        JSON.stringify({ response: 'The', done: false }),
        JSON.stringify({ response: ' quick', done: false }),
        JSON.stringify({ response: ' brown', done: false }),
        JSON.stringify({ response: ' fox', done: true }),
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

      const client = new AllternitOllama({ baseURL: 'http://localhost:11434' });
      const generator = client.generate({
        model: 'llama2',
        prompt: 'Complete the sentence'
      });

      const results: string[] = [];
      for await (const chunk of generator) {
        results.push(chunk);
      }

      expect(results).toEqual(['The', ' quick', ' brown', ' fox']);
    });

    it('should include system prompt when provided', async () => {
      let requestBody: any;

      global.fetch = (url: any, options: any) => {
        requestBody = JSON.parse(options.body);
        return Promise.resolve({
          ok: true,
          body: new ReadableStream({
            start(controller) {
              controller.enqueue(new TextEncoder().encode('{"response": "Hi", "done": true}\n'));
              controller.close();
            }
          }),
        } as Response);
      };

      const client = new AllternitOllama({ baseURL: 'http://localhost:11434' });
      const generator = client.generate({
        model: 'llama2',
        prompt: 'Hello',
        system: 'You are helpful'
      });

      await generator.next();

      expect(requestBody.system).toBe('You are helpful');
    });

    it('should throw error on failed generation', async () => {
      global.fetch = () => Promise.resolve({
        ok: false,
        status: 400,
        statusText: 'Bad Request',
      } as Response);

      const client = new AllternitOllama({ baseURL: 'http://localhost:11434' });

      try {
        const generator = client.generate({
          model: 'llama2',
          prompt: 'Test'
        });
        await generator.next();
        expect(false).toBe(true);
      } catch (error) {
        expect(error).toBeInstanceOf(Error);
        expect((error as Error).message).toContain('Generation failed');
      }
    });
  });

  describe('chat', () => {
    it('should stream chat responses', async () => {
      const mockChunks = [
        JSON.stringify({ message: { role: 'assistant', content: 'Hello' }, done: false }),
        JSON.stringify({ message: { role: 'assistant', content: '!' }, done: true }),
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

      const client = new AllternitOllama({ baseURL: 'http://localhost:11434' });
      const generator = client.chat({
        model: 'llama2',
        messages: [
          { role: 'user', content: 'Hi' }
        ]
      });

      const results: string[] = [];
      for await (const chunk of generator) {
        results.push(chunk);
      }

      expect(results).toEqual(['Hello', '!']);
    });

    it('should include tools when provided', async () => {
      let requestBody: any;

      global.fetch = (url: any, options: any) => {
        requestBody = JSON.parse(options.body);
        return Promise.resolve({
          ok: true,
          body: new ReadableStream({
            start(controller) {
              controller.enqueue(new TextEncoder().encode('{"message": {"role": "assistant", "content": "Hi"}, "done": true}\n'));
              controller.close();
            }
          }),
        } as Response);
      };

      const client = new AllternitOllama({ baseURL: 'http://localhost:11434' });
      const generator = client.chat({
        model: 'llama2',
        messages: [{ role: 'user', content: 'What is the weather?' }],
        tools: [{
          name: 'get_weather',
          description: 'Get weather for a location',
          parameters: {
            type: 'object',
            properties: {
              location: { type: 'string' }
            },
            required: ['location']
          }
        }]
      });

      await generator.next();

      expect(requestBody.tools).toBeDefined();
      expect(requestBody.tools).toHaveLength(1);
      expect(requestBody.tools[0].name).toBe('get_weather');
    });

    it('should throw error on chat failure', async () => {
      global.fetch = () => Promise.resolve({
        ok: false,
        status: 404,
        statusText: 'Not Found',
      } as Response);

      const client = new AllternitOllama({ baseURL: 'http://localhost:11434' });

      try {
        const generator = client.chat({
          model: 'unknown-model',
          messages: [{ role: 'user', content: 'Hi' }]
        });
        await generator.next();
        expect(false).toBe(true);
      } catch (error) {
        expect(error).toBeInstanceOf(Error);
        expect((error as Error).message).toContain('Chat failed');
      }
    });
  });

  describe('pullModel', () => {
    it('should pull model successfully', async () => {
      global.fetch = () => Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ status: 'success' }),
      } as Response);

      const client = new AllternitOllama({ baseURL: 'http://localhost:11434' });
      
      // Should not throw
      await client.pullModel('llama2');
      expect(true).toBe(true);
    });

    it('should throw error on failed pull', async () => {
      global.fetch = () => Promise.resolve({
        ok: false,
        status: 404,
        statusText: 'Not Found',
      } as Response);

      const client = new AllternitOllama({ baseURL: 'http://localhost:11434' });

      try {
        await client.pullModel('nonexistent-model');
        expect(false).toBe(true);
      } catch (error) {
        expect(error).toBeInstanceOf(Error);
        expect((error as Error).message).toContain('Failed to pull model');
      }
    });
  });
});
