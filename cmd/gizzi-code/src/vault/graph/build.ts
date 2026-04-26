/**
 * Graph Builder
 *
 * Extracts entities and relationships from vault notes
 * to build a traversable knowledge graph.
 */

import path from "path"
import { Log } from "@/shared/util/log"
import type { Vault } from "../types"
import * as IO from "../io"

const log = Log.create({ service: "vault-graph" })

const ENTITY_PATTERNS: Array<{ type: Vault.EntityType; regex: RegExp }> = [
  { type: "person", regex: /(?:^|\n)(?:##?#?\s*)?(?:From|To|Attendee|Owner|Assigned to):?\s*([^\n]+)/gi },
  { type: "project", regex: /(?:^|\n)(?:##?#?\s*)?(?:Project|Workstream|Epic):?\s*([^\n]+)/gi },
  { type: "decision", regex: /(?:^|\n)(?:##?#?\s*)?(?:Decision|Resolved|Agreed):?\s*([^\n]+)/gi },
  { type: "task", regex: /(?:^|\n)\s*[-*]\s+\[([ xX])\]\s*([^\n]+)/gi },
]

export interface ExtractedEntity {
  name: string
  type: Vault.EntityType
  context: string
  notePath: string
}

export function extractEntities(note: Vault.Note): ExtractedEntity[] {
  const entities: ExtractedEntity[] = []
  const seen = new Set<string>()

  for (const { type, regex } of ENTITY_PATTERNS) {
    let match: RegExpExecArray | null
    while ((match = regex.exec(note.content)) !== null) {
      const name = (match[2] || match[1]!).trim().substring(0, 200)
      if (!name || seen.has(`${type}:${name}`)) continue
      seen.add(`${type}:${name}`)
      entities.push({
        name,
        type,
        context: note.title,
        notePath: note.relPath,
      })
    }
    regex.lastIndex = 0
  }

  // Extract people from "From: Name <email>" patterns (email threads)
  const fromMatches = note.content.match(/From:\s*([^<\n]+)/g)
  if (fromMatches) {
    for (const m of fromMatches) {
      const name = m.replace("From:", "").trim().split("<")[0]!.trim()
      if (name && !seen.has(`person:${name}`)) {
        seen.add(`person:${name}`)
        entities.push({ name, type: "person", context: note.title, notePath: note.relPath })
      }
    }
  }

  return entities
}

export function buildGraph(notes: Vault.Note[]): Vault.Graph {
  const nodes = new Map<string, Vault.GraphNode>()
  const edges: Vault.GraphEdge[] = []

  for (const note of notes) {
    const nodeId = note.relPath
    const folderType = note.folder.split("/")[0]?.toLowerCase() as Vault.EntityType

    if (!nodes.has(nodeId)) {
      nodes.set(nodeId, {
        id: nodeId,
        title: note.title,
        type: folderType || "topic",
        path: note.relPath,
        edges: [],
      })
    }

    const node = nodes.get(nodeId)!

    // Outgoing wikilinks
    for (const link of note.outgoingLinks) {
      const targetId = link.endsWith(".md") ? link : `${link}.md`
      const edge: Vault.GraphEdge = {
        target: targetId,
        relation: "related",
      }
      node.edges.push(edge)
      edges.push(edge)
    }

    // Extracted entities become their own nodes
    const entities = extractEntities(note)
    for (const entity of entities) {
      const entityId = `entity/${entity.type}/${IO.sanitizeFilename(entity.name)}.md`
      if (!nodes.has(entityId)) {
        nodes.set(entityId, {
          id: entityId,
          title: entity.name,
          type: entity.type,
          path: entityId,
          edges: [],
        })
      }
      const entNode = nodes.get(entityId)!
      const edge: Vault.GraphEdge = {
        target: nodeId,
        relation: entity.type === "person" ? "attended" : entity.type === "decision" ? "decided_in" : "related",
        context: entity.context,
      }
      entNode.edges.push(edge)
      edges.push(edge)
    }
  }

  return { nodes, edges }
}

export async function ensureEntityNotes(vaultRoot: string, notes: Vault.Note[]): Promise<void> {
  const graph = buildGraph(notes)

  for (const [id, node] of graph.nodes) {
    if (!id.startsWith("entity/")) continue

    const absPath = path.join(vaultRoot, id)
    const exists = await IO.readNote(absPath, vaultRoot)
    if (exists) continue

    const folder = path.dirname(id)
    await IO.ensureVaultStructure(path.join(vaultRoot, folder))

    const relatedNotes = notes.filter(n =>
      node.edges.some(e => e.target === n.relPath)
    )

    const content = [
      `## ${node.title}`,
      "",
      `**Type:** ${node.type}`,
      "",
      "### Related Notes",
      ...relatedNotes.map(n => `- [[${n.title}]]`),
      "",
    ].join("\n")

    const frontmatter: Vault.Frontmatter = {
      title: node.title,
      type: node.type,
      tags: [node.type],
    }

    await IO.writeNote(absPath, { frontmatter, content })
    log.info("Created entity note", { id, title: node.title })
  }
}
