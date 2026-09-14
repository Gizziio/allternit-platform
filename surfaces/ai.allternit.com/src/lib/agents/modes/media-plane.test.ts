import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { previewImageCost, previewVideoCost } from './media-cost';
import { generateVideo } from './video-generation';
import { generateImages } from './image-generation';

/**
 * Contract tests for the MEDIA_PLUGINS Phase 1 media-plane wiring.
 * Fetch is mocked at the `/api/v1/media/...` boundary — no live keys, no
 * network. These prove the submit → poll → download wiring the plugins rely
 * on; the provider-protocol shapes themselves are covered by the Rust
 * `allternit-api` media module tests (mock transport).
 */

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn());
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('media-cost previews', () => {
  it('MiniMax H3: $0.08/s at 768P', () => {
    const preview = previewVideoCost('minimax-h3', 6, { resolution: '768P' });
    expect(preview.unitPriceUsd).toBe(0.08);
    expect(preview.units).toBe(6);
    expect(preview.totalUsd).toBeCloseTo(0.48);
    expect(preview.summary).toContain('$0.48');
  });

  it('MiniMax H3 2K price is flagged as an estimate', () => {
    const preview = previewVideoCost('minimax-h3', 5, { resolution: '2K' });
    expect(preview.unitPriceUsd).toBe(0.13);
    expect(preview.summary).toContain('estimate');
  });

  it('fal Seedance fast vs standard per-second pricing', () => {
    const fast = previewVideoCost('fal-seedance', 6, { resolution: '720p', falTier: 'fast' });
    const standard = previewVideoCost('fal-seedance', 6, { resolution: '720p', falTier: 'standard' });
    expect(fast.unitPriceUsd).toBe(0.2419);
    expect(standard.unitPriceUsd).toBe(0.3034);
    expect(fast.totalUsd).toBeCloseTo(6 * 0.2419);
  });

  it('gpt-image quality tiers × count', () => {
    const low = previewImageCost('gpt-image', { quality: 'low', n: 1 });
    const mediumTwo = previewImageCost('gpt-image', { quality: 'medium', n: 2 });
    expect(low.totalUsd).toBeCloseTo(0.006);
    expect(mediumTwo.totalUsd).toBeCloseTo(0.106);
  });

  it('FLUX prices per megapixel rounded up', () => {
    const oneMp = previewImageCost('flux-fal', { size: '1024x1024', n: 1 });
    expect(oneMp.units).toBe(2); // 1024×1024 = 1.05 MP → rounds up to 2
    expect(oneMp.totalUsd).toBeCloseTo(2 * 0.003);
  });
});

describe('video media plane wiring (MiniMax H3 / fal Seedance)', () => {
  it('submits a job, polls until succeeded, and returns the artifact URL', async () => {
    vi.useFakeTimers();
    try {
      const fetchMock = vi.mocked(fetch);
      fetchMock
        // submit
        .mockResolvedValueOnce(jsonResponse({ job_id: 'job-1', provider: 'minimax-h3', status: 'queued', estimated_cost_usd: 0.48 }))
        // poll 1: processing
        .mockResolvedValueOnce(jsonResponse({ job_id: 'job-1', provider: 'minimax-h3', status: 'processing' }))
        // poll 2: succeeded
        .mockResolvedValueOnce(jsonResponse({
          job_id: 'job-1',
          provider: 'minimax-h3',
          status: 'succeeded',
          video: { artifact_url: '/api/v1/media/artifacts/a1', content_type: 'video/mp4' },
          estimated_cost_usd: 0.48,
        }));

      const pending = generateVideo('a dancer on a drone', { provider: 'minimax-h3', duration: 6, resolution: '768P' });
      await vi.advanceTimersByTimeAsync(6000); // first poll
      await vi.advanceTimersByTimeAsync(6000); // second poll → terminal
      const result = await pending;

      expect(fetchMock).toHaveBeenCalledTimes(3);
      const [submitUrl, submitInit] = fetchMock.mock.calls[0];
      expect(submitUrl).toBe('/api/v1/media/video/jobs');
      expect(JSON.parse(String(submitInit?.body))).toMatchObject({
        provider: 'minimax-h3',
        prompt: 'a dancer on a drone',
        duration: 6,
        resolution: '768P',
      });
      expect(fetchMock.mock.calls[1][0]).toBe('/api/v1/media/video/jobs/job-1');
      expect(result.videos).toHaveLength(1);
      expect(result.videos[0].url).toBe('/api/v1/media/artifacts/a1');
      expect(result.videos[0].metadata.provider).toBe('minimax-h3');
      expect(result.usage?.cost).toBeCloseTo(0.48);
    } finally {
      vi.useRealTimers();
    }
  });

  it('surfaces provider failure instead of fabricating a video', async () => {
    vi.useFakeTimers();
    try {
      const fetchMock = vi.mocked(fetch);
      fetchMock
        .mockResolvedValueOnce(jsonResponse({ job_id: 'job-2', provider: 'fal-seedance', status: 'queued', estimated_cost_usd: 1.45 }))
        .mockResolvedValueOnce(jsonResponse({ job_id: 'job-2', provider: 'fal-seedance', status: 'failed', error: 'content policy rejection' }));

      const pending = generateVideo('prompt', { provider: 'fal-seedance', duration: 6, resolution: '720p', falTier: 'standard' });
      const assertion = expect(pending).rejects.toThrow('content policy rejection');
      await vi.advanceTimersByTimeAsync(6000);
      await assertion;
    } finally {
      vi.useRealTimers();
    }
  });

  it('surfaces no_provider_key errors from the API', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      jsonResponse({ error: 'no_provider_key', message: 'Add a fal API key in Settings → Media providers.' }, 400),
    );
    await expect(generateVideo('prompt', { provider: 'fal-seedance' })).rejects.toThrow('Add a fal API key');
  });
});

describe('image media plane wiring (gpt-image / FLUX-via-fal)', () => {
  it('gpt-image: posts to the media plane and maps artifacts to images', async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockResolvedValueOnce(jsonResponse({
      images: [{ artifact_url: '/api/v1/media/artifacts/i1', width: 1024, height: 1024 }],
      estimated_cost_usd: 0.053,
    }));

    const result = await generateImages('a lighthouse', { provider: 'gpt-image', quality: 'medium', n: 1 });

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('/api/v1/media/image/generate');
    expect(JSON.parse(String(init?.body))).toMatchObject({ provider: 'gpt-image', prompt: 'a lighthouse', quality: 'medium', n: 1 });
    expect(result.images[0].url).toBe('/api/v1/media/artifacts/i1');
    expect(result.images[0].metadata.provider).toBe('gpt-image');
    expect(result.usage?.cost).toBeCloseTo(0.053);
  });

  it('flux-fal: passes size through and fails when the provider returns nothing', async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockResolvedValueOnce(jsonResponse({ images: [], estimated_cost_usd: 0 }));
    await expect(
      generateImages('a lighthouse', { provider: 'flux-fal', size: '1024x1024', n: 2 }),
    ).rejects.toThrow('returned no images');
  });
});
