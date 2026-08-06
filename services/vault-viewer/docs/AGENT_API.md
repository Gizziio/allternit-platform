# WebObsidian Agent API (`/api/v1`)

REST API for AI agents to interact with the vault. Authenticated with an **API key**
created in **Settings → API Keys**. Pass it as either header:

```
Authorization: Bearer wok_xxx
X-API-Key: wok_xxx
```

Scopes: `read`, `write`, `search`. Rate limit: configurable (default 120 req/min/key).
All `{path}` values are vault-relative (URL-encode slashes are fine, e.g. `Notes/Ideas.md`).

## Endpoints

| Method | Path | Scope | Description |
|--------|------|-------|-------------|
| GET | `/api/v1/health` | – | Liveness check |
| GET | `/api/v1/notes?offset=&limit=` | read | List markdown notes (paginated) |
| GET | `/api/v1/notes/{path}` | read | Read a note + parsed metadata |
| PUT | `/api/v1/notes/{path}` | write | Create/overwrite a note (`{ "content": "..." }`) |
| PATCH | `/api/v1/notes/{path}` | write | Append (`{ "append": "..." }`) |
| DELETE | `/api/v1/notes/{path}` | write | Move note to trash |
| GET | `/api/v1/search?q=&limit=` | search | QMD search |
| GET | `/api/v1/backlinks?path=` | read | Notes linking to a path |
| GET | `/api/v1/tags` | read | All tags with counts |

## Examples

```bash
KEY=wok_your_key_here
BASE=http://localhost:8787/api/v1

# list notes
curl -H "X-API-Key: $KEY" "$BASE/notes?limit=10"

# read a note
curl -H "X-API-Key: $KEY" "$BASE/notes/Welcome.md"

# create / update a note
curl -X PUT -H "X-API-Key: $KEY" -H 'Content-Type: application/json' \
  -d '{"content":"# From the agent\n\nHello vault."}' \
  "$BASE/notes/Agent/Generated.md"

# append
curl -X PATCH -H "X-API-Key: $KEY" -H 'Content-Type: application/json' \
  -d '{"append":"\n- a new bullet"}' "$BASE/notes/Agent/Generated.md"

# search (fielded queries supported: tag:, path:, title:)
curl -H "X-API-Key: $KEY" "$BASE/search?q=tag:idea%20graph&limit=5"

# backlinks
curl -H "X-API-Key: $KEY" "$BASE/backlinks?path=Welcome.md"
```

## Response shapes

```jsonc
// GET /notes/{path}
{
  "path": "Welcome.md",
  "content": "...",
  "title": "Welcome to WebObsidian",
  "frontmatter": { "tags": ["welcome"] },
  "tags": ["welcome", "getting-started"],
  "links": ["Notes/Ideas"]
}

// GET /search
{ "query": "graph", "hits": [
  { "path": "Notes/Ideas.md", "title": "Ideas", "score": 4.2, "tags": ["idea"], "snippet": "..." }
] }
```
