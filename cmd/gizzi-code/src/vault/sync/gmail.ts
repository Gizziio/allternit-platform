/**
 * Gmail Sync Engine
 *
 * Synchronizes Gmail threads into the knowledge vault as Markdown notes.
 * Uses raw Gmail API v1 via fetch + OAuth tokens from Allternit auth store.
 */

import path from "path"
import { Log } from "@/shared/util/log"
import { Auth } from "@/runtime/integrations/auth"
import { Filesystem } from "@/shared/util/filesystem"
import type { Vault } from "../types"
import { VaultManager } from "../index"
import * as IO from "../io"
import { loadSettings } from "../settings"
import type { SyncResult, SyncEngine } from "./index"
import { registerEngine } from "./index"

const log = Log.create({ service: "vault-sync-gmail" })

const GMAIL_API_BASE = "https://gmail.googleapis.com/gmail/v1"
const AUTH_KEY = "google"
const SYNC_STATE_FILE = "gmail-sync-state.json"

interface SyncState {
  historyId?: string
  lastSyncAt?: string
}

async function getAccessToken(): Promise<string | null> {
  const auth = await Auth.get(AUTH_KEY)
  if (!auth || auth.type !== "oauth") {
    log.warn("No Google OAuth credentials found. Run authentication first.")
    return null
  }

  // Check if token is expired and refresh if needed
  const now = Date.now()
  if (auth.expires <= now + 60000) {
    log.info("Access token expired, refreshing...")
    const refreshed = await refreshAccessToken(auth.refresh)
    if (refreshed) {
      await Auth.set(AUTH_KEY, {
        type: "oauth",
        access: refreshed.access_token,
        refresh: auth.refresh,
        expires: now + refreshed.expires_in * 1000,
      })
      return refreshed.access_token
    }
    return null
  }

  return auth.access
}

async function refreshAccessToken(refreshToken: string): Promise<{ access_token: string; expires_in: number } | null> {
  try {
    const settings = await loadSettings()
    const clientId = settings.sources.gmail.clientId
    const clientSecret = settings.sources.gmail.clientSecret
    if (!clientId || !clientSecret) {
      log.error("Google OAuth credentials not configured. Run: gizzi vault config google")
      return null
    }

    const response = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        refresh_token: refreshToken,
        grant_type: "refresh_token",
      }),
    })

    if (!response.ok) {
      log.error("Token refresh failed", { status: response.status })
      return null
    }

    const data = await response.json()
    return { access_token: data.access_token, expires_in: data.expires_in }
  } catch (e) {
    log.error("Token refresh error", { error: e })
    return null
  }
}

async function gmailFetch(endpoint: string, token: string) {
  const response = await fetch(`${GMAIL_API_BASE}${endpoint}`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!response.ok) {
    throw new Error(`Gmail API error: ${response.status} ${await response.text()}`)
  }
  return response.json()
}

function decodeBase64Url(data: string): string {
  const base64 = data.replace(/-/g, "+").replace(/_/g, "/")
  const pad = base64.length % 4
  const padded = pad ? base64 + "=".repeat(4 - pad) : base64
  return Buffer.from(padded, "base64").toString("utf-8")
}

function getBody(payload: any): string {
  let body = ""
  if (payload.parts) {
    for (const part of payload.parts) {
      if (part.mimeType === "text/plain" && part.body?.data) {
        body += decodeBase64Url(part.body.data)
      } else if (part.mimeType === "text/html" && part.body?.data) {
        // Strip HTML tags for simplicity
        const html = decodeBase64Url(part.body.data)
        body += html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim()
      } else if (part.parts) {
        body += getBody(part)
      }
    }
  } else if (payload.body?.data) {
    body += decodeBase64Url(payload.body.data)
  }
  return body
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

async function processThread(
  token: string,
  threadId: string,
  vault: VaultManager,
): Promise<boolean> {
  const thread = await gmailFetch(`/users/me/threads/${threadId}`, token) as any
  const messages = thread.messages || []
  if (messages.length === 0) return false

  const firstHeaders = messages[0].payload?.headers || []
  const subject = firstHeaders.find((h: any) => h.name === "Subject")?.value || "(No Subject)"

  let mdContent = `---\ntitle: ${subject}\ndate: ${new Date().toISOString()}\ntags: [email]\nsource: gmail\n---\n\n`
  mdContent += `# ${subject}\n\n**Thread ID:** ${threadId}\n**Message Count:** ${messages.length}\n\n---\n\n`

  for (const msg of messages) {
    const headers = msg.payload?.headers || []
    const from = headers.find((h: any) => h.name === "From")?.value || "Unknown"
    const date = headers.find((h: any) => h.name === "Date")?.value || "Unknown"
    const body = getBody(msg.payload)

    mdContent += `### From: ${from}\n**Date:** ${date}\n\n${body}\n\n---\n\n`
  }

  const safeSubject = IO.sanitizeFilename(subject)
  const relPath = path.join("Topics", `gmail-${safeSubject}-${threadId}.md`)
  await vault.writeNote(relPath, mdContent, { title: subject, tags: ["email", "gmail"] })
  return true
}

async function fullSync(token: string, vault: VaultManager, lookbackDays: number): Promise<number> {
  const pastDate = new Date()
  pastDate.setDate(pastDate.getDate() - lookbackDays)
  const dateQuery = pastDate.toISOString().split("T")[0]!.replace(/-/g, "/")

  const profile = await gmailFetch("/users/me/profile", token) as any
  const currentHistoryId = profile.historyId

  let pageToken: string | undefined
  let synced = 0

  do {
    const params = new URLSearchParams({ q: `after:${dateQuery}` })
    if (pageToken) params.set("pageToken", pageToken)

    const list = await gmailFetch(`/users/me/threads?${params.toString()}`, token) as any
    const threads = list.threads || []

    for (const thread of threads) {
      const ok = await processThread(token, thread.id, vault)
      if (ok) synced++
    }

    pageToken = list.nextPageToken
  } while (pageToken)

  await saveState(vault, { historyId: currentHistoryId, lastSyncAt: new Date().toISOString() })
  return synced
}

export const gmailSyncEngine: SyncEngine = async (vault, config) => {
  const token = await getAccessToken()
  if (!token) {
    return { source: "gmail", success: false, itemsSynced: 0, errors: ["No Google OAuth token available"] }
  }

  const state = await loadState(vault)
  const synced = await fullSync(token, vault, config.lookbackDays)

  return { source: "gmail", success: true, itemsSynced: synced, errors: [] }
}

// Auto-register on module load
registerEngine("gmail", gmailSyncEngine)
