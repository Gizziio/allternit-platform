/**
 * Brain Memory Schema
 *
 * Triple-store memory for the gizzi brain:
 * - Episodic: events with timestamps (what happened)
 * - Semantic: facts with embeddings (what matters)
 * - Procedural: skills + task graphs (how to do things)
 *
 * Uses SQLite FTS5 for full-text search and JSON columns
 * for pluggable vector embeddings.
 */

import { sqliteTable, text, integer, index, primaryKey } from "drizzle-orm/sqlite-core"
import { Timestamps } from "@/runtime/session/storage/schema.sql"

/** Memory chunk table — raw episodic + semantic memories */
export const MemoryChunkTable = sqliteTable(
  "brain_memory_chunk",
  {
    id: text().primaryKey(),
    tenant_id: text().notNull(), // session or workspace ID
    chunk_type: text().notNull().$type<"episodic" | "semantic" | "procedural">(),
    source: text(), // where did this come from? (event_id, file, tool_call)
    content: text().notNull(), // the actual memory text
    metadata_json: text({ mode: "json" }).$type<Record<string, unknown>>(),
    importance: integer().notNull().default(5), // 1-10, higher = more important
    access_count: integer().notNull().default(0), // how many times retrieved
    last_accessed_at: integer(),
    ...Timestamps,
  },
  (table) => [
    index("brain_chunk_tenant_idx").on(table.tenant_id),
    index("brain_chunk_type_idx").on(table.chunk_type),
    index("brain_chunk_importance_idx").on(table.importance),
  ],
)

/** Embedding table — vector representations for semantic search */
export const MemoryEmbeddingTable = sqliteTable(
  "brain_memory_embedding",
  {
    chunk_id: text()
      .notNull()
      .references(() => MemoryChunkTable.id, { onDelete: "cascade" }),
    provider: text().notNull().$type<"openai" | "ollama" | "local" | "keyword">(),
    model: text().notNull(), // e.g. "text-embedding-3-small"
    // Store vector as JSON array. For large vectors this is inefficient,
    // but for local-first with <10K memories it's fine and requires zero deps.
    vector_json: text({ mode: "json" }).$type<number[]>(),
    dimensions: integer().notNull(),
    ...Timestamps,
  },
  (table) => [
    primaryKey({ columns: [table.chunk_id, table.provider, table.model] }),
    index("brain_embed_chunk_idx").on(table.chunk_id),
  ],
)

/** Entity graph — lightweight knowledge graph for relationships */
export const MemoryEntityTable = sqliteTable(
  "brain_memory_entity",
  {
    id: text().primaryKey(),
    tenant_id: text().notNull(),
    entity_type: text().notNull().$type<"person" | "concept" | "file" | "tool" | "task" | "project">(),
    name: text().notNull(),
    description: text(),
    canonical_json: text({ mode: "json" }).$type<Record<string, unknown>>(),
    first_seen_at: integer().notNull(),
    last_seen_at: integer().notNull(),
    mention_count: integer().notNull().default(1),
    ...Timestamps,
  },
  (table) => [
    index("brain_entity_tenant_idx").on(table.tenant_id),
    index("brain_entity_type_idx").on(table.entity_type),
    index("brain_entity_name_idx").on(table.name),
  ],
)

/** Entity relationships — graph edges */
export const MemoryRelationTable = sqliteTable(
  "brain_memory_relation",
  {
    id: text().primaryKey(),
    tenant_id: text().notNull(),
    subject_id: text()
      .notNull()
      .references(() => MemoryEntityTable.id, { onDelete: "cascade" }),
    predicate: text().notNull(), // e.g. "created", "depends_on", "mentions"
    object_id: text()
      .notNull()
      .references(() => MemoryEntityTable.id, { onDelete: "cascade" }),
    confidence: integer().notNull().default(7), // 1-10
    evidence_chunk_id: text().references(() => MemoryChunkTable.id),
    ...Timestamps,
  },
  (table) => [
    index("brain_rel_tenant_idx").on(table.tenant_id),
    index("brain_rel_subject_idx").on(table.subject_id),
    index("brain_rel_object_idx").on(table.object_id),
  ],
)
