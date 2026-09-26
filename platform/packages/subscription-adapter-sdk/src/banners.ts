// §A3.1 — detectBanners: regex packs → QuotaSignal classification.
import type { QuotaSignal } from "@allternit/subscription-fabric-contracts";

export type QuotaSignalKind = QuotaSignal["kind"];

export interface BannerPattern {
  kind: QuotaSignalKind;
  pattern: RegExp;
}

export interface BannerMatch {
  kind: QuotaSignalKind;
  raw_excerpt: string;
}

export interface BannerClassifier {
  classify(text: string): BannerMatch | null;
}

export function createBannerClassifier(pack: BannerPattern[]): BannerClassifier {
  return {
    classify(text: string): BannerMatch | null {
      for (const { kind, pattern } of pack) {
        if (pattern.test(text)) {
          return { kind, raw_excerpt: text.slice(0, 500) };
        }
      }
      return null;
    },
  };
}
