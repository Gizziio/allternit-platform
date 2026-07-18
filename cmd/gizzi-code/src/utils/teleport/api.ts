/**
 * Teleport API Utilities
 */

export interface TeleportApiConfig {
  baseUrl: string
  token?: string
}

export async function teleportRequest<T>(
  endpoint: string,
  config?: TeleportApiConfig
): Promise<T> {
  return {} as T
}

// Merge-by-re-export: complete counterpart (local exports win on conflict)
export { CCR_BYOC_BETA, CodeSessionSchema, axiosGetWithRetry, fetchCodeSessionsFromSessionsAPI, fetchSession, getBranchFromSession, getOAuthHeaders, isTransientNetworkError, prepareApiRequest, sendEventToRemoteSession, updateSessionTitle } from "../../shared/utils/teleport/api.js";
export type { CodeSession, GitRepositoryOutcome, GitSource, KnowledgeBaseSource, ListSessionsResponse, Outcome, OutcomeGitInfo, RemoteMessageContent, SessionContext, SessionContextSource, SessionResource, SessionStatus } from "../../shared/utils/teleport/api.js";
