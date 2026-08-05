/**
 * Vault Types
 *
 * Core type definitions for the Allternit Knowledge Vault.
 * The vault is an Obsidian-compatible Markdown directory tree
 * that serves as the long-lived memory layer for the platform.
 */

import z from "zod/v4"

export namespace Vault {
  export const EntityType = z.enum([
    "person",
    "project",
    "meeting",
    "decision",
    "topic",
    "daily",
    "task",
    "reference",
    // Added when Vault and the second brain (`gizzi brain`) were unified
    // onto one storage root — match brain's template frontmatter `type:`
    // values (identity.md, domains/, runbooks/, ideas/). See
    // docs/LENS_CONTEXT_LAYER_PLAN.md.
    "identity",
    "domain",
    "runbook",
    "idea",
  ])
  export type EntityType = z.infer<typeof EntityType>

  // Coarse-grained visibility label an ingest source assigns to a note at
  // extraction time. Read by the Lens MCP server (mcp/servers/lens-context-server)
  // to decide what a given connected AI tool is allowed to see — see
  // docs/LENS_CONTEXT_LAYER_PLAN.md Phase 4. Defaults to "private" when
  // absent (extraction-pipeline.ts always sets it explicitly; this is a
  // fail-closed fallback for hand-written notes that predate this field).
  export const Sensitivity = z.enum(["public", "private", "restricted"])
  export type Sensitivity = z.infer<typeof Sensitivity>

  export interface Frontmatter {
    title?: string
    date?: string
    tags?: string[]
    entities?: string[]
    source?: string
    sensitivity?: Sensitivity
    status?: "open" | "closed" | "pending"
    // Brain templates (identity.md, domains/, decisions/, runbooks/,
    // ideas/) set this explicitly. Prefer it over folder-name inference —
    // see inferEntityType() below — since root-level files like
    // identity.md/MEMORY.md have no folder to infer from.
    type?: EntityType
    [key: string]: unknown
  }

  export interface Note {
    path: string
    relPath: string
    title: string
    folder: string
    frontmatter: Frontmatter
    content: string
    backlinks: string[]
    outgoingLinks: string[]
    mtime: number
    ctime: number
  }

  /**
   * A note's entity type: prefer `frontmatter.type` when it's a valid
   * EntityType (how brain's templates declare it), fall back to the
   * existing plural-folder→singular-type convention (e.g. `decisions/` →
   * `decision`), default to `"reference"` when neither yields a valid
   * type. Shared by vault/index.ts's query() and vault/graph/build.ts so
   * both agree on one inference rule.
   */
  export function inferEntityType(note: Pick<Note, "folder" | "frontmatter">): EntityType {
    const fromFrontmatter = EntityType.safeParse(note.frontmatter.type)
    if (fromFrontmatter.success) return fromFrontmatter.data

    const folderType = note.folder.split("/")[0]?.toLowerCase()
    const fromFolder = EntityType.safeParse(folderType)
    return fromFolder.success ? fromFolder.data : "reference"
  }

  export interface Query {
    text?: string
    entityTypes?: EntityType[]
    entities?: string[]
    tags?: string[]
    folder?: string
    depth?: number
    limit?: number
    after?: Date
    before?: Date
    // Restrict results to these frontmatter.source values (e.g. provider ids
    // like "gmail"/"notion"). Used by the Lens MCP server to enforce
    // per-source connection scoping.
    sources?: string[]
    // Restrict results to these sensitivity levels. Used by the Lens MCP
    // server to enforce per-tool visibility (e.g. a "restricted" note never
    // leaves the vault via MCP even if the source matches).
    sensitivity?: Sensitivity[]
  }

  export interface QueryResult {
    notes: Note[]
    total: number
    truncated: boolean
  }

  export interface GraphNode {
    id: string
    title: string
    type: EntityType
    path: string
    edges: GraphEdge[]
  }

  export interface GraphEdge {
    target: string
    relation: "mentions" | "decided_in" | "attended" | "owns" | "related"
    context?: string
  }

  export interface Graph {
    nodes: Map<string, GraphNode>
    edges: GraphEdge[]
  }

  export interface SyncConfig {
    enabled: boolean
    intervalMinutes: number
    lookbackDays: number
    credentialsPath?: string
  }

  export interface VaultConfig {
    enabled: boolean
    vaultPath: string
    obsidianCompatible: boolean
    sync: {
      gmail: SyncConfig
      calendar: SyncConfig
      fireflies: SyncConfig & { apiKey?: string }
    }
    liveNotes: {
      enabled: boolean
      updateIntervalMinutes: number
      sources: ("vault" | "web" | "social")[]
    }
  }

  export const DEFAULT_CONFIG: VaultConfig = {
    enabled: true,
    vaultPath: "",
    obsidianCompatible: true,
    sync: {
      gmail: {
        enabled: false,
        intervalMinutes: 60,
        lookbackDays: 7,
      },
      calendar: {
        enabled: false,
        intervalMinutes: 60,
        lookbackDays: 30,
      },
      fireflies: {
        enabled: false,
        intervalMinutes: 60,
        lookbackDays: 30,
        apiKey: undefined,
      },
    },
    liveNotes: {
      enabled: true,
      updateIntervalMinutes: 360,
      sources: ["vault", "web"],
    },
  }
}
