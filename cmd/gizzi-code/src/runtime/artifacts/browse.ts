/**
 * Local artifact browsing for the `/artifact` TUI command.
 *
 * Pure, UI-free module (no ink-app imports) so it can be unit-tested
 * directly — same seam as `src/runtime/bots/bot-store.ts`.
 *
 * What lives on disk today: `gizzi html-artifact publish` writes
 * `.gizzi/artifacts/<slug>/config.json` in the project directory (see
 * config.ts) — the generated HTML itself is published to the allternit-api
 * canvas, not saved locally, so the config is the only local record. No
 * gizzi code path writes loose "workspace markdown" files; the browser
 * still lists top-level `*.md` files in the artifacts dir so reports a
 * user or agent drops there are readable too.
 */
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import type { ArtifactConfig } from './config'
import type { ArtifactInput, ArtifactSection, ArtifactTab } from './types'

export interface CanvasArtifactEntry {
  kind: 'canvas'
  /** Directory name under the artifacts root — the artifact_key. */
  slug: string
  /** Display title (from the saved input; falls back to the slug). */
  title: string
  canvasId?: string
  version?: number
  publishedAt?: string
  /** Absolute path to config.json — the open-in-editor target. */
  configPath: string
  mtimeMs: number
  sizeBytes: number
}

export interface MarkdownArtifactEntry {
  kind: 'markdown'
  name: string
  filePath: string
  mtimeMs: number
  sizeBytes: number
}

export type ArtifactListEntry = CanvasArtifactEntry | MarkdownArtifactEntry

export interface ArtifactsRoot {
  /** Absolute path of the resolved artifacts directory. */
  root: string
  /** Which config home won — same GIZZI-first / CLAUDE-fallback idiom as config.ts. */
  source: 'gizzi' | 'claude'
}

/** GIZZI-first resolution: prefer `<cwd>/.gizzi/artifacts` if it exists,
 * else read `<cwd>/.claude/artifacts`, else default to the `.gizzi` path
 * (so the empty state points at the directory a publish would write). */
export function resolveArtifactsRoot(cwd: string): ArtifactsRoot {
  const gizziRoot = join(cwd, '.gizzi', 'artifacts')
  const claudeRoot = join(cwd, '.claude', 'artifacts')
  try {
    if (existsSync(gizziRoot)) return { root: gizziRoot, source: 'gizzi' }
    if (existsSync(claudeRoot)) return { root: claudeRoot, source: 'claude' }
  } catch {
    // fall through
  }
  return { root: gizziRoot, source: 'gizzi' }
}

function safeStat(path: string): { mtimeMs: number; sizeBytes: number } {
  try {
    const st = statSync(path)
    return { mtimeMs: st.mtimeMs, sizeBytes: st.size }
  } catch {
    return { mtimeMs: 0, sizeBytes: 0 }
  }
}

function readConfig(configPath: string): Partial<ArtifactConfig> | undefined {
  try {
    return JSON.parse(readFileSync(configPath, 'utf8')) as Partial<ArtifactConfig>
  } catch {
    return undefined
  }
}

/** List everything browsable under the artifacts root: per-slug canvas
 * configs (subdir with config.json) and loose top-level *.md files.
 * Newest first; ties broken by name for determinism. */
export function listArtifacts(root: string): ArtifactListEntry[] {
  const entries: ArtifactListEntry[] = []
  let dirents
  try {
    dirents = readdirSync(root, { withFileTypes: true })
  } catch {
    return entries
  }
  for (const dirent of dirents) {
    if (dirent.isDirectory()) {
      const configPath = join(root, dirent.name, 'config.json')
      if (!existsSync(configPath)) continue
      const config = readConfig(configPath)
      const { mtimeMs, sizeBytes } = safeStat(configPath)
      entries.push({
        kind: 'canvas',
        slug: dirent.name,
        title: config?.input?.title ?? dirent.name,
        canvasId: config?.canvasId,
        version: config?.lastPublishedVersion,
        publishedAt: config?.lastPublishedAt,
        configPath,
        mtimeMs,
        sizeBytes,
      })
    } else if (dirent.isFile() && dirent.name.endsWith('.md')) {
      const filePath = join(root, dirent.name)
      const { mtimeMs, sizeBytes } = safeStat(filePath)
      entries.push({ kind: 'markdown', name: dirent.name, filePath, mtimeMs, sizeBytes })
    }
  }
  entries.sort((a, b) => {
    if (b.mtimeMs !== a.mtimeMs) return b.mtimeMs - a.mtimeMs
    const nameA = a.kind === 'canvas' ? a.slug : a.name
    const nameB = b.kind === 'canvas' ? b.slug : b.name
    return nameA.localeCompare(nameB)
  })
  return entries
}

export function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`
  return `${(n / (1024 * 1024)).toFixed(1)} MB`
}

/** Compact local timestamp for list rows: "2026-09-26 14:03". */
export function formatDate(ms: number): string {
  if (!ms) return '—'
  const d = new Date(ms)
  const pad = (v: number) => String(v).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

/** One-line metadata for a list row (Select option description). */
export function describeEntryMeta(entry: ArtifactListEntry): string {
  if (entry.kind === 'canvas') {
    const parts: string[] = []
    if (entry.version != null) parts.push(`v${entry.version}`)
    if (entry.canvasId) parts.push(`canvas ${entry.canvasId}`)
    parts.push(formatDate(entry.mtimeMs))
    return parts.join(' · ')
  }
  return `${formatBytes(entry.sizeBytes)} · ${formatDate(entry.mtimeMs)}`
}

function escapeCell(text: string): string {
  return text.replace(/\|/g, '\\|')
}

function sectionToMarkdown(section: ArtifactSection): string[] {
  const out: string[] = []
  if (section.heading) out.push(`### ${section.heading}`, '')
  for (const paragraph of section.body ?? []) out.push(paragraph, '')
  if (section.stats?.length) {
    for (const stat of section.stats) out.push(`- **${stat.value}** — ${stat.label}`)
    out.push('')
  }
  if (section.list?.length) {
    for (const item of section.list) out.push(`- ${item}`)
    out.push('')
  }
  if (section.table) {
    out.push(`| ${section.table.headers.map(escapeCell).join(' | ')} |`)
    out.push(`| ${section.table.headers.map(() => '---').join(' | ')} |`)
    for (const row of section.table.rows) {
      out.push(`| ${row.map(escapeCell).join(' | ')} |`)
    }
    out.push('')
  }
  return out
}

function tabToMarkdown(tab: ArtifactTab): string[] {
  const out: string[] = [`## ${tab.label}`, '']
  if (tab.callout) out.push(`> ${tab.callout.text}`, '')
  for (const section of tab.sections) out.push(...sectionToMarkdown(section))
  return out
}

export interface ArtifactMarkdownMeta {
  artifactKey?: string
  canvasId?: string
  version?: number
  publishedAt?: string
}

/** Render a saved ArtifactInput back into markdown so the TUI viewer can
 * show it through the standard Markdown renderer — the inverse of what
 * generateHtml.ts does for the published canvas. */
export function artifactInputToMarkdown(input: ArtifactInput, meta: ArtifactMarkdownMeta = {}): string {
  const out: string[] = [`# ${input.title}`, '']
  if (input.subtitle) out.push(input.subtitle, '')
  if (input.status) out.push(`**Status:** ${input.status.label}`, '')
  const facts: string[] = []
  if (meta.artifactKey) facts.push(`key \`${meta.artifactKey}\``)
  if (meta.canvasId) facts.push(`canvas \`${meta.canvasId}\``)
  if (meta.version != null) facts.push(`version ${meta.version}`)
  if (meta.publishedAt) facts.push(`published ${meta.publishedAt}`)
  if (facts.length) out.push(`_${facts.join(' · ')}_`, '')
  for (const tab of input.tabs) out.push(...tabToMarkdown(tab))
  return out.join('\n').trimEnd() + '\n'
}

/** Load an entry's content as markdown: the file itself for loose *.md,
 * or a rendered view of the saved input for canvas configs. Falls back to
 * a field summary when a config has no usable input. */
export function readArtifactMarkdown(entry: ArtifactListEntry): string {
  if (entry.kind === 'markdown') {
    return readFileSync(entry.filePath, 'utf8')
  }
  const config = readConfig(entry.configPath)
  if (config?.input && typeof config.input.title === 'string' && Array.isArray(config.input.tabs)) {
    return artifactInputToMarkdown(config.input, {
      artifactKey: config.artifactKey ?? entry.slug,
      canvasId: config.canvasId,
      version: config.lastPublishedVersion,
      publishedAt: config.lastPublishedAt,
    })
  }
  const lines = [`# ${entry.slug}`, '']
  if (!config) {
    lines.push('_config.json is missing or unreadable._')
  } else {
    lines.push('_No saved generator input — raw fields:_', '')
    for (const [key, value] of Object.entries(config)) {
      if (key === 'input') continue
      lines.push(`- **${key}:** ${JSON.stringify(value)}`)
    }
  }
  return lines.join('\n') + '\n'
}

/** Rough rendered-line estimate for scroll clamping: wraps each source
 * line at the given column width. Pure estimate — ANSI styling doesn't
 * change line counts, and the Markdown renderer adds at most a couple of
 * blank separators, so overshoot slightly per non-empty line. */
export function estimateRenderedLines(content: string, columns: number): number {
  const width = Math.max(20, columns)
  let lines = 0
  for (const raw of content.split('\n')) {
    // Markdown table rows render one line each; headings add a margin.
    const len = raw.replace(/[*_`>#|-]/g, '').length
    lines += Math.max(1, Math.ceil(len / width))
  }
  return lines
}
