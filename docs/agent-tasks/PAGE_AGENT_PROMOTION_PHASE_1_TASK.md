# Page-Agent Promotion — Phase 1

**Goal:** Promote the existing Allternit extension page-agent integration into a shared service usable across all surfaces.

## Background
Allternit already has page-agent code:
- `surfaces/ai.allternit.com/src/lib/page-agent/config.ts`
- `surfaces/ai.allternit.com/src/lib/page-agent/runtime-client.ts`
- Extension-side bridge in `surfaces/allternit-extensions/allternit-extension/`
- Browser capsule integration in `surfaces/ai.allternit.com/src/capsules/browser/`

## Scope
1. Audit the existing page-agent implementation (extension + surface client + any backend routes).
2. Design a shared service package `services/page-agent/` (or `platform/page-agent/`) that owns:
   - Configuration schema
   - Runtime client
   - SSE/streaming protocol
   - Session lifecycle (run/stop/status)
3. Refactor `surfaces/ai.allternit.com/src/lib/page-agent/` to re-export from the shared package.
4. Add API routes under `/api/page-agent/*` in `cmd/allternit-api` that proxy to the page-agent service.
5. Ensure the browser capsule and extension continue to work with the new shared exports.
6. Validate with `cargo check -p allternit-api` and `tsc --noEmit` for touched surface files.

## Deliverables
- `services/page-agent/` or `platform/page-agent/` package with types, client, and service stub.
- Refactored `surfaces/ai.allternit.com/src/lib/page-agent/` re-exports.
- `cmd/allternit-api/src/page_agent_routes.rs` with proxy/stub routes.
- `docs/agent-tasks/PAGE_AGENT_PROMOTION_PHASE_1_NOTES.md` with YAML frontmatter.

## Constraints
- Match existing Allternit idioms: Rust axum routes, Zustand stores, `@/lib/*` imports.
- No git commits.
- If `pnpm install`/`bun x tsc` fails due to native deps, use the symlink workaround or root `node_modules/.bin/tsc` and grep changed files for errors.
