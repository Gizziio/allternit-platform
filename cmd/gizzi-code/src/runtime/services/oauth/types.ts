/**
 * OAuth types
 */

export interface OAuthConfig {
  clientId: string
  redirectUri: string
  scope?: string[]
}

export interface OAuthToken {
  accessToken: string
  refreshToken?: string
  expiresAt?: number
  scopes?: string[]
  subscriptionType?: string
  rateLimitTier?: string
  [key: string]: unknown
}

// Alias for OAuthToken (backward compatibility)
export type OAuthTokens = OAuthToken

export interface OAuthProvider {
  name: string
  config: OAuthConfig
}

// Billing types
export type BillingType = 'monthly' | 'annual' | 'usage' | 'stripe_subscription' | 'stripe_subscription_contracted' | 'apple_subscription' | 'google_play_subscription' | string

// Subscription types
export type SubscriptionType = 'free' | 'pro' | 'team' | 'enterprise' | 'max' | string

// Referral types
export interface ReferralEligibilityResponse {
  eligible: boolean
  reason?: string
  maxReferrals?: number
}

export interface ReferralRedemptionsResponse {
  redemptions: number
  remaining: number
  total: number
}

export interface ReferrerRewardInfo {
  rewardAmount: number
  currency: string
  threshold: number
}

export interface ReferralCampaign {
  id: string
  name: string
  active: boolean
  startDate: number
  endDate?: number
}

// Token exchange
export interface OAuthTokenExchangeResponse {
  accessToken: string
  refreshToken?: string
  expiresAt?: number
  scope?: string
  // Snake case variants (from API response)
  access_token?: string
  refresh_token?: string
  expires_in?: number
  account?: {
    id: string
    uuid?: string
    email?: string
    email_address?: string
  }
  organization?: {
    id: string
    uuid?: string
    name?: string
  }
}

// User roles
export interface UserRolesResponse {
  roles: string[]
  permissions: string[]
  organization_role?: string
  workspace_role?: string
  organization_name?: string
}

// Rate limiting
export type RateLimitTier = 'free' | 'pro' | 'enterprise'

// Subscription quota info from the cloud API
export interface SubscriptionQuota {
  planId: string
  planTier: string
  monthlyQuotaUsd: number
  usageThisPeriodUsd: number
  status: string
}

// Profile response
export interface OAuthProfileResponse {
  id: string
  email: string
  name?: string
  avatar?: string
  subscription?: SubscriptionType
  // claude.ai /oauth/profile nested payloads (snake_case, straight from the API)
  account?: {
    uuid?: string
    email?: string
    display_name?: string
    created_at?: string
  }
  organization?: {
    uuid?: string
    organization_type?: string
    rate_limit_tier?: RateLimitTier
    has_extra_usage_enabled?: boolean
    billing_type?: BillingType
    subscription_created_at?: string
  }
  // Allternit Cloud subscription quota (snake_case, from /api/v1/me/usage)
  allternit_subscription?: {
    plan_id: string
    plan_tier: string
    monthly_quota_usd: number
    usage_this_period_usd: number
    status: string
  }
}
