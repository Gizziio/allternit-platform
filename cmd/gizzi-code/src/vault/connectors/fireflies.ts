/**
 * Fireflies Connector
 *
 * Vault connector that synchronizes Fireflies.ai meeting transcripts
 * into the knowledge vault.
 */

import path from "path"
import { Log } from "@/shared/util/log"
import { Filesystem } from "@/shared/util/filesystem"
import type { VaultManager } from "@/vault"
import * as IO from "@/vault/io"
import { loadSettings } from "@/vault/settings"
import {
  registerConnector,
  type VaultConnector,
  type ConnectorConfig,
  type ConnectorStatus,
} from "@/vault/connector"
import type { SyncResult } from "@/vault/sync"

const log = Log.create({ service: "connector-fireflies" })

const FIREFLIES_API = "https://api.fireflies.ai/graphql"
const SYNC_STATE_FILE = "fireflies-sync-state.json"

interface SyncState {
  lastSyncAt?: string
}

// ============================================================================
// Fireflies API Helpers
// ============================================================================

async function fetchTranscripts(apiKey: string, limit = 50): Promise<any[]> {
  const query = `
    query Transcripts {
      transcripts(limit: ${limit}) {
        id
        title
        date
        duration
        summary {
          keywords
          action_items
          outline
          shorthand_bullet
          overview
        }
        sentences {
          speaker_name
          text
        }
      }
    }
  `

  const response = await fetch(FIREFLIES_API, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({ query }),
  })

  if (!response.ok) {
    throw new Error(`Fireflies API error: ${response.status}`)
  }

  const data = await response.json()
  return data.data?.transcripts || []
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

function formatTranscript(t: any): string {
  const sentences = (t.sentences || [])
    .map((s: any) => `**${s.speaker_name}:** ${s.text}`)
    .join("\n\n")

  const summary = t.summary || {}
  const actionItems = (summary.action_items || [])
    .map((item: string) => `- [ ] ${item}`)
    .join("\n")

  return [
    `## ${t.title || "Meeting"}`,
    "",
    `- **Date:** ${t.date || "Unknown"}`,
    `- **Duration:** ${t.duration || "Unknown"}` + " minutes",
    `- **Fireflies ID:** ${t.id}`,
    "",
    "### Summary",
    summary.overview || summary.shorthand_bullet || "No summary available.",
    "",
    summary.keywords?.length ? `**Keywords:** ${summary.keywords.join(", ")}` : "",
    "",
    "### Action Items",
    actionItems || "None",
    "",
    "### Transcript",
    sentences || "No transcript available.",
    "",
  ].filter(Boolean).join("\n")
}

// ============================================================================
// Connector Implementation
// ============================================================================

export const FirefliesConnector: VaultConnector = {
  meta: {
    id: "fireflies",
    name: "Fireflies.ai",
    description: "Synchronize Fireflies meeting transcripts into the knowledge vault",
    version: "1.0.0",
    authType: "apikey",
  },

  async init(): Promise<void> {
    log.info("Fireflies connector initialized")
  },

  async connect(): Promise<boolean> {
    const settings = await loadSettings()
    const hasKey = !!settings.sources.fireflies.apiKey
    log.info("Fireflies connect", { authenticated: hasKey })
    return hasKey
  },

  async status(): Promise<ConnectorStatus> {
    const settings = await loadSettings()
    const authenticated = !!settings.sources.fireflies.apiKey
    return {
      connected: authenticated,
      authenticated,
    }
  },

  async sync(vault: VaultManager, config: ConnectorConfig): Promise<SyncResult> {
    const apiKey = config.apiKey as string | undefined
    if (!apiKey) {
      return {
        source: "fireflies",
        success: false,
        itemsSynced: 0,
        errors: ["No Fireflies API key configured. Run: gizzi vault config auth fireflies"],
      }
    }

    const transcripts = await fetchTranscripts(apiKey)
    let synced = 0

    for (const t of transcripts) {
      const dateStr = t.date ? t.date.slice(0, 10) : new Date().toISOString().slice(0, 10)
      const safeTitle = IO.sanitizeFilename(t.title || `meeting-${t.id}`)
      const relPath = path.join("Meetings", `${dateStr}-${safeTitle}.md`)

      const existing = await vault.getNote(relPath)
      if (existing) continue

      const content = formatTranscript(t)
      await vault.writeNote(relPath, content, {
        title: t.title || "Meeting",
        date: dateStr,
        tags: ["meeting", "fireflies"],
      })
      synced++
    }

    await saveState(vault, { lastSyncAt: new Date().toISOString() })
    log.info("Fireflies sync complete", { synced, total: transcripts.length })

    return { source: "fireflies", success: true, itemsSynced: synced, errors: [] }
  },

  async disconnect(): Promise<void> {
    log.info("Fireflies connector disconnected")
  },
}

registerConnector(FirefliesConnector)
