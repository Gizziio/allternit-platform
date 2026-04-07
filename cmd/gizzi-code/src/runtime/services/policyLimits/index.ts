/**
 * Policy Limits Service
 */

export interface PolicyLimits {
  maxRequests: number
  maxTokens: number
}

export function getPolicyLimits(): PolicyLimits {
  return { maxRequests: 100, maxTokens: 100000 }
}
