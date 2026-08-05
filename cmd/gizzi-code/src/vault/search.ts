/**
 * Vault Search
 *
 * SQLite-backed indexing for the knowledge vault.
 * Provides fast full-text search, backlink traversal, and entity lookup.
 */

import path from "path"
import { Database } from "bun:sqlite"
import { Log } from "@/shared/util/log"
import { Filesystem } from "@/shared/util/filesystem"
import type { Vault } from "./types"

const log = Log.create({ service: "vault-search" })

export class VaultIndex {
  private db: Database
  private vaultRoot: string

  constructor(vaultRoot: string) {
    this.vaultRoot = vaultRoot
    const dbPath = path.join(vaultRoot, ".allternit", "vault-index.db")
    Filesystem.ensureDir(path.dirname(dbPath))
    this.db = new Database(dbPath)
    this.db.run("PRAGMA journal_mode = WAL")
    this.initSchema()
  }

  private initSchema(): void {
    this.db.run(`
      CREATE TABLE IF NOT EXISTS notes (
        path TEXT PRIMARY KEY,
        rel_path TEXT NOT NULL,
        title TEXT NOT NULL,
        folder TEXT,
        content TEXT,
        mtime INTEGER,
        ctime INTEGER
      )
    `)

    this.db.run(`
      CREATE TABLE IF NOT EXISTS tags (
        note_path TEXT NOT NULL,
        tag TEXT NOT NULL,
        PRIMARY KEY (note_path, tag)
      )
    `)

    this.db.run(`
      CREATE TABLE IF NOT EXISTS links (
        source TEXT NOT NULL,
        target TEXT NOT NULL,
        PRIMARY KEY (source, target)
      )
    `)

    this.db.run(`
      CREATE TABLE IF NOT EXISTS entities (
        note_path TEXT NOT NULL,
        entity TEXT NOT NULL,
        type TEXT,
        PRIMARY KEY (note_path, entity)
      )
    `)

    this.db.run(`
      CREATE VIRTUAL TABLE IF NOT EXISTS notes_fts USING fts5(
        title, content
      )
    `)

    // Semantic/bridge edges from vault/graph/semantic-linking.ts. Deliberately
    // separate from `links`: that table is delete+reinsert per-note on every
    // vault scan keyed off note.outgoingLinks, so semantic edges would be
    // wiped on the next VaultManager.initialize() if stored there. This
    // table is instead fully replaced only when `gizzi vault graph` runs
    // (see replaceSemanticLinks) — same "recompute everything" philosophy,
    // just on its own schedule. Keyed on relPath (not the absolute `path`
    // the other tables use), since that's what semantic-linking.ts computes
    // with end-to-end.
    this.db.run(`
      CREATE TABLE IF NOT EXISTS semantic_links (
        source TEXT NOT NULL,
        target TEXT NOT NULL,
        relation TEXT NOT NULL,
        weight REAL NOT NULL,
        PRIMARY KEY (source, target, relation)
      )
    `)

    this.db.run(`CREATE INDEX IF NOT EXISTS idx_notes_folder ON notes(folder)`)
    this.db.run(`CREATE INDEX IF NOT EXISTS idx_notes_mtime ON notes(mtime)`)
    this.db.run(`CREATE INDEX IF NOT EXISTS idx_tags_tag ON tags(tag)`)
    this.db.run(`CREATE INDEX IF NOT EXISTS idx_links_target ON links(target)`)
    this.db.run(`CREATE INDEX IF NOT EXISTS idx_entities_entity ON entities(entity)`)
  }

  index(note: Vault.Note): void {
    const insert = this.db.prepare(`
      INSERT INTO notes (path, rel_path, title, folder, content, mtime, ctime)
      VALUES ($path, $relPath, $title, $folder, $content, $mtime, $ctime)
      ON CONFLICT(path) DO UPDATE SET
        title = excluded.title,
        folder = excluded.folder,
        content = excluded.content,
        mtime = excluded.mtime
    `)
    insert.run({
      $path: note.path,
      $relPath: note.relPath,
      $title: note.title,
      $folder: note.folder,
      $content: note.content,
      $mtime: note.mtime,
      $ctime: note.ctime,
    })

    // Get rowid for FTS
    const rowidRow = this.db.query("SELECT rowid FROM notes WHERE path = $path").get({ $path: note.path }) as { rowid: number } | null
    if (rowidRow) {
      // FTS5 virtual tables don't support UPSERT; delete then re-insert
      this.db.prepare("DELETE FROM notes_fts WHERE rowid = $rowid").run({ $rowid: rowidRow.rowid })
      this.db.prepare(`INSERT INTO notes_fts (rowid, title, content) VALUES ($rowid, $title, $content)`).run({
        $rowid: rowidRow.rowid,
        $title: note.title,
        $content: note.content,
      })
    }

    // Tags
    this.db.prepare("DELETE FROM tags WHERE note_path = $path").run({ $path: note.path })
    if (note.frontmatter.tags?.length) {
      const tagStmt = this.db.prepare("INSERT OR IGNORE INTO tags (note_path, tag) VALUES ($path, $tag)")
      for (const tag of note.frontmatter.tags) {
        tagStmt.run({ $path: note.path, $tag: tag })
      }
    }

    // Links
    this.db.prepare("DELETE FROM links WHERE source = $path").run({ $path: note.path })
    if (note.outgoingLinks.length) {
      const linkStmt = this.db.prepare("INSERT OR IGNORE INTO links (source, target) VALUES ($source, $target)")
      for (const target of note.outgoingLinks) {
        linkStmt.run({ $source: note.path, $target: target })
      }
    }

    // Entities
    this.db.prepare("DELETE FROM entities WHERE note_path = $path").run({ $path: note.path })
    if (note.frontmatter.entities?.length) {
      const entStmt = this.db.prepare("INSERT OR IGNORE INTO entities (note_path, entity, type) VALUES ($path, $entity, $type)")
      for (const entity of note.frontmatter.entities) {
        entStmt.run({ $path: note.path, $entity: entity, $type: null })
      }
    }
  }

  remove(path: string): void {
    this.db.prepare("DELETE FROM notes WHERE path = $path").run({ $path: path })
    this.db.prepare("DELETE FROM tags WHERE note_path = $path").run({ $path: path })
    this.db.prepare("DELETE FROM links WHERE source = $path").run({ $path: path })
    this.db.prepare("DELETE FROM entities WHERE note_path = $path").run({ $path: path })
  }

  search(query: string, limit = 20): Array<{ path: string; title: string; snippet: string }> {
    const rows = this.db.query(`
      SELECT notes.path, notes.title, snippet(notes_fts, 0, '>>', '<<', '...', 120) as snippet
      FROM notes_fts
      JOIN notes ON notes.rowid = notes_fts.rowid
      WHERE notes_fts MATCH $query
      ORDER BY rank
      LIMIT $limit
    `).all({ $query: query, $limit: limit }) as Array<{ path: string; title: string; snippet: string }>
    return rows
  }

  getBacklinks(targetPath: string): Array<{ source: string; title: string }> {
    const targetTitle = path.basename(targetPath, ".md")
    const rows = this.db.query(`
      SELECT n.path as source, n.title
      FROM links l
      JOIN notes n ON n.path = l.source
      WHERE l.target = $target OR l.target = $title
    `).all({ $target: targetPath, $title: targetTitle }) as Array<{ source: string; title: string }>
    return rows
  }

  getByFolder(folder: string): Array<{ path: string; title: string; mtime: number }> {
    return this.db.query(`
      SELECT path, title, mtime FROM notes
      WHERE folder = $folder OR folder LIKE $pattern
      ORDER BY mtime DESC
    `).all({ $folder: folder, $pattern: `${folder}/%` }) as Array<{ path: string; title: string; mtime: number }>
  }

  getByTag(tag: string): Array<{ path: string; title: string }> {
    return this.db.query(`
      SELECT n.path, n.title
      FROM tags t
      JOIN notes n ON n.path = t.note_path
      WHERE t.tag = $tag
    `).all({ $tag: tag }) as Array<{ path: string; title: string }>
  }

  getRecent(limit = 20): Array<{ path: string; title: string; mtime: number }> {
    return this.db.query(`
      SELECT path, title, mtime FROM notes
      ORDER BY mtime DESC
      LIMIT $limit
    `).all({ $limit: limit }) as Array<{ path: string; title: string; mtime: number }>
  }

  /**
   * Full delete + bulk insert — the semantic graph is recomputed from
   * scratch on every `gizzi vault graph` run (deterministic given the same
   * vault content), so there's no incremental-update path to maintain here.
   */
  replaceSemanticLinks(edges: Array<{ source: string; target: string; relation: string; weight: number }>): void {
    this.db.run("DELETE FROM semantic_links")
    if (edges.length === 0) return
    const insert = this.db.prepare(
      "INSERT OR IGNORE INTO semantic_links (source, target, relation, weight) VALUES ($source, $target, $relation, $weight)",
    )
    const insertAll = this.db.transaction((rows: typeof edges) => {
      for (const e of rows) {
        insert.run({ $source: e.source, $target: e.target, $relation: e.relation, $weight: e.weight })
      }
    })
    insertAll(edges)
  }

  getSemanticNeighbors(relPath: string): Array<{ target: string; relation: string; weight: number }> {
    return this.db.query(`
      SELECT target, relation, weight FROM semantic_links WHERE source = $source
      UNION
      SELECT source as target, relation, weight FROM semantic_links WHERE target = $source
      ORDER BY weight DESC
    `).all({ $source: relPath }) as Array<{ target: string; relation: string; weight: number }>
  }

  close(): void {
    this.db.close()
  }
}
