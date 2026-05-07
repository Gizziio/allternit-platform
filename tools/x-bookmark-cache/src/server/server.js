#!/usr/bin/env node
/**
 * X Bookmark Cache — Local Server
 *
 * Express server that receives intercepted bookmarks from the browser extension,
 * stores them in SQLite, and serves the viewer UI.
 */

import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  insertBookmarks,
  getBookmarks,
  getBookmarkById,
  getStats,
  searchBookmarks,
  queueMedia,
  getSyncState,
  setSyncState,
} from './db.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.XBC_PORT || 34100;

app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use('/viewer', express.static(path.join(__dirname, '../viewer')));

// ─── Health ─────────────────────────────────────────────────────────────────

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', version: '1.0.0' });
});

// ─── Receive Bookmarks from Extension ───────────────────────────────────────

app.post('/api/bookmarks', (req, res) => {
  const { bookmarks, authHeaders } = req.body;
  if (!Array.isArray(bookmarks) || !bookmarks.length) {
    return res.status(400).json({ error: 'No bookmarks provided' });
  }

  try {
    insertBookmarks(bookmarks);

    // Queue media for download
    for (const bm of bookmarks) {
      if (bm.media && Array.isArray(bm.media)) {
        for (const m of bm.media) {
          const mediaUrl = m.media_url_https || m.media_url;
          if (mediaUrl) {
            queueMedia(bm.tweetId, mediaUrl, m.type);
          }
        }
      }
    }

    // Store auth headers for sync mode
    if (authHeaders?.auth) {
      setSyncState('auth_token', authHeaders.auth);
    }
    if (authHeaders?.ct0) {
      setSyncState('ct0', authHeaders.ct0);
    }

    console.log(`[Server] Stored ${bookmarks.length} bookmarks`);
    res.json({ stored: bookmarks.length });
  } catch (err) {
    console.error('[Server] Store error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ─── Browse / Search ────────────────────────────────────────────────────────

app.get('/api/bookmarks', (req, res) => {
  const limit = Math.min(parseInt(req.query.limit) || 50, 500);
  const offset = parseInt(req.query.offset) || 0;
  const order = req.query.order === 'oldest' ? 'created_at ASC' : 'captured_at DESC';
  const items = getBookmarks({ limit, offset, order });
  res.json(items);
});

app.get('/api/bookmarks/search', (req, res) => {
  const q = req.query.q || '';
  if (!q) return res.json([]);
  res.json(searchBookmarks(q));
});

app.get('/api/bookmarks/:id', (req, res) => {
  const bm = getBookmarkById(req.params.id);
  if (!bm) return res.status(404).json({ error: 'Not found' });
  res.json(bm);
});

// ─── Stats ──────────────────────────────────────────────────────────────────

app.get('/api/stats', (_req, res) => {
  res.json(getStats());
});

// ─── Exports ────────────────────────────────────────────────────────────────

app.get('/api/export/json', (_req, res) => {
  const items = getBookmarks({ limit: 10000, order: 'created_at DESC' });
  res.json(items.map(row => ({
    id: row.id,
    tweetId: row.tweet_id,
    text: row.text,
    createdAt: row.created_at,
    capturedAt: row.captured_at,
    author: {
      name: row.author_name,
      handle: row.author_handle,
    },
    metrics: {
      likes: row.likes,
      retweets: row.retweets,
      replies: row.replies,
      quotes: row.quotes,
    },
    url: row.url,
    entities: row.entities_json ? JSON.parse(row.entities_json) : null,
    media: row.media_json ? JSON.parse(row.media_json) : null,
  })));
});

app.get('/api/export/pipeline', (_req, res) => {
  const items = getBookmarks({ limit: 10000, order: 'captured_at DESC' });
  const pipeline = items.map(row => ({
    url: row.url,
    title: row.text?.slice(0, 200) || row.url,
    author: row.author_handle ? `@${row.author_handle}` : 'Unknown',
    source: 'twitter',
    tags: ['curated', 'twitter'],
    note: `Cached from X. Likes: ${row.likes}, RTs: ${row.retweets}`,
  }));
  res.json(pipeline);
});

app.get('/api/export/markdown', (_req, res) => {
  const items = getBookmarks({ limit: 10000, order: 'created_at DESC' });
  let md = '# X Bookmark Cache Export\n\n';
  md += `Generated: ${new Date().toISOString()}\n\n`;
  md += `Total: ${items.length} bookmarks\n\n---\n\n`;

  for (const row of items) {
    md += `## ${row.text?.slice(0, 100) || 'Untitled'}\n\n`;
    md += `- **Author:** @${row.author_handle} (${row.author_name})\n`;
    md += `- **Date:** ${row.created_at}\n`;
    md += `- **URL:** ${row.url}\n`;
    md += `- **Engagement:** ${row.likes} likes, ${row.retweets} RTs, ${row.replies} replies\n\n`;
    md += `---\n\n`;
  }

  res.setHeader('Content-Type', 'text/markdown');
  res.setHeader('Content-Disposition', `attachment; filename="x-bookmarks-${new Date().toISOString().slice(0,10)}.md"`);
  res.send(md);
});

// ─── Start ──────────────────────────────────────────────────────────────────

app.listen(PORT, () => {
  console.log(`[XBC] Server running on http://localhost:${PORT}`);
  console.log(`[XBC] Viewer: http://localhost:${PORT}/viewer`);
  console.log(`[XBC] Data dir: ~/.x-bookmark-cache`);
});
