/**
 * Settings Constants
 */

export type SettingSource = 'config' | 'env' | 'default'

export const DEFAULT_SETTINGS = {
  theme: 'default',
  autoCompact: true,
}

// Merge-by-re-export: complete counterpart (local exports win on conflict)
export { GIZZI_SETTINGS_SCHEMA_URL, SETTING_SOURCES, SOURCES, getEnabledSettingSources, getSettingSourceDisplayNameCapitalized, getSettingSourceDisplayNameLowercase, getSettingSourceName, getSourceDisplayName, isSettingSourceEnabled, parseSettingSourcesFlag } from "../../shared/utils/settings/constants.js";
export type { EditableSettingSource } from "../../shared/utils/settings/constants.js";
