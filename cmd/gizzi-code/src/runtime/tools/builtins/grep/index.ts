export { GrepTool } from './GrepTool.js'

// Mirrors the input/output zod schemas in GrepTool.ts (which is @ts-nocheck
// and does not export them), following the inline-interface idiom used by
// the sibling write/read/edit tool index files.
export interface GrepToolParams {
  pattern: string
  path?: string
  glob?: string
  output_mode?: 'content' | 'files_with_matches' | 'count'
  '-B'?: number
  '-A'?: number
  '-C'?: number
  context?: number
  '-n'?: boolean
  '-i'?: boolean
  type?: string
  head_limit?: number
  offset?: number
  multiline?: boolean
}

export interface GrepToolResult {
  mode?: 'content' | 'files_with_matches' | 'count'
  numFiles: number
  filenames: string[]
  content?: string
  numLines?: number
  numMatches?: number
  appliedLimit?: number
  appliedOffset?: number
}
