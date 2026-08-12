import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AllternitHarness } from '../harness/index.js';

describe('Anthropic citations', () => {
  const originalFetch = globalThis.fetch;
  beforeEach(() => { vi.restoreAllMocks(); });
  afterEach(() => { globalThis.fetch = originalFetch; });

  it('returns provider citations from stream and run events', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      body: new ReadableStream({ start(controller) {
        const encode = new TextEncoder();
        const events = [
          { type: 'message_start', message: { usage: { input_tokens: 4 } } },
          { type: 'content_block_delta', delta: { type: 'text_delta', text: 'Answer' } },
          { type: 'content_block_delta', delta: { type: 'citations_delta', citation: {
            cited_text: 'Source text', document_title: 'Guide', url: 'https://example.test', document_index: 0,
          } } },
          { type: 'message_delta', usage: { output_tokens: 2 } },
        ];
        for (const event of events) controller.enqueue(encode.encode(`data: ${JSON.stringify(event)}\n\n`));
        controller.close();
      } }),
    });
    const harness = new AllternitHarness({ mode: 'byok', byok: { anthropic: { apiKey: 'key' } } });

    const result = await harness.run({
      provider: 'anthropic', model: 'claude-test', citations: true,
      messages: [{ role: 'user', content: 'Question' }],
    });

    expect(result.content).toBe('Answer');
    expect(result.citations?.[0]).toMatchObject({ title: 'Guide', citedText: 'Source text' });
    expect(result.usage?.totalTokens).toBe(6);
  });

  it('extracts page_number and document_title from citations_delta events', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      body: new ReadableStream({ start(controller) {
        const encode = new TextEncoder();
        const events = [
          { type: 'message_start', message: { usage: { input_tokens: 4 } } },
          { type: 'content_block_delta', delta: { type: 'text_delta', text: 'Per the guide' } },
          { type: 'content_block_delta', delta: { type: 'citations_delta', citation: {
            cited_text: 'PDF excerpt',
            document_title: 'User Manual',
            url: 'https://example.test/manual.pdf',
            document_index: 1,
            start_char_index: 120,
            end_char_index: 135,
            page_number: 7,
          } } },
          { type: 'message_delta', usage: { output_tokens: 3 } },
        ];
        for (const event of events) controller.enqueue(encode.encode(`data: ${JSON.stringify(event)}\n\n`));
        controller.close();
      } }),
    });
    const harness = new AllternitHarness({ mode: 'byok', byok: { anthropic: { apiKey: 'key' } } });

    const result = await harness.run({
      provider: 'anthropic', model: 'claude-test', citations: true,
      messages: [{ role: 'user', content: 'Question' }],
    });

    expect(result.citations).toHaveLength(1);
    expect(result.citations?.[0]).toMatchObject({
      citedText: 'PDF excerpt',
      title: 'User Manual',
      documentTitle: 'User Manual',
      url: 'https://example.test/manual.pdf',
      documentIndex: 1,
      startCharIndex: 120,
      endCharIndex: 135,
      pageNumber: 7,
    });
  });
});
