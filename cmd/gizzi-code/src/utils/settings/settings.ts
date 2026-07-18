/**
 * Settings Utilities
 */

import type { Settings } from './types.js'

let cachedSettings: Settings = {}

export function getSettings(): Settings {
  return cachedSettings
}

export function updateSettings(settings: Partial<Settings>): void {
  cachedSettings = { ...cachedSettings, ...settings }
}

// Merge-by-re-export: complete counterpart (local exports win on conflict)
export { getAutoModeConfig, getInitialSettings, getManagedFileSettingsPresence, getManagedSettingsKeysForLogging, getPolicySettingsOrigin, getRelativeSettingsFilePathForSource, getSettingsFilePathForSource, getSettingsRootPathForSource, getSettingsWithErrors, getSettingsWithSources, getUseAutoModeDuringPlan, hasAutoModeOptIn, hasSkipDangerousModePermissionPrompt, loadManagedFileSettings, parseSettingsFile, rawSettingsContainsKey, settingsMergeCustomizer, updateSettingsForSource } from "../../shared/utils/settings/settings.js";
export type { SettingsWithSources } from "../../shared/utils/settings/settings.js";

/** Settings scoped to a source layer; only userSettings exists in this shim. */
export function getSettingsForSource(source: string): Settings | undefined {
  return source === 'userSettings' ? getSettings() : undefined
}

/** Legacy accessor kept for migrations and older call sites. */
export function getSettings_DEPRECATED(): Settings {
  return getSettings()
}
