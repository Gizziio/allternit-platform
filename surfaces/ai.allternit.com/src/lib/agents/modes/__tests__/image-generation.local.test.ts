import { afterEach, describe, expect, it, vi } from 'vitest';
import { checkBonsaiLocal, generateImages, generateImagesBonsaiLocal } from '../image-generation';

afterEach(() => vi.unstubAllGlobals());

describe('local Bonsai image generation', () => {
  it('is the default and returns a real PNG blob artifact', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(new Blob(['png'], { type: 'image/png' }), {
        status: 200,
        headers: { 'Content-Type': 'image/png' },
      }),
    );
    vi.stubGlobal('fetch', fetchMock);
    vi.stubGlobal('URL', { ...URL, createObjectURL: vi.fn(() => 'blob:bonsai-image') });

    const result = await generateImages('a red cube', { seed: 7, n: 1, size: '512x512' });

    expect(result.config.provider).toBe('bonsai-local');
    expect(result.images[0]?.url).toBe('blob:bonsai-image');
    expect(fetchMock).toHaveBeenCalledWith(
      'http://127.0.0.1:8000/generate',
      expect.objectContaining({ method: 'POST' }),
    );
    const request = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(request).toMatchObject({ seed: 7, width: 512, height: 512, backend: 'bonsai-ternary-mlx' });
  });

  it('does not silently fall back to a hosted provider', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('connection refused')));
    await expect(generateImagesBonsaiLocal('private prompt')).rejects.toThrow('local Bonsai service is unavailable');
  });

  it('reports companion health from the local backend response', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(Response.json({ healthy: true })));
    await expect(checkBonsaiLocal()).resolves.toBe(true);
  });
});
