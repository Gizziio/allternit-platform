/**
 * Provider plan quotas — how much of a subscription's rolling windows (e.g.
 * 5-hour, weekly) a provider has used. Read-only: uses the provider CLI's own
 * stored sign-in, never prompts or refreshes it. Providers without a quota
 * source return undefined (the client shows nothing, not a guess).
 */

import { readFile } from "node:fs/promises"
import { homedir } from "node:os"
import path from "node:path"
import { Log } from "@/shared/util/log"

const log = Log.create({ service: "provider.quota" })

export interface QuotaWindow {
  /** Stable id: "5h" | "7d" | "month" | "month-code". */
  id: string
  label: string
  /** 0–1 share of the window already used. */
  usedRatio: number
  /** ISO time the window resets, when the provider says. */
  resetAt?: string
}

export interface ProviderQuota {
  providerID: string
  source: string
  windows: QuotaWindow[]
  fetchedAt: number
}

export type QuotaResult =
  | { status: "ok"; quota: ProviderQuota }
  | { status: "unsupported" }
  | { status: "signed-out" | "expired" | "error"; message: string }

type Fetcher = () => Promise<QuotaResult>

const CACHE_MS = 60_000
const cache = new Map<string, { at: number; result: QuotaResult }>()

// ── Kimi For Coding (kimi-cli) ────────────────────────────────────────────
// Same endpoint and sign-in the Kimi CLI uses for its own usage view.
function kimiHome(): string {
  return process.env.KIMI_CODE_HOME ?? path.join(homedir(), ".kimi-code")
}

function kimiBaseUrl(): string {
  return (process.env.KIMI_CODE_BASE_URL ?? "https://api.kimi.com/coding/v1").replace(/\/+$/, "")
}

function ratio(value: unknown): number | undefined {
  const n = typeof value === "string" ? Number(value) : value
  return typeof n === "number" && Number.isFinite(n) ? Math.min(1, Math.max(0, n)) : undefined
}

export function parseKimiUsages(payload: any): QuotaWindow[] {
  const usages = payload?.usages ?? {}
  const entries: Array<[string, string, string]> = [
    ["limit_5h", "5h", "5-hour"],
    ["limit_7d", "7d", "Weekly"],
    ["limit_month_total", "month", "Monthly"],
  ]
  const windows: QuotaWindow[] = []
  for (const [key, id, label] of entries) {
    const entry = usages[key]
    const usedRatio = ratio(entry?.used_ratio)
    if (usedRatio === undefined) continue
    const resetAt = typeof entry?.reset_time === "string" && entry.reset_time ? entry.reset_time : undefined
    windows.push({ id, label, usedRatio, ...(resetAt ? { resetAt } : {}) })
  }
  return windows
}

const kimi: Fetcher = async () => {
  let token: string | undefined
  let expiresAt: number | undefined
  try {
    const raw = JSON.parse(await readFile(path.join(kimiHome(), "credentials", "kimi-code.json"), "utf8"))
    token = typeof raw?.access_token === "string" ? raw.access_token : undefined
    expiresAt = typeof raw?.expires_at === "number" ? raw.expires_at : undefined
  } catch {
    return { status: "signed-out", message: "Sign in to Kimi CLI to see plan usage." }
  }
  if (!token) return { status: "signed-out", message: "Sign in to Kimi CLI to see plan usage." }
  // expires_at is epoch seconds; the CLI refreshes it on its next run.
  if (expiresAt && expiresAt * 1000 < Date.now()) {
    return { status: "expired", message: "Kimi sign-in expired; it refreshes the next time Kimi runs." }
  }
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 8000)
  try {
    const res = await fetch(`${kimiBaseUrl()}/usages`, {
      headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
      signal: controller.signal,
    })
    if (res.status === 401) return { status: "expired", message: "Kimi sign-in expired; it refreshes the next time Kimi runs." }
    if (!res.ok) return { status: "error", message: `Kimi usage request failed (${res.status}).` }
    const payload = await res.json()
    return {
      status: "ok",
      quota: {
        providerID: "kimi-cli",
        source: "Kimi For Coding",
        windows: parseKimiUsages(payload),
        fetchedAt: Date.now(),
      },
    }
  } catch (err) {
    log.warn("kimi quota fetch failed", { error: err instanceof Error ? err.message : String(err) })
    return { status: "error", message: "Couldn't reach Kimi to read plan usage." }
  } finally {
    clearTimeout(timer)
  }
}

const FETCHERS: Record<string, Fetcher> = {
  "kimi-cli": kimi,
}

export namespace ProviderQuotas {
  export async function get(providerID: string): Promise<QuotaResult> {
    const fetcher = FETCHERS[providerID]
    if (!fetcher) return { status: "unsupported" }
    const hit = cache.get(providerID)
    if (hit && Date.now() - hit.at < CACHE_MS) return hit.result
    const result = await fetcher()
    cache.set(providerID, { at: Date.now(), result })
    return result
  }

  export function supported(): string[] {
    return Object.keys(FETCHERS)
  }
}
