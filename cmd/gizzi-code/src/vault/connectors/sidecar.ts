/**
 * Sidecar-Backed Vault Connectors
 *
 * Generic VaultConnector factory for sources reachable through
 * allternit-api's connector layer (cmd/allternit-api/src/connector_routes.rs)
 * — which itself either dispatches declaratively (assets/connectors.meta.json
 * tools[]) or proxies to the vendored open-connector sidecar
 * (services/open-connector, see its PROVENANCE.md). Vault talks to neither
 * directly; it goes through allternit-api's existing REST surface the same
 * way the rest of gizzi-code does (runtime/services/api/allternitApi.ts).
 *
 * This intentionally does NOT replace vault/connectors/{gmail,calendar,fireflies}.ts
 * — those already work end-to-end via their own direct OAuth. This factory
 * is for filling coverage gaps (Notion, GitHub, Linear, Slack, ...) without
 * writing a bespoke OAuth flow per source.
 *
 * See docs/LENS_CONTEXT_LAYER_PLAN.md Phase 1/2.
 */

import { Log } from "@/shared/util/log"
import { getAllternitApiConfig, apiFetchJson } from "@/runtime/services/api/allternitApi"
import type { VaultManager } from "../index"
import type { Vault } from "../types"
import type { ConnectorConfig, ConnectorMetadata, ConnectorStatus, VaultConnector } from "../connector"
import { registerConnector } from "../connector"
import type { SyncResult } from "../sync"
import { ingestItems, type ExtractedItem } from "../extraction-pipeline"

const log = Log.create({ service: "vault-connector-sidecar" })

interface ConnectorApiResponse {
  connection?: { status?: string; account?: string }
  connectable?: boolean
}

interface SidecarConnectorSpec {
  id: string
  name: string
  description: string
  /** Tool name to POST to /api/v1/connectors/:id/execute — must exist as
   * either a hand-written case or a connectors.meta.json tools[] entry in
   * allternit-api (curated ids), or a real sidecar action id (non-curated
   * ids, resolved via open_connector_proxy). Verify with a real execute
   * call before shipping — see PROVENANCE note per-instance below. */
  tool: string
  input?: Record<string, unknown>
  /** Maps the raw `{status, result, ...}` execute response into vault items. */
  mapItems: (executeResponse: unknown) => ExtractedItem[]
  sensitivity?: Vault.Sensitivity
  defaultLookbackDays?: number
  defaultIntervalMinutes?: number
}

function createSidecarConnector(spec: SidecarConnectorSpec): VaultConnector {
  const meta: ConnectorMetadata = {
    id: spec.id,
    name: spec.name,
    description: spec.description,
    version: "1.0.0",
    authType: "oauth",
    defaultLookbackDays: spec.defaultLookbackDays,
    defaultIntervalMinutes: spec.defaultIntervalMinutes,
  }

  async function fetchStatus(): Promise<ConnectorStatus> {
    try {
      const config = getAllternitApiConfig()
      const data = await apiFetchJson<ConnectorApiResponse>(config, `/api/v1/connectors/${spec.id}`)
      const connected = data.connection?.status === "connected"
      return { connected, authenticated: connected }
    } catch (e) {
      const error = e instanceof Error ? e.message : String(e)
      log.warn("Failed to check connector status", { id: spec.id, error })
      return { connected: false, authenticated: false, error }
    }
  }

  return {
    meta,

    async init() {},

    async connect(): Promise<boolean> {
      const status = await fetchStatus()
      return status.connected
    },

    async disconnect(): Promise<void> {},

    status: fetchStatus,

    async sync(vault: VaultManager, _config: ConnectorConfig): Promise<SyncResult> {
      const status = await fetchStatus()
      if (!status.connected) {
        return {
          source: spec.id,
          success: false,
          itemsSynced: 0,
          errors: [
            `${spec.name} is not connected. Connect it via allternit-api ` +
              `(GET/POST /api/v1/connectors/${spec.id}/connect), then run: gizzi vault sync ${spec.id}`,
          ],
        }
      }

      try {
        const apiConfig = getAllternitApiConfig()
        const data = await apiFetchJson<unknown>(apiConfig, `/api/v1/connectors/${spec.id}/execute`, {
          method: "POST",
          body: JSON.stringify({ tool: spec.tool, input: spec.input || {} }),
        })
        const items = spec.mapItems(data)
        const count = await ingestItems(vault, spec.id, items, spec.sensitivity)
        return { source: spec.id, success: true, itemsSynced: count, errors: [] }
      } catch (e) {
        const error = e instanceof Error ? e.message : String(e)
        log.error("Sidecar connector sync failed", { id: spec.id, error })
        return { source: spec.id, success: false, itemsSynced: 0, errors: [error] }
      }
    },
  }
}

// ============================================================================
// GitHub — verified 2026-08-04 against a live connection (account "Gizziio",
// local_cli auth via the `gh` CLI, no OAuth app needed). Real response shape
// confirmed by a manual execute call before this was written; see
// docs/LENS_CONTEXT_LAYER_PLAN.md Phase 1 notes.
// ============================================================================
registerConnector(
  createSidecarConnector({
    id: "github",
    name: "GitHub",
    description: "Recently updated repositories on the connected GitHub account.",
    tool: "github_list_repos",
    input: { sort: "updated", per_page: 20 },
    defaultLookbackDays: 30,
    defaultIntervalMinutes: 120,
    mapItems: (response) => {
      const repos = (response as { result?: unknown })?.result
      if (!Array.isArray(repos)) return []
      return repos.map((r: Record<string, unknown>): ExtractedItem => ({
        id: String(r.id),
        title: String(r.full_name ?? r.name ?? r.id),
        content:
          `# ${r.full_name}\n\n${r.description ?? ""}\n\n` +
          `**Language:** ${r.language ?? "n/a"}  \n` +
          `**Updated:** ${r.updated_at}  \n` +
          `**URL:** ${r.html_url}\n`,
        tags: ["repository"],
        date: typeof r.updated_at === "string" ? r.updated_at : undefined,
      }))
    },
  }),
)

// ============================================================================
// Linear — via allternit-api, same as GitHub. Linear is NOT in
// connectors.meta.json's curated set (github/notion/slack only), so it
// already routes through execute_connector's sidecar passthrough
// (execute_sidecar), which lets the sidecar build its own request — no
// header bug here, unlike the curated path. It also supports a self-serve
// "Personal API Key" (Settings > Account > Security & Access on linear.app)
// — no OAuth app needed. Not yet connected (no key set), so this reports
// disconnected until Eoj pastes one in — but that's a one-minute step, not
// an app-registration process. Real action id verified against
// services/open-connector/src/providers/linear/actions.ts.
//
// Connect it directly against allternit-api once you have a key (the gateway
// base defaults to the loopback fallback in
// src/shared/constants/allternitGateway.ts; override with ALLTERNIT_API_URL):
//   curl -X PUT "$ALLTERNIT_API_URL/api/v1/connectors/linear/connect" \
//     -H "Content-Type: application/json" -d '{"via":"api_key","api_key":"lin_api_..."}'
// ============================================================================
registerConnector(
  createSidecarConnector({
    id: "linear",
    name: "Linear",
    description: "Recent Linear issues.",
    tool: "list_linear_issues",
    input: { first: 20 },
    defaultLookbackDays: 30,
    defaultIntervalMinutes: 120,
    mapItems: (response) => {
      const issues = (response as { result?: { issues?: unknown } })?.result?.issues
      if (!Array.isArray(issues)) return []
      return issues.map((i: Record<string, unknown>): ExtractedItem => ({
        id: String(i.id),
        title: String(i.title ?? i.id),
        content: `# ${i.title}\n\n${i.description ?? ""}\n\n**State:** ${i.state ?? "n/a"}\n**URL:** ${i.url ?? ""}\n`,
        tags: ["issue"],
        date: typeof i.updatedAt === "string" ? i.updatedAt : undefined,
      }))
    },
  }),
)

// ============================================================================
// Notion — bypasses allternit-api entirely. Notion IS in the curated set,
// and execute_connector's curated path hardcodes a GitHub Accept header on
// every request with no per-provider override — Notion's API 400s without
// `Notion-Version`, regardless of auth method. The sidecar's own executor
// (services/open-connector/src/providers/notion/executors.ts:134) sets this
// correctly, so this connector talks to the sidecar directly using its
// admin/runtime tokens instead of going through the buggy Rust wrapper.
// Notion supports a self-serve "Internal Integration Secret" (no OAuth app):
// create one at notion.so/my-integrations, share target pages/databases
// with it, then connect:
//   curl -X PUT http://127.0.0.1:8014/api/connections/notion \
//     -H "Authorization: Bearer $ALLTERNIT_CONNECTOR_SIDECAR_ADMIN_TOKEN" \
//     -H "Content-Type: application/json" \
//     -d '{"authType":"api_key","values":{"apiKey":"secret_..."}}'
//
// Sidecar URL/tokens read from env (same names dev-stack-watch.cjs uses for
// the api/connectors child processes) — not yet wired into gizzi-code's own
// process env by default; export them in your shell before running
// `gizzi vault sync notion`, or source .env.lens-dev at the repo root.
// ============================================================================
function sidecarBaseUrl(): string {
  return (process.env.ALLTERNIT_CONNECTOR_SIDECAR_URL || "http://127.0.0.1:8014").replace(/\/$/, "")
}
function sidecarAdminToken(): string | undefined {
  return process.env.ALLTERNIT_CONNECTOR_SIDECAR_ADMIN_TOKEN
}
function sidecarRuntimeToken(): string | undefined {
  return process.env.ALLTERNIT_CONNECTOR_SIDECAR_RUNTIME_TOKEN
}

registerConnector({
  meta: {
    id: "notion",
    name: "Notion",
    description: "Recently edited Notion pages.",
    version: "1.0.0",
    authType: "apikey",
    defaultLookbackDays: 30,
    defaultIntervalMinutes: 120,
  },
  async init() {},
  async disconnect() {},
  async connect() {
    const status = await this.status()
    return status.connected
  },
  async status(): Promise<ConnectorStatus> {
    const adminToken = sidecarAdminToken()
    if (!adminToken) {
      return { connected: false, authenticated: false, error: "ALLTERNIT_CONNECTOR_SIDECAR_ADMIN_TOKEN not set in this process's env" }
    }
    try {
      const res = await fetch(`${sidecarBaseUrl()}/api/connections`, {
        headers: { Authorization: `Bearer ${adminToken}` },
      })
      if (!res.ok) return { connected: false, authenticated: false, error: `sidecar /api/connections: ${res.status}` }
      const connections = (await res.json()) as Array<{ service: string }>
      const connected = connections.some((c) => c.service === "notion")
      return { connected, authenticated: connected }
    } catch (e) {
      return { connected: false, authenticated: false, error: e instanceof Error ? e.message : String(e) }
    }
  },
  async sync(vault: VaultManager, _config: ConnectorConfig): Promise<SyncResult> {
    const status = await this.status()
    if (!status.connected) {
      return {
        source: "notion",
        success: false,
        itemsSynced: 0,
        errors: [status.error || "Notion is not connected. See the PUT /api/connections/notion example above this connector's definition in vault/connectors/sidecar.ts."],
      }
    }
    const runtimeToken = sidecarRuntimeToken()
    if (!runtimeToken) {
      return { source: "notion", success: false, itemsSynced: 0, errors: ["ALLTERNIT_CONNECTOR_SIDECAR_RUNTIME_TOKEN not set in this process's env"] }
    }
    try {
      const res = await fetch(`${sidecarBaseUrl()}/v1/actions/notion.search`, {
        method: "POST",
        headers: { Authorization: `Bearer ${runtimeToken}`, "Content-Type": "application/json" },
        body: JSON.stringify({ input: { query: "", pageSize: 20 } }),
      })
      if (!res.ok) {
        const text = await res.text().catch(() => "")
        return { source: "notion", success: false, itemsSynced: 0, errors: [`sidecar execute: ${res.status} ${text}`] }
      }
      const envelope = (await res.json()) as { data?: { result?: { results?: unknown[] } } }
      const results = envelope.data?.result?.results
      if (!Array.isArray(results)) {
        return { source: "notion", success: true, itemsSynced: 0, errors: [] }
      }
      const items: ExtractedItem[] = results.map((p: Record<string, unknown>): ExtractedItem => {
        const props = (p.properties ?? {}) as Record<string, any>
        const titleProp = Object.values(props).find((v: any) => v?.type === "title") as any
        const title = titleProp?.title?.[0]?.plain_text || String(p.id ?? "Untitled")
        return {
          id: String(p.id),
          title,
          content: `# ${title}\n\n**URL:** ${p.url ?? ""}\n**Last edited:** ${p.last_edited_time ?? ""}\n`,
          tags: ["page"],
          date: typeof p.last_edited_time === "string" ? p.last_edited_time : undefined,
        }
      })
      const count = await ingestItems(vault, "notion", items, "private")
      return { source: "notion", success: true, itemsSynced: count, errors: [] }
    } catch (e) {
      const error = e instanceof Error ? e.message : String(e)
      log.error("Notion sync failed", { error })
      return { source: "notion", success: false, itemsSynced: 0, errors: [error] }
    }
  },
})

// ============================================================================
// Slack — genuinely needs an OAuth app; the sidecar's own definition has no
// api_key alternative for it (unlike Notion/Linear), and that's Slack's own
// auth model, not a gap in our tooling. IS in the curated set, so once an
// app exists it would hit the same header bug Notion had — route it through
// the sidecar directly too (same pattern as notion above) rather than
// through allternit-api's curated path. Not built out further this session:
// there's nothing to verify against without a real OAuth app.
// ============================================================================
registerConnector(
  createSidecarConnector({
    id: "slack",
    name: "Slack",
    description: "Recent Slack channel activity — needs a Slack OAuth app (Slack has no personal-token alternative); connect via the sidecar directly, not allternit-api, to avoid the same header issue Notion had.",
    tool: "",
    mapItems: () => [],
  }),
)
