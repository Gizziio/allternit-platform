/**
 * LSP types
 */

export interface LspServerConfig {
  command: string
  args: string[]
  env?: Record<string, string>
  rootUri?: string
  extensionToLanguage?: Record<string, string>
}

export interface ScopedLspServerConfig extends LspServerConfig {
  scope: 'project' | 'global'
}

export type LspServerState = 'starting' | 'running' | 'stopped' | 'error' | string

export interface LspServerStateInfo {
  status: 'starting' | 'running' | 'stopped' | 'error'
  capabilities?: unknown
  error?: string
}

export interface LspDiagnostic {
  range: {
    start: { line: number; character: number }
    end: { line: number; character: number }
  }
  severity: 'error' | 'warning' | 'information' | 'hint'
  message: string
  source?: string
  code?: string
}

export interface LspLocation {
  uri: string
  range: {
    start: { line: number; character: number }
    end: { line: number; character: number }
  }
}
