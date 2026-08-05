/**
 * Vault IO
 *
 * File-system abstraction for the knowledge vault.
 * Handles Obsidian-compatible Markdown with YAML frontmatter
 * and [[wikilink]] extraction.
 */

import path from "path"
import fs from "fs/promises"
import { Glob } from "@/shared/util/glob"
import { Filesystem } from "@/shared/util/filesystem"
import { Log } from "@/shared/util/log"
import { BRAIN_GITIGNORE_ENTRIES } from "@/cli/commands/brain/lib"
import type { Vault } from "./types"

const log = Log.create({ service: "vault-io" })

const FM_OPEN = "---"
const FM_CLOSE = "---"
const WIKILINK_RE = /\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g
const TAG_RE = /#([a-zA-Z0-9_\-\/]+)/g

export function parseFrontmatter(content: string): { frontmatter: Vault.Frontmatter; body: string } {
  const lines = content.split("\n")
  if (lines[0]?.trim() !== FM_OPEN) {
    return { frontmatter: {}, body: content }
  }

  const closeIdx = lines.findIndex((l, i) => i > 0 && l.trim() === FM_CLOSE)
  if (closeIdx < 0) {
    return { frontmatter: {}, body: content }
  }

  const fmLines = lines.slice(1, closeIdx)
  const body = lines.slice(closeIdx + 1).join("\n").trimStart()
  const frontmatter: Vault.Frontmatter = {}

  let currentKey: string | null = null
  let currentArray: string[] = []
  let inArray = false

  for (const line of fmLines) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith("#")) continue

    if (trimmed.startsWith("- ")) {
      if (inArray && currentKey) {
        currentArray.push(trimmed.slice(2).trim())
      }
      continue
    }

    // flush previous array
    if (inArray && currentKey) {
      frontmatter[currentKey] = currentArray
      inArray = false
      currentArray = []
    }

    const colonIdx = trimmed.indexOf(":")
    if (colonIdx < 0) continue

    currentKey = trimmed.slice(0, colonIdx).trim()
    const val = trimmed.slice(colonIdx + 1).trim()

    if (!val) {
      inArray = true
      currentArray = []
    } else {
      frontmatter[currentKey] = parseScalar(val)
    }
  }

  if (inArray && currentKey) {
    frontmatter[currentKey] = currentArray
  }

  return { frontmatter, body }
}

function parseScalar(val: string): string | number | boolean {
  if (val === "true") return true
  if (val === "false") return false
  if (/^-?\d+$/.test(val)) return parseInt(val, 10)
  if (/^-?\d+\.\d+$/.test(val)) return parseFloat(val)
  return val.replace(/^["']|["']$/g, "")
}

export function stringifyFrontmatter(frontmatter: Vault.Frontmatter): string {
  const lines: string[] = [FM_OPEN]
  for (const [key, value] of Object.entries(frontmatter)) {
    if (value === undefined || value === null) continue
    if (Array.isArray(value)) {
      lines.push(`${key}:`)
      for (const item of value) {
        lines.push(`  - ${item}`)
      }
    } else if (typeof value === "boolean" || typeof value === "number") {
      lines.push(`${key}: ${value}`)
    } else {
      lines.push(`${key}: ${value}`)
    }
  }
  lines.push(FM_CLOSE)
  return lines.join("\n")
}

export function extractWikilinks(content: string): string[] {
  const links: string[] = []
  let match: RegExpExecArray | null
  while ((match = WIKILINK_RE.exec(content)) !== null) {
    links.push(match[1]!.trim())
  }
  WIKILINK_RE.lastIndex = 0
  return [...new Set(links)]
}

export function extractTags(content: string): string[] {
  const tags: string[] = []
  let match: RegExpExecArray | null
  while ((match = TAG_RE.exec(content)) !== null) {
    tags.push(match[1]!)
  }
  TAG_RE.lastIndex = 0
  return [...new Set(tags)]
}

export async function readNote(absPath: string, vaultRoot: string): Promise<Vault.Note | null> {
  try {
    const stat = await fs.stat(absPath)
    if (!stat.isFile()) return null

    const raw = await fs.readFile(absPath, "utf-8")
    const { frontmatter, body } = parseFrontmatter(raw)
    const relPath = path.relative(vaultRoot, absPath)
    const folder = path.dirname(relPath)
    const title = frontmatter.title || path.basename(relPath, ".md")

    const allContent = raw
    const outgoingLinks = extractWikilinks(allContent)
    const tags = extractTags(allContent)
    const mergedTags = [...new Set([...(frontmatter.tags || []), ...tags])]

    return {
      path: absPath,
      relPath,
      title,
      folder: folder === "." ? "" : folder,
      frontmatter: { ...frontmatter, tags: mergedTags },
      content: body,
      backlinks: [],
      outgoingLinks,
      mtime: stat.mtimeMs,
      ctime: stat.ctimeMs,
    }
  } catch (e) {
    log.warn("Failed to read note", { path: absPath, error: e })
    return null
  }
}

export async function writeNote(absPath: string, note: Pick<Vault.Note, "frontmatter" | "content">): Promise<void> {
  await Filesystem.ensureDir(path.dirname(absPath))
  const fm = stringifyFrontmatter(note.frontmatter)
  const raw = `${fm}\n\n${note.content}\n`
  await fs.writeFile(absPath, raw, "utf-8")
}

export async function listNotes(vaultRoot: string, pattern = "**/*.md"): Promise<Vault.Note[]> {
  const matches = await Glob.scan(pattern, { cwd: vaultRoot, absolute: true })
  const notes: Vault.Note[] = []
  for (const match of matches) {
    const note = await readNote(match, vaultRoot)
    if (note) notes.push(note)
  }
  return notes
}

export async function ensureVaultStructure(vaultRoot: string): Promise<void> {
  const dirs = ["Daily", "People", "Projects", "Meetings", "Topics", "Attachments"]
  for (const dir of dirs) {
    await Filesystem.ensureDir(path.join(vaultRoot, dir))
  }
  await ensureGitignoreEntries(vaultRoot)
}

/**
 * Top up an existing brain's .gitignore with the entries that keep
 * auto-synced content (Topics/, profile/, .allternit/) out of git — covers
 * brains initialized before those entries were added to the init template.
 * No-op for a non-git root (a bare vault that never went through
 * `gizzi brain init`/VaultManager's brain-bootstrap).
 */
async function ensureGitignoreEntries(vaultRoot: string): Promise<void> {
  if (!(await Filesystem.exists(path.join(vaultRoot, ".git")))) return

  const gitignorePath = path.join(vaultRoot, ".gitignore")
  const existing = (await Filesystem.exists(gitignorePath))
    ? await fs.readFile(gitignorePath, "utf-8")
    : ""
  const missing = BRAIN_GITIGNORE_ENTRIES.filter((entry) => !existing.includes(entry))
  if (missing.length === 0) return

  const separator = existing && !existing.endsWith("\n") ? "\n" : ""
  await fs.writeFile(gitignorePath, `${existing}${separator}${missing.join("\n")}\n`, "utf-8")
  log.info("Topped up .gitignore with brain/vault entries", { vaultRoot, added: missing })
}

export function sanitizeFilename(name: string): string {
  return name.replace(/[<>:"/\\|?*\x00-\x1f]/g, "_").substring(0, 200).trim()
}
