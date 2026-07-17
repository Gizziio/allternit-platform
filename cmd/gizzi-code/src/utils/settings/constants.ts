/**
 * Settings Constants
 */

export type SettingSource = 'config' | 'env' | 'default'

export const DEFAULT_SETTINGS = {
  theme: 'default',
  autoCompact: true,
}

// Merge-by-re-export: complete counterpart (local exports win on conflict)
export * from '../../shared/utils/settings/constants.js'
