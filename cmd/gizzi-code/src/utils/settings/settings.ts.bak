/**
 * Settings Utilities
 */

import type { Settings } from './types.js'

let cachedSettings: Settings = {}

export function getSettings(): Settings {
  return cachedSettings
}

export function getInitialSettings(): Settings {
  return {}
}

export function updateSettings(settings: Partial<Settings>): void {
  cachedSettings = { ...cachedSettings, ...settings }
}
