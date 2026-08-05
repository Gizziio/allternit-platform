/**
 * Vault Settings
 *
 * User-managed configuration for vault sync sources and API credentials.
 * No hardcoded env vars. Users opt-in to each integration.
 */

import path from "path"
import { Log } from "@/shared/util/log"
import { Filesystem } from "@/shared/util/filesystem"
import { Global } from "@/runtime/context/global"

const log = Log.create({ service: "vault-settings" })

const SETTINGS_FILE = path.join(Global.Path.config, "vault-settings.json")

// Per-source settings. Keyed by connector id (see vault/connector.ts registry) —
// not a fixed set of literal keys, so registering a new VaultConnector never
// requires a type change here. OAuth tokens themselves live in the separate
// Auth store (auth.json), never in this file; the fields below are the small
// set of things a connector needs beyond a bare enabled flag (its own OAuth
// app credentials, an API key, etc).
export interface SourceSettings {
  enabled: boolean
  clientId?: string
  clientSecret?: string
  apiKey?: string
  [key: string]: unknown
}

export interface VaultUserSettings {
  version: number
  sources: Record<string, SourceSettings>
  voice: {
    enabled: boolean
    deepgramApiKey?: string
    elevenlabsApiKey?: string
    elevenlabsVoiceId?: string
  }
  liveNotes: {
    enabled: boolean
    trigger: string
    updateIntervalMinutes: number
  }
}

const DEFAULT_SETTINGS: VaultUserSettings = {
  version: 1,
  sources: {
    gmail: { enabled: false },
    calendar: { enabled: false },
    fireflies: { enabled: false },
    // Sidecar-backed sources (see vault/connectors/sidecar.ts) — auth lives
    // entirely in the open-connector sidecar, so these only need the flag.
    notion: { enabled: false },
    github: { enabled: false },
    linear: { enabled: false },
    slack: { enabled: false },
  },
  voice: {
    enabled: false,
    elevenlabsVoiceId: "allternit-default",
  },
  liveNotes: {
    enabled: true,
    trigger: "@allternit",
    updateIntervalMinutes: 360,
  },
}

export async function loadSettings(): Promise<VaultUserSettings> {
  const data = await Filesystem.readJson<VaultUserSettings>(SETTINGS_FILE).catch(() => null)
  if (!data) {
    log.info("No vault settings found, using defaults")
    return { ...DEFAULT_SETTINGS }
  }
  // Merge with defaults for any missing fields
  return {
    ...DEFAULT_SETTINGS,
    ...data,
    sources: {
      ...DEFAULT_SETTINGS.sources,
      ...data.sources,
    },
    voice: {
      ...DEFAULT_SETTINGS.voice,
      ...data.voice,
    },
    liveNotes: {
      ...DEFAULT_SETTINGS.liveNotes,
      ...data.liveNotes,
    },
  }
}

export async function saveSettings(settings: VaultUserSettings): Promise<void> {
  await Filesystem.ensureDir(path.dirname(SETTINGS_FILE))
  await Filesystem.writeJson(SETTINGS_FILE, settings, 0o600)
  log.info("Vault settings saved")
}

export async function getSourceConfig(source: string): Promise<SourceSettings> {
  const settings = await loadSettings()
  return settings.sources[source] ?? { enabled: false }
}

export async function setSourceEnabled(source: string, enabled: boolean): Promise<void> {
  const settings = await loadSettings()
  settings.sources[source] = { ...(settings.sources[source] ?? {}), enabled }
  await saveSettings(settings)
  log.info(`Source ${source} ${enabled ? "enabled" : "disabled"}`)
}

export async function setGoogleCredentials(clientId: string, clientSecret: string): Promise<void> {
  const settings = await loadSettings()
  settings.sources.gmail.clientId = clientId
  settings.sources.gmail.clientSecret = clientSecret
  await saveSettings(settings)
  log.info("Google OAuth credentials saved")
}

export async function setFirefliesApiKey(apiKey: string): Promise<void> {
  const settings = await loadSettings()
  settings.sources.fireflies.apiKey = apiKey
  await saveSettings(settings)
  log.info("Fireflies API key saved")
}

export async function setVoiceConfig(config: Partial<VaultUserSettings["voice"]>): Promise<void> {
  const settings = await loadSettings()
  settings.voice = { ...settings.voice, ...config }
  await saveSettings(settings)
  log.info("Voice config saved")
}

export async function getVoiceConfig(): Promise<VaultUserSettings["voice"]> {
  const settings = await loadSettings()
  return settings.voice
}
