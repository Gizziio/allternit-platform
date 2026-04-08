/**
 * Plugin Update Checker
 *
 * Checks for plugin updates from the registry/marketplace, manages update state,
 * and provides subscription-based notifications for available updates.
 */

import type { MarketplacePlugin } from './capability.types';
import { searchMarketplace } from './marketplaceApi';

// ============================================================================
// Types
// ============================================================================

export interface UpdateInfo {
  pluginId: string;
  pluginName: string;
  currentVersion: string;
  latestVersion: string;
  releaseNotes?: string;
  isRequired: boolean;
  downloadUrl?: string;
  source: 'marketplace' | 'curated' | 'github' | 'api';
  checkedAt: string;
}

export interface UpdateCheckResult {
  updates: UpdateInfo[];
  errors: string[];
  checkedAt: string;
}

export interface UpdateCheckerOptions {
  checkIntervalMs?: number;
  storageKey?: string;
}

export type UpdateListener = (updates: UpdateInfo[]) => void;

// ============================================================================
// Constants
// ============================================================================

const DEFAULT_CHECK_INTERVAL_MS = 24 * 60 * 60 * 1000; // 24 hours
const STORAGE_KEY = 'allternit:plugin-updates:dismissed';
const LAST_CHECK_KEY = 'allternit:plugin-updates:last-check';

// ============================================================================
// State
// ============================================================================

interface InstalledPlugin {
  id: string;
  name: string;
  version: string;
  source?: string;
}

let checkIntervalId: ReturnType<typeof setInterval> | null = null;
let listeners: UpdateListener[] = [];
let currentUpdates: UpdateInfo[] = [];
let dismissedIds: Set<string> = new Set();
let isInitialized = false;

// ============================================================================
// LocalStorage Helpers
// ============================================================================

function loadDismissedIds(): Set<string> {
  if (typeof window === 'undefined') return new Set();
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return new Set();
    const parsed = JSON.parse(raw) as string[];
    return new Set(parsed.filter((id) => typeof id === 'string'));
  } catch {
    return new Set();
  }
}

function saveDismissedIds(ids: Set<string>): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(Array.from(ids)));
  } catch {
    // Ignore storage errors
  }
}

function getLastCheckTime(): Date | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(LAST_CHECK_KEY);
    if (!raw) return null;
    const timestamp = parseInt(raw, 10);
    if (isNaN(timestamp)) return null;
    return new Date(timestamp);
  } catch {
    return null;
  }
}

function setLastCheckTime(date: Date): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(LAST_CHECK_KEY, date.getTime().toString());
  } catch {
    // Ignore storage errors
  }
}

// ============================================================================
// Version Comparison
// ============================================================================

function parseVersion(version: string): number[] | null {
  if (!version || typeof version !== 'string') return null;
  const normalized = version.trim().replace(/^v/i, '');
  if (!normalized) return null;
  const main = normalized.split('-')[0];
  const parts = main.split('.');
  if (parts.length === 0) return null;
  const parsed = parts.map((part) => Number.parseInt(part, 10));
  if (parsed.some((part) => Number.isNaN(part))) return null;
  return parsed;
}

export function isVersionGreaterThan(remoteVersion: string, localVersion: string): boolean {
  const remoteParts = parseVersion(remoteVersion);
  const localParts = parseVersion(localVersion);
  if (!remoteParts || !localParts) return false;

  const maxLength = Math.max(remoteParts.length, localParts.length);
  for (let i = 0; i < maxLength; i += 1) {
    const remote = remoteParts[i] || 0;
    const local = localParts[i] || 0;
    if (remote > local) return true;
    if (remote < local) return false;
  }
  return false;
}

// ============================================================================
// Core Functions
// ============================================================================

/**
 * Check a single plugin for updates
 */
export async function checkPlugin(
  installedPlugin: InstalledPlugin
): Promise<UpdateInfo | null> {
  try {
    // Search marketplace for this plugin
    const result = await searchMarketplace(installedPlugin.name, {
      perPage: 10,
      sortBy: 'relevance',
    });

    // Find matching plugin by name or ID
    const matchingPlugin = result.plugins.find(
      (p) =>
        p.id === installedPlugin.id ||
        p.name.toLowerCase() === installedPlugin.name.toLowerCase()
    );

    if (!matchingPlugin) return null;

    // Compare versions
    if (!isVersionGreaterThan(matchingPlugin.version, installedPlugin.version)) {
      return null;
    }

    return {
      pluginId: installedPlugin.id,
      pluginName: installedPlugin.name,
      currentVersion: installedPlugin.version,
      latestVersion: matchingPlugin.version,
      releaseNotes: undefined, // Could be fetched from release API
      isRequired: false, // Could be determined by semantic versioning
      downloadUrl: matchingPlugin.sourceUrl,
      source: matchingPlugin.sourceKind === 'api' ? 'marketplace' : 
              matchingPlugin.sourceKind === 'curated' ? 'curated' : 
              matchingPlugin.sourceKind === 'github' ? 'github' : 'api',
      checkedAt: new Date().toISOString(),
    };
  } catch (error) {
    console.error(`[UpdateChecker] Failed to check updates for ${installedPlugin.name}:`, error);
    return null;
  }
}

/**
 * Check all installed plugins for updates
 */
export async function checkAllPlugins(
  installedPlugins: InstalledPlugin[]
): Promise<UpdateCheckResult> {
  const errors: string[] = [];
  const updates: UpdateInfo[] = [];

  // Check plugins in parallel with concurrency limit
  const CONCURRENCY = 3;
  const batches: InstalledPlugin[][] = [];
  
  for (let i = 0; i < installedPlugins.length; i += CONCURRENCY) {
    batches.push(installedPlugins.slice(i, i + CONCURRENCY));
  }

  for (const batch of batches) {
    const results = await Promise.allSettled(
      batch.map((plugin) => checkPlugin(plugin))
    );

    results.forEach((result, index) => {
      if (result.status === 'fulfilled') {
        if (result.value) {
          updates.push(result.value);
        }
      } else {
        const pluginName = batch[index]?.name || 'unknown';
        errors.push(`Failed to check ${pluginName}: ${result.reason}`);
      }
    });
  }

  const checkedAt = new Date().toISOString();
  setLastCheckTime(new Date());

  // Filter out dismissed updates
  dismissedIds = loadDismissedIds();
  const filteredUpdates = updates.filter((u) => !dismissedIds.has(u.pluginId));

  // Update current state
  currentUpdates = filteredUpdates;

  // Notify listeners
  notifyListeners(filteredUpdates);

  return {
    updates: filteredUpdates,
    errors,
    checkedAt,
  };
}

/**
 * Check if an update check is due based on the last check time
 */
export function isCheckDue(intervalMs: number = DEFAULT_CHECK_INTERVAL_MS): boolean {
  const lastCheck = getLastCheckTime();
  if (!lastCheck) return true;
  return Date.now() - lastCheck.getTime() >= intervalMs;
}

// ============================================================================
// Subscription Management
// ============================================================================

function notifyListeners(updates: UpdateInfo[]): void {
  listeners.forEach((listener) => {
    try {
      listener(updates);
    } catch (error) {
      console.error('[UpdateChecker] Listener error:', error);
    }
  });
}

/**
 * Subscribe to update notifications
 */
export function subscribeToUpdates(listener: UpdateListener): () => void {
  listeners.push(listener);
  
  // Immediately notify with current updates
  if (currentUpdates.length > 0) {
    listener(currentUpdates);
  }

  // Return unsubscribe function
  return () => {
    listeners = listeners.filter((l) => l !== listener);
  };
}

/**
 * Dismiss an update notification
 */
export function dismissUpdate(pluginId: string): void {
  dismissedIds.add(pluginId);
  saveDismissedIds(dismissedIds);

  // Remove from current updates
  currentUpdates = currentUpdates.filter((u) => u.pluginId !== pluginId);
  notifyListeners(currentUpdates);
}

/**
 * Restore a dismissed update (for "undo" functionality)
 */
export function restoreUpdate(update: UpdateInfo): void {
  dismissedIds.delete(update.pluginId);
  saveDismissedIds(dismissedIds);
  
  // Add back to current updates if not already present
  if (!currentUpdates.find((u) => u.pluginId === update.pluginId)) {
    currentUpdates.push(update);
    notifyListeners(currentUpdates);
  }
}

/**
 * Clear all dismissed updates
 */
export function clearDismissedUpdates(): void {
  dismissedIds.clear();
  saveDismissedIds(dismissedIds);
}

/**
 * Get all dismissed update IDs
 */
export function getDismissedIds(): string[] {
  return Array.from(dismissedIds);
}

// ============================================================================
// Background Checking
// ============================================================================

/**
 * Start automatic background update checking
 */
export function startBackgroundChecks(
  getInstalledPlugins: () => InstalledPlugin[],
  options: UpdateCheckerOptions = {}
): void {
  if (isInitialized) return;
  
  isInitialized = true;
  dismissedIds = loadDismissedIds();

  const intervalMs = options.checkIntervalMs ?? DEFAULT_CHECK_INTERVAL_MS;

  // Check immediately if due
  if (isCheckDue(intervalMs)) {
    void checkAllPlugins(getInstalledPlugins());
  }

  // Schedule periodic checks
  checkIntervalId = setInterval(() => {
    void checkAllPlugins(getInstalledPlugins());
  }, intervalMs);
}

/**
 * Stop automatic background update checking
 */
export function stopBackgroundChecks(): void {
  if (checkIntervalId) {
    clearInterval(checkIntervalId);
    checkIntervalId = null;
  }
  isInitialized = false;
}

/**
 * Check if background checking is active
 */
export function isBackgroundChecking(): boolean {
  return checkIntervalId !== null;
}

// ============================================================================
// Manual Check Trigger
// ============================================================================

/**
 * Trigger a manual update check
 */
export async function triggerUpdateCheck(
  installedPlugins: InstalledPlugin[]
): Promise<UpdateCheckResult> {
  return checkAllPlugins(installedPlugins);
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Get current available updates
 */
export function getCurrentUpdates(): UpdateInfo[] {
  return [...currentUpdates];
}

/**
 * Get update count
 */
export function getUpdateCount(): number {
  return currentUpdates.length;
}

/**
 * Check if a specific plugin has an available update
 */
export function hasUpdate(pluginId: string): boolean {
  return currentUpdates.some((u) => u.pluginId === pluginId);
}

/**
 * Get update info for a specific plugin
 */
export function getUpdateForPlugin(pluginId: string): UpdateInfo | undefined {
  return currentUpdates.find((u) => u.pluginId === pluginId);
}
