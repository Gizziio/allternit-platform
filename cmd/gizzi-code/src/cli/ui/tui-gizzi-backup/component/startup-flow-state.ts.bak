export const STARTUP_FLOW_VERSION = 3
export const STARTUP_FLOW_VERSION_KEY = "startup_flow_version"

export function startupFlowStateKey(name: string) {
  return `startup_flow_v${STARTUP_FLOW_VERSION}.${name}`
}

function encodeWorkspace(value: string) {
  return Buffer.from(value)
    .toString("base64")
    .replace(/=+$/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
}

export function workspaceTrustKey(workspace: string) {
  return `startup_workspace_trust.${encodeWorkspace(workspace)}`
}

type KVLike = {
  ready: boolean
  get(key: string, defaultValue?: any): any
}

export function isWorkspaceTrusted(kv: Pick<KVLike, "get">, workspace: string) {
  return kv.get(workspaceTrustKey(workspace), false) === true
}

export function isStartupFlowComplete(kv: Pick<KVLike, "get">) {
  const raw = Number(kv.get(STARTUP_FLOW_VERSION_KEY, 0))
  return Number.isFinite(raw) && raw >= STARTUP_FLOW_VERSION
}

export function isStartupFlowActive(input: {
  kv: KVLike
  syncStatus: "loading" | "partial" | "complete"
  workspace: string
}) {
  if (process.env.GIZZI_TUI_FORCE_STARTUP_FLOW === "1") return true
  if (process.env.GIZZI_TUI_DISABLE_STARTUP_FLOW === "1") return false
  if (!input.kv.ready || input.syncStatus === "loading") return false
  if (!input.workspace) return true
  if (!isWorkspaceTrusted(input.kv, input.workspace)) return true
  return !isStartupFlowComplete(input.kv)
}

export function clearStartupFlow(kv: { set(key: string, value: any): void }, workspace?: string) {
  kv.set(STARTUP_FLOW_VERSION_KEY, 0)
  kv.set(startupFlowStateKey("completed_at"), null)
  kv.set(startupFlowStateKey("theme_done"), false)
  kv.set(startupFlowStateKey("account_done"), false)
  kv.set(startupFlowStateKey("account_skipped"), false)
  kv.set(startupFlowStateKey("account_url"), null)
  kv.set(startupFlowStateKey("provider_skipped"), false)
  kv.set(startupFlowStateKey("terminal_done"), false)
  kv.set(startupFlowStateKey("mcp_done"), false)

  if (workspace) {
    kv.set(workspaceTrustKey(workspace), false)
  }
}
