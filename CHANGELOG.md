# Changelog

All notable changes to the Allternit platform, API, SDKs, and `gizzi-code` CLI are tracked in this file. For a higher-level, release-by-release summary, see [`docs/public/release-notes.md`](./docs/public/release-notes.md).

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [Unreleased]

### Added

- `cmd/allternit-api/migrations/V71__eval_runs.sql` — `eval_datasets` and `eval_runs` tables for agent evaluation.
- `cmd/allternit-api/src/eval_routes.rs` — `/api/v1/admin/eval/datasets`, `/api/v1/admin/eval/runs`, and `/runs/:id/scores` CRUD endpoints.
- `cmd/allternit-api/migrations/V72__fallback_credits.sql` — fallback credit policy, ledger, and `llm_usage_events.fallback_from_event_id`.
- `cmd/allternit-api/src/fallback_credit_routes.rs` — admin endpoints to configure fallback credit policy, reconcile credits, and apply credits to org spend.
- `docs/public/release-notes.md` and `docs/public/guides/migration-guides.md` — release notes index and migration guide landing page.

### Changed

- Updated `/Users/joe/Desktop/allternit-parity-handoff.md` to reflect Phase 9 slices 9 and 10.

## [2026.08.09] — Phase 9 admin control plane closes (in progress)

### Added

- Admin MCP tunnels management API with mTLS/OAuth validation.
- Outcome rubrics DSL, scoring, and global templates.
- Admin analytics endpoints for cost, token usage, request volume, and per-user cost.
- Managed agent quickstart checklist API.
- Federation issuer/rule CRUD.
- Normalized cross-provider LLM refusal detection.

## [2026.07.31] — Phase 8 managed agents / admin / MCP / files

### Added

- Service account CRUD with scoped API keys and rotation.
- Spend limits and increase-request approval flow.
- User profile enrollment with signed URLs.
- Server-side MCP dispatcher and SDK connectors.
- Agent permission policy DSL and approval store.
- Session-scoped agent file store.

## [2026.07.15] — Phase 7 SDKs / skills / webhooks / hooks

### Added

- Vertex AI provider adapter.
- Signed webhook delivery with HMAC-SHA256.
- Skill registry loader and `SKILL.md` format.
- Python SDK with provider transforms.
- Inference hooks execution engine.

## [2026.06.30] — Phase 6 PDF / citations / OpenAI-compat

### Added

- PDF content blocks and file API.
- Citations service and RAG attribution fallback.
- `pdf_process` Tool Belt tool.
- OpenAI batch shim and SDK citation annotations.

## [2026.06.15] — Phase 5 SDK / API parity closes

### Added

- Model registry metadata and `service_tier: 'flex'` support.
- Context window editing and warnings.
- Vision input and tool-use-with-images support.
- SDK middleware hook system.
- Batch worker execution and error handling.

## [2026.05.31] — Phase 4 Docs / GTM

### Added

- Public API reference and provider parity matrix.
- Gizzi CLI and SDK quickstart documentation.
- Admin, security, and self-hosting documentation.

## [2026.05.15] — Phase 3 Enterprise control plane

### Added

- Public API idempotency and rate-limit middleware.
- Session-scoped resources.
- MCP tunnel security scaffold.
- SCIM v2 endpoints and compliance API.

## [2026.04.30] — Phase 2 User surfaces & distribution

### Added

- SDK retry/backoff interceptor and rate-limits endpoint.
- Deployment, work-queue, and memory-store endpoints.
- `gizzi config profile` and permission profiles.
- Workspace and RBAC admin endpoints.

## [2026.04.15] — Phase 1 Agent runtime & tools

### Added

- Batch Messages API and token-counting endpoint.
- WebSocket session events and interrupt endpoint.
- Native web search/fetch, text editor, bash, and memory tools.
- Agent runtime dispatcher.

## [2026.04.01] — Phase 0 Core request/response parity

### Added

- OpenAI-compatible chat completions gateway.
- Anthropic/OpenAI/Kimi provider adapters.
- Reasoning, cache control, JSON schema response format, and tool choice.
- Admin API keys, vault, and idempotency.
