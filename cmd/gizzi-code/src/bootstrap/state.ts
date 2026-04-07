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

// Default export
export default {
  createSession,
  getCurrentSession,
  getSessionId,
  setSessionId,
  updateSessionActivity,
  clearSession,
  getModelSetting,
  setModelSetting,
  subscribeToSession,
  subscribeToModelSetting,
  addSlowOperation,
  getSlowOperations,
  clearSlowOperations,
  setOriginalCwd,
  getOriginalCwd,
  setKairosActive,
  getKairosActive,
  setIsRemoteMode,
  getIsRemoteMode,
  setPermissionMode,
  getPermissionMode,
  setDebugMode,
  isDebugMode,
  initializeBootstrapState,
}
