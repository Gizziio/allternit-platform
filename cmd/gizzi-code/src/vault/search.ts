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

  close(): void {
    this.db.close()
  }
}
