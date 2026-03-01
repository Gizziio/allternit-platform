function truthy(key: string) {
  const value = (process.env[key] ?? process.env["OPENCODE_" + key.slice(4)])?.toLowerCase()
  return value === "true" || value === "1"
}

function env(key: string) {
  return process.env[key] ?? process.env["OPENCODE_" + key.slice(4)]
}

export namespace Flag {
  export const A2R_AUTO_SHARE = truthy("A2R_AUTO_SHARE")
  export const A2R_GIT_BASH_PATH = env("A2R_GIT_BASH_PATH")
  export const A2R_CONFIG = env("A2R_CONFIG")
  export const A2R_CONFIG_DIR = env("A2R_CONFIG_DIR")
  export const A2R_CONFIG_CONTENT = env("A2R_CONFIG_CONTENT")
  export const A2R_DISABLE_AUTOUPDATE = truthy("A2R_DISABLE_AUTOUPDATE")
  export const A2R_DISABLE_PRUNE = truthy("A2R_DISABLE_PRUNE")
  export const A2R_DISABLE_TERMINAL_TITLE = truthy("A2R_DISABLE_TERMINAL_TITLE")
  export const A2R_PERMISSION = env("A2R_PERMISSION")
  export const A2R_DISABLE_DEFAULT_PLUGINS = truthy("A2R_DISABLE_DEFAULT_PLUGINS")
  export const A2R_DISABLE_LSP_DOWNLOAD = truthy("A2R_DISABLE_LSP_DOWNLOAD")
  export const A2R_ENABLE_EXPERIMENTAL_MODELS = truthy("A2R_ENABLE_EXPERIMENTAL_MODELS")
  export const A2R_DISABLE_AUTOCOMPACT = truthy("A2R_DISABLE_AUTOCOMPACT")
  export const A2R_DISABLE_MODELS_FETCH = truthy("A2R_DISABLE_MODELS_FETCH")
  export const A2R_DISABLE_CLAUDE_CODE = truthy("A2R_DISABLE_CLAUDE_CODE")
  export const A2R_DISABLE_CLAUDE_CODE_PROMPT =
    A2R_DISABLE_CLAUDE_CODE || truthy("A2R_DISABLE_CLAUDE_CODE_PROMPT")
  export const A2R_DISABLE_CLAUDE_CODE_SKILLS =
    A2R_DISABLE_CLAUDE_CODE || truthy("A2R_DISABLE_CLAUDE_CODE_SKILLS")
  export const A2R_DISABLE_EXTERNAL_SKILLS =
    A2R_DISABLE_CLAUDE_CODE_SKILLS || truthy("A2R_DISABLE_EXTERNAL_SKILLS")
  export declare const A2R_DISABLE_PROJECT_CONFIG: boolean
  export const A2R_FAKE_VCS = env("A2R_FAKE_VCS")
  export declare const A2R_CLIENT: string
  export const A2R_SERVER_PASSWORD = env("A2R_SERVER_PASSWORD")
  export const A2R_SERVER_USERNAME = env("A2R_SERVER_USERNAME")
  export const A2R_ENABLE_QUESTION_TOOL = truthy("A2R_ENABLE_QUESTION_TOOL")

  // Experimental
  export const A2R_EXPERIMENTAL = truthy("A2R_EXPERIMENTAL")
  export const A2R_EXPERIMENTAL_FILEWATCHER = truthy("A2R_EXPERIMENTAL_FILEWATCHER")
  export const A2R_EXPERIMENTAL_DISABLE_FILEWATCHER = truthy("A2R_EXPERIMENTAL_DISABLE_FILEWATCHER")
  export const A2R_EXPERIMENTAL_ICON_DISCOVERY =
    A2R_EXPERIMENTAL || truthy("A2R_EXPERIMENTAL_ICON_DISCOVERY")

  const copy = env("A2R_EXPERIMENTAL_DISABLE_COPY_ON_SELECT")
  export const A2R_EXPERIMENTAL_DISABLE_COPY_ON_SELECT =
    copy === undefined ? process.platform === "win32" : truthy("A2R_EXPERIMENTAL_DISABLE_COPY_ON_SELECT")
  export const A2R_ENABLE_EXA =
    truthy("A2R_ENABLE_EXA") || A2R_EXPERIMENTAL || truthy("A2R_EXPERIMENTAL_EXA")
  export const A2R_EXPERIMENTAL_BASH_DEFAULT_TIMEOUT_MS = number("A2R_EXPERIMENTAL_BASH_DEFAULT_TIMEOUT_MS")
  export const A2R_EXPERIMENTAL_OUTPUT_TOKEN_MAX = number("A2R_EXPERIMENTAL_OUTPUT_TOKEN_MAX")
  export const A2R_EXPERIMENTAL_OXFMT = A2R_EXPERIMENTAL || truthy("A2R_EXPERIMENTAL_OXFMT")
  export const A2R_EXPERIMENTAL_LSP_TY = truthy("A2R_EXPERIMENTAL_LSP_TY")
  export const A2R_EXPERIMENTAL_LSP_TOOL = A2R_EXPERIMENTAL || truthy("A2R_EXPERIMENTAL_LSP_TOOL")
  export const A2R_DISABLE_FILETIME_CHECK = truthy("A2R_DISABLE_FILETIME_CHECK")
  export const A2R_EXPERIMENTAL_PLAN_MODE = A2R_EXPERIMENTAL || truthy("A2R_EXPERIMENTAL_PLAN_MODE")
  export const A2R_EXPERIMENTAL_MARKDOWN = truthy("A2R_EXPERIMENTAL_MARKDOWN")
  export const A2R_MODELS_URL = env("A2R_MODELS_URL")
  export const A2R_MODELS_PATH = env("A2R_MODELS_PATH")

  function number(key: string) {
    const value = env(key)
    if (!value) return undefined
    const parsed = Number(value)
    return Number.isInteger(parsed) && parsed > 0 ? parsed : undefined
  }
}

// Dynamic getter for A2R_DISABLE_PROJECT_CONFIG
Object.defineProperty(Flag, "A2R_DISABLE_PROJECT_CONFIG", {
  get() {
    return truthy("A2R_DISABLE_PROJECT_CONFIG")
  },
  enumerable: true,
  configurable: false,
})

// Dynamic getter for A2R_CLIENT
Object.defineProperty(Flag, "A2R_CLIENT", {
  get() {
    return env("A2R_CLIENT") ?? "cli"
  },
  enumerable: true,
  configurable: false,
})
