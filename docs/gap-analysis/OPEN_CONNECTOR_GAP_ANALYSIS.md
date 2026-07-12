# Gap Analysis: Allternit Connectors vs. open-connector (oomol-lab)

> Research conducted: 2026-07-11
> Reference: https://github.com/oomol-lab/open-connector (Apache-2.0, TypeScript, 1.3k stars, created 2026-06-29)
> Goal: Compare Allternit's "one-click app connection" systems against open-connector's architecture and identify concrete gaps worth closing.

---

## 0. TL;DR

Allternit doesn't have *one* connector system — it has **three**, built at different times with different philosophies, none of which reach open-connector's combination of **breadth** (1,000+ providers), **depth** (every listed provider actually executes), and **protocol surface** (SDK/CLI/MCP/HTTP/OpenAPI all backed by one contract). The most functional Allternit system (System C, the Rust "owned connector standard") has the right shape — catalog + declarative metadata + generic dispatcher — but only **3 of its 181 catalog entries actually work end-to-end**. The other two systems (a TS interface/registry with 3 connectors, and 15 hand-written stdio-MCP servers requiring manual env-var tokens) are dead ends or manual-auth-only. There is no MCP surface, no OpenAPI generation, no SDK/CLI package, and no automatic token refresh anywhere in Allternit today.

The single highest-leverage move is **not** "add more providers by hand" — it's adopting open-connector's core insight: **separate the provider catalog (data) from the execution engine (code) so contributors can add a provider without touching the runtime**, then pointing that engine at MCP as a first-class surface, since that's how agents will actually consume connectors.

---

## 1. What Allternit has today

### System A — `mcp/connectors/` (TypeScript interface/registry)
Abstract `Connector` class + in-memory `Map` registry. Only 3 concrete connectors (Slack, GitHub, PostgreSQL) using official vendor SDKs. CLI `configure` command is explicitly unfinished. This is the closest analog to open-connector's *shape* (a pluggable interface) but was abandoned before it scaled past 3 providers.

### System B — `domains/cowork/connectors/*` (15 stdio-MCP servers)
Each connector is a hand-rolled TS package reimplementing MCP's JSON-RPC framing from scratch (no shared MCP SDK). 15 services (Slack, GitHub, Notion, Linear, Jira, Google Workspace, HubSpot, Figma, Asana, Salesforce, Zendesk, Vercel, Okta, Monday, Discord). Auth is **entirely manual**: an operator sets env vars (`SLACK_BOT_TOKEN`, `GITHUB_TOKEN`, ...) and the UI just checks whether the var is present — there is no in-app OAuth flow, no encryption at rest, no token refresh. "Connected" means "someone pasted a secret into an env file."

### System C — Rust "owned connector standard" (`cmd/allternit-api/src/connector_routes.rs`)
The current strategic direction, and structurally the most sophisticated:
- **Catalog** (`connectors.json`): 181 entries (id/name/category), vendored from what looks like an Open-Design/Composio-derived list.
- **Meta** (`connectors.meta.json`): auth type, OAuth endpoints, scopes, declarative `tools[]` (REST templates). **Only 3 entries are hand-curated (github, notion, slack).** The other 178 get a `synthesize_meta()` stub with no real OAuth endpoints — they render as "connectable" in the UI but fail with `owned_oauth_endpoint_mapping_needed` if clicked.
- **Auth types**: `local_cli` (shell out to an installed CLI, e.g. `gh auth token`), `oauth2` (loopback callback, PKCE flagged but not actually implemented), `device_flow` (RFC 8628), `api_key`.
- **Storage**: SQLite `connector_connections` table, AES-256-GCM at rest (`token_crypto.rs`), OS-keychain-backed key, fail-closed decryption. This part is genuinely solid — arguably ahead of open-connector's "encryption is opt-in via an env var, off by default in dev" model.
- **Execution**: in-process `reqwest` calls, either hand-written dispatch (GitHub only) or the generic `generic_dispatch` driven by `meta.tools[]` — no code needed for a new REST operation once metadata exists. No sandboxing, but also no arbitrary code execution, since it's declarative REST only.
- **Refresh**: manual, user-triggered (`POST /connectors/:id/refresh`). No background scheduler.
- **UI**: `ConnectorModal.tsx` (Design surface, one-click, OAuth popup) — but there's a *second*, separately-implemented connector browsing UI in Plugin Manager (`BrowseConnectorsOverlay.tsx` / `ConnectorConnectModal.tsx`) hitting a different "marketplace" API. Two UIs, two mental models, not unified.

### Docs / governance
No ADR reconciling the three systems exists (unlike the precedent `ADR_PROVIDER_FORK_STRATEGY.md` pattern). One forward-looking blueprint (`BLUEPRINT-ALLTERNIT_WORKFLOW_BLUEPRINTS_WITH_CONNECTORS.md`) proposes a per-connector `.allternit/connectors/*.json` file format that **doesn't match** what System C actually implements — it's aspirational, not as-built.

---

## 2. What open-connector has

- **Scale**: 1,000+ providers under `src/providers/<service>/`, each with a `definition.ts` (source of truth: schemas, scopes, auth type) and a lazy-loaded `executors.ts` (only pulled in when an action actually runs). Catalog JSON is *generated* from definitions (`npm run generate:catalog`), never hand-edited — this is the key structural difference from Allternit's vendored, largely-unmaintained 181-entry JSON.
- **Auth models**: `api_key`, `oauth2` (with real client-config storage + token refresh), `custom_credential`, `no_auth` — all through one uniform `/api/connections` contract and one `Connection Identity` concept (`accountId`, `displayName`, `grantedScopes`) that's surfaced back to agents so they know *which account* an action will run as without ever seeing the raw token.
- **Protocol surface**: MCP (`POST /mcp`, stateless JSON-RPC, `list_apps`/`search_actions`/`get_action_guide`/`execute_action` tools), HTTP `/v1/*` with a uniform envelope, generated OpenAPI (`/openapi.json`), a per-action agent-readable markdown guide (`/api/actions/:id/agent.md`), plus an official SDK and CLI (`oo`) as separate maintained packages. Allternit has none of MCP/OpenAPI/SDK/CLI for its connector layer today (System B *is* MCP-shaped internally, but each server hand-rolls JSON-RPC rather than exposing one unified MCP endpoint across all connectors).
- **Credential storage**: SQLite (Docker/Node) or Cloudflare D1 (Workers), AES-256-GCM, `OOMOL_CONNECT_ENCRYPTION_KEY`. Roughly on par with Allternit System C, except Allternit's key auto-provisions from the OS keychain on first run (arguably better default) vs. open-connector's explicit opt-in with a startup warning if unset.
- **Execution status transparency**: catalog responses expose `locallyExecutable` / `catalogOnly` / `needsCredential` / `noAuthRunnable` per action — i.e., the catalog is *honest* about what's wired vs. just listed. This is exactly the distinction Allternit is currently missing: System C's UI shows 181 "connectable" entries with no signal that 178 of them are non-functional stubs.
- **Extensibility contract**: adding a provider means writing `src/providers/<service>/definition.ts` + `executors.ts` and running a codegen step — no runtime/server code changes. `CONTRIBUTING.md` documents this as the entire onboarding path, plus an agent-automatable skill (`.codex/skills/add-provider/SKILL.md`) for AI-assisted provider addition.
- **Deployment flexibility**: local Docker/Node, Fly.io (persistent volume), Cloudflare Workers (D1 + R2 + Static Assets) — same provider/action contracts across all three, plus a hosted commercial option (OOMOL) for teams blocked on OAuth app approval.
- **Policy & observability**: allow/block action policies, runtime tokens, redacted run logs, temporary file transit with cleanup — none of this exists in Allternit's connector layer today.

---

## 3. Dimension-by-dimension gap table

| Dimension | Allternit today | open-connector | Gap |
|---|---|---|---|
| Provider breadth (actually working) | 3 fully wired (github, notion, slack), 178 stubs, 15 manual-token via System B | 1,000+, all code-verified via `executors.ts` | **Severe** |
| Provider onboarding | Hand-edit vendored JSON + write Rust dispatch for anything not covered by generic REST templating | Add `definition.ts` + `executors.ts`, run codegen — no server changes | **Large** — no codegen, no per-provider test harness |
| Catalog honesty | UI shows all 181 as "connectable"; failure only surfaces on click | Catalog exposes `locallyExecutable`/`catalogOnly`/`needsCredential`/`noAuthRunnable` per action | **Medium** — cheap fix, high UX payoff |
| Auth models | local_cli, oauth2 (no real PKCE), device_flow, api_key | api_key, oauth2 (full refresh), custom_credential, no_auth | **Small-Medium** — Allternit's local_cli/device_flow are actually *more* auth surface, but oauth2 needs PKCE finished |
| Token refresh | Manual, user-triggered only | Automatic refresh built into the OAuth2 credential type | **Medium** |
| Encryption at rest | AES-256-GCM, OS-keychain auto key | AES-256-GCM, explicit opt-in key, warns if unset | Roughly parity (Allternit's default is arguably safer) |
| Connection identity surfaced to agents | Not found — raw connection row only | `accountId`/`displayName`/`grantedScopes` exposed via API + MCP + run logs | **Medium** |
| MCP surface | None unified (System B has per-connector hand-rolled JSON-RPC, not one MCP endpoint) | One `/mcp` endpoint, 4 discovery tools across the whole catalog | **Large** |
| HTTP/OpenAPI surface | REST endpoints exist but no generated OpenAPI spec | Generated `/openapi.json`, uniform response envelope | **Medium** |
| SDK / CLI | Allternit CLI `connectors` command is unfinished (`configure` not implemented) | Maintained `connector-sdk` (TS) + `oo` CLI as separate packages | **Large** |
| Execution model | In-process declarative REST dispatch (Rust); no sandboxing needed by design | In-process "Action Executors," lazy-loaded, run-logged, policy-gated | Roughly comparable approach; Allternit lacks the policy/log layer |
| Action policy (allow/block) | None | Built-in allow/block rules per action | **Medium** |
| Run logs / observability | None found for connector execution specifically | Redacted, inspectable run logs | **Medium** |
| Deployment targets | Single Rust binary, presumably one deployment mode | Docker/Node, Fly.io, Cloudflare Workers, hosted SaaS — same contract everywhere | **Small** (probably not a priority for Allternit's architecture) |
| UI unification | Two separate, divergent connector UIs (Design `ConnectorModal` vs. Plugin Manager marketplace) | One Web Console (catalog browse, credential setup, Action debugging, run review) | **Medium** — internal fragmentation, not a capability gap per se |
| Governance / ADR | No ADR reconciling 3 systems; blueprint doc describes a format that doesn't match reality | Single system, documented catalog format is the actual implementation | **Process gap**, not technical |

---

## 4. Concrete risks if left as-is

1. **UX credibility risk**: shipping a "181 connectors" UI where 98% silently fail on click is worse than shipping "3 connectors" honestly. This is the most user-visible gap.
2. **Duplicate maintenance burden**: three connector systems (A/B/C) mean bug fixes and new-provider work has to be triaged against which system a request even belongs to. System A and B are effectively legacy but still live in the tree.
3. **No agent-facing protocol**: as Allternit leans further into agentic workflows, the lack of a unified MCP endpoint for connectors means every agent surface has to know Allternit-specific REST shapes instead of a standard agents already understand.
4. **Silent auth failures**: no automatic refresh means OAuth connections quietly go stale until a user notices an action failing and manually hits refresh.

---

## 5. Recommended priorities

1. **Consolidate on System C, deprecate A and B.** System C's catalog+meta+generic-dispatcher shape is the right foundation; systems A and B don't need to coexist. Port System B's 15 working manual-token connectors into System C's meta format rather than maintaining a separate execution path.
2. **Make the catalog honest before growing it.** Add open-connector's execution-status fields (`locallyExecutable`/`needsCredential`/etc.) to the 181-entry catalog and reflect them in `ConnectorModal.tsx` immediately — this is a small, high-value fix independent of everything else.
3. **Adopt a codegen-from-definition workflow** for `connectors.meta.json` instead of hand-editing, so adding real OAuth wiring for a new provider doesn't require Rust changes — mirroring open-connector's `definition.ts` → generated catalog pattern.
4. **Add automatic OAuth2 token refresh** (currently manual-only) and finish PKCE (currently flagged but not implemented).
5. **Expose one unified MCP endpoint** across all connected providers — this is the largest single capability gap relative to open-connector and the most valuable for agent-facing use cases.
6. **Unify the two frontend connector UIs** into one, and write the ADR that's currently missing to record the System A/B/C consolidation decision.

Lower priority, worth tracking but not blocking: generated OpenAPI spec, action allow/block policy, run-log surface, SDK/CLI package. These matter more once the core catalog is honest and MCP-exposed.
