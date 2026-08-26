/**
 * Bootstrap state management
 * Core application state and signals
 */

import { createSignal, type Signal } from '../runtime/util/signal.js'
import { log } from '../runtime/util/log.js'

// Model settings
export interface ModelSetting {
  model: string
  provider: string
  temperature?: number
  maxTokens?: number
}

export type SessionId = string & { readonly __brand: 'SessionId' }

// Session management
interface SessionState {
  id: SessionId
  createdAt: Date
  lastActiveAt: Date
  modelSetting: ModelSetting
}

// Global bootstrap state
let currentSession: SessionState | null = null
const slowOperations: { description: string; duration: number; timestamp: Date }[] = []

// Signals for reactive state
const sessionSignal = createSignal<SessionState | null>(null)
const modelSettingSignal = createSignal<ModelSetting | null>(null)

// Session management
export function createSession(modelSetting: ModelSetting): SessionId {
  const id = `sess_${Date.now()}_${Math.random().toString(36).slice(2, 11)}` as SessionId
  const session: SessionState = {
    id,
    createdAt: new Date(),
    lastActiveAt: new Date(),
    modelSetting,
  }
  
  currentSession = session
  sessionSignal.set(session)
  modelSettingSignal.set(modelSetting)
  
  log('info', 'Session created', { sessionId: id, model: modelSetting.model })
  return id
}

export function getCurrentSession(): SessionState | null {
  return currentSession
}

export function getSessionId(): SessionId | null {
  return currentSession?.id || null
}

export function setSessionId(id: SessionId): void {
  if (currentSession) {
    currentSession.id = id
    sessionSignal.set(currentSession)
  }
}

export function updateSessionActivity(): void {
  if (currentSession) {
    currentSession.lastActiveAt = new Date()
    sessionSignal.set(currentSession)
  }
}

export function clearSession(): void {
  currentSession = null
  sessionSignal.set(null)
  modelSettingSignal.set(null)
  log('info', 'Session cleared')
}

// Model settings
export function getModelSetting(): ModelSetting | null {
  return currentSession?.modelSetting || modelSettingSignal.get()
}

export function setModelSetting(setting: ModelSetting): void {
  if (currentSession) {
    currentSession.modelSetting = setting
    sessionSignal.set(currentSession)
  }
  modelSettingSignal.set(setting)
}

// Session subscriptions
export function subscribeToSession(listener: (session: SessionState | null) => void): () => void {
  return sessionSignal.subscribe(() => listener(sessionSignal.get()))
}

export function subscribeToModelSetting(listener: (setting: ModelSetting | null) => void): () => void {
  return modelSettingSignal.subscribe(() => listener(modelSettingSignal.get()))
}

// Slow operation tracking
export function addSlowOperation(description: string, duration: number): void {
  slowOperations.push({
    description,
    duration,
    timestamp: new Date(),
  })
  
  // Keep only recent operations
  const cutoff = Date.now() - 5 * 60 * 1000 // 5 minutes
  while (slowOperations.length > 0 && slowOperations[0].timestamp.getTime() < cutoff) {
    slowOperations.shift()
  }
  
  log('warn', `Slow operation detected: ${description} (${duration.toFixed(1)}ms)`)
}

export function getSlowOperations(): typeof slowOperations {
  return [...slowOperations]
}

export function clearSlowOperations(): void {
  slowOperations.length = 0
}

// Working directory management
let originalCwd = process.cwd()
let kairosActive = false
let isRemoteMode = false

export function setOriginalCwd(cwd: string): void {
  originalCwd = cwd
}

export function getOriginalCwd(): string {
  return originalCwd
}

export function setKairosActive(active: boolean): void {
  kairosActive = active
}

export function getKairosActive(): boolean {
  return kairosActive
}

export function setIsRemoteMode(remote: boolean): void {
  isRemoteMode = remote
}

export function getIsRemoteMode(): boolean {
  return isRemoteMode
}

// Permission mode
export type PermissionMode = 'ask' | 'acceptEdits' | 'bypassPermissions' | 'acceptAll'

let currentPermissionMode: PermissionMode = 'ask'

export function setPermissionMode(mode: PermissionMode): void {
  currentPermissionMode = mode
  log('info', `Permission mode set to: ${mode}`)
}

export function getPermissionMode(): PermissionMode {
  return currentPermissionMode
}

// Debug mode
let debugMode = false

export function setDebugMode(enabled: boolean): void {
  debugMode = enabled
}

export function isDebugMode(): boolean {
  return debugMode
}

// Initialization
export function initializeBootstrapState(): void {
  log('info', 'Bootstrap state initialized')
}

// ─── Merge-rot repair ────────────────────────────────────────────────────────
// This file was a partial merge of the bootstrap state module; the complete
// implementation lives in the ink-app tree. Re-export everything it provides
// — local exports above take precedence on name conflicts (ES `export *`
// semantics), so the session/model/permission management unique to this file
// keeps its behavior while the ~200 missing accessors come through.
export { addInvokedSkill, addSessionCronTask, addToInMemoryErrorLog, addToToolDuration, addToTotalCostState, addToTotalDurationState, addToTotalLinesChanged, addToTurnClassifierDuration, addToTurnHookDuration, clearBetaHeaderLatches, clearInvokedSkills, clearInvokedSkillsForAgent, clearRegisteredHooks, clearRegisteredPluginHooks, clearSystemPromptSectionState, consumePostCompaction, flushInteractionTime, getActiveTimeCounter, getAdditionalDirectoriesForClaudeMd, getAfkModeHeaderLatched, getAgentColorMap, getAllowedChannels, getAllowedSettingSources, getApiKeyFromFd, getBudgetContinuationCount, getCacheEditingHeaderLatched, getCachedClaudeMdContent, getChromeFlagOverride, getClientType, getCodeEditToolDecisionCounter, getCommitCounter, getCostCounter, getCurrentTurnTokenBudget, getCwdState, getDirectConnectServerUrl, getEventLogger, getFastModeHeaderLatched, getFlagSettingsInline, getFlagSettingsPath, getHasDevChannels, getInitJsonSchema, getInitialMainLoopModel, getInlinePlugins, getInvokedSkills, getInvokedSkillsForAgent, getIsInteractive, getIsNonInteractiveSession, getIsScrollDraining, getLastAPIRequest, getLastAPIRequestMessages, getLastApiCompletionTimestamp, getLastClassifierRequests, getLastEmittedDate, getLastInteractionTime, getLastMainRequestId, getLocCounter, getLoggerProvider, getMainLoopModelOverride, getMainThreadAgentType, getMeter, getMeterProvider, getModelStrings, getModelUsage, getOauthTokenFromFd, getParentSessionId, getPlanSlugCache, getPrCounter, getProjectRoot, getPromptCache1hAllowlist, getPromptCache1hEligible, getPromptId, getQuestionPreviewFormat, getRegisteredHooks, getScheduledTasksEnabled, getSdkAgentProgressSummariesEnabled, getSdkBetas, getSessionBypassPermissionsMode, getSessionCounter, getSessionCreatedTeams, getSessionCronTasks, getSessionIngressToken, getSessionProjectDir, getSessionSource, getSessionTrustAccepted, getStatsStore, getStrictToolResultPairing, getSystemPromptSectionCache, getTeleportedSessionInfo, getThinkingClearLatched, getTokenCounter, getTotalAPIDuration, getTotalAPIDurationWithoutRetries, getTotalCacheCreationInputTokens, getTotalCacheReadInputTokens, getTotalCostUSD, getTotalDuration, getTotalInputTokens, getTotalLinesAdded, getTotalLinesRemoved, getTotalOutputTokens, getTotalToolDuration, getTotalWebSearchRequests, getTracerProvider, getTurnClassifierCount, getTurnClassifierDurationMs, getTurnHookCount, getTurnHookDurationMs, getTurnOutputTokens, getTurnToolCount, getTurnToolDurationMs, getUsageForModel, getUseCoworkPlugins, getUserMsgOptIn, handleAutoModeTransition, handlePlanModeTransition, hasExitedPlanModeInSession, hasShownLspRecommendationThisSession, hasUnknownModelCost, incrementBudgetContinuationCount, isSessionPersistenceDisabled, markFirstTeleportMessageLogged, markPostCompaction, markScrollActivity, needsAutoModeExitAttachment, needsPlanModeExitAttachment, onSessionSwitch, preferThirdPartyAuthentication, regenerateSessionId, registerHookCallbacks, removeSessionCronTasks, resetCostState, resetModelStringsForTestingOnly, resetSdkInitState, resetStateForTests, resetTotalDurationStateAndCost_FOR_TESTS_ONLY, resetTurnClassifierDuration, resetTurnHookDuration, resetTurnToolDuration, setAdditionalDirectoriesForClaudeMd, setAfkModeHeaderLatched, setAllowedChannels, setAllowedSettingSources, setApiKeyFromFd, setCacheEditingHeaderLatched, setCachedClaudeMdContent, setChromeFlagOverride, setClientType, setCostStateForRestore, setCwdState, setDirectConnectServerUrl, setEventLogger, setFastModeHeaderLatched, setFlagSettingsInline, setFlagSettingsPath, setHasDevChannels, setHasExitedPlanMode, setHasUnknownModelCost, setInitJsonSchema, setInitialMainLoopModel, setInlinePlugins, setIsInteractive, setLastAPIRequest, setLastAPIRequestMessages, setLastApiCompletionTimestamp, setLastClassifierRequests, setLastEmittedDate, setLastMainRequestId, setLoggerProvider, setLspRecommendationShownThisSession, setMainLoopModelOverride, setMainThreadAgentType, setMeter, setMeterProvider, setModelStrings, setNeedsAutoModeExitAttachment, setNeedsPlanModeExitAttachment, setOauthTokenFromFd, setProjectRoot, setPromptCache1hAllowlist, setPromptCache1hEligible, setPromptId, setQuestionPreviewFormat, setScheduledTasksEnabled, setSdkAgentProgressSummariesEnabled, setSdkBetas, setSessionBypassPermissionsMode, setSessionIngressToken, setSessionPersistenceDisabled, setSessionSource, setSessionTrustAccepted, setStatsStore, setStrictToolResultPairing, setSystemPromptSectionCacheEntry, setTeleportedSessionInfo, setThinkingClearLatched, setTracerProvider, setUseCoworkPlugins, setUserMsgOptIn, snapshotOutputTokensForTurn, switchSession, updateLastInteractionTime, waitForScrollIdle } from "../cli/ui/ink-app/bootstrap/state.js";
export type { AttributedCounter, ChannelEntry, InvokedSkillInfo, SessionCronTask } from "../cli/ui/ink-app/bootstrap/state.js";
