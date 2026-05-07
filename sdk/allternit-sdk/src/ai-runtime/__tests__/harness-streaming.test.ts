import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { AllternitHarness } from '../harness/index.js';
import type { StreamRequest } from '../harness/types.js';

describe('AllternitHarness Streaming', () => {
  const mockFetch = vi.fn();
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    globalThis.fetch = mockFetch;
    mockFetch.mockClear();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  describe('Google Gemini (streamFromGoogle)', () => {
    it('should stream text chunks from Gemini API', async () => {
      const harness = new AllternitHarness({
        mode: 'byok',
        byok: { google: { apiKey: 'test-google-key' } },
      });

      const streamRequest: StreamRequest = {
        provider: 'google',
        model: 'gemini-2.0-flash',
        messages: [{ role: 'user', content: 'Hello' }],
      };

      // Mock SSE response
      mockFetch.mockResolvedValueOnce({
        ok: true,
        body: new ReadableStream({
          start(controller) {
            const encoder = new TextEncoder();
            const chunk1 = JSON.stringify({ candidates: [{ content: { parts: [{ text: 'Hello ' }] } }] });
            const chunk2 = JSON.stringify({ candidates: [{ content: { parts: [{ text: 'world!' }] } }] });
            controller.enqueue(encoder.encode(`data: ${chunk1}\n\n`));
            controller.enqueue(encoder.encode(`data: ${chunk2}\n\n`));
            controller.enqueue(encoder.encode('data: [DONE]\n\n'));
            controller.close();
          },
        }),
      });

      const chunks: string[] = [];
      for await (const chunk of harness.stream(streamRequest)) {
        if (chunk.type === 'text') chunks.push(chunk.text);
      }

      expect(chunks).toEqual(['Hello ', 'world!']);
      expect(mockFetch).toHaveBeenCalledTimes(1);
      const callArgs = mockFetch.mock.calls[0];
      expect(callArgs[0]).toContain('generativelanguage.googleapis.com');
      expect(callArgs[0]).toContain('gemini-2.0-flash');
    });

    it('should throw when Google API key is missing', () => {
      // Config validation happens at construction time
      expect(() => {
        new AllternitHarness({
          mode: 'byok',
          byok: {},
        });
      }).toThrow('BYOK mode requires at least one provider API key');
    });
  });

  describe('Local/Ollama (streamFromLocal)', () => {
    it('should stream text chunks from local OpenAI-compatible endpoint', async () => {
      const harness = new AllternitHarness({
        mode: 'local',
        local: { baseURL: 'http://localhost:11434/v1' },
      });

      const streamRequest: StreamRequest = {
        provider: 'openai',
        model: 'llama3.2',
        messages: [{ role: 'user', content: 'Hello' }],
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        body: new ReadableStream({
          start(controller) {
            const encoder = new TextEncoder();
            const chunk1 = JSON.stringify({ choices: [{ delta: { content: 'Hi ' } }] });
            const chunk2 = JSON.stringify({ choices: [{ delta: { content: 'there!' } }] });
            const chunk3 = JSON.stringify({ choices: [{ delta: {}, finish_reason: 'stop' }] });
            controller.enqueue(encoder.encode(`data: ${chunk1}\n\n`));
            controller.enqueue(encoder.encode(`data: ${chunk2}\n\n`));
            controller.enqueue(encoder.encode(`data: ${chunk3}\n\n`));
            controller.close();
          },
        }),
      });

      const chunks: string[] = [];
      for await (const chunk of harness.stream(streamRequest)) {
        if (chunk.type === 'text') chunks.push(chunk.text);
      }

      expect(chunks).toEqual(['Hi ', 'there!']);
      expect(mockFetch).toHaveBeenCalledTimes(1);
      const callArgs = mockFetch.mock.calls[0];
      expect(callArgs[0]).toBe('http://localhost:11434/v1/chat/completions');
    });

    it('should throw when local baseURL is missing', () => {
      expect(() => {
        new AllternitHarness({
          mode: 'local',
          local: { baseURL: '' as any },
        });
      }).toThrow('Local mode requires baseURL');
    });
  });

  describe('Subprocess (streamFromSubprocess)', () => {
    it('should throw when subprocess command is missing', () => {
      expect(() => {
        new AllternitHarness({
          mode: 'subprocess',
          subprocess: { command: '' },
        });
      }).toThrow('Subprocess mode requires command');
    });

    it('should accept valid subprocess config', () => {
      const harness = new AllternitHarness({
        mode: 'subprocess',
        subprocess: { command: 'node', args: ['--version'] },
      });
      expect(harness).toBeDefined();
    });
  });
});
