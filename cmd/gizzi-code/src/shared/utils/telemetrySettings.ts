/**
 * Telemetry consent settings (gizzi-code fork).
 *
 * Persists the user's telemetry choice in a small JSON file under the gizzi
 * config directory (`$XDG_CONFIG_HOME/gizzi-code/telemetry.json`, overridable
 * with `GIZZI_TELEMETRY_SETTINGS_PATH` for tests):
 *
 *   { "enabled": boolean, "noticeShownAt": string | null }
 *
 * `enabled` defaults to true (telemetry on) and is an *opt-out* flag: set it
 * to false with `gizzi config telemetry off`. Environment kill switches
 * (GIZZI_TELEMETRY=off, GIZZI_DISABLE_TELEMETRY, DISABLE_TELEMETRY,
 * GIZZI_DISABLE_NONESSENTIAL_TRAFFIC) take precedence and are handled in
 * privacyLevel.ts — this file only covers the persistent settings flag and
 * the first-run disclosure marker.
 *
 * Reads are memoized for the process lifetime; writes are atomic
 * (tmp + rename) and invalidate the memo.
 */

import * as fs from 'fs'
import * as path from 'path'
import { xdgConfig } from 'xdg-basedir'

export type TelemetrySettings = {
  enabled: boolean
  noticeShownAt: string | null
}

const DEFAULT_SETTINGS: TelemetrySettings = {
  enabled: true,
  noticeShownAt: null,
}

export function getTelemetrySettingsPath(): string {
  const override = process.env.GIZZI_TELEMETRY_SETTINGS_PATH?.trim()
  if (override) return override
  return path.join(xdgConfig ?? path.join(process.env.HOME ?? '', '.config'), 'gizzi-code', 'telemetry.json')
}

let cached: TelemetrySettings | null = null

export function getTelemetrySettings(): TelemetrySettings {
  if (cached) return cached
  try {
    const raw = fs.readFileSync(getTelemetrySettingsPath(), 'utf8')
    const parsed = JSON.parse(raw) as Partial<TelemetrySettings>
    cached = {
      enabled: parsed.enabled !== false,
      noticeShownAt:
        typeof parsed.noticeShownAt === 'string' ? parsed.noticeShownAt : null,
    }
  } catch {
    cached = { ...DEFAULT_SETTINGS }
  }
  return cached
}

/** True when the persistent settings flag opts out of telemetry. */
export function isTelemetryDisabledInSettings(): boolean {
  return getTelemetrySettings().enabled === false
}

/** True when the one-time first-run disclosure has been shown. */
export function hasTelemetryNoticeBeenShown(): boolean {
  return getTelemetrySettings().noticeShownAt !== null
}

function writeSettings(settings: TelemetrySettings): void {
  cached = settings
  const filePath = getTelemetrySettingsPath()
  fs.mkdirSync(path.dirname(filePath), { recursive: true })
  const tmpPath = `${filePath}.tmp.${process.pid}`
  fs.writeFileSync(tmpPath, JSON.stringify(settings, null, 2) + '\n', 'utf8')
  fs.renameSync(tmpPath, filePath)
}

export function setTelemetryEnabled(enabled: boolean): TelemetrySettings {
  const settings = { ...getTelemetrySettings(), enabled }
  writeSettings(settings)
  return settings
}

export function markTelemetryNoticeShown(): TelemetrySettings {
  const settings = {
    ...getTelemetrySettings(),
    noticeShownAt: new Date().toISOString(),
  }
  writeSettings(settings)
  return settings
}

/** Test hook: drop the in-process memo. */
export function _resetTelemetrySettingsForTesting(): void {
  cached = null
}
