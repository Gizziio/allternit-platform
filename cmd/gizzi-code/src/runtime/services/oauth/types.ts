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
  scope?: string[]
  // Snake case variants (from API response)
  access_token?: string
  refresh_token?: string
  expires_in?: number
  account?: {
    id: string
    email?: string
  }
  organization?: {
    id: string
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

// Profile response
export interface OAuthProfileResponse {
  id: string
  email: string
  name?: string
  avatar?: string
  subscription?: SubscriptionType
}
