---
status: done
files_changed:
  - cmd/allternit-api/migrations/V33__brains_and_git_tokens.sql
  - cmd/allternit-api/src/brain_routes.rs
  - cmd/allternit-api/src/config.rs
  - cmd/allternit-api/src/lib.rs
  - cmd/allternit-api/src/main.rs
  - .steering/checkpoint.md
  - docs/BRAIN_D2_NOTES.md
tests_green: true
deviations:
  - "The git smart-HTTP router is mounted on the PUBLIC router (nested under /api/v1) with a per-handler `allternit_git_` token gate, not behind the Clerk auth_middleware — same precedent as internal_routes (require_internal_token) and the LLM gateway. A Clerk layer would 401 every git client, and the spec scopes git tokens to the brain git routes ONLY. Management routes (POST/GET /brains, /tokens/git, /brains/:id/pages) stay behind Clerk."
  - "clone_url is derived from the request's host / x-forwarded-proto / x-forwarded-host headers (<scheme>://<host>/api/v1/brains/<id>/git) because AppConfig has no public-base-URL setting; this tracks whatever reverse proxy terminates TLS."
  - "CGI request/response bodies are collected then relayed (not bidirectionally streamed): git smart-HTTP requests are bounded, and this keeps the http-backend spawn simple. HTTP_CONTENT_ENCODING is forwarded so gzip'd push bodies work."
remaining:
  - "D1 client wiring: `gizzi brain init --remote` currently calls POST /api/v1/brains with NO credentials and no git-token minting flow; making the CLI mint/use an `allternit_git_` token (and embedding it in the origin URL or a git credential helper) is follow-up work on the cmd/gizzi-code side."
  - "Track-D backlog: D3 (agents consuming GET /api/v1/brains/:id/pages server-side) is untouched here."
---

# D2 — hosted brain remotes + read API: completion notes

## What was built (spec D2a-R1..R3, D2b-R1)

All of it lives in a new route module `cmd/allternit-api/src/brain_routes.rs`,
wired in `main.rs`, with state in SQLite (refinery migration V33) and repos on
disk under `AppConfig::brains_dir()`.

### D2a-R1 — provisioning

`POST /api/v1/brains` (Clerk-authed, `Extension<AuthUser>` like every other
v1 route) runs `git init --bare <brains_dir>/<user_id>/<brain_id>.git`,
registers the brain in the `brains` table (id, user_id, path, created_at) and
returns `201 {brain_id, clone_url, created_at}` — exactly the shape D1's
`init --remote` already consumes (`data?.clone_url`). `GET /api/v1/brains`
lists the caller's brains. Isolation: every brain read goes through the
registry row and returns 404 (indistinguishable from missing) when the caller
doesn't own it; the user id is sanitized before touching the filesystem.

### D2a-R2 — git smart-HTTP

`GET|POST /api/v1/brains/:id/git/*path` proxies to the `git http-backend` CGI
bundled with git — no bespoke protocol code. The handler builds the CGI env in
a pure function (`build_cgi_env`: GIT_PROJECT_ROOT, PATH_INFO, REQUEST_METHOD,
CONTENT_TYPE, QUERY_STRING, HTTP_CONTENT_ENCODING, GIT_HTTP_EXPORT_ALL,
REMOTE_USER), feeds the collected request body to the CGI's stdin, and maps
the CGI response headers/`Status:` line back onto an axum Response. `..`
segments in the wildcard path are rejected before any path is built.

### D2a-R3 — git tokens

New credential type: `allternit_git_` + 32 hex (uuid v4). Only the sha256 hex
digest is stored (`git_tokens` table, UNIQUE); the plaintext is returned ONCE
by `POST /api/v1/tokens/git` (201 `{id, token, note}`). `GET` lists
id/name/created_at/last_used_at (never the token); `DELETE /:id` revokes
(owner-scoped). Verification hashes the presented token and compares digests
with a constant-time fold, then stamps last_used_at. Git endpoints accept
`Authorization: Bearer allternit_git_...` or `Basic base64(user:allternit_git_...)`
(git's native credential shape; username ignored); failures get 401 +
`WWW-Authenticate: Basic realm="allternit-git"`. The token is valid on the
brain git routes only — the management API remains Clerk-only.

### D2b-R1 — pages API

`GET /api/v1/brains/:id/pages` (Clerk-authed, owner-only) resolves the bare
repo's default branch (`symbolic-ref HEAD`, with an unborn-HEAD check so a
fresh repo returns `branch: null, pages: []` instead of erroring), lists
`*.md` blobs via `ls-tree -r --name-only`, reads each with `cat-file blob`,
and returns `{brain_id, branch, pages: [{path, frontmatter, content}]}`.
Frontmatter parsing is the brain convention's simple `key: value` block
(type/status/domain) — quoted values unquoted, malformed input ignored, never
fatal. Read-only; writes happen only via git.

### Storage

Migration `V33__brains_and_git_tokens.sql`: `brains` (id PK, user_id, path,
created_at) and `git_tokens` (id PK, user_id, token_hash UNIQUE, name,
created_at, last_used_at), applied by the existing refinery runner in
`DbHandle::new`.

## System requirement

The routes shell out to the **system `git` binary** (`init --bare`,
`http-backend`, `symbolic-ref`, `ls-tree`, `cat-file`). It must be on PATH for
the allternit-api process; every spawn failure surfaces as a 500 with a
"is git installed?" hint. No git libraries were added.

## Tests

Narrowest covering target: `cargo test -p allternit-api --lib brain_routes`
→ **8 passed, 0 failed** (0.84s). `cargo build -p allternit-api` compiles
clean (no new warnings).

- `git_token_mint_verify_revoke_hash_only_storage` — mint shape (`allternit_git_`
  + 32 hex), DB stores only the sha256 digest (plaintext absent from the row),
  verify + last_used stamping, unknown/wrong-prefix rejection, cross-user
  revoke denied, revoke kills the token.
- `constant_time_eq_matches_and_rejects` — the digest compare.
- `extract_git_token_bearer_and_basic` — Bearer and Basic parsing; a
  Clerk-JWT-shaped Bearer is never mistaken for a git token.
- `provisioning_and_per_user_isolation` (oneshot) — POST creates the bare
  repo on disk under `<brains_dir>/<user>/`, clone_url reflects forwarded
  proto/host; user B gets 404 on user A's pages and an empty list; fresh repo
  returns `branch: null, pages: []`.
- `pages_api_reads_frontmatter_from_seeded_repo` (oneshot) — real seeded bare
  repo: frontmatter type/status/domain parsed, body separated, non-markdown
  files skipped, cross-user 404.
- `cgi_env_is_constructed_for_http_backend` — the pure CGI env mapping,
  including HTTP_CONTENT_ENCODING omission when absent.
- `git_auth_gate_rejects_missing_bad_and_foreign_tokens` (oneshot) — 401 +
  WWW-Authenticate for missing/unknown tokens, valid-token-wrong-owner
  rejected, traversal rejected.
- `git_smart_http_push_pull_round_trip` — full round-trip through a live
  axum server + real `git http-backend`: clone over smart-HTTP with a Bearer
  token → commit a frontmatter page → push (receive-pack) → platform-side
  `read_brain_pages` sees it → second clone has the file. (Multi-threaded
  test runtime: the blocking git client would starve a current-thread
  executor hosting the server.)

## Notes for the gate

- Route mounting mirrors an existing precedent: protected and public routers
  already both nest `/api` and merge; the git router nests `/api/v1` on the
  public side with disjoint paths from the protected brain routes, so there is
  no route-table conflict.
- `git http-backend` (not a hand-rolled protocol) is the only git server
  code path, per the constraints.
- Tokens are never logged, never returned after mint, stored hashed.
- Gate round 1 finding (fixed): the `git http-backend` spawn originally
  inherited the full parent process environment (DB DSNs, JWT secrets, API
  keys). It now uses `.env_clear()` and passes only the explicit CGI vars plus
  `PATH` (needed for git's own upload-pack/receive-pack helper resolution);
  the live round-trip test re-verified push/pull through the cleared env.
