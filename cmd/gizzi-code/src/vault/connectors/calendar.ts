/**
 * Calendar Connector
 *
 * Vault connector that synchronizes Google Calendar events into the knowledge vault.
 * Shares OAuth credentials with Gmail via the "google" auth provider.
 */

import path from "path"
import { Log } from "@/shared/util/log"
import { Auth } from "@/runtime/integrations/auth"
import { Filesystem } from "@/shared/util/filesystem"
import type { VaultManager } from "@/vault"
import * as IO from "@/vault/io"
import {
  registerConnector,
  checkOAuthAuth,
  type VaultConnector,
  type ConnectorConfig,
  type ConnectorStatus,
} from "@/vault/connector"
import type { SyncResult } from "@/vault/sync"

const log = Log.create({ service: "connector-calendar" })

const CALENDAR_API_BASE = "https://www.googleapis.com/calendar/v3"
const AUTH_KEY = "google"
const SYNC_STATE_FILE = "calendar-sync-state.json"

interface SyncState {
  lastSyncAt?: string
}

// ============================================================================
// Calendar API Helpers
// ============================================================================

async function getAccessToken(): Promise<string | null> {
  const auth = await Auth.get(AUTH_KEY)
  if (!auth || auth.type !== "oauth") {
    log.warn("No Google OAuth credentials found")
    return null
  }
  return auth.access
}

async function calendarFetch(endpoint: string, token: string): Promise<any> {
  const response = await fetch(`${CALENDAR_API_BASE}${endpoint}`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!response.ok) {
    throw new Error(`Calendar API error: ${response.status} ${await response.text()}`)
  }
  return response.json()
}

async function loadState(vault: VaultManager): Promise<SyncState> {
  const statePath = path.join(vault.rootPath, ".allternit", SYNC_STATE_FILE)
  return Filesystem.readJson<SyncState>(statePath).catch(() => ({}))
}

async function saveState(vault: VaultManager, state: SyncState): Promise<void> {
  const statePath = path.join(vault.rootPath, ".allternit", SYNC_STATE_FILE)
  await Filesystem.ensureDir(path.dirname(statePath))
  await Filesystem.writeJson(statePath, state)
}

function formatEventMarkdown(event: any): string {
  const start = event.start?.dateTime || event.start?.date || "TBD"
  const end = event.end?.dateTime || event.end?.date || "TBD"
  const attendees = (event.attendees || [])
    .map((a: any) => `- ${a.displayName || a.email || "Guest"}${a.responseStatus ? ` (${a.responseStatus})` : ""}`)
    .join("\n")
  const description = event.description || ""

  return [
    `## ${event.summary || "Untitled Event"}`,
    "",
    `- **Start:** ${start}`,
    `- **End:** ${end}`,
    `- **Location:** ${event.location || "N/A"}`,
    `- **Organizer:** ${event.organizer?.displayName || event.organizer?.email || "N/A"}`,
    "",
    "### Description",
    description,
    "",
    attendees ? "### Attendees\n" + attendees : "",
    "",
  ].filter(Boolean).join("\n")
}

// ============================================================================
// Connector Implementation
// ============================================================================

export const CalendarConnector: VaultConnector = {
  meta: {
    id: "calendar",
    name: "Google Calendar",
    description: "Synchronize Google Calendar events into the knowledge vault",
    version: "1.0.0",
    authType: "oauth",
    authProviderId: AUTH_KEY,
  },

  async init(): Promise<void> {
    log.info("Calendar connector initialized")
  },

  async connect(): Promise<boolean> {
    const ok = await checkOAuthAuth(AUTH_KEY)
    log.info("Calendar connect", { authenticated: ok })
    return ok
  },

  async status(): Promise<ConnectorStatus> {
    const authenticated = await checkOAuthAuth(AUTH_KEY)
    return {
      connected: authenticated,
      authenticated,
    }
  },

  async sync(vault: VaultManager, config: ConnectorConfig): Promise<SyncResult> {
    const token = await getAccessToken()
    if (!token) {
      return {
        source: "calendar",
        success: false,
        itemsSynced: 0,
        errors: ["No Google OAuth credentials. Run: gizzi vault config login google"],
      }
    }

    const lookbackMs = (config.lookbackDays || 30) * 24 * 60 * 60 * 1000
    const timeMin = new Date(Date.now() - lookbackMs).toISOString()
    const timeMax = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()

    const list = await calendarFetch(
      `/calendars/primary/events?timeMin=${encodeURIComponent(timeMin)}&timeMax=${encodeURIComponent(timeMax)}&maxResults=250&singleEvents=true&orderBy=startTime`,
      token,
    )
    const events = list.items || []

    let synced = 0
    for (const event of events) {
      const dateStr = event.start?.dateTime
        ? event.start.dateTime.slice(0, 10)
        : event.start?.date || new Date().toISOString().slice(0, 10)
      const safeTitle = IO.sanitizeFilename(event.summary || `event-${event.id}`).slice(0, 80)
      const relPath = path.join("Meetings", `${dateStr}-${safeTitle}.md`)

      const existing = await vault.getNote(relPath)
      if (existing) continue

      const content = formatEventMarkdown(event)
      await vault.writeNote(relPath, content, {
        title: event.summary || "Event",
        date: dateStr,
        tags: ["calendar", "event"],
      })
      synced++
    }

    await saveState(vault, { lastSyncAt: new Date().toISOString() })
    log.info("Calendar sync complete", { synced, total: events.length })

    return { source: "calendar", success: true, itemsSynced: synced, errors: [] }
  },

  async disconnect(): Promise<void> {
    log.info("Calendar connector disconnected")
  },
}

registerConnector(CalendarConnector)
