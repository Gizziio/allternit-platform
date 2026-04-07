/**
 * Plugin Registry
 *
 * Curated catalog of gizzi-code plugins with categories, metadata, and
 * a remote refresh mechanism. The static list is always available offline;
 * remote fetches extend it with community / third-party listings.
 */

export type PluginCategory =
  | "auth"
  | "mcp"
  | "provider"
  | "tools"
  | "theme"
  | "search"
  | "workflow"
  | "community"

export interface RegistryEntry {
  /** npm package name */
  name: string
  /** Short human-readable label */
  label: string
  description: string
  category: PluginCategory
  author: string
  /** Latest known version — populated from npm if available */
  version?: string
  /** Homepage / docs URL */
  homepage?: string
  /** Star count / download rank proxy */
  downloads?: number
  /** Official / first-party plugin */
  verified?: boolean
  /** Keywords for search matching */
  keywords?: string[]
}

// ── Curated first-party + well-known community plugins ─────────────────────

const CURATED: RegistryEntry[] = [
  // ── Auth ─────────────────────────────────────────────────────────────────
  {
    name: "@gizzi/plugin-openai-codex",
    label: "OpenAI Codex Auth",
    description: "Authenticate with OpenAI ChatGPT / Codex — enables gpt-5.3-codex and friends via OAuth.",
    category: "auth",
    author: "allternit",
    verified: true,
    keywords: ["openai", "codex", "oauth", "chatgpt"],
  },
  {
    name: "@gizzi/plugin-github-auth",
    label: "GitHub Auth",
    description: "OAuth flow for GitHub Copilot and GitHub Models endpoints.",
    category: "auth",
    author: "allternit",
    verified: true,
    keywords: ["github", "copilot", "oauth"],
  },

  // ── MCP servers ──────────────────────────────────────────────────────────
  {
    name: "@gizzi/plugin-mcp-superpowers",
    label: "Superpowers MCP",
    description: "Bundles the Superpowers MCP server — adds filesystem, browser, and memory tools beyond the built-ins.",
    category: "mcp",
    author: "allternit",
    verified: true,
    keywords: ["mcp", "superpowers", "tools"],
  },
  {
    name: "@gizzi/plugin-mcp-git",
    label: "Git MCP",
    description: "Exposes full git operations (blame, log, stash, rebase, bisect) as MCP tools.",
    category: "mcp",
    author: "allternit",
    verified: true,
    keywords: ["mcp", "git", "version control"],
  },
  {
    name: "@gizzi/plugin-mcp-database",
    label: "Database MCP",
    description: "Connect to PostgreSQL, MySQL, SQLite, and MongoDB — run queries, inspect schemas, and migrate data.",
    category: "mcp",
    author: "allternit",
    verified: true,
    keywords: ["mcp", "database", "sql", "postgres", "sqlite"],
  },
  {
    name: "@gizzi/plugin-mcp-linear",
    label: "Linear MCP",
    description: "Manage Linear issues, projects, and cycles directly from the agent session.",
    category: "mcp",
    author: "allternit",
    verified: true,
    keywords: ["mcp", "linear", "project management"],
  },
  {
    name: "@gizzi/plugin-mcp-jira",
    label: "Jira MCP",
    description: "Read and write Jira issues, sprints, and epics from gizzi-code sessions.",
    category: "mcp",
    author: "allternit",
    verified: true,
    keywords: ["mcp", "jira", "atlassian", "project management"],
  },
  {
    name: "@gizzi/plugin-mcp-slack",
    label: "Slack MCP",
    description: "Post messages, search channels, and read threads in Slack from the agent.",
    category: "mcp",
    author: "allternit",
    verified: true,
    keywords: ["mcp", "slack", "messaging"],
  },
  {
    name: "@gizzi/plugin-mcp-notion",
    label: "Notion MCP",
    description: "Read and write Notion pages, databases, and blocks.",
    category: "mcp",
    author: "allternit",
    verified: true,
    keywords: ["mcp", "notion", "docs"],
  },
  {
    name: "@gizzi/plugin-mcp-figma",
    label: "Figma MCP",
    description: "Extract component info, export assets, and read design tokens from Figma files.",
    category: "mcp",
    author: "allternit",
    verified: true,
    keywords: ["mcp", "figma", "design"],
  },

  // ── Provider adapters ─────────────────────────────────────────────────────
  {
    name: "@gizzi/plugin-provider-bedrock",
    label: "AWS Bedrock",
    description: "Route agent calls to AWS Bedrock (Claude, Llama, Mistral) using IAM credentials.",
    category: "provider",
    author: "allternit",
    verified: true,
    keywords: ["provider", "aws", "bedrock", "claude"],
  },
  {
    name: "@gizzi/plugin-provider-vertex",
    label: "Google Vertex AI",
    description: "Route calls to Google Cloud Vertex AI (Gemini, Claude on Vertex, PaLM).",
    category: "provider",
    author: "allternit",
    verified: true,
    keywords: ["provider", "google", "vertex", "gemini"],
  },
  {
    name: "@gizzi/plugin-provider-azure",
    label: "Azure OpenAI",
    description: "Use Azure-hosted OpenAI models with deployment-based routing.",
    category: "provider",
    author: "allternit",
    verified: true,
    keywords: ["provider", "azure", "openai"],
  },

  // ── Search ────────────────────────────────────────────────────────────────
  {
    name: "@gizzi/plugin-search-perplexity",
    label: "Perplexity Search",
    description: "Adds a Perplexity-powered web search tool — alternative to Exa for web research.",
    category: "search",
    author: "allternit",
    verified: true,
    keywords: ["search", "perplexity", "web"],
  },
  {
    name: "@gizzi/plugin-search-brave",
    label: "Brave Search",
    description: "Web search via the Brave Search API — privacy-preserving alternative.",
    category: "search",
    author: "allternit",
    verified: true,
    keywords: ["search", "brave", "web"],
  },

  // ── Workflow ──────────────────────────────────────────────────────────────
  {
    name: "@gizzi/plugin-workflow-ci",
    label: "CI/CD Workflow",
    description: "Adds hooks that auto-run tests and linting after every file edit. Blocks apply if tests fail.",
    category: "workflow",
    author: "allternit",
    verified: true,
    keywords: ["workflow", "ci", "tests", "hooks"],
  },
  {
    name: "@gizzi/plugin-workflow-pr",
    label: "PR Autopilot",
    description: "Automatically opens a GitHub PR, requests review, and posts a summary comment after task completion.",
    category: "workflow",
    author: "allternit",
    verified: true,
    keywords: ["workflow", "github", "pr", "pull request"],
  },
  {
    name: "@gizzi/plugin-workflow-snapshot",
    label: "Session Snapshot",
    description: "Captures a git stash + session state snapshot before any destructive operation, with one-key restore.",
    category: "workflow",
    author: "allternit",
    verified: true,
    keywords: ["workflow", "snapshot", "undo", "safety"],
  },

  // ── Theme ─────────────────────────────────────────────────────────────────
  {
    name: "@gizzi/plugin-theme-catppuccin",
    label: "Catppuccin",
    description: "Catppuccin Mocha/Latte/Frappé/Macchiato color themes for the gizzi-code TUI.",
    category: "theme",
    author: "community",
    verified: false,
    keywords: ["theme", "catppuccin", "colors"],
  },
  {
    name: "@gizzi/plugin-theme-nord",
    label: "Nord",
    description: "Nord arctic color palette adapted for the gizzi-code TUI.",
    category: "theme",
    author: "community",
    verified: false,
    keywords: ["theme", "nord", "colors"],
  },
  {
    name: "@gizzi/plugin-theme-tokyonight",
    label: "Tokyo Night",
    description: "Tokyo Night dark theme — popular in VS Code, now in your terminal.",
    category: "theme",
    author: "community",
    verified: false,
    keywords: ["theme", "tokyo", "night", "colors"],
  },

  // ── Community / Tools ─────────────────────────────────────────────────────
  {
    name: "@gizzi/plugin-shell-env",
    label: "Shell Env Injector",
    description: "Loads .envrc / direnv files automatically and injects their exports into every bash tool call.",
    category: "tools",
    author: "allternit",
    verified: true,
    keywords: ["shell", "env", "direnv", "environment"],
  },
  {
    name: "@gizzi/plugin-audit-log",
    label: "Audit Log",
    description: "Writes a structured JSONL log of every tool call, permission request, and agent decision to disk.",
    category: "tools",
    author: "allternit",
    verified: true,
    keywords: ["audit", "log", "compliance"],
  },
]

// ── Registry API ─────────────────────────────────────────────────────────────

export namespace PluginRegistry {
  const REMOTE_INDEX_URL = "https://plugins.gizzi.dev/index.json"
  const CACHE_TTL_MS = 5 * 60 * 1000 // 5 min

  let cachedRemote: RegistryEntry[] | null = null
  let lastFetch = 0

  /**
   * Full catalog: curated list merged with remote index (if reachable).
   * Falls back to curated-only if the remote is unavailable.
   */
  export async function all(): Promise<RegistryEntry[]> {
    const remote = await fetchRemote().catch(() => [])
    const merged = new Map<string, RegistryEntry>()
    for (const e of CURATED) merged.set(e.name, e)
    for (const e of remote) {
      if (!merged.has(e.name)) merged.set(e.name, e)
    }
    return Array.from(merged.values())
  }

  /** Curated-only (offline, synchronous). */
  export function curated(): RegistryEntry[] {
    return CURATED
  }

  /** Search by name, label, description, or keywords. */
  export function search(entries: RegistryEntry[], query: string): RegistryEntry[] {
    const q = query.toLowerCase().trim()
    if (!q) return entries
    return entries.filter((e) => {
      return (
        e.name.toLowerCase().includes(q) ||
        e.label.toLowerCase().includes(q) ||
        e.description.toLowerCase().includes(q) ||
        e.keywords?.some((k) => k.includes(q))
      )
    })
  }

  /** Filter by category. */
  export function byCategory(entries: RegistryEntry[], category: PluginCategory): RegistryEntry[] {
    return entries.filter((e) => e.category === category)
  }

  /** All distinct categories present in the given entry list. */
  export function categories(entries: RegistryEntry[]): PluginCategory[] {
    return [...new Set(entries.map((e) => e.category))]
  }

  /** Fetch and cache the remote plugin index. */
  async function fetchRemote(): Promise<RegistryEntry[]> {
    const now = Date.now()
    if (cachedRemote && now - lastFetch < CACHE_TTL_MS) return cachedRemote

    const res = await fetch(REMOTE_INDEX_URL, {
      signal: AbortSignal.timeout(4000),
      headers: { Accept: "application/json" },
    })
    if (!res.ok) throw new Error(`Registry fetch failed: ${res.status}`)
    cachedRemote = (await res.json()) as RegistryEntry[]
    lastFetch = now
    return cachedRemote
  }

  /** Label for a category. */
  export function categoryLabel(category: PluginCategory): string {
    return {
      auth: "Authentication",
      mcp: "MCP Servers",
      provider: "AI Providers",
      tools: "Tools",
      theme: "Themes",
      search: "Search",
      workflow: "Workflow",
      community: "Community",
    }[category]
  }
}
