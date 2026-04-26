/**
 * Gmail Connector
 *
 * Vault connector that synchronizes Gmail threads into the knowledge vault.
 */

import path from "path"
import { Log } from "@/shared/util/log"
import { Auth } from "@/runtime/integrations/auth"
import { Filesystem } from "@/shared/util/filesystem"
import type { VaultManager } from "@/vault"
import * as IO from "@/vault/io"
import { loadSettings } from "@/vault/settings"
import {
  registerConnector,
  checkOAuthAuth,
  refreshOAuthToken,
  type VaultConnector,
  type ConnectorConfig,
  type ConnectorStatus,
} from "@/vault/connector"
import type { SyncResult } from "@/vault/sync"

const log = Log.create({ service: "connector-gmail" })

const GMAIL_API_BASE = "https://gmail.googleapis.com/gmail/v1"
const AUTH_KEY = "google"
const SYNC_STATE_FILE = "gmail-sync-state.json"

interface SyncState {
  historyId?: string
  lastSyncAt?: string
}

// ============================================================================
// Gmail API Helpers
// ============================================================================

async function getAccessToken(): Promise<string | null> {
  const auth = await Auth.get(AUTH_KEY)
  if (!auth || auth.type !== "oauth") {
    log.warn("No Google OAuth credentials found")
    return null
  }

  const now = Date.now()
  if (auth.expires <= now + 60000) {
    log.info("Access token expired, refreshing...")
    const settings = await loadSettings()
    const clientId = settings.sources.gmail.clientId
    const clientSecret = settings.sources.gmail.clientSecret
    if (!clientId || !clientSecret) {
      log.error("Google OAuth credentials not configured")
      return null
    }
    const refreshed = await refreshOAuthToken(AUTH_KEY, auth.refresh, clientId, clientSecret)
    if (!refreshed) return null
    const updated = await Auth.get(AUTH_KEY)
    return updated?.type === "oauth" ? updated.access : null
  }

  return auth.access
}

async function gmailFetch(endpoint: string, token: string): Promise<any> {
  const response = await fetch(`${GMAIL_API_BASE}${endpoint}`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!response.ok) {
    throw new Error(`Gmail API error: ${response.status} ${await response.text()}`)
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

function formatThreadMarkdown(thread: any): string {
  const messages = thread.messages || []
  const subject = messages[0]?.payload?.headers?.find((h: any) => h.name === "Subject")?.value || "No Subject"
  const from = messages[0]?.payload?.headers?.find((h: any) => h.name === "From")?.value || "Unknown"
  const date = messages[0]?.payload?.headers?.find((h: any) => h.name === "Date")?.value || "Unknown"

  const body = messages
    .map((m: any) => {
      const sender = m.payload?.headers?.find((h: any) => h.name === "From")?.value || "Unknown"
      const text = m.snippet || ""
      return `**${sender}:** ${text}`
    })
    .join("\n\n")

  return [
    `## ${subject}`,
    "",
    `- **From:** ${from}`,
    `- **Date:** ${date}`,
    `- **Thread ID:** ${thread.id}`,
    "",
    "### Messages",
    body,
    "",
  ].join("\n")
}

// ============================================================================
// Connector Implementation
// ============================================================================

export const GmailConnector: VaultConnector = {
  meta: {
    id: "gmail",
    name: "Gmail",
    description: "Synchronize Gmail threads into the knowledge vault",
    version: "1.0.0",
    authType: "oauth",
    authProviderId: AUTH_KEY,
  },

  async init(): Promise<void> {
    log.info("Gmail connector initialized")
  },

  async connect(): Promise<boolean> {
    const ok = await checkOAuthAuth(AUTH_KEY)
    log.info("Gmail connect", { authenticated: ok })
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
        source: "gmail",
        success: false,
        itemsSynced: 0,
        errors: ["No Google OAuth credentials. Run: gizzi vault config login google"],
      }
    }

    const state = await loadState(vault)
    const lookbackMs = (config.lookbackDays || 7) * 24 * 60 * 60 * 1000
    const afterDate = new Date(Date.now() - lookbackMs).toISOString().split("T")[0].replace(/-/g, "/")

    const query = `after:${afterDate}`
    const threadsList = await gmailFetch(`/users/me/threads?q=${encodeURIComponent(query)}`, token)
    const threads = threadsList.threads || []

    let synced = 0
    for (const t of threads.slice(0, 50)) {
      const thread = await gmailFetch(`/users/me/threads/${t.id}`, token)
      const subject = thread.messages?.[0]?.payload?.headers?.find((h: any) => h.name === "Subject")?.value || "No Subject"
      const dateStr = thread.messages?.[0]?.internalDate
        ? new Date(Number(thread.messages[0].internalDate)).toISOString().slice(0, 10)
        : new Date().toISOString().slice(0, 10)
      const safeTitle = IO.sanitizeFilename(subject).slice(0, 80) || `email-${t.id}`
      const relPath = path.join("Emails", `${dateStr}-${safeTitle}.md`)

      const existing = await vault.getNote(relPath)
      if (existing) continue

      const content = formatThreadMarkdown(thread)
      await vault.writeNote(relPath, content, {
        title: subject,
        date: dateStr,
        tags: ["email", "gmail"],
      })
      synced++
    }

    await saveState(vault, { lastSyncAt: new Date().toISOString() })
    log.info("Gmail sync complete", { synced, total: threads.length })

    return { source: "gmail", success: true, itemsSynced: synced, errors: [] }
  },

  async disconnect(): Promise<void> {
    log.info("Gmail connector disconnected")
  },
}

registerConnector(GmailConnector)
