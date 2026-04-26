/**
 * Live Notes
 *
 * Auto-updating notes that stay current with vault context and external sources.
 * A note containing the trigger token (default: @allternit) will be periodically
 * refreshed with new information.
 */

import { Log } from "@/shared/util/log"
import type { Vault } from "../types"
import { VaultManager } from "../index"

const log = Log.create({ service: "vault-live-notes" })

const DEFAULT_TRIGGER = "@allternit"

export interface LiveNoteConfig {
  trigger?: string
  sources?: ("vault" | "web")[]
}

export async function findLiveNotes(vault: VaultManager, trigger = DEFAULT_TRIGGER): Promise<Vault.Note[]> {
  const all = await vault.query({})
  return all.notes.filter(n => n.content.includes(trigger) || n.frontmatter.tags?.includes("live"))
}

function extractTopic(note: Vault.Note, trigger: string): string {
  // Try to extract the topic from the first line after the trigger
  const lines = note.content.split("\n")
  for (const line of lines) {
    const idx = line.indexOf(trigger)
    if (idx >= 0) {
      const after = line.slice(idx + trigger.length).trim()
      if (after) return after.replace(/[#*]/g, "").trim()
    }
  }
  return note.title
}

export async function updateLiveNote(
  vault: VaultManager,
  note: Vault.Note,
  config?: LiveNoteConfig,
): Promise<boolean> {
  const trigger = config?.trigger || DEFAULT_TRIGGER
  const topic = extractTopic(note, trigger)

  log.info("Updating live note", { path: note.relPath, topic })

  // Query vault for related context
  const related = await vault.query({ text: topic, limit: 10 })

  // Build update section
  const updateLines = [
    `\n<!-- live-note-updated: ${new Date().toISOString()} -->`,
    `### Latest Context on "${topic}"`,
    "",
  ]

  if (related.notes.length > 0) {
    updateLines.push("**Related from vault:**")
    for (const r of related.notes.slice(0, 5)) {
      if (r.relPath === note.relPath) continue
      updateLines.push(`- [[${r.title}]] — ${r.folder}`)
    }
    updateLines.push("")
  }

  // Remove old live-note-updated sections
  let baseContent = note.content
  const liveUpdateRegex = /\n<!-- live-note-updated: .*? -->\n### Latest Context on ".*?"[\s\S]*?(?=\n<!-- live-note-updated:|\n#{1,6} |$)/g
  baseContent = baseContent.replace(liveUpdateRegex, "")

  const updatedContent = baseContent.trimEnd() + "\n" + updateLines.join("\n")

  await vault.writeNote(note.relPath, updatedContent, {
    ...note.frontmatter,
    tags: [...new Set([...(note.frontmatter.tags || []), "live"])],
  })

  return true
}

export async function updateAllLiveNotes(vault: VaultManager, config?: LiveNoteConfig): Promise<number> {
  const notes = await findLiveNotes(vault, config?.trigger)
  let updated = 0

  for (const note of notes) {
    try {
      const ok = await updateLiveNote(vault, note, config)
      if (ok) updated++
    } catch (e) {
      log.error("Failed to update live note", { path: note.relPath, error: e })
    }
  }

  log.info("Live notes update complete", { updated, total: notes.length })
  return updated
}
