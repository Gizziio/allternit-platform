export function types_ts(): void {
  // Not yet implemented
}

// Mirror of BillingType in src/runtime/services/oauth/types.ts — identical by
// design. (ReferralEligibilityResponse is NOT mirrored here: the eligibility
// cache in utils/config.ts stores the api/referral.ts payload shape, so that
// type is imported directly from ../services/api/referral.js.)
export type BillingType =
  | 'monthly'
  | 'annual'
  | 'usage'
  | 'stripe_subscription'
  | 'stripe_subscription_contracted'
  | 'apple_subscription'
  | 'google_play_subscription'
  | string

// Mirror of SubscriptionQuota in src/runtime/services/oauth/types.ts — the
// plan + remaining compute payload from GET /api/v1/me/usage.
export interface SubscriptionQuota {
  planId: string
  planTier: string
  monthlyQuotaUsd: number
  usageThisPeriodUsd: number
  status: string
}

export default types_ts
