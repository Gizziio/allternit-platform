# Allternit release notes

This page tracks major releases of the Allternit platform, SDK, and `gizzi-code` CLI. For a detailed commit-level log, see the [`CHANGELOG.md`](../../CHANGELOG.md) in the repository root.

## Release cadence

- **Platform releases** ship from the `parity/swarm-sprint` branch and are tagged `v<year>.<month>.<patch>`.
- **CLI releases** (`gizzi-code`) follow an independent semver schedule and are published to npm / the standalone installer.
- **Patch releases** include security fixes, provider adapter updates, and documentation corrections.

## 2026.08 — Agent packaging and admin control plane

Highlights:

- Added agent evaluation scaffold: `eval_datasets`, `eval_runs`, and per-run scoring under `/api/v1/admin/eval`.
- Added fallback credit policy and ledger: org admins can configure when a failed primary model request is credited back after a successful cross-provider fallback.
- Added normalized cross-provider refusal detection with `finish_reason: "refusal"` and usage-event marking.
- Added admin analytics endpoints for cost, token usage, request volume, and per-user spend.
- Added managed-agent quickstart checklist API.
- Added outcome rubric templates and weighted scoring.
- Added federation issuer/rule management for SSO-bound organizations.

## 2026.07 — Managed agents, MCP, files, and permissions

Highlights:

- Added server-side MCP dispatcher with attach/sync/call over stdio and HTTP/SSE.
- Added MCP tunnel management with mTLS and OAuth audience/issuer validation.
- Added session-scoped agent file store (`/beta/sessions/:id/files`).
- Added agent permission policy DSL with allow/ask/deny rules.
- Added Python SDK (`sdk/allternit-python`) with provider transforms and tests.
- Added Vertex AI provider adapter in the TypeScript harness.
- Added signed webhook delivery with `X-Allternit-Signature`.

## 2026.06 — SDK, skills, webhooks, and hooks

Highlights:

- Added formal SDK middleware hooks (`beforeRequest`, `afterResponse`, `onError`).
- Added built-in refusal/content-filter fallback middleware.
- Added skill registry loader and canonical `SKILL.md` format.
- Added PowerPoint skill and PDF processing skill.
- Added inference hooks execution engine with HMAC signing and mutation/abort semantics.

## 2026.05 — PDFs, citations, and OpenAI compatibility

Highlights:

- Added `PdfContentBlock` support and `/v1/files` file API.
- Added citation parsing, hydration, and RAG-attribution fallback.
- Added OpenAI batch shim and citation annotations in OpenAI-shaped responses.
- Added cache hints on tool definitions and large tool results.

## 2026.04 — User surfaces and distribution

Highlights:

- Added `gizzi config profile` and named permission profiles in `config.toml`.
- Added `allternit admin` workspace/key/budget CLI commands.
- Added deployment run history and work-queue lease/heartbeat/ack endpoints.
- Added session memory store endpoints and cron expression parser.

## 2026.03 — Core request/response parity

Highlights:

- Normalized reasoning/thinking, `cache_control`, JSON Schema `response_format`, `tool_choice`, and `parallel_tool_calls`.
- Added OpenAI/Anthropic/Kimi request adapters.
- Added idempotency key validation and stable `allternit.*` error codes.
- Added per-model context-window and max-output metadata.

## Deprecation policy

- A feature is marked **deprecated** at least one minor release before removal.
- Deprecated REST endpoints return a `Deprecation` header with a link to the migration guide.
- Provider/model deprecations are tracked in the [provider parity matrix](./providers/parity-matrix.md).

## How to upgrade

1. Review the [migration guides](./guides/migration-guides.md) for your current provider.
2. Run `gizzi update` (CLI) or update the SDK package to the latest version.
3. Check the [self-hosting BYOC guide](./self-hosting/byoc.md) for infrastructure changes.
