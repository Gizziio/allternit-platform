/**
 * Fireflies Sync Engine
 *
 * Synchronizes Fireflies.ai meeting transcripts into the knowledge vault.
 */

import path from "path"
import { Log } from "@/shared/util/log"
import { Filesystem } from "@/shared/util/filesystem"
import type { Vault } from "../types"
import { VaultManager } from "../index"
import * as IO from "../io"
import { loadSettings } from "../settings"
import type { SyncResult, SyncEngine } from "./index"
import { registerEngine } from "./index"

const log = Log.create({ service: "vault-sync-fireflies" })

const FIREFLIES_API = "https://api.fireflies.ai/graphql"
const SYNC_STATE_FILE = "fireflies-sync-state.json"

interface SyncState {
  lastSyncAt?: string
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
    `- **Duration:** ${t.duration || "Unknown"} minutes`,
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

export const firefliesSyncEngine: SyncEngine = async (vault, config) => {
  const settings = await loadSettings()
  const apiKey = settings.sources.fireflies.apiKey
  if (!apiKey) {
    return { source: "fireflies", success: false, itemsSynced: 0, errors: ["No Fireflies API key configured. Run: gizzi vault config fireflies"] }
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
}

registerEngine("fireflies", firefliesSyncEngine)
