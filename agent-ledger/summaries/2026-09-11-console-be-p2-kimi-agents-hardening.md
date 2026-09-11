# Attestation — session/console-be-p2 (console backend phase 2)

**Date:** 2026-09-11 (session ran afternoon)
**Agent:** kimi-code
**PR:** #355 (merge `ca666a9ba`)
**Topic:** Agents hardening — PATCH, first-class is_bot, version snapshots, toolset permissions + enforcement

## What was done

Phase 2 of the approved 10-phase "no stubs" console backend plan (G4–G5).

- **V143__agent_hardening.sql**: `agents.is_bot` (backfilled from config JSON blob via json_extract, camelCase + snake_case spellings; column now authoritative, blob write-through), `tool_permissions` + `mcp_connector_ids` JSON columns, `agent_versions` snapshot table + index.
- **agent_routes.rs**: shared AGENT_SELECT/read_agent_row/snapshot_agent_version helpers (deduplicated triplicated column mapping); PATCH /agents/:id (merge semantics, strict 404/400, version bump + snapshot); `?is_bot=true|false` list filter; PUT /agents/:id/toolset (tools/allowed_tools/allowed_skills/MCP connectors/per-tool permissions with 400 validation) + snapshot on every mutation.
- **cloud_agents_routes.rs**: `compute_effective_permissions` at session create — always_allow→all allow, always_ask→all ask, auto→per-tool map (unset=allow) — stored in session metadata, echoed top-level.
- **beta_work_routes.rs**: lease payload carries optional `effective_permissions` (older tasks/workers unaffected).
- **beta_session_routes.rs**: `tool_calls` events gated at write time — `ask` calls get `requires_approval: true` + per-call `approval_id`, pending request enqueued in the existing `permission_policy::ApprovalStore`. No second approval store. Enforcement boundary documented in module docs: payload+flag for external workers, in-process gating at event-write.

## Verification evidence

- `cargo test -p allternit-api`: **910 passed, 5 failed** — failures exactly the 5 known pre-existing environment-dependent tests (4× agent_cloud real-OS-control-plane, 1× rails gate round-trip). 14 new tests green, incl. a V143 backfill test applying the real migration SQL against a simulated pre-V143 DB.
- Live smoke (port 18099, temp data dir): PATCH version bump + 404/400; toolset PUT/GET round-trip + 400s; is_bot create/filter/echo; session create `always_ask` → all-ask effective_permissions; lease payload carries map; tool_calls event flagged with approval_id.
- `node scripts/release-preflight.mjs`: 35 passed, 0 failed.

## Incidents / deviations

- PUT update_agent now also snapshots versions (spec read as "every successful mutation"); its `{"success": true}` response shape unchanged.
- `POST /agents` response shape unchanged (additive `is_bot` only) for SDK compatibility.
- Legacy `POST /beta/sessions` create path has no permission-mode input; sessions created via the beta alias carry no map (consistent optional-field design).
- effective_permissions normalize to allow/ask for workers; the always_allow|always_ask|auto vocabulary lives on the agent toolset surface.
- Pre-merge main had moved (designlaw/wordmark sessions); merge conflict only in `.steering/checkpoint.md` (resolved keeping this session's); code files merged clean, but the merged-backend test run predates that merge — overlap was nil (frontend-token-only changes).

## Honest deferrals

- Phases 3–10 remain (deployment scheduler, memory-store contents, tags/costs/batch metering, caching analytics, webhooks v2, residency + org rate limits, Stripe credits wiring, gizzi telemetry + announcements).
