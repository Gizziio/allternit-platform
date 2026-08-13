# Allternit Parity Audit — Canonical Codebase

**Date:** 2026-08-13  
**Canonical repo:** `/Users/joe/Desktop/allternit-workspace/allternit`  
**Handoff source:** `/Users/joe/Desktop/allternit-parity-handoff.md`

## Executive summary

The Phase 0–9 parity work has been merged into `main` (`63d552fc9`). The canonical Rust API (`cmd/allternit-api`) wires the vast majority of the parity features as real Axum routes. TypeScript SDK, Python SDK, `gizzi-code`, and `cmd/cli` surfaces also contain the corresponding client-side implementations. The main remaining gaps are on the **documentation site**: many admin/enterprise/batch/evaluation endpoints exist in code but are not surfaced in `surfaces/docs`.

## Methodology

- Verified `cargo check -p allternit-api` and `pnpm -r typecheck` pass.
- Grepped `cmd/allternit-api/src/main.rs` for router merges.
- Cross-referenced deliverables in `allternit-parity-handoff.md` against files in the canonical tree.
- Checked `surfaces/docs/docs.json` and `surfaces/docs/**/*.mdx` for coverage.

## Codebase audit by parity area

### 1. Core API / harness / meter / batch / files

| Deliverable | Code location | Status |
|-------------|---------------|--------|
| Normalized reasoning/thinking, `cache_control`, JSON Schema `response_format`, `tool_choice`, `parallel_tool_calls`, strict tool schemas | `cmd/allternit-api/src/llm_gateway/translate.rs`, `proxy.rs` | ✅ Wired |
| OpenAI/Anthropic/Kimi request adapters | `cmd/allternit-api/src/llm_gateway/translate.rs`, `sdk/allternit-sdk/src/ai-runtime/harness/` | ✅ Wired |
| `Idempotency-Key` validation | `cmd/allternit-api/src/idempotency.rs` | ✅ Wired |
| Stable `allternit.*` error codes | `cmd/allternit-api/src/error.rs` | ✅ Wired |
| Per-model context window / max output metadata | `sdk/allternit-sdk/src/ai-runtime/harness/model-registry.ts` | ✅ Wired |
| `/v1/batches` create/list/get/cancel/results | `cmd/allternit-api/src/llm_gateway/batches.rs` | ✅ Wired |
| Provider-agnostic `citation` schema | `cmd/allternit-api/src/llm_gateway/citations.rs` | ✅ Wired |
| `/v1/tokens` deterministic estimator | `cmd/allternit-api/src/llm_gateway/estimation.rs` | ✅ Wired |
| `AllternitEmbeddings.create` | `cmd/allternit-api/src/llm_gateway/embeddings.rs` | ✅ Wired |
| `POST /v1/files` + `GET /v1/files/:id` | `cmd/allternit-api/src/llm_gateway/files.rs` | ✅ Wired |
| Public API idempotency middleware | `cmd/allternit-api/src/idempotency.rs` | ✅ Wired |
| Public API rate-limit enforcement (`429` + `Retry-After`) | `cmd/allternit-api/src/rate_limit.rs` | ✅ Wired |
| `service_tier: 'flex'`, cached-token usage, tiktoken counting | `cmd/allternit-api/src/llm_gateway/proxy.rs`, `cache.rs` | ✅ Wired |
| `thinking_delta` / `signature_delta` chunks | `cmd/allternit-api/src/llm_gateway/streaming.rs` | ✅ Wired |
| `PdfContentBlock`, PDF-to-markdown `pdf_process` tool | `cmd/allternit-api/src/llm_gateway/pdf.rs`, tool-belt | ✅ Wired |
| Vertex AI provider adapter | `sdk/allternit-sdk/src/ai-runtime/harness/` | ✅ Wired |

### 2. Agent runtime / memory / sessions / threads

| Deliverable | Code location | Status |
|-------------|---------------|--------|
| `/api/v1/beta/sessions` CRUD | `cmd/allternit-api/src/beta_session_routes.rs` | ✅ Wired |
| Child threads via `parent_thread_id` | `cmd/allternit-api/src/beta_session_routes.rs` | ✅ Wired |
| SSE event stream with standardized run events | `cmd/allternit-api/src/beta_session_routes.rs` | ✅ Wired |
| Token/turn/tool-call budgets + `budget_exceeded` | `cmd/allternit-api/src/beta_session_routes.rs` | ✅ Wired |
| WebSocket fanout `/beta/sessions/:id/events/ws` | `cmd/allternit-api/src/beta_session_routes.rs` | ✅ Wired |
| `beta_session_resources` create/list/delete | `cmd/allternit-api/src/beta_session_routes.rs` | ✅ Wired |
| `POST /beta/sessions/:id/interrupt` | `cmd/allternit-api/src/beta_session_routes.rs` | ✅ Wired |
| `/beta/deployments` CRUD + run history | `cmd/allternit-api/src/beta_deployment_routes.rs` | ✅ Wired |
| `/beta/work` lease/heartbeat/ack task queue | `cmd/allternit-api/src/beta_work_routes.rs` | ✅ Wired |
| `/beta/memory-stores` CRUD | `cmd/allternit-api/src/beta_memory_store_routes.rs` | ✅ Wired |
| SQLite-backed session memory service | `services/memory/agent/` | ✅ Wired |
| `cron_lite` expression parser | `cmd/allternit-api/src/cron_lite.rs` | ✅ Wired |
| `/beta/sessions` `context_window`/`truncation_strategy` | `cmd/allternit-api/src/beta_session_routes.rs` | ✅ Wired |
| `context_warning` event, `POST /beta/sessions/:id/context/edit` | `cmd/allternit-api/src/beta_session_routes.rs` | ✅ Wired |
| `SearchResultBlock` content block | SDK harness | ✅ Wired |
| Session-scoped resources (`github_token`, `vault_credential`, `api_key`) | `cmd/allternit-api/src/beta_session_routes.rs` | ✅ Wired |
| Session-scoped agent file store `/beta/sessions/:id/files` | `cmd/allternit-api/src/beta_session_routes.rs` | ✅ Wired |

### 3. Tools / sandbox / MCP / search / ACI

| Deliverable | Code location | Status |
|-------------|---------------|--------|
| Native `web_search` / `web_fetch` Tool Belt tools | `packages/@allternit/plugin-sdk/`, tool-belt | ✅ Wired |
| Namespace support, strict-mode JSON Schema validation | tool-belt | ✅ Wired |
| MCP server attachment to Tool Belt | `cmd/allternit-api/src/mcp_routes.rs`, `mcp_dispatcher.rs` | ✅ Wired |
| Tavily/Perplexity/Bing `web_search` adapters | tool-belt adapters | ✅ Wired |
| Anthropic-compatible `text_editor_20250124` tool | tool-belt | ✅ Wired |
| Computer-use schema aligned to `computer_20250124` | `cmd/allternit-api/src/aci_routes.rs` | ✅ Wired |
| MCP tunnel security scaffold (mTLS / OAuth) | `cmd/allternit-api/src/admin_mcp_tunnel_routes.rs` | ✅ Wired |
| Server-side MCP dispatcher (`attach/sync/call/list`) | `cmd/allternit-api/src/mcp_dispatcher.rs` | ✅ Wired |
| SDK MCP config connectors (stdio/http) | `sdk/allternit-sdk/src/ai-runtime/` | ✅ Wired |
| `~/.allternit/mcp-servers.json` directory loader | `cmd/gizzi-code/` | ✅ Wired |
| Image tool-input schema, `VisionContentBlock`, parallel tool execution | SDK harness | ✅ Wired |

### 4. gizzi-code / IDE / SDKs / surfaces

| Deliverable | Code location | Status |
|-------------|---------------|--------|
| `config.toml` auth profiles / default model / sandbox prefs | `cmd/gizzi-code/src/config/` | ✅ Wired |
| `gizzi exec` headless command | `cmd/gizzi-code/src/cli/commands/` | ✅ Wired |
| `allternit` admin CLI scaffold | `cmd/cli/src/commands/admin.ts` | ✅ Wired |
| `allternit admin` workspace/key/budget update & delete | `cmd/cli/src/commands/admin.ts` | ✅ Wired |
| `gizzi auth profile list|add|remove|set-active` | `cmd/gizzi-code/test/config/auth-profiles.test.ts` | ✅ Wired |
| Named permission profiles in `config.toml` | `cmd/gizzi-code/test/config/permission-profiles.test.ts` | ✅ Wired |
| Approval policy and sandbox preset config | `cmd/gizzi-code/src/config/` | ✅ Wired |
| `allternit admin mcp-tunnels list|create|rotate|delete` | `cmd/cli/src/commands/admin.ts` | ✅ Wired |
| `gizzi auth login --api-key`, `gizzi auth status` | `cmd/gizzi-code/src/cli/commands/auth.ts` | ✅ Wired |
| Pluggable credential store (`file`/`keyring`/`auto`) | `cmd/gizzi-code/src/config/credential-store.ts` | ✅ Wired |
| Agent permission policy DSL | `cmd/allternit-api/src/permission_policy.rs` | ✅ Wired |
| Formal SDK middleware hook system (`beforeRequest`/`afterResponse`/`onError`) | `sdk/allternit-sdk/src/ai-runtime/` | ✅ Wired |
| TypeScript SDK | `sdk/allternit-sdk/` | ✅ Wired |
| Python SDK (`allternit-python`) | `sdk/allternit-python/` | ✅ Wired |

### 5. Enterprise / admin / vault / budgets / compliance

| Deliverable | Code location | Status |
|-------------|---------------|--------|
| Admin API keys with RBAC | `cmd/allternit-api/src/admin_access_token_routes.rs` | ✅ Wired |
| Expiring CLI access tokens | `cmd/allternit-api/src/admin_access_token_routes.rs` | ✅ Wired |
| `AllternitVault` encrypted OAuth credential storage | `cmd/allternit-api/src/allternit_vault.rs` | ✅ Wired |
| Idempotency bound to authenticated virtual keys | `cmd/allternit-api/src/idempotency.rs` | ✅ Wired |
| `/api/v1/admin/workspaces` CRUD + members | `cmd/allternit-api/src/admin_workspace_routes.rs` | ✅ Wired |
| `/api/v1/admin/rbac_roles` + `/api/v1/admin/rbac_groups` CRUD | `cmd/allternit-api/src/admin_workspace_routes.rs` | ✅ Wired |
| `/api/v1/admin/external-keys` BYO KMS scaffold | `cmd/allternit-api/src/cloud_credentials_routes.rs` | ✅ Wired |
| `/beta/vaults` + credentials CRUD | `cmd/allternit-api/src/allternit_vault.rs` | ✅ Wired |
| Organization inference-hooks config + pre/post middleware | `cmd/allternit-api/src/inference_hooks.rs` | ✅ Wired |
| SCIM v2 `/Users` and `/Groups` | `cmd/allternit-api/src/scim_routes.rs` | ✅ Wired |
| Access Transparency `/admin/audit` feed | `cmd/allternit-api/src/admin_audit_routes.rs` | ✅ Wired |
| Compliance API scaffold | `cmd/allternit-api/src/compliance_routes.rs` | ✅ Wired |
| CMEK AWS KMS scaffold | `cmd/allternit-api/src/cloud_credentials_routes.rs` | ✅ Wired |
| `/api/v1/admin/service-accounts` CRUD + scoped API keys | `cmd/allternit-api/src/admin_service_account_routes.rs` | ✅ Wired |
| `/api/v1/admin/spend-limits` caps + increase-request flow | `cmd/allternit-api/src/admin_spend_limit_routes.rs` | ✅ Wired |
| `/beta/user-profiles` CRUD + signed enrollment URLs | `cmd/allternit-api/src/user_profile_routes.rs` | ✅ Wired |
| Outcome rubrics DSL + scoring API | `cmd/allternit-api/src/outcome_rubric_routes.rs` | ✅ Wired |
| Eval datasets / runs scaffold | `cmd/allternit-api/src/eval_routes.rs` | ✅ Wired |
| Fallback credit policy + ledger | `cmd/allternit-api/src/fallback_credit_routes.rs` | ✅ Wired |
| Admin analytics endpoints | `cmd/allternit-api/src/analytics_routes.rs` | ✅ Wired |
| Federation issuers/rules | `cmd/allternit-api/src/federation_routes.rs` | ✅ Wired |
| Managed agent quickstart state API | `cmd/allternit-api/src/quickstart_routes.rs` | ✅ Wired |
| Normalized cross-provider refusal detection | `cmd/allternit-api/src/llm_gateway/refusal.rs` | ✅ Wired |

### 6. Marketplace

| Deliverable | Code location | Status |
|-------------|---------------|--------|
| Marketplace routes | `cmd/allternit-api/src/marketplace_routes.rs` | ✅ Wired |
| Plugin/registry services | `services/registry/`, `platform/plugins/` | ✅ Wired |

### 7. Kimi / Qwen provider parity

| Deliverable | Code location | Status |
|-------------|---------------|--------|
| Kimi model/provider registry entries | `sdk/allternit-sdk/src/ai-runtime/harness/model-registry.ts`, `cmd/gizzi-code/src/runtime/providers/` | ✅ Wired |
| Qwen local runtime / kernel benchmark | `surfaces/ai.allternit.com/src/lib/local-models/bonsai-runtime/qwen-kernel-benchmark.ts` | ✅ Wired |

### 8. Docs

| Deliverable | Docs location | Status |
|-------------|---------------|--------|
| API reference (auth, endpoints, events, chat, agents, sessions, memory, files, sandbox) | `surfaces/docs/api/*.mdx` | ✅ Covered |
| CLI reference (overview, install, config, auth, headless, permission profiles, CI) | `surfaces/docs/cli/*.mdx` | ✅ Covered |
| Tools & ACI | `surfaces/docs/tools/*.mdx` | ✅ Covered |
| Security & Enterprise (overview, model, vault, compliance, audit, scim) | `surfaces/docs/security/*.mdx` | ✅ Covered |
| SDK (TypeScript, Python) | `surfaces/docs/sdk/*.mdx` | ✅ Covered |
| BYOC Runtime | `surfaces/docs/byoc/*.mdx` | ✅ Covered |
| Guides & cookbooks | `surfaces/docs/guides/*.mdx`, `surfaces/docs/cookbooks/*.mdx` | ✅ Covered |

## Docs gaps (verified missing from `surfaces/docs/docs.json` and `*.mdx`)

The following features exist in code but do **not** have dedicated docs pages in the Mintlify site:

1. **Admin API** — no top-level section exists
   - Workspaces / RBAC / groups
   - Service accounts
   - Spend limits / increase requests
   - MCP tunnels
   - Federation issuers / rules
   - Outcome rubrics / templates
   - Eval datasets / runs
   - Fallback credit policy / ledger
   - Admin analytics
   - Inference hooks
   - External keys / BYO KMS / CMEK
   - User profiles / enrollment URLs
   - Quickstart state API
2. **API Reference gaps**
   - `/v1/batches`
   - `/v1/embeddings`
   - Rate limits (`/v1/rate-limits`)
   - Webhooks (`/beta/webhooks`)
   - Work queue (`/beta/work`)
   - Deployments (`/beta/deployments`)
   - Agent file store (`/beta/sessions/:id/files`)
   - Context editing endpoint
3. **Guides gaps**
   - PDF / citations
   - Migration from OpenAI (only model-migration exists)
   - Webhook signature verification
   - BYOC deployment deep-dive for managed agents
4. **Release notes / changelog** — `CHANGELOG.md` may exist at repo root but is not linked in docs.

## Recommendations

1. Add an **Admin API** section to `surfaces/docs/docs.json` with stub/overview pages for every admin route group.
2. Add the missing API reference pages and link them from the top-level API Reference group.
3. Add a `security/rbac.mdx` page and an `security/external-keys.mdx` page.
4. Add a `guides/webhooks.mdx` page showing `X-Allternit-Signature` verification.
5. Surface `CHANGELOG.md` / release notes in the docs footer or a top-level page.
