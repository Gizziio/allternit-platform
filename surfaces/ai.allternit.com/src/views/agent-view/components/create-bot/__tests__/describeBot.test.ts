import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  describeBot,
  refineSystemPrompt,
  validateDescribeBotResult,
  DESCRIBE_BOT_TIMEOUT_MS,
} from '../describeBot';
import { getDefaultAgentModel } from '@/lib/agents/agent-models';
import { BOT_NATIVE_TOOLS } from '@/lib/bots/bot-tool-registry';

function mockCompletion(content: string) {
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ choices: [{ message: { content } }] }),
    }),
  );
}

describe('describeBot', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it('maps a valid response onto the result shape and filters invalid tools', async () => {
    mockCompletion(
      JSON.stringify({
        displayName: 'Scout — Pricing Analyst',
        tagline: 'Tracks competitor pricing',
        botCategory: 'research',
        description: 'Checks competitor pricing every morning and summarizes changes.',
        systemPrompt: 'You are a pricing analyst. Check competitor prices, summarize changes.',
        welcomeMessage: 'Morning pricing brief ready when you are.',
        starterPrompts: ['Compare our price to Acme', 'Summarize this week’s changes'],
        allowedTools: ['web_search', 'web_fetch', 'not_a_real_tool'],
        suggestedTemplateId: 'deep-researcher',
      }),
    );

    const result = await describeBot({ description: 'A bot that watches competitor prices' });

    expect(result).not.toBeNull();
    expect(result?.displayName).toBe('Scout — Pricing Analyst');
    expect(result?.botCategory).toBe('research');
    expect(result?.allowedTools).toEqual(['web_search', 'web_fetch']);
    expect(result?.suggestedTemplateId).toBe('deep-researcher');
    expect(result?.starterPrompts).toHaveLength(2);

    // The request must hit the platform chat-completions route with the
    // platform default model and forced JSON.
    const [url, init] = (fetch as unknown as ReturnType<typeof vi.fn>).mock.calls[0] as [
      string,
      RequestInit,
    ];
    expect(url).toContain('/api/chat/completions');
    const body = JSON.parse(String(init.body));
    expect(body.model).toBe(getDefaultAgentModel().id);
    expect(body.stream).toBe(false);
    expect(body.response_format).toEqual({ type: 'json_object' });
    expect(body.messages[0].role).toBe('system');
    expect(body.messages[1].content).toContain('competitor prices');
  });

  it('drops unknown categories and unknown template ids defensively', async () => {
    mockCompletion(
      JSON.stringify({
        displayName: 'Odd',
        botCategory: 'not-a-category',
        suggestedTemplateId: 'not-a-template',
        allowedTools: ['memory'],
      }),
    );
    const result = await describeBot({ description: 'something strange' });
    expect(result?.displayName).toBe('Odd');
    expect(result?.botCategory).toBeUndefined();
    expect(result?.suggestedTemplateId).toBeUndefined();
    expect(result?.allowedTools).toEqual(['memory']);
  });

  it('tolerates JSON wrapped in a code fence', async () => {
    mockCompletion('```json\n{"displayName":"Fenced"}\n```');
    const result = await describeBot({ description: 'x' });
    expect(result?.displayName).toBe('Fenced');
  });

  it('returns null on malformed JSON', async () => {
    mockCompletion('Here is your bot: no structured output at all');
    expect(await describeBot({ description: 'x' })).toBeNull();
  });

  it('returns null on a non-ok response', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 500 }));
    expect(await describeBot({ description: 'x' })).toBeNull();
  });

  it('returns null on a rejected request', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network down')));
    expect(await describeBot({ description: 'x' })).toBeNull();
  });

  it('returns null on timeout instead of hanging the wizard', async () => {
    vi.useFakeTimers();
    vi.stubGlobal(
      'fetch',
      vi.fn(
        (_url: string, init: RequestInit) =>
          new Promise((_resolve, reject) => {
            init.signal?.addEventListener('abort', () =>
              reject(new DOMException('Aborted', 'AbortError')),
            );
          }),
      ),
    );
    const promise = describeBot({ description: 'x' });
    await vi.advanceTimersByTimeAsync(DESCRIBE_BOT_TIMEOUT_MS + 100);
    expect(await promise).toBeNull();
  });

  it('returns null immediately for empty input', async () => {
    const spy = vi.fn();
    vi.stubGlobal('fetch', spy);
    expect(await describeBot({ description: '   ' })).toBeNull();
    expect(spy).not.toHaveBeenCalled();
  });

  it('refineSystemPrompt passes current instructions as context', async () => {
    mockCompletion(JSON.stringify({ systemPrompt: 'Refined job instructions.' }));
    const result = await refineSystemPrompt({
      description: 'A research bot',
      displayName: 'Scout',
      currentSystemPrompt: 'Do research.',
    });
    expect(result?.systemPrompt).toBe('Refined job instructions.');
    const [, init] = (fetch as unknown as ReturnType<typeof vi.fn>).mock.calls[0] as [
      string,
      RequestInit,
    ];
    const body = JSON.parse(String(init.body));
    expect(body.messages[1].content).toContain('Current bot name: Scout');
    expect(body.messages[1].content).toContain('Do research.');
  });
});

describe('validateDescribeBotResult', () => {
  it('returns null for non-objects and empty objects', () => {
    expect(validateDescribeBotResult(null)).toBeNull();
    expect(validateDescribeBotResult('string')).toBeNull();
    expect(validateDescribeBotResult({})).toBeNull();
  });

  it('caps starterPrompts at 5 and keeps only known tool ids', () => {
    const result = validateDescribeBotResult({
      starterPrompts: ['a', 'b', 'c', 'd', 'e', 'f', 'g'],
      allowedTools: BOT_NATIVE_TOOLS.map((t) => t.id).concat(['bogus']),
    });
    expect(result?.starterPrompts).toHaveLength(5);
    expect(result?.allowedTools).not.toContain('bogus');
    expect(result?.allowedTools).toHaveLength(BOT_NATIVE_TOOLS.length);
  });

  it('ignores wrong-typed fields', () => {
    const result = validateDescribeBotResult({
      displayName: 42,
      tagline: 'ok',
      starterPrompts: 'not-an-array',
    });
    expect(result?.displayName).toBeUndefined();
    expect(result?.tagline).toBe('ok');
    expect(result?.starterPrompts).toBeUndefined();
  });
});
