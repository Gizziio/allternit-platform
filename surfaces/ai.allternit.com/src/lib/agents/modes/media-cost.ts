/**
 * Media generation cost preview (MEDIA_PLUGINS Phase 1).
 *
 * Unit prices come from the provider list in `docs/MEDIA_PLUGINS_MAP.md`
 * (fal.ai model pages, MiniMax pay-as-you-go page, OpenAI image pricing),
 * mirrored here so the UI can show unit price × requested units BEFORE any
 * metered generate. Copy stays in voice Register 1: plain, direct, no
 * quality guarantees.
 *
 * The server holds the same numbers in `cmd/allternit-api/src/media/catalog.rs`;
 * keep the two in sync (the server is authoritative for billing records, this
 * module is for the pre-flight preview).
 */

export type VideoProviderId = 'minimax-h3' | 'fal-seedance';
export type ImageProviderId = 'gpt-image' | 'flux-fal';

export interface CostPreview {
  /** Unit price in USD (per second of video, per image, or per megapixel). */
  unitPriceUsd: number;
  /** What one unit buys — plain words for the preview line. */
  unitLabel: string;
  /** How many units the request will consume. */
  units: number;
  totalUsd: number;
  /** Register-1 preview sentence, e.g. "About $0.48 for 6 seconds at 768P." */
  summary: string;
}

const MINIMAX_H3_PRICE_PER_SECOND: Record<string, number> = {
  // $0.08/s at 768P is from the official MiniMax pay-as-you-go page.
  '768P': 0.08,
  // 2K is corroborated by third-party writeups but not directly listed on the
  // official paygo table — flagged so the preview can say so.
  '2K': 0.13,
};

const SEEDANCE_PRICE_PER_SECOND: Record<string, number> = {
  // fal.ai Seedance 2.0 model page, 720p with audio.
  'fast:720p': 0.2419,
  'standard:720p': 0.3034,
  'standard:1080p': 0.682,
};

const GPT_IMAGE_PRICE_PER_IMAGE: Record<string, number> = {
  // OpenAI gpt-image pricing at 1024².
  low: 0.006,
  medium: 0.053,
  high: 0.211,
};

/** FLUX schnell via fal: $0.003 per megapixel, rounded up. */
export const FLUX_PRICE_PER_MEGAPIXEL = 0.003;

function usd(amount: number): string {
  return amount < 0.01 ? `$${amount.toFixed(4)}` : `$${amount.toFixed(2)}`;
}

/** Video preview: unit price is per output second. */
export function previewVideoCost(
  provider: VideoProviderId,
  durationSeconds: number,
  options: { resolution?: string; falTier?: 'fast' | 'standard' } = {},
): CostPreview {
  let unitPriceUsd: number;
  let unitLabel: string;
  let note = '';

  if (provider === 'minimax-h3') {
    const resolution = options.resolution ?? '768P';
    unitPriceUsd = MINIMAX_H3_PRICE_PER_SECOND[resolution] ?? MINIMAX_H3_PRICE_PER_SECOND['768P'];
    unitLabel = `second of video at ${resolution}`;
    if (resolution === '2K') {
      note = ' The 2K price is not listed on the official pay-as-you-go table; treat it as an estimate.';
    }
  } else {
    const resolution = options.resolution ?? '720p';
    const tier = options.falTier ?? 'fast';
    const key = resolution === '1080p' ? 'standard:1080p' : `${tier}:${resolution}`;
    unitPriceUsd = SEEDANCE_PRICE_PER_SECOND[key] ?? SEEDANCE_PRICE_PER_SECOND['fast:720p'];
    unitLabel = `second of video (${tier}, ${resolution})`;
  }

  const units = Math.max(1, Math.round(durationSeconds));
  const totalUsd = unitPriceUsd * units;
  return {
    unitPriceUsd,
    unitLabel,
    units,
    totalUsd,
    summary: `About ${usd(totalUsd)} for ${units} ${unitLabel.replace('second of video', units === 1 ? 'second of video' : 'seconds of video')}.${note}`,
  };
}

/** Image preview: gpt-image prices per image; FLUX prices per megapixel. */
export function previewImageCost(
  provider: ImageProviderId,
  options: { quality?: string; size?: string; n?: number } = {},
): CostPreview {
  const n = Math.max(1, Math.min(4, options.n ?? 1));

  if (provider === 'gpt-image') {
    const quality = options.quality ?? 'medium';
    const unitPriceUsd = GPT_IMAGE_PRICE_PER_IMAGE[quality] ?? GPT_IMAGE_PRICE_PER_IMAGE.medium;
    const totalUsd = unitPriceUsd * n;
    return {
      unitPriceUsd,
      unitLabel: `image (${quality} quality)`,
      units: n,
      totalUsd,
      summary:
        `About ${usd(totalUsd)} for ${n} ${quality}-quality image${n === 1 ? '' : 's'}. ` +
        'The Batch API is 50% cheaper; interactive generation does not use it.',
    };
  }

  // FLUX schnell: megapixels rounded up to the nearest whole.
  const size = options.size ?? '1024x1024';
  const [w, h] = size.split('x').map((v) => Number(v) || 1024);
  const megapixels = Math.max(1, Math.ceil((w * h) / 1_000_000));
  const unitPriceUsd = FLUX_PRICE_PER_MEGAPIXEL;
  const totalUsd = unitPriceUsd * megapixels * n;
  return {
    unitPriceUsd,
    unitLabel: 'megapixel (rounded up)',
    units: megapixels * n,
    totalUsd,
    summary: `About ${usd(totalUsd)} for ${n} image${n === 1 ? '' : 's'} at ${size} (${megapixels} MP each, rounded up).`,
  };
}
