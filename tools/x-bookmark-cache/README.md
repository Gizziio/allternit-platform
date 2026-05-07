# X Bookmark Cache

A **hybrid** Twitter/X bookmark archiver that combines the best of every approach:

| Approach | What We Took | Why |
|----------|--------------|-----|
| **xarchive** | Chrome extension, passive auth capture, built-in viewer | Zero setup friction — just browse X.com |
| **tweetxvault** | Incremental sync, cron-friendly, JSON export | Keeps archive fresh without manual work |
| **TBD** | Passive GraphQL interception, media preservation | No API keys, captures what the browser sees |
| **twitter-web-exporter** | Multiple export formats (JSON, Markdown, Pipeline) | Feeds directly into your discovery pipeline |

**No API key. No paid tier. No rate limits.** Your data stays local.

---

## How It Works

```
[x.com in Chrome] ──intercept──→ [Extension] ──HTTP──→ [Local Server :34100]
                                                            │
                                                            ▼
                                                      [SQLite DB]
                                                            │
                                      ┌─────────────────────┼─────────────────────┐
                                      ▼                     ▼                     ▼
                                [Viewer UI]         [JSON Export]         [Media Dir]
                                (localhost)         (pipeline feed)       (~/media)
```

1. **Browse X.com** — the extension silently intercepts bookmark GraphQL responses
2. **Auto-capture** — tweets stream into a local SQLite database as you scroll
3. **Active sync** (optional) — run `npm run sync` to paginate through your entire bookmark history
4. **Export** — JSON for the pipeline, Markdown for notes, or browse in the built-in viewer

---

## Quick Start

### 1. Install the local server

```bash
cd tools/x-bookmark-cache
npm install
npm start
```

Server runs on `http://localhost:34100`. Data lives in `~/.x-bookmark-cache/`.

### 2. Load the Chrome extension

1. Open Chrome → `chrome://extensions/`
2. Enable **Developer mode** (toggle top-right)
3. Click **Load unpacked**
4. Select `tools/x-bookmark-cache/src/extension/`
5. Pin the extension to your toolbar

### 3. Capture bookmarks

**Method A — Passive (easiest):**
- Go to [x.com/i/bookmarks](https://x.com/i/bookmarks)
- Scroll through your bookmarks
- The extension intercepts every GraphQL response and sends it to the local server
- Open `http://localhost:34100/viewer` to browse

**Method B — Active sync (complete history):**
```bash
npm run sync        # incremental — resumes where it left off
npm run sync --full # reset cursor, fetch entire history
```

This uses the auth token captured by the extension to paginate through your bookmarks via X's internal API.

### 4. Export to your pipeline

```bash
# Export as JSON for manual use
npm run export:json

# Export as Markdown for Obsidian/Notion
npm run export:md

# Export directly into the discovery pipeline
npm run export:pipeline
```

The pipeline export writes to `../../surfaces/allternit-platform/src/data/bookmarks.json` in the format the briefing generator expects.

### 5. (Optional) Download media

```bash
npm run media:download
```

Saves images/videos to `~/.x-bookmark-cache/media/`.

---

## Architecture

### Passive Interception (TBD-style)
The content script hooks `XMLHttpRequest` and `fetch` on x.com. When X's web app makes a `BookmarkTimeline` GraphQL request, we parse the response and extract tweet metadata — text, author, engagement metrics, media URLs, entities. This happens transparently while you browse. No extra API calls.

### Active Sync (tweetxvault-style)
If the extension captures your `authorization` header (happens automatically when you browse X), the sync script can make paginated requests to X's internal GraphQL endpoints. It stores a cursor in SQLite so each run is incremental. Rate-limited to 2.5s between pages with automatic backoff.

### Storage
- **SQLite** (better-sqlite3) — fast, synchronous, zero-config
- **WAL mode** — safe for concurrent reads/writes
- **Schema** — deduplicated by tweet ID, indexed by date, author, capture time

### Export Formats
| Format | Use Case |
|--------|----------|
| JSON | Raw data, API consumption, backups |
| Markdown | Note-taking apps (Obsidian, Logseq, Notion) |
| Pipeline JSON | Direct feed into Allternit discovery pipeline |
| HTML Viewer | Browse locally with search and pagination |

---

## Automation

Add to your crontab for background sync:

```bash
# Sync bookmarks every 6 hours
0 */6 * * * cd /path/to/tools/x-bookmark-cache && npm run sync >> /tmp/xbc-sync.log 2>&1

# Download new media daily
0 3 * * * cd /path/to/tools/x-bookmark-cache && npm run media:download >> /tmp/xbc-media.log 2>&1

# Push to pipeline weekly
0 9 * * 1 cd /path/to/tools/x-bookmark-cache && npm run export:pipeline
```

---

## Directory Structure

```
tools/x-bookmark-cache/
├── src/
│   ├── extension/          # Chrome extension (Manifest V3)
│   │   ├── manifest.json
│   │   ├── content.js      # XHR/fetch interceptor
│   │   ├── background.js   # Service worker relay
│   │   ├── popup.html      # Extension popup UI
│   │   └── popup.js
│   ├── server/             # Local Express server
│   │   ├── server.js       # HTTP API
│   │   ├── db.js           # SQLite layer
│   │   ├── sync.js         # Active paginated sync
│   │   ├── export.js       # CLI export wrappers
│   │   └── media.js        # Media downloader
│   └── viewer/             # Built-in web UI
│       └── index.html
├── package.json
└── README.md
```

---

## Data Location

```
~/.x-bookmark-cache/
├── bookmarks.db           # SQLite database
├── bookmarks.db-shm       # WAL shared memory
├── bookmarks.db-wal       # WAL journal
└── media/                 # Downloaded images/videos
    ├── 123456789_1.jpg
    └── 123456789_2.mp4
```

---

## Troubleshooting

**"Server offline" in extension popup**
- Make sure `npm start` is running
- Check `http://localhost:34100/health` in your browser

**No bookmarks captured**
- Browse to `x.com/i/bookmarks` and scroll
- Check browser console for `[XBC]` logs
- Verify the extension has host permissions for `x.com`

**Sync fails with 401/403**
- Your auth token expired. Browse X.com normally to refresh it, then the extension will capture the new one
- Run `npm run sync --full` to reset the cursor

**Media downloads fail**
- X may rate-limit media requests. Wait a few minutes and retry
- Some videos require special handling — media.js marks them as failed and skips on retry

---

## License

MIT — for personal archiving only. Respect content creators and X's TOS.
