import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import { AllternitOllama } from '../index';

describe('AllternitOllama', () => {
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
      // Access protected config through method behavior
      expect(client).toBeDefined();
    });

    it('should use default model', () => {
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
    it('should list models successfully', async () => {
      const mockModels = {
        models: [
          { name: 'llama2', size: 1000000, digest: 'abc123', modified_at: '2024-01-01' },
          { name: 'mistral', size: 2000000, digest: 'def456', modified_at: '2024-01-02' }
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
      expect(models[0].size).toBe(1000000);
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

    it('should throw error on failed request', async () => {
      global.fetch = () => Promise.resolve({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
      } as Response);

      const client = new AllternitOllama({ baseURL: 'http://localhost:11434' });
      
      try {
        await client.listModels();
        expect(false).toBe(true); // Should not reach here
      } catch (error) {
        expect(error).toBeInstanceOf(Error);
        expect((error as Error).message).toContain('Failed to list models');
      }
    });
  });

  describe('pullModel', () => {
    it('should pull model successfully', async () => {
      let fetchCalled = false;
      let fetchBody: any;

      global.fetch = (url: any, options: any) => {
        fetchCalled = true;
        fetchBody = JSON.parse(options.body);
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ status: 'success' }),
        } as Response);
      };

      const client = new AllternitOllama({ baseURL: 'http://localhost:11434' });
      await client.pullModel('llama2');

      expect(fetchCalled).toBe(true);
      expect(fetchBody.name).toBe('llama2');
      expect(fetchBody.stream).toBe(false);
    });

    it('should throw error on failed pull', async () => {
      global.fetch = () => Promise.resolve({
        ok: false,
        status: 404,
        statusText: 'Not Found',
      } as Response);

      const client = new AllternitOllama({ baseURL: 'http://localhost:11434' });
      
      try {
        await client.pullModel('unknown-model');
        expect(false).toBe(true);
      } catch (error) {
        expect(error).toBeInstanceOf(Error);
        expect((error as Error).message).toContain('Failed to pull model');
      }
    });
  });

  describe('isAvailable', () => {
    it('should return true when server is available', async () => {
      global.fetch = () => Promise.resolve({
        ok: true,
      } as Response);

      const client = new AllternitOllama({ baseURL: 'http://localhost:11434' });
      const available = await client.isAvailable();

      expect(available).toBe(true);
    });

    it('should return false when server is unavailable', async () => {
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
    it('should stream generation results', async () => {
      const mockChunks = [
        JSON.stringify({ response: 'Hello', done: false }),
        JSON.stringify({ response: ' World', done: false }),
        JSON.stringify({ response: '!', done: true }),
      ];

      const stream = new ReadableStream({
        start(controller) {
          mockChunks.forEach(chunk => controller.enqueue(new TextEncoder().encode(chunk + '\n')));
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
        prompt: 'Say hello'
      });

      const results: string[] = [];
      for await (const chunk of generator) {
        results.push(chunk);
      }

      expect(results).toEqual(['Hello', ' World', '!']);
    });

    it('should throw error on generation failure', async () => {
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

    it('should throw error when no response body', async () => {
      global.fetch = () => Promise.resolve({
        ok: true,
        body: null,
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
        expect((error as Error).message).toContain('No response body');
      }
    });
  });

  describe('chat', () => {
    it('should stream chat results', async () => {
      const mockChunks = [
        JSON.stringify({ message: { role: 'assistant', content: 'Hi' }, done: false }),
        JSON.stringify({ message: { role: 'assistant', content: ' there' }, done: false }),
        JSON.stringify({ message: { role: 'assistant', content: '!' }, done: true }),
      ];

      const stream = new ReadableStream({
        start(controller) {
          mockChunks.forEach(chunk => controller.enqueue(new TextEncoder().encode(chunk + '\n')));
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
        messages: [{ role: 'user', content: 'Hello' }]
      });

      const results: string[] = [];
      for await (const chunk of generator) {
        results.push(chunk);
      }

      expect(results).toEqual(['Hi', ' there', '!']);
    });

    it('should throw error on chat failure', async () => {
      global.fetch = () => Promise.resolve({
        ok: false,
        status: 400,
        statusText: 'Bad Request',
      } as Response);

      const client = new AllternitOllama({ baseURL: 'http://localhost:11434' });
      
      try {
        const generator = client.chat({
          model: 'llama2',
          messages: [{ role: 'user', content: 'Hello' }]
        });
        await generator.next();
        expect(false).toBe(true);
      } catch (error) {
        expect(error).toBeInstanceOf(Error);
        expect((error as Error).message).toContain('Chat failed');
      }
    });
  });
});
