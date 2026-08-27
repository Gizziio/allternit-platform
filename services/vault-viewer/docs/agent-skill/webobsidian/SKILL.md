---
name: webobsidian
description: "Read, write, search, and manage notes in a WebObsidian vault through its Agent REST API (/api/v1). Use whenever the user asks to find, read, create, update, append to, or delete notes in their WebObsidian / Obsidian vault, list tags, get backlinks, or run a vault search. Credentials (base URL + API key) are stored in ~/.webobsidian/credentials.json; if missing, ask the user for them and save them before making requests."
---

# WebObsidian Agent skill

Operate a [WebObsidian](https://github.com/xnohat/webobsidian) vault over its Agent REST
API at `/api/v1`. Everything is a plain HTTP call authenticated with an API key.

## Credentials (read these first, every session)

Credentials live in **`~/.webobsidian/credentials.json`**:

```json
{ "baseUrl": "https://your-webobsidian.example.com", "apiKey": "wok_xxxxxxxx" }
```

**Before the first request in a session**, load them into shell variables:

```bash
BASE=$(python3 -c 'import json,os;print(json.load(open(os.path.expanduser("~/.webobsidian/credentials.json")))["baseUrl"].rstrip("/"))')
KEY=$(python3 -c 'import json,os;print(json.load(open(os.path.expanduser("~/.webobsidian/credentials.json")))["apiKey"])')
```

If `~/.webobsidian/credentials.json` does **not** exist or a call returns **401**:

1. Ask the user for their **WebObsidian base URL** (e.g. `https://notes.example.com` or
   `http://host:8787`) and their **API key**. They create the key in the app at
   **Settings → API Keys** (choose scopes `read` / `write` / `search`). Keys look like `wok_…`.
2. Save it (never echo the key back):
   ```bash
   mkdir -p ~/.webobsidian && chmod 700 ~/.webobsidian
   cat > ~/.webobsidian/credentials.json <<JSON
   { "baseUrl": "<BASE_URL>", "apiKey": "<API_KEY>" }
   JSON
   chmod 600 ~/.webobsidian/credentials.json
   ```
3. Verify with the health + an authenticated call, then proceed.

**Security rules:** never print, log, or commit the API key. Never write it into vault
notes. If a command would expose it, redact it.

## Sanity check

```bash
curl -s "$BASE/api/v1/health"                          # liveness, no auth
curl -s -H "X-API-Key: $KEY" "$BASE/api/v1/tags" | head # confirms the key works
```

## Authentication

Send the key as a header on every `/api/v1` request (either form works):

```
X-API-Key: wok_xxx
Authorization: Bearer wok_xxx
```

Scopes per key: `read`, `write`, `search`. A call outside the key's scope returns `403`.
Rate-limited (default 120 req/min/key) → `429` when exceeded; back off and retry.

## Endpoint reference

All `{path}` values are **vault-relative** and must be **URL-encoded** (`curl -G --data-urlencode`
for queries; encode `/`-containing paths in the URL path, e.g. `Notes/Ideas.md` →
`Notes%2FIdeas.md` is accepted, plain `Notes/Ideas.md` also works).

| Method | Path | Scope | Description |
|--------|------|-------|-------------|
| GET | `/api/v1/health` | – | Liveness check |
| GET | `/api/v1/notes?offset=&limit=` | read | List markdown notes (paginated) |
| GET | `/api/v1/notes/{path}` | read | Read a note + parsed metadata |
| PUT | `/api/v1/notes/{path}` | write | Create / overwrite a note — body `{"content":"..."}` |
| PATCH | `/api/v1/notes/{path}` | write | Append — body `{"append":"..."}` |
| DELETE | `/api/v1/notes/{path}` | write | Move note to trash |
| GET | `/api/v1/search?q=&limit=` | search | QMD search (fielded: `tag:`, `path:`, `title:`) |
| GET | `/api/v1/backlinks?path=` | read | Notes linking to a path |
| GET | `/api/v1/tags` | read | All tags with counts |

## Recipes

```bash
# List 10 notes
curl -s -H "X-API-Key: $KEY" "$BASE/api/v1/notes?limit=10"

# Read a note (URL-encode the path's query value if it has spaces/slashes)
curl -s -H "X-API-Key: $KEY" "$BASE/api/v1/notes/Welcome.md"

# Create or overwrite a note
curl -s -X PUT -H "X-API-Key: $KEY" -H 'Content-Type: application/json' \
  -d '{"content":"# Title\n\nBody written by the agent."}' \
  "$BASE/api/v1/notes/Agent/Generated.md"

# Append to a note (creates it if missing)
curl -s -X PATCH -H "X-API-Key: $KEY" -H 'Content-Type: application/json' \
  -d '{"append":"\n- another bullet"}' \
  "$BASE/api/v1/notes/Agent/Generated.md"

# Delete a note (→ trash)
curl -s -X DELETE -H "X-API-Key: $KEY" "$BASE/api/v1/notes/Agent/Generated.md"

# Full-text search (fielded queries supported)
curl -s -G -H "X-API-Key: $KEY" "$BASE/api/v1/search" \
  --data-urlencode "q=tag:idea graph" --data-urlencode "limit=5"

# Backlinks for a note
curl -s -G -H "X-API-Key: $KEY" "$BASE/api/v1/backlinks" --data-urlencode "path=Welcome.md"

# All tags with counts
curl -s -H "X-API-Key: $KEY" "$BASE/api/v1/tags"
```

## Response shapes

```jsonc
// GET /api/v1/notes/{path}
{ "path": "Welcome.md", "content": "...", "title": "Welcome",
  "frontmatter": { "tags": ["welcome"] }, "tags": ["welcome"], "links": ["Notes/Ideas"] }

// GET /api/v1/search
{ "query": "graph", "hits": [
  { "path": "Notes/Ideas.md", "title": "Ideas", "score": 4.2, "tags": ["idea"], "snippet": "…" } ] }
```

## Obsidian Flavored Markdown (write notes in this dialect)

The vault is a real Obsidian vault — the user also opens these files in the Obsidian app,
so write **Obsidian Flavored Markdown**, not plain Markdown. Use `[[wikilinks]]` for links
between vault notes (Obsidian tracks renames); use `[text](url)` **only** for external URLs.

### Properties (YAML frontmatter)
At the very top of the note, between `---` fences. Default keys: `tags`, `aliases`,
`cssclasses`. Preserve existing frontmatter on overwrite.

```markdown
---
title: My Note
date: 2024-01-15
tags:
  - project
  - active
aliases:
  - Alternative Name
---
```

### Wikilinks (internal links)
```markdown
[[Note Name]]                 Link to a note
[[Note Name|Display Text]]    Custom display text
[[Note Name#Heading]]         Link to a heading
[[Note Name#^block-id]]       Link to a block
[[#Heading in same note]]     Same-note link
```

### Block references
Append `^block-id` to a paragraph; for lists/quotes put the id on its own line after the block.
```markdown
This paragraph can be linked to. ^my-block-id
```

### Embeds / transclusion (prefix a wikilink with `!`)
```markdown
![[Note Name]]                Embed a whole note
![[Note Name#Heading]]        Embed one section
![[image.png]]                Embed an image
![[image.png|300]]            Embed with width
![[document.pdf#page=3]]      Embed a PDF page
```

### Callouts
```markdown
> [!note]
> Basic callout.

> [!warning] Custom Title
> Callout with a custom title.

> [!faq]- Collapsed by default
> Foldable callout (`-` starts collapsed, `+` starts expanded).
```
Common types: `note`, `tip`, `info`, `warning`, `danger`, `success`, `failure`, `question`,
`example`, `quote`, `bug`, `abstract`, `todo`.

### Tags
```markdown
#tag            inline tag
#nested/tag     hierarchical tag
```
Letters, digits (not first char), `_`, `-`, `/`. Tags also go in frontmatter `tags:`.

### Tasks
```markdown
- [ ] Pending task
- [x] Completed task
```

### Other syntax
```markdown
==highlight==   **bold**   *italic*
Footnote[^1].          [^1]: Footnote text.       Inline footnote.^[Inline text.]
Visible %%hidden inline comment%% text.            $e^{i\pi}+1=0$  (inline math)
```
````markdown
$$\frac{a}{b} = c$$         (block math, KaTeX)

```mermaid
graph TD
  A --> B
```
````

## Editing rules

- **Prefer `PATCH` append** over `PUT` when only adding content, so you don't clobber a note.
- **Read before you overwrite** an existing note unless the user explicitly wants a fresh
  replace; preserve its frontmatter and formatting.
- Paths are **case-sensitive** and notes must include the `.md` extension.
- When you reference another note, link it (`[[Other Note]]`) instead of writing a bare name —
  it keeps the graph and backlinks intact.

## Troubleshooting

- `401` → key missing/invalid → re-run the credentials flow above.
- `403` → the key lacks the required scope → ask the user to create a key with the needed
  scope (`read`/`write`/`search`).
- `404` on a note → wrong path/casing, or it's in `.trash`.
- `429` → rate limited → wait and retry.
- Connection refused / TLS error → confirm the base URL and that the server is reachable.
