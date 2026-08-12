import { describe, it, expect, afterEach } from 'bun:test';
import { AllternitHarness } from '../index';
import { HarnessError, HarnessErrorCode } from '../types';

describe('Harness middleware', () => {
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

  function successEvents(content = 'Hi') {
    return [
      'data: {"type":"message_start","message":{"usage":{"input_tokens":10}}}\n\n',
      `data: {"type":"content_block_delta","delta":{"type":"text_delta","text":"${content}"}}\n\n`,
      'data: {"type":"message_delta","usage":{"output_tokens":5},"delta":{"stop_reason":"end_turn"}}\n\n',
      'data: {"type":"message_stop"}\n\n',
    ];
  }

  it('applies beforeRequest middleware before routing', async () => {
    let capturedModel: string | undefined;

    const harness = new AllternitHarness({
      mode: 'byok',
      byok: { anthropic: { apiKey: 'test-key' } },
      retry: { maxRetries: 0 },
      middleware: {
        beforeRequest: (request) => {
          capturedModel = request.model;
          return { ...request, model: 'modified-model' };
        },
      },
    });

    let requestBody: Record<string, unknown> | undefined;
    globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      void input;
      requestBody = JSON.parse(init?.body as string);
      return new Response(sseBody(successEvents()), { status: 200 });
    }) as typeof fetch;

    await harness.run({
      provider: 'anthropic',
      model: 'original-model',
      messages: [{ role: 'user', content: 'Hello' }],
    });

    expect(capturedModel).toBe('original-model');
    expect(requestBody?.model).toBe('modified-model');
  });

  it('applies afterResponse middleware on run()', async () => {
    const harness = new AllternitHarness({
      mode: 'byok',
      byok: { anthropic: { apiKey: 'test-key' } },
      retry: { maxRetries: 0 },
      middleware: {
        afterResponse: (response) => ({
          ...response,
          content: `${response.content}!`,
        }),
      },
    });

    globalThis.fetch = (async () => {
      return new Response(sseBody(successEvents('Hi')), { status: 200 });
    }) as typeof fetch;

    const response = await harness.run({
      provider: 'anthropic',
      model: 'claude-3-haiku',
      messages: [{ role: 'user', content: 'Hello' }],
    });

    expect(response.content).toBe('Hi!');
  });

  it('applies custom onError middleware to substitute a stream', async () => {
    const harness = new AllternitHarness({
      mode: 'byok',
      byok: { anthropic: { apiKey: 'test-key' } },
      retry: { maxRetries: 0 },
      middleware: {
        onError: async function* () {
          yield { type: 'text', text: 'recovered' };
          yield { type: 'done', usage: undefined, stopReason: 'end_turn' };
        },
      },
    });

    globalThis.fetch = (async () => {
      return new Response('bad request', { status: 400 });
    }) as typeof fetch;

    const response = await harness.run({
      provider: 'anthropic',
      model: 'claude-3-haiku',
      messages: [{ role: 'user', content: 'Hello' }],
    });

    expect(response.content).toBe('recovered');
  });

  it('retries retryable errors via the default retry middleware', async () => {
    let calls = 0;

    const harness = new AllternitHarness({
      mode: 'byok',
      byok: { anthropic: { apiKey: 'test-key' } },
      retry: { initialDelayMs: 1, maxDelayMs: 1, jitter: false },
    });

    globalThis.fetch = (async () => {
      calls++;
      if (calls === 1) {
        return new Response('rate limited', { status: 429 });
      }
      return new Response(sseBody(successEvents()), { status: 200 });
    }) as typeof fetch;

    const response = await harness.run({
      provider: 'anthropic',
      model: 'claude-3-haiku',
      messages: [{ role: 'user', content: 'Hello' }],
    });

    expect(calls).toBe(2);
    expect(response.content).toBe('Hi');
  });

  it('preserves legacy retry config behavior', async () => {
    let calls = 0;

    const harness = new AllternitHarness({
      mode: 'byok',
      byok: { anthropic: { apiKey: 'test-key' } },
      retry: { maxRetries: 1, initialDelayMs: 1, maxDelayMs: 1, jitter: false },
    });

    globalThis.fetch = (async () => {
      calls++;
      if (calls === 1) {
        throw new Error('network down');
      }
      return new Response(sseBody(successEvents()), { status: 200 });
    }) as typeof fetch;

    const response = await harness.run({
      provider: 'anthropic',
      model: 'claude-3-haiku',
      messages: [{ role: 'user', content: 'Hello' }],
    });

    expect(calls).toBe(2);
    expect(response.content).toBe('Hi');
  });

  it('falls back to the next model on provider refusal', async () => {
    let calls = 0;

    const harness = new AllternitHarness({
      mode: 'byok',
      byok: { anthropic: { apiKey: 'test-key' } },
      retry: { maxRetries: 0 },
      fallbackModels: [{ provider: 'anthropic', model: 'claude-fallback' }],
    });

    globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      calls++;
      const body = JSON.parse(init?.body as string) as { model: string };
      if (body.model === 'claude-refused') {
        return new Response(
          JSON.stringify({ error: { type: 'content_filter', message: 'content_filter' } }),
          { status: 400 }
        );
      }
      return new Response(sseBody(successEvents('Fallback')), { status: 200 });
    }) as typeof fetch;

    const response = await harness.run({
      provider: 'anthropic',
      model: 'claude-refused',
      messages: [{ role: 'user', content: 'Hello' }],
    });

    expect(calls).toBe(2);
    expect(response.content).toBe('Fallback');
  });

  it('throws the original error when refusal fallback is exhausted', async () => {
    const harness = new AllternitHarness({
      mode: 'byok',
      byok: { anthropic: { apiKey: 'test-key' } },
      retry: { maxRetries: 0 },
      fallbackModels: [{ provider: 'anthropic', model: 'claude-fallback' }],
    });

    globalThis.fetch = (async () => {
      return new Response(
        JSON.stringify({ error: { type: 'content_filter', message: 'content_filter' } }),
        { status: 400 }
      );
    }) as typeof fetch;

    try {
      await harness.run({
        provider: 'anthropic',
        model: 'claude-refused',
        messages: [{ role: 'user', content: 'Hello' }],
      });
      expect(false).toBe(true);
    } catch (error) {
      expect(error).toBeInstanceOf(HarnessError);
      if (error instanceof HarnessError) {
        expect(error.code).toBe(HarnessErrorCode.API_ERROR);
      }
    }
  });
});
