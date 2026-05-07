/**
 * X Bookmark Cache — Database Layer
 *
 * SQLite with better-sqlite3. Fast, synchronous, zero config.
 */

import Database from 'better-sqlite3';
import path from 'path';
import os from 'os';
import fs from 'fs';

const DATA_DIR = path.join(os.homedir(), '.x-bookmark-cache');
const DB_PATH = path.join(DATA_DIR, 'bookmarks.db');

fs.mkdirSync(DATA_DIR, { recursive: true });

const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// ─── Schema ─────────────────────────────────────────────────────────────────

db.exec(`
  CREATE TABLE IF NOT EXISTS bookmarks (
    id              TEXT PRIMARY KEY,
    tweet_id        TEXT NOT NULL,
    conversation_id TEXT,
    text            TEXT,
    created_at      TEXT,
    captured_at     TEXT DEFAULT (datetime('now')),
    author_id       TEXT,
    author_name     TEXT,
    author_handle   TEXT,
    likes           INTEGER DEFAULT 0,
    retweets        INTEGER DEFAULT 0,
    replies         INTEGER DEFAULT 0,
    quotes          INTEGER DEFAULT 0,
    url             TEXT NOT NULL,
    entities_json   TEXT,
    media_json      TEXT,
    raw_json        TEXT,
    media_downloaded INTEGER DEFAULT 0,
    sync_source     TEXT DEFAULT 'intercept'
  );

  CREATE INDEX IF NOT EXISTS idx_bookmarks_created ON bookmarks(created_at);
  CREATE INDEX IF NOT EXISTS idx_bookmarks_captured ON bookmarks(captured_at);
  CREATE INDEX IF NOT EXISTS idx_bookmarks_author ON bookmarks(author_handle);

  CREATE TABLE IF NOT EXISTS sync_state (
    key   TEXT PRIMARY KEY,
    value TEXT
  );

  CREATE TABLE IF NOT EXISTS media_queue (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    tweet_id    TEXT NOT NULL,
    media_url   TEXT NOT NULL,
    media_type  TEXT,
    filename    TEXT,
    downloaded  INTEGER DEFAULT 0,
    created_at  TEXT DEFAULT (datetime('now'))
  );
`);

// ─── Queries ────────────────────────────────────────────────────────────────

export function insertBookmark(bm) {
  const stmt = db.prepare(`
    INSERT OR REPLACE INTO bookmarks (
      id, tweet_id, conversation_id, text, created_at, captured_at,
      author_id, author_name, author_handle, likes, retweets, replies, quotes,
      url, entities_json, media_json, raw_json, sync_source
    ) VALUES (
      @id, @tweetId, @conversationId, @text, @createdAt, @capturedAt,
      @authorId, @authorName, @authorHandle, @likes, @retweets, @replies, @quotes,
      @url, @entitiesJson, @mediaJson, @rawJson, @syncSource
    )
  `);

  stmt.run({
    id: bm.id,
    tweetId: bm.tweetId,
    conversationId: bm.conversationId || null,
    text: bm.text || null,
    createdAt: bm.createdAt || null,
    capturedAt: bm.capturedAt || new Date().toISOString(),
    authorId: bm.author?.id || null,
    authorName: bm.author?.name || null,
    authorHandle: bm.author?.handle || null,
    likes: bm.metrics?.likes || 0,
    retweets: bm.metrics?.retweets || 0,
    replies: bm.metrics?.replies || 0,
    quotes: bm.metrics?.quotes || 0,
    url: bm.url,
    entitiesJson: bm.entities ? JSON.stringify(bm.entities) : null,
    mediaJson: bm.media ? JSON.stringify(bm.media) : null,
    rawJson: bm.raw ? JSON.stringify(bm.raw) : null,
    syncSource: bm.syncSource || 'intercept',
  });
}

export function insertBookmarks(bookmarks) {
  const insert = db.transaction((items) => {
    for (const bm of items) insertBookmark(bm);
  });
  insert(bookmarks);
}

export function getBookmarks(opts = {}) {
  const { limit = 100, offset = 0, order = 'captured_at DESC' } = opts;
  return db.prepare(`
    SELECT * FROM bookmarks
    ORDER BY ${order}
    LIMIT @limit OFFSET @offset
  `).all({ limit, offset });
}

export function getBookmarkById(id) {
  return db.prepare('SELECT * FROM bookmarks WHERE id = ?').get(id);
}

export function getStats() {
  const total = db.prepare('SELECT COUNT(*) as count FROM bookmarks').get();
  const authors = db.prepare('SELECT COUNT(DISTINCT author_handle) as count FROM bookmarks').get();
  const latest = db.prepare('SELECT MAX(captured_at) as date FROM bookmarks').get();
  const mediaPending = db.prepare('SELECT COUNT(*) as count FROM media_queue WHERE downloaded = 0').get();
  return {
    totalBookmarks: total.count,
    uniqueAuthors: authors.count,
    lastCapture: latest.date,
    mediaPending: mediaPending.count,
  };
}

export function searchBookmarks(query) {
  return db.prepare(`
    SELECT * FROM bookmarks
    WHERE text LIKE @q
       OR author_name LIKE @q
       OR author_handle LIKE @q
    ORDER BY captured_at DESC
    LIMIT 100
  `).all({ q: `%${query}%` });
}

export function queueMedia(tweetId, mediaUrl, mediaType) {
  const existing = db.prepare('SELECT id FROM media_queue WHERE media_url = ?').get(mediaUrl);
  if (existing) return;
  db.prepare(`
    INSERT INTO media_queue (tweet_id, media_url, media_type)
    VALUES (?, ?, ?)
  `).run(tweetId, mediaUrl, mediaType);
}

export function getPendingMedia(limit = 50) {
  return db.prepare(`
    SELECT * FROM media_queue WHERE downloaded = 0
    ORDER BY created_at LIMIT @limit
  `).all({ limit });
}

export function markMediaDownloaded(id, filename) {
  db.prepare(`
    UPDATE media_queue SET downloaded = 1, filename = ? WHERE id = ?
  `).run(filename, id);
  // Also update bookmark
  const row = db.prepare('SELECT tweet_id FROM media_queue WHERE id = ?').get(id);
  if (row) {
    db.prepare('UPDATE bookmarks SET media_downloaded = 1 WHERE tweet_id = ?').run(row.tweet_id);
  }
}

export function getSyncState(key) {
  const row = db.prepare('SELECT value FROM sync_state WHERE key = ?').get(key);
  return row?.value || null;
}

export function setSyncState(key, value) {
  db.prepare(`
    INSERT INTO sync_state (key, value) VALUES (?, ?)
    ON CONFLICT(key) DO UPDATE SET value = excluded.value
  `).run(key, value);
}

export { db, DATA_DIR };
