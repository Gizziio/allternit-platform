/**
 * Calendar Sync Engine
 *
 * Synchronizes Google Calendar events into the knowledge vault as Markdown notes.
 */

import path from "path"
import { Log } from "@/shared/util/log"
import { Auth } from "@/runtime/integrations/auth"
import { Filesystem } from "@/shared/util/filesystem"
import type { Vault } from "../types"
import { VaultManager } from "../index"
import * as IO from "../io"
import type { SyncResult, SyncEngine } from "./index"
import { registerEngine } from "./index"

const log = Log.create({ service: "vault-sync-calendar" })

const CALENDAR_API_BASE = "https://www.googleapis.com/calendar/v3"
const AUTH_KEY = "google"
const SYNC_STATE_FILE = "calendar-sync-state.json"

interface SyncState {
  lastSyncAt?: string
}

async function getAccessToken(): Promise<string | null> {
  const auth = await Auth.get(AUTH_KEY)
  if (!auth || auth.type !== "oauth") {
    log.warn("No Google OAuth credentials found.")
    return null
  }
  return auth.access
}

async function calendarFetch(endpoint: string, token: string) {
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
    .filter((a: any) => !a.self)
    .map((a: any) => `- ${a.displayName || a.email} (${a.responseStatus})`)
    .join("\n")

  return [
    `## ${event.summary || "Untitled Event"}`,
    "",
    `- **Start:** ${start}`,
    `- **End:** ${end}`,
    `- **Location:** ${event.location || "N/A"}`,
    `- **Organizer:** ${event.organizer?.displayName || event.organizer?.email || "N/A"}`,
    "",
    event.description || "",
    "",
    attendees ? `**Attendees:**\n${attendees}\n` : "",
    "---",
    "",
  ].join("\n")
}

export const calendarSyncEngine: SyncEngine = async (vault, config) => {
  const token = await getAccessToken()
  if (!token) {
    return { source: "calendar", success: false, itemsSynced: 0, errors: ["No Google OAuth token available"] }
  }

  const now = new Date()
  const pastDate = new Date()
  pastDate.setDate(pastDate.getDate() - config.lookbackDays)

  const timeMin = pastDate.toISOString()
  const timeMax = now.toISOString()

  const params = new URLSearchParams({
    timeMin,
    timeMax,
    singleEvents: "true",
    orderBy: "startTime",
    maxResults: "250",
  })

  const data = await calendarFetch(`/calendars/primary/events?${params.toString()}`, token) as any
  const events = data.items || []
  let synced = 0

  for (const event of events) {
    const dateStr = (event.start?.date || event.start?.dateTime || "").slice(0, 10)
    if (!dateStr) continue

    const dailyNote = await vault.getDailyNote(new Date(dateStr))
    const eventMd = formatEventMarkdown(event)

    // Append to daily note if not already present
    if (!dailyNote.content.includes(event.id)) {
      const updatedContent = dailyNote.content + `\n### Calendar: ${event.summary || "Event"}\n\n${eventMd}\n`
      await vault.writeNote(dailyNote.relPath, updatedContent, dailyNote.frontmatter)
      synced++
    }
  }

  await saveState(vault, { lastSyncAt: now.toISOString() })
  log.info("Calendar sync complete", { synced, totalEvents: events.length })

  return { source: "calendar", success: true, itemsSynced: synced, errors: [] }
}

registerEngine("calendar", calendarSyncEngine)
