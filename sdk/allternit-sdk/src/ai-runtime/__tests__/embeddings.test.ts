import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AllternitEmbeddings } from '../embeddings.js';

describe('AllternitEmbeddings', () => {
  const originalFetch = globalThis.fetch;
  const fetchMock = vi.fn();

  beforeEach(() => { globalThis.fetch = fetchMock; fetchMock.mockReset(); });
  afterEach(() => { globalThis.fetch = originalFetch; });

  it('uses OpenAI BYOK authentication and normalizes the endpoint', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ object: 'list', model: 'text-embedding-3-small', data: [
        { object: 'embedding', index: 0, embedding: [0.1, 0.2] },
      ] }),
    });
    const embeddings = new AllternitEmbeddings({
      mode: 'byok', byok: { openai: { apiKey: 'secret', baseURL: 'https://example.test/v1/' } },
    });

    const result = await embeddings.create({ model: 'text-embedding-3-small', input: 'hello' });

    expect(result.data[0].embedding).toEqual([0.1, 0.2]);
    expect(fetchMock).toHaveBeenCalledWith('https://example.test/v1/embeddings', expect.objectContaining({
      headers: expect.objectContaining({ authorization: 'Bearer secret' }),
    }));
  });
});
