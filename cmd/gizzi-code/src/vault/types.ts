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
  ])
  export type EntityType = z.infer<typeof EntityType>

  export interface Frontmatter {
    title?: string
    date?: string
    tags?: string[]
    entities?: string[]
    source?: string
    status?: "open" | "closed" | "pending"
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
