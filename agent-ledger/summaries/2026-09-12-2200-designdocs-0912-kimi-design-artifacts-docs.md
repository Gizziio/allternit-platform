# designdocs-0912 — Public docs: A:// Studio design + artifacts section

## What was done
Wrote the public docs for the entire design/artifacts program (previously documented only in internal docs: docs/design/artifacts-api.md, surfaces/ai.allternit.com/DESIGN.md, ledger summaries). New section `docs/public/design/`:

- `index.md` — overview of the design surface (web + desktop + `/design` CLI entry), the a:// model, honest limits (local-first, publish keeps deployment history, sandbox is the spec).
- `design-mode.md` — skills+inputs form, model picker, aspect pills, click-to-target surgical edits (data-aio-id, postMessage channel), edit-in-place AST two-way binding (setText/setAttributes/innerHtml, byte-preserving), critique (latest-turn images, vision parts where supported), render-and-compare self-verification, gallery (capture-on-save, lazy thumbnails, click-to-remix, 10-version history), `/design` ack receipt, sandbox + exact CSP policy.
- `artifacts.md` — a://artifact/<id>[@gateway] addressing, full /api/v1/content-artifacts route table (CRUD, versions, cursor list, files tree), idempotency semantics, 50-version retention cap (ALLTERNIT_CONTENT_ARTIFACT_MAX_VERSIONS), typed renderers (deck/mobile/prototype), publish semantics (shared project, per-user u-<sha12(user_id)>/<artifact_id> routes, immutable version snapshot, route-only unpublish, 422 sandbox-policy gate, wrangler/fs publishers via ALLTERNIT_ARTIFACT_PUBLISHER), org relay (new local id, provenance.relay chain, token-gated /relay/inbox, idempotent by bundle hash, @gateway read-through), security model (API stores/serves, never executes).

## How it works / grounding
Every command, route, env var, and limit in the docs was verified against merged code before writing (spot checks: content_artifact_relay.rs INBOX_PATH, content_artifact_publish.rs u-<sha256[:12]> prefix, content_artifact_file_routes.rs files/*path, env var names in content_artifact_routes.rs / content_artifact_publish.rs). One path corrected during review (relay inbox full path).

## Verification
Docs-only PR (#449, merged). No code change, no release-path touch, no desktop rebuild (docs are not bundled). Content review against source.

## Incidents
- The originally assigned subagent (agent-28) died on a subagent quota 403 before writing anything; the parent agent adopted the worktree and completed the session.

## Deferrals
- Relay/vercel nav index: docs/public has no hand-maintained section index (navigation appears generated from the tree); resources-overview.md is a resource-path index, not a docs TOC, so no edit was made there.
