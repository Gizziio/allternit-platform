function truthy(key: string) {
  const value = (process.env[key] ?? process.env["GIZZI_" + key.slice(4)])?.toLowerCase()
  return value === "true" || value === "1"
}

function env(key: string) {
  return process.env[key] ?? process.env["GIZZI_" + key.slice(4)]
}

export namespace Flag {
  export const GIZZI_AUTO_SHARE = truthy("GIZZI_AUTO_SHARE")
  export const GIZZI_GIT_BASH_PATH = env("GIZZI_GIT_BASH_PATH")
  export const GIZZI_CONFIG = env("GIZZI_CONFIG")
  export const GIZZI_CONFIG_DIR = env("GIZZI_CONFIG_DIR")
  export const GIZZI_CONFIG_CONTENT = env("GIZZI_CONFIG_CONTENT")
  export const GIZZI_DISABLE_AUTOUPDATE = truthy("GIZZI_DISABLE_AUTOUPDATE")
  export const GIZZI_DISABLE_PRUNE = truthy("GIZZI_DISABLE_PRUNE")
  export const GIZZI_DISABLE_TERMINAL_TITLE = truthy("GIZZI_DISABLE_TERMINAL_TITLE")
  export const GIZZI_PERMISSION = env("GIZZI_PERMISSION")
  export const GIZZI_DISABLE_DEFAULT_PLUGINS = truthy("GIZZI_DISABLE_DEFAULT_PLUGINS")
  export const GIZZI_DISABLE_LSP_DOWNLOAD = truthy("GIZZI_DISABLE_LSP_DOWNLOAD")
  export const GIZZI_ENABLE_EXPERIMENTAL_MODELS = truthy("GIZZI_ENABLE_EXPERIMENTAL_MODELS")
  export const GIZZI_DISABLE_AUTOCOMPACT = truthy("GIZZI_DISABLE_AUTOCOMPACT")
  export const GIZZI_DISABLE_MODELS_FETCH = truthy("GIZZI_DISABLE_MODELS_FETCH")
  export const GIZZI_DISABLE_CLAUDE_CODE = truthy("GIZZI_DISABLE_CLAUDE_CODE")
  export const GIZZI_DISABLE_CLAUDE_CODE_PROMPT =
    GIZZI_DISABLE_CLAUDE_CODE || truthy("GIZZI_DISABLE_CLAUDE_CODE_PROMPT")
  export const GIZZI_DISABLE_CLAUDE_CODE_SKILLS =
    GIZZI_DISABLE_CLAUDE_CODE || truthy("GIZZI_DISABLE_CLAUDE_CODE_SKILLS")
  export const GIZZI_DISABLE_EXTERNAL_SKILLS =
    GIZZI_DISABLE_CLAUDE_CODE_SKILLS || truthy("GIZZI_DISABLE_EXTERNAL_SKILLS")
  export declare const GIZZI_DISABLE_PROJECT_CONFIG: boolean
  export const GIZZI_FAKE_VCS = env("GIZZI_FAKE_VCS")
  export declare const GIZZI_CLIENT: string
  export const GIZZI_SERVER_PASSWORD = env("GIZZI_SERVER_PASSWORD")
  export const GIZZI_SERVER_USERNAME = env("GIZZI_SERVER_USERNAME")
  export const GIZZI_ENABLE_QUESTION_TOOL = truthy("GIZZI_ENABLE_QUESTION_TOOL")

  // Permission modes (set from CLI flags)
  export let GIZZI_PERMISSION_MODE: string | undefined = env("GIZZI_PERMISSION_MODE")
  export let GIZZI_SKIP_PERMISSIONS: boolean = truthy("GIZZI_SKIP_PERMISSIONS")

  // Worktree override (set from --worktree CLI flag)
  export let GIZZI_WORKTREE: string | undefined = env("GIZZI_WORKTREE")

  // Fallback model (set from --fallback-model CLI flag)
  export let GIZZI_FALLBACK_MODEL: string | undefined = env("GIZZI_FALLBACK_MODEL")

  // Experimental
  export const GIZZI_EXPERIMENTAL = truthy("GIZZI_EXPERIMENTAL")
  export const GIZZI_EXPERIMENTAL_FILEWATCHER = truthy("GIZZI_EXPERIMENTAL_FILEWATCHER")
  export const GIZZI_EXPERIMENTAL_DISABLE_FILEWATCHER = truthy("GIZZI_EXPERIMENTAL_DISABLE_FILEWATCHER")
  export const GIZZI_EXPERIMENTAL_ICON_DISCOVERY =
    GIZZI_EXPERIMENTAL || truthy("GIZZI_EXPERIMENTAL_ICON_DISCOVERY")

  const copy = env("GIZZI_EXPERIMENTAL_DISABLE_COPY_ON_SELECT")
  export const GIZZI_EXPERIMENTAL_DISABLE_COPY_ON_SELECT =
    copy === undefined ? process.platform === "win32" : truthy("GIZZI_EXPERIMENTAL_DISABLE_COPY_ON_SELECT")
  export const GIZZI_ENABLE_EXA =
    truthy("GIZZI_ENABLE_EXA") || GIZZI_EXPERIMENTAL || truthy("GIZZI_EXPERIMENTAL_EXA")
  export const GIZZI_EXPERIMENTAL_BASH_DEFAULT_TIMEOUT_MS = number("GIZZI_EXPERIMENTAL_BASH_DEFAULT_TIMEOUT_MS")
  export const GIZZI_EXPERIMENTAL_OUTPUT_TOKEN_MAX = number("GIZZI_EXPERIMENTAL_OUTPUT_TOKEN_MAX")
  export const GIZZI_EXPERIMENTAL_OXFMT = GIZZI_EXPERIMENTAL || truthy("GIZZI_EXPERIMENTAL_OXFMT")
  export const GIZZI_EXPERIMENTAL_LSP_TY = truthy("GIZZI_EXPERIMENTAL_LSP_TY")
  export const GIZZI_EXPERIMENTAL_LSP_TOOL = GIZZI_EXPERIMENTAL || truthy("GIZZI_EXPERIMENTAL_LSP_TOOL")
  export const GIZZI_ENABLE_BROWSER_TOOL = !truthy("GIZZI_DISABLE_BROWSER_TOOL")
  export const GIZZI_DISABLE_FILETIME_CHECK = truthy("GIZZI_DISABLE_FILETIME_CHECK")
  export const GIZZI_EXPERIMENTAL_PLAN_MODE = GIZZI_EXPERIMENTAL || truthy("GIZZI_EXPERIMENTAL_PLAN_MODE")
  export const GIZZI_EXPERIMENTAL_MARKDOWN = truthy("GIZZI_EXPERIMENTAL_MARKDOWN")
  export const GIZZI_MODELS_URL = env("GIZZI_MODELS_URL")
  export const GIZZI_MODELS_PATH = env("GIZZI_MODELS_PATH")

  // Sandbox — enable OS-level subprocess isolation (bwrap on Linux, sandbox-exec on macOS)
  // When set, ALL agent bash sessions start sandboxed. Individual sessions can still toggle.
  export const GIZZI_SANDBOX = truthy("GIZZI_SANDBOX")
  // When sandbox is on, allow outbound network (default true — agents need npm/pip/cargo)
  export const GIZZI_SANDBOX_ALLOW_NETWORK = !truthy("GIZZI_SANDBOX_BLOCK_NETWORK")

  // Cowork VM runtime endpoint (a2r-api POST /sandbox/execute)
  export const GIZZI_SANDBOX_RUNTIME_URL = env("GIZZI_SANDBOX_RUNTIME_URL")

  // VM session mode — provision a full VM per gizzi-code session (like CC cloud sessions).
  // When set, every new agent session gets a dedicated VM. All Bash tool calls execute
  // inside the VM rather than on the host. Project dir is shared in via bind mount / VirtioFS.
  export const GIZZI_VM_SESSIONS = truthy("GIZZI_VM_SESSIONS")
  // a2r-api base URL for VM session API (POST /vm-session etc.)
  // Defaults to GIZZI_SANDBOX_RUNTIME_URL if not set separately.
  export const GIZZI_VM_API_URL = env("GIZZI_VM_API_URL") ?? env("GIZZI_SANDBOX_RUNTIME_URL")

  function number(key: string) {
    const value = env(key)
    if (!value) return undefined
    const parsed = Number(value)
    return Number.isInteger(parsed) && parsed > 0 ? parsed : undefined
  }
}

// Dynamic getter for GIZZI_DISABLE_PROJECT_CONFIG
Object.defineProperty(Flag, "GIZZI_DISABLE_PROJECT_CONFIG", {
  get() {
    return truthy("GIZZI_DISABLE_PROJECT_CONFIG")
  },
  enumerable: true,
  configurable: false,
})

// Dynamic getter for GIZZI_CLIENT
Object.defineProperty(Flag, "GIZZI_CLIENT", {
  get() {
    return env("GIZZI_CLIENT") ?? "cli"
  },
  enumerable: true,
  configurable: false,
})
