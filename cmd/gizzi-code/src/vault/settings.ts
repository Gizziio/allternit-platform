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
import type { Vault } from "./types"

const log = Log.create({ service: "vault-settings" })

const SETTINGS_FILE = path.join(Global.Path.config, "vault-settings.json")

export interface VaultUserSettings {
  version: number
  sources: {
    gmail: {
      enabled: boolean
      clientId?: string
      clientSecret?: string
      // OAuth tokens stored separately in auth.json
    }
    calendar: {
      enabled: boolean
      // Shares gmail OAuth if from same Google account
    }
    fireflies: {
      enabled: boolean
      apiKey?: string
    }
  }
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

export async function getSourceConfig(source: keyof VaultUserSettings["sources"]): Promise<VaultUserSettings["sources"][typeof source]> {
  const settings = await loadSettings()
  return settings.sources[source]
}

export async function setSourceEnabled(source: keyof VaultUserSettings["sources"], enabled: boolean): Promise<void> {
  const settings = await loadSettings()
  settings.sources[source].enabled = enabled
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

export async function getSyncConfig(): Promise<Vault.VaultConfig["sync"]> {
  const settings = await loadSettings()
  return {
    gmail: {
      enabled: settings.sources.gmail.enabled,
      intervalMinutes: 60,
      lookbackDays: 7,
    },
    calendar: {
      enabled: settings.sources.calendar.enabled,
      intervalMinutes: 60,
      lookbackDays: 30,
    },
    fireflies: {
      enabled: settings.sources.fireflies.enabled,
      intervalMinutes: 60,
      lookbackDays: 30,
      apiKey: settings.sources.fireflies.apiKey,
    },
  }
}

export async function getVoiceConfig(): Promise<VaultUserSettings["voice"]> {
  const settings = await loadSettings()
  return settings.voice
}
