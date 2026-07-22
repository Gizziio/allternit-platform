/**
 * Types for the native .claude-plugin/ format.
 *
 * A .claude-plugin/ directory contains:
 *   .claude-plugin/plugin.json     manifest
 *   commands/ *.md                 slash commands with YAML frontmatter
 *   skills/ * /SKILL.md            skill modules with YAML frontmatter
 *   hooks/hooks.json               hook configuration
 *   .mcp.json                      MCP server definitions
 */

export interface ClaudePluginManifest {
  name: string
  version?: string
  description?: string
  author?: string | { name?: string; email?: string }
  keywords?: string[]
  license?: string
  [key: string]: unknown
}

export interface ClaudePluginCommand {
  name: string
  description?: string
  allowedTools?: string[]
  argumentHint?: string
  model?: string
  template: string
  pluginName: string
  source: string
}

export interface ClaudePluginSkill {
  name: string
  description: string
  version?: string
  content: string
  pluginName: string
  location: string
}

export interface ClaudeHookCommand {
  type: "command"
  command: string
  timeout?: number
}

export interface ClaudeHookGroup {
  matcher?: string
  hooks: ClaudeHookCommand[]
}

export interface ClaudeHooksConfig {
  description?: string
  hooks: {
    PreToolUse?: ClaudeHookGroup[]
    PostToolUse?: ClaudeHookGroup[]
    Stop?: ClaudeHookGroup[]
    UserPromptSubmit?: ClaudeHookGroup[]
    [key: string]: ClaudeHookGroup[] | undefined
  }
}

export interface ClaudeMcpServer {
  command?: string
  args?: string[]
  env?: Record<string, string>
  type?: string
  url?: string
  headers?: Record<string, string>
  [key: string]: unknown
}

export interface ClaudePlugin {
  root: string
  manifest: ClaudePluginManifest
  commands: ClaudePluginCommand[]
  skills: ClaudePluginSkill[]
  hooksConfig: ClaudeHooksConfig | null
  mcpServers: Record<string, ClaudeMcpServer>
}
