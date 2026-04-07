/**
 * Global runtime context
 * Manages global state and configuration
 */

import { createSignal, type Signal } from '../../util/signal.js'
import { log } from '../../util/log.js'

export interface GlobalContext {
  version: string
  environment: 'development' | 'production' | 'test'
  debug: boolean
  telemetry: boolean
  settings: GlobalSettings
}

export interface GlobalSettings {
  autoUpdate: boolean
  theme: string
  language: string
  notifications: boolean
  analytics: boolean
}

const DEFAULT_SETTINGS: GlobalSettings = {
  autoUpdate: true,
  theme: 'system',
  language: 'en',
  notifications: true,
  analytics: true,
}

// Global context state
let globalContext: GlobalContext = {
  version: '0.1.0',
  environment: 'production',
  debug: false,
  telemetry: true,
  settings: { ...DEFAULT_SETTINGS },
}

const contextListeners = new Set<(ctx: GlobalContext) => void>()

export function getGlobalContext(): GlobalContext {
  return { ...globalContext }
}

export function setGlobalContext(updates: Partial<GlobalContext>): void {
  globalContext = { ...globalContext, ...updates }
  contextListeners.forEach(listener => listener(globalContext))
  log('debug', 'Global context updated', updates)
}

export function subscribeToContext(listener: (ctx: GlobalContext) => void): () => void {
  contextListeners.add(listener)
  return () => contextListeners.delete(listener)
}

// Settings management
export function getGlobalSettings(): GlobalSettings {
  return { ...globalContext.settings }
}

export function updateGlobalSettings(updates: Partial<GlobalSettings>): void {
  globalContext.settings = { ...globalContext.settings, ...updates }
  contextListeners.forEach(listener => listener(globalContext))
  saveGlobalSettings().catch(err => log('error', 'Failed to save settings', err))
}

export async function loadGlobalSettings(): Promise<void> {
  try {
    const { safeReadFile } = await import('../../util/filesystem.js')
    const content = await safeReadFile(getGlobalSettingsPath(), '{}')
    const parsed = JSON.parse(content)
    globalContext.settings = { ...DEFAULT_SETTINGS, ...parsed }
    log('debug', 'Loaded global settings')
  } catch (error) {
    log('warn', 'Failed to load global settings, using defaults')
  }
}

export async function saveGlobalSettings(): Promise<void> {
  try {
    const { writeFile, ensureDir } = await import('../../util/filesystem.js')
    const configDir = getGlobalConfigDir()
    await ensureDir(configDir)
    await writeFile(
      getGlobalSettingsPath(),
      JSON.stringify(globalContext.settings, null, 2)
    )
    log('debug', 'Saved global settings')
  } catch (error) {
    log('error', 'Failed to save global settings', error)
  }
}

// Paths
export function getGlobalConfigDir(): string {
  const os = require('os')
  const path = require('path')
  const home = os.homedir()
  
  switch (process.platform) {
    case 'darwin':
      return path.join(home, 'Library', 'Application Support', 'gizzi')
    case 'win32':
      return path.join(process.env.APPDATA || home, 'gizzi')
    default:
      return path.join(process.env.XDG_CONFIG_HOME || path.join(home, '.config'), 'gizzi')
  }
}

export function getGlobalSettingsPath(): string {
  const path = require('path')
  return path.join(getGlobalConfigDir(), 'settings.json')
}

export function getGlobalCacheDir(): string {
  const path = require('path')
  return path.join(getGlobalConfigDir(), 'cache')
}

export function getGlobalLogsDir(): string {
  const path = require('path')
  return path.join(getGlobalConfigDir(), 'logs')
}

// Environment detection
export function isDevelopment(): boolean {
  return globalContext.environment === 'development'
}

export function isProduction(): boolean {
  return globalContext.environment === 'production'
}

export function isTest(): boolean {
  return globalContext.environment === 'test'
}

// Version
export function getVersion(): string {
  return globalContext.version
}

export function setVersion(version: string): void {
  globalContext.version = version
}

// Initialize
export async function initializeGlobalContext(): Promise<void> {
  // Detect environment
  if (process.env.NODE_ENV === 'development' || process.env.GIZZI_DEV) {
    globalContext.environment = 'development'
    globalContext.debug = true
  } else if (process.env.NODE_ENV === 'test') {
    globalContext.environment = 'test'
  }
  
  // Load settings
  await loadGlobalSettings()
  
  log('info', 'Global context initialized', { environment: globalContext.environment })
}

// Default export
export default {
  getGlobalContext,
  setGlobalContext,
  subscribeToContext,
  getGlobalSettings,
  updateGlobalSettings,
  loadGlobalSettings,
  saveGlobalSettings,
  getGlobalConfigDir,
  getGlobalSettingsPath,
  getGlobalCacheDir,
  getGlobalLogsDir,
  isDevelopment,
  isProduction,
  isTest,
  getVersion,
  setVersion,
  initializeGlobalContext,
}
