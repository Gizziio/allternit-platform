# Agent Work Attestation — Office add-in chat model resolution

- **Date:** 2026-09-08 10:46
- **Session ID:** model-resolve
- **Branch:** `session/model-resolve`
- **Agent:** kimi-code
- **PR:** #145 → merge `fdd92733378a0c4f6737346cde805cfd054737ef`

## What was done

Fixed the Office add-in pane hard-coding `claude-3-5-sonnet` as its chat
model. Against backends whose upstream catalog doesn't offer that model (the
verified live case: the local desktop gateway on 127.0.0.1:8013 proxying
gizzi on 127.0.0.1:4096) every chat request failed with
`400 model_not_found` and the pane showed an error banner.

Model resolution is now layered (add-in only, no gateway changes):

1. **Explicit advanced-panel model** — honored as-is.
2. **Runtime catalog** — an empty model (new default) resolves from
   `GET {baseURL}/v1/models` with the minted `ak-…` virtual key; first (or
   `default: true`-flagged) entry wins; cached per pane session; any failure
   falls through.
3. **`DEFAULT_OFFICE_MODEL`** — last resort only.

Stored configs carrying the legacy hard-coded default are treated as unset
(they predate resolution and 400 on gateways without that model). The
settings panel model field defaults to empty with an "Auto (resolved from
backend)" placeholder.

## How it works (file:line, at merge commit)

- `surfaces/allternit-extensions/allternit-office-addin/src/lib/model-resolution.ts` —
  `resolveBackendModel()` (session-scoped promise cache, 8 s timeout,
  graceful null on non-2xx/malformed/network error) and
  `pickModelFromList()` (default-flag preference, else first non-empty id).
- `…/src/agent/useOfficeAgent.ts` — `resolveRuntimeConfig()` wires the
  three layers; `DEFAULT_CONFIG.model` is now `''` (auto).
- `…/src/lib/agent-defaults.ts` — documents the last-resort semantics and
  the legacy-sentinel rule.
- `…/src/taskpane/components/OfficeConfigPanel.tsx` — empty model default +
  auto placeholder.
- Tests: `…/src/lib/model-resolution.test.ts`,
  `…/src/agent/useOfficeAgent.test.ts` (fixtures use the verified-known-good
  `subconscious/glm-5.2` from the live gizzi catalog).

## Verification

- `npm run typecheck` ✅, `npm test` ✅ 157/157 (13 new), `npm run build` ✅
  (re-run after rebase onto main @ a6bb0a6df — all still green).
- **Built bundle, Playwright (chromium-1234, /tmp/pwtest) against a local
  stub backend** (`/tmp/model-resolve-verify.cjs`, scratch, not committed):
  - Scenario A — stub serves `GET /v1/models` with `subconscious/glm-5.2`:
    the pane requested the catalog with `Authorization: Bearer ak-…` and sent
    the chat completion with model `subconscious/glm-5.2`, **not**
    `claude-3-5-sonnet`. Screenshot: `/tmp/model-resolve-A-catalog.png`.
  - Scenario B — stub `/v1/models` 401: pane fell through to
    `claude-3-5-sonnet` (documented last resort).
- PR checks: Vercel builds failed with "Deployment rate limited — retry in
  24 hours" (pre-existing infra condition on this repo, unrelated to the
  change; Cloudflare Pages check passed/pending at merge time).

## Incidents / live-check status (honest)

- **Gateway does not serve `/v1/models` to `ak-…` keys on current main.**
  Live-verified 2026-09-08: fresh `ak-…` key minted via
  `POST http://127.0.0.1:8013/api/v1/gateway/keys` with the desktop runtime
  token → `GET /v1/models` with that key → **401 `Invalid token`** (no-auth
  401, runtime token 403). The Fabric model catalog owns `/v1/models` behind
  the Clerk/access-token middleware (`cmd/allternit-api/src/main.rs:847`)
  and rejects virtual keys. Consequently, on this gateway the pane's catalog
  fetch 401s today and resolution falls back to the hard-coded default until
  the gateway exposes an ak--readable, availability-filtered model list
  (suggested follow-up, deliberately out of scope — add-in-only fix).
- Related live probes: `POST /v1/chat/completions` with the `ak-` key accepts
  routing aliases `allternit-balanced` / `auto` (200) and
  `claude-cli/…` / `kimi-cli/kimi-for-coding` (200);
  `subconscious/glm-5.2` → 502 at probe time (upstream flaky; verified 200 by
  shell earlier per the task brief). `GET /v1/pricing` accepts the `ak-` key
  but returns a global 7120-entry models.dev list — not availability-filtered,
  so not usable as a resolution source.
- Local gizzi on 4096 was down at session start (desktop app not running);
  started `gizzi serve --port 4096` for the catalog probes, killed at
  cleanup. The wedged `gizzi serve --port 4097` process (another session,
  98% CPU) was left untouched, as was the gateway on 8013 (PID 4627, started
  by another session's orchestrator).

## Honest deferrals

- End-to-end chat against the real 8013 gateway with a resolved model not
  demonstrated, because the gateway currently rejects `/v1/models` for `ak-`
  keys (see Incidents). The add-in side of the contract is verified end to
  end with the stub; the gateway side is flagged as follow-up.
- Two probe virtual keys minted on the local gateway during verification
  (`office-addin-model-resolve-check`, and one cached by the pane's minting
  flow in the Playwright profile) — the first was noted for deletion;
  ephemeral headless profile keys die with the profile. No production state
  touched.

## Files changed (PR #145)

- `…/allternit-office-addin/src/lib/model-resolution.ts` (new)
- `…/allternit-office-addin/src/lib/model-resolution.test.ts` (new)
- `…/allternit-office-addin/src/agent/useOfficeAgent.test.ts` (new)
- `…/allternit-office-addin/src/agent/useOfficeAgent.ts`
- `…/allternit-office-addin/src/lib/agent-defaults.ts`
- `…/allternit-office-addin/src/taskpane/components/OfficeConfigPanel.tsx`
- `.steering/checkpoint.md` (steering checkpoint; conflict on rebase resolved
  in favor of the other active session's state, this attestation is the
  durable record)
