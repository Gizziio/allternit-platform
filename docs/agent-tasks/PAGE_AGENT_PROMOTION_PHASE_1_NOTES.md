---
title: Page-Agent Promotion — Phase 1 Notes
phase: 1
goal: Promote the existing Allternit extension page-agent integration into a shared service usable across all surfaces.
status: complete
updated: 2026-08-13
---

# Page-Agent Promotion — Phase 1 Notes

## What changed

### 1. Shared service package
Created `services/page-agent/` with the canonical page-agent code that was previously duplicated or scattered across the surface:

- `src/config.ts` — `PageAgentBridgeConfig` schema and helpers (`buildPageAgentBridgeConfig`, `hasPageAgentBridgeConfig`, `normalizePageAgentLanguage`).
- `src/types.ts` — `PageAgentStatus`, `PageAgentActivity`, `PageAgentHistoricalEvent`, `PageAgentSessionRecord`, `PageAgentSession`, `PageAgentRunResult`.
- `src/client.ts` — endpoint helpers (`getPageAgentRunEndpoint`, `getPageAgentStreamEndpoint`, `getPageAgentStopEndpoint`, `getPageAgentStatusEndpoint`, `getPageAgentConfigEndpoint`) and the runtime client (`runPageAgentTask`, `stopPageAgentTask`) ported from `gizzi-brain-client.ts`.
- `src/service.ts` — `PageAgentService` stub exposing `run`, `stop`, `status`, `list`, and `remove` lifecycle methods.
- `src/index.ts` — barrel exports.
- `package.json` / `tsconfig.json` — TypeScript package scaffold.

### 2. Surface refactor
- `surfaces/ai.allternit.com/src/lib/page-agent/config.ts` now re-exports from `@allternit/page-agent`.
- `surfaces/ai.allternit.com/src/lib/page-agent/runtime-client.ts` now re-exports from `@allternit/page-agent`.
- Added `surfaces/ai.allternit.com/src/lib/page-agent/index.ts` as a backwards-compatible barrel.
- Added `@allternit/page-agent` path mapping to `surfaces/ai.allternit.com/tsconfig.json`.
- `surfaces/ai.allternit.com/src/capsules/browser/browserAgent.store.ts` now imports `PageAgentActivity`, `PageAgentHistoricalEvent`, and `PageAgentStatus` from `@/lib/page-agent` instead of defining them locally.
- `surfaces/ai.allternit.com/src/capsules/browser/gizzi-brain-client.ts` is now a thin re-export wrapper over `@/lib/page-agent` so existing `./gizzi-brain-client` imports keep working.

### 3. API routes
Added `cmd/allternit-api/src/page_agent_routes.rs` with proxy/stub routes under `/api/page-agent/*`:

- `POST /api/page-agent/run`
- `GET /api/page-agent/stream/:session_id`
- `POST /api/page-agent/stop/:session_id`
- `GET /api/page-agent/status/:session_id`
- `POST /api/page-agent/config`

The routes are mounted in `cmd/allternit-api/src/main.rs` behind the existing auth middleware. Phase 1 proxies run/stop/stream to the local gizzi brain runtime (`http://127.0.0.1:4096`, overridable via `ALLTERNIT_PAGE_AGENT_URL`); `config` echoes the payload as a validation stub.

### 4. Extension / browser capsule compatibility
The extension-sidepanel imports (`PageAgentActivity`, `PageAgentHistoricalEvent`, `PageAgentSessionRecord`, `PageAgentStatus`) continue to flow from `browserAgent.store.ts`, which now re-exports the shared types. The extension bridge (`useExtensionBridge.ts`) still reads `PageAgentBridgeConfig` from `@/lib/page-agent/config`.

## Validation
Run after changes:

```bash
cargo check -p allternit-api
cd surfaces/ai.allternit.com && pnpm exec tsc --noEmit
```

## Open questions / Phase 2
- Replace the gizzi-brain proxy with a persistent server-side session store and an in-process page-agent runtime client.
- Decide whether `services/page-agent` should be published as `@allternit/page-agent` or consumed via workspace path by additional surfaces (e.g., `surfaces/allternit-extensions/allternit-extension`).
- Wire `POST /api/page-agent/config` to real persistence and surface-driven config sync.
