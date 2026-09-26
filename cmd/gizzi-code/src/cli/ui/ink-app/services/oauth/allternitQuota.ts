/**
 * Allternit Cloud subscription quota client.
 *
 * Fetches the caller's plan + remaining compute from
 * GET /api/v1/me/usage on the Allternit control plane, using the same
 * access token the OAuth flow already minted. Best-effort by design:
 * callers must treat failures as "quota unknown", never as fatal.
 */

import axios from 'axios'

import { getOauthConfig } from '../../constants/oauth.js'

// TODO(types): the '@/*' path map resolves '@/services/oauth/types.js' to the
// ink-app stub; this twin needs the real runtime types module (sibling).
import type { SubscriptionQuota } from './types.js'

interface MeUsageResponse {
  plan: string
  planTier?: string
  plan_tier?: string
  weeklyLimit?: number
  weekly_limit?: number
  weeklyUsed?: number
  weekly_used?: number
  credits?: number | null
  status?: string
}

/**
 * Fetch the current subscription quota from the Allternit Cloud API.
 * Returns null when the endpoint is unreachable, unauthenticated, or
 * returns a shape we don't understand — quota display is optional.
 */
export async function fetchAllternitSubscriptionQuota(
  accessToken: string,
): Promise<SubscriptionQuota | null> {
  try {
    const response = await axios.get<MeUsageResponse>(
      `${getOauthConfig().BASE_API_URL}/api/v1/me/usage`,
      {
        headers: { Authorization: `Bearer ${accessToken}` },
        timeout: 10000,
      },
    )

    if (response.status !== 200) {
      return null
    }

    const data = response.data
    const planId = data.plan
    if (!planId) {
      return null
    }

    const planTier = data.planTier ?? data.plan_tier ?? 'free'
    const quotaLimit = data.weeklyLimit ?? data.weekly_limit ?? 0
    const quotaUsed = data.weeklyUsed ?? data.weekly_used ?? 0

    return {
      planId,
      planTier,
      monthlyQuotaUsd: quotaLimit,
      usageThisPeriodUsd: quotaUsed,
      status: data.status ?? 'none',
    }
  } catch {
    return null
  }
}
