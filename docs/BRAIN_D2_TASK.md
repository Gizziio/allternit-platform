# D2 TASK — platform brain remotes + read API

You are the executor. `.steering/spec.md` (D2a-R1..R3, D2b-R1 + acceptance) is
the source of truth. D1 (`gizzi brain init`) is merged — this is the platform
side its `--remote` flag points at. Work in `cmd/allternit-api`.

## Workflow rules

1. Update `.steering/checkpoint.md` at checkpoints; [steering] is authoritative.
2. Done → `docs/BRAIN_D2_NOTES.md` with YAML frontmatter, then
   `touch docs/BRAIN_D2_NOTES.sentinel`.
3. Then commit: `git add cmd .steering docs && git commit -m "feat(allternit-api): hosted brain remotes + git tokens + pages API (D2)"`.
   A gate reviews; fix and retry if blocked.

## Build

1. **D2a-R1 provisioning** (`POST /api/v1/brains`): create a per-user bare git
   repo under a platform data dir (follow existing config for data roots;
   e.g. `<data>/brains/<user_id>/<brain_id>.git` via `git init --bare`),
   return `{brain_id, clone_url}`. Isolation: users only see their own
   (route through the existing auth middleware; look at how other
   per-user resources are scoped).
2. **D2a-R2 git smart-HTTP**: serve push/pull on those repos by proxying to
   `git http-backend` (CGI bundled with git) — in Rust/axum this means
   spawning the CGI with the right env (GIT_PROJECT_ROOT, PATH_INFO,
   REQUEST_METHOD, CONTENT_TYPE, QUERY_STRING, HTTP_CONTENT_ENCODING) and
   streaming request/response bodies. Auth-gated by the new git token (R3).
3. **D2a-R3 git tokens**: new credential type `allternit_git_` +
   32-hex random; `POST /api/v1/tokens/git` mints (returns the token ONCE,
   stores only its sha256 hash), `DELETE /api/v1/tokens/git/:id` revokes,
   `GET /api/v1/tokens/git` lists (id, created, last_used, never the token).
   Git endpoints accept `Authorization: Basic base64(user:allternit_git_...)`
   or `Bearer allternit_git_...` — scoped to brain git routes ONLY.
4. **D2b-R1 pages API**: `GET /api/v1/brains/:id/pages` — read the bare
   repo's default branch (git archive or cat-file via CLI), return markdown
   pages with parsed frontmatter (type/status/domain) as JSON. Read-only.
5. **Storage**: brain registry (id, owner, created, path) in the platform's
   existing store (find how other resources persist — SQLite? follow it).
6. **Tests**: unit tests for token mint/verify/revoke (hash-only storage,
   constant-time compare), provisioning isolation (user A can't read user
   B's), pages API on a seeded repo (frontmatter parsing). For smart-HTTP, a
   test that the CGI env is constructed correctly + the auth gate rejects
   bad tokens; a full push/pull round-trip test if the crate has HTTP-test
   precedent (the oneshot pattern used in rails handler tests).
   `cargo build -p allternit-api` compiles; run the narrowest test target
   covering your modules and record it in NOTES.

## Constraints

- No bespoke git protocol code — http-backend CGI only.
- Tokens are never logged, never returned after mint, stored hashed.
- Match cmd/allternit-api route/auth/config conventions (look at
  oauth_routes or rails mod for handler patterns).
- `git` binary presence: shell out to the system git (document the
  requirement in NOTES).
