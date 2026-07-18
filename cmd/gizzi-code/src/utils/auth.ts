// Re-export from shared/utils
export { calculateApiKeyHelperTTL, checkAndRefreshOAuthTokenIfNeeded, clearApiKeyHelperCache, clearOAuthTokenCache, getAccountInformation, getAnthropicApiKey, getAnthropicApiKeyWithSource, getApiKeyFromApiKeyHelper, getApiKeyFromApiKeyHelperCached, getApiKeyFromConfigOrMacOSKeychain, getApiKeyHelperElapsedMs, getAuthTokenSource, getClaudeAIOAuthTokens, getClaudeAIOAuthTokensAsync, getConfiguredApiKeyHelper, getOauthAccountInfo, getRateLimitTier, getSubscriptionName, getSubscriptionType, handleOAuth401Error, hasAnthropicApiKeyAuth, hasOpusAccess, hasProfileScope, is1PApiCustomer, isAnthropicAuthEnabled, isClaudeAISubscriber, isConsumerSubscriber, isCustomApiKeyApproved, isEnterpriseSubscriber, isMaxSubscriber, isOverageProvisioningAllowed, isProSubscriber, isTeamPremiumSubscriber, isTeamSubscriber, isUsing3PServices, prefetchApiKeyFromApiKeyHelperIfSafe, removeApiKey, saveApiKey, saveOAuthTokensIfNeeded, validateForceLoginOrg } from "../shared/utils/auth.js";
export type { ApiKeySource, OrgValidationResult, UserAccountInfo } from "../shared/utils/auth.js";

/** AWS credential refresh for Bedrock-backed calls; no cloud creds in this build. */
export async function refreshAndGetAwsCredentials(): Promise<null> {
  return null
}

/** GCP credential refresh for Vertex-backed calls; no cloud creds in this build. */
export async function refreshGcpCredentialsIfNeeded(): Promise<void> {}
