/**
 * Automatic model router for AllternitHarness.
 *
 * Builds a tier map from whatever provider keys are present in BYOKConfig,
 * then scores each request and returns the right provider+model.
 * Zero configuration required — callers just pass provider: "auto".
 */
import type { BYOKConfig, Message, Tool } from './types.js';
export type Tier = 'simple' | 'standard' | 'complex' | 'reasoning';
export interface TierMap {
    simple: {
        provider: string;
        model: string;
    };
    standard: {
        provider: string;
        model: string;
    };
    complex: {
        provider: string;
        model: string;
    };
    reasoning: {
        provider: string;
        model: string;
    };
}
/**
 * Build a tier map from available provider keys.
 * Picks the best cross-provider option for each tier, falling back to
 * single-provider ladders if only one key is present.
 */
export declare function buildTierMap(keys: BYOKConfig['keys']): TierMap;
/**
 * Score a request and return the appropriate tier.
 * Processes only the last 3 user messages for speed.
 */
export declare function scoreMessages(messages: Message[], tools?: Tool[]): Tier;
//# sourceMappingURL=router.d.ts.map