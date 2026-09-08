# Steering checkpoint — session/model-resolve

## Goal
Fix the Office add-in pane hard-coding `claude-3-5-sonnet` (400 model_not_found on
gateways whose catalog doesn't have it). Implement model resolution:
1. explicit advanced-panel model wins,
2. runtime catalog `GET {chat-backend}/v1/models` with the minted `ak-` key,
   first/default entry, cached per session, fall through on failure,
3. `DEFAULT_OFFICE_MODEL` only as last resort.
Then PR + merge + ledger attestation per AGENTS.md ritual.

## Just did
- Implemented `src/lib/model-resolution.ts` (session-cached `resolveBackendModel`,
  `pickModelFromList` with default-flag preference) + wired into `resolveRuntimeConfig`
  (explicit non-default model wins; legacy claude-3-5-sonnet stored value treated as unset;
  empty model = auto; hard-coded default last resort). DEFAULT_CONFIG.model now ''.
- Config panel: model field empty by default, placeholder "Auto (resolved from backend)".
- Unit tests: src/lib/model-resolution.test.ts + src/agent/useOfficeAgent.test.ts
  (fixtures use subconscious/glm-5.2 from the live gizzi catalog on :4096).
- Created worktree `allternit-session-model-resolve` on `session/model-resolve` from `origin/main` (f2184ac74).
- Live verification against the running stack:
  - gizzi on 4096 was DOWN (desktop app not running); started `gizzi serve --port 4096` locally.
    `GET /v1/provider` → 200, catalog offers `subconscious/glm-5.2` (+ 7512 models across 227 providers; `connected` = availability).
  - Gateway on 8013 is UP (debug binary PID 4627 started by another session's orchestrator at 9:45AM).
  - Minted fresh ak- key via `POST /api/v1/gateway/keys` with the runtime token → 200 `ak-tyHKvlRg...`.
  - **`GET /v1/models` with the ak- key → 401 "Invalid token"** — the Fabric catalog owns `/v1/models`
    and sits behind Clerk/auth middleware (`cmd/allternit-api/src/main.rs:847`), which does not accept
    ak- virtual keys. No-auth → 401, runtime token → 403. This contradicts the task assumption; will
    implement per spec anyway and note honestly in the PR (task caveat covers this).
  - `POST /v1/chat/completions` with ak-: `subconscious/glm-5.2` → 502 right now (flaky upstream;
    user verified 200 earlier), `allternit-balanced` / `auto` / `kimi-cli/kimi-for-coding` → 200,
    `claude-3-5-sonnet` → 400 model_not_found (the bug).
  - `/v1/pricing` with ak- works but is a global 7120-entry models.dev list — NOT availability-filtered.

## Next
- (in progress) pnpm install --frozen-lockfile at worktree root (npm install + flattened
  node_modules copy both broke pnpm-style type resolution in extension-shared; pnpm is the
  known-good path used by the shared checkout).
- Then: typecheck/test/build, Playwright bundle check (script ready at /tmp/model-resolve-verify.cjs,
  stub backend on :8123 + built bundle via vite preview on :3000, chromium-1234), PR.

## Open questions
- Gateway-side gap: `/v1/models` rejects ak- keys on current main. Flagged for parent/human;
  out of scope (add-in-only change). Fallback chain keeps pane functional: explicit → /v1/models →
  hard-coded default. On this gateway the fetch 401s → falls back (bug persists locally until the
  gateway exposes an ak--readable catalog or the pane points at a backend that serves /v1/models).
