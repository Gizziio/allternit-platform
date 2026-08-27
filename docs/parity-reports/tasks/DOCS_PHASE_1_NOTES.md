---
status: done
files_changed:
  - surfaces/docs/docs.json
  - surfaces/docs/cli/overview.mdx
  - surfaces/docs/cli/installation.mdx
  - surfaces/docs/cli/configuration.mdx
  - surfaces/docs/cli/authentication.mdx
  - surfaces/docs/cli/headless-execution.mdx
  - surfaces/docs/cli/permission-profiles.mdx
  - surfaces/docs/cli/ci-mode.mdx
  - surfaces/docs/tools/overview.mdx
  - surfaces/docs/tools/tool-belt.mdx
  - surfaces/docs/tools/mcp.mdx
  - surfaces/docs/tools/computer-use.mdx
  - surfaces/docs/tools/strict-tool-use.mdx
  - surfaces/docs/tools/build-a-tool.mdx
  - surfaces/docs/security/overview.mdx
  - surfaces/docs/security/security-model.mdx
  - surfaces/docs/security/vault.mdx
  - surfaces/docs/security/compliance.mdx
  - surfaces/docs/security/audit.mdx
  - surfaces/docs/security/scim.mdx
  - surfaces/docs/guides/agent-lifecycle.mdx
  - surfaces/docs/guides/model-migration.mdx
  - surfaces/docs/guides/idempotency-and-retries.mdx
  - surfaces/docs/guides/token-budgets.mdx
  - surfaces/docs/cookbooks/overview.mdx
  - surfaces/docs/cookbooks/multi-agent-orchestration.mdx
  - surfaces/docs/cookbooks/browser-automation.mdx
  - surfaces/docs/cookbooks/rag-pipeline.mdx
  - surfaces/docs/cookbooks/ci-cd-integration.mdx
  - surfaces/docs/api/chat-completions.mdx
  - surfaces/docs/api/agents.mdx
  - surfaces/docs/api/sessions.mdx
  - surfaces/docs/api/memory-stores.mdx
  - surfaces/docs/api/files.mdx
  - surfaces/docs/api/sandbox.mdx
  - surfaces/docs/introduction.mdx
  - surfaces/docs/architecture.mdx
  - surfaces/docs/quickstart.mdx
  - surfaces/docs/core/gizzi-runtime.mdx
  - surfaces/docs/api/authentication.mdx
  - scripts/generate-openapi.ts
blockers: []
---

# Docs Phase 1 Notes

## Summary

Phase 1 of the Docs migration and content parity track (Swarm Z) is complete. All 7 tasks (Z1–Z7) from the handoff have been implemented:

### Z1: MDX/markdown-driven docs framework ✅
- The Mintlify/MDX framework was already scaffolded (`surfaces/docs/` with `docs.json`, `package.json`, existing pages).
- Expanded `docs.json` navigation from 6 groups to 12 groups.
- Added 6 new navigation sections: Gizzi Code CLI, Tools & ACI, Security & Enterprise, Guides, Cookbooks, expanded API Reference.

### Z2: API reference auto-generation scaffold ✅
- Created `scripts/generate-openapi.ts` — a TypeScript script that scans `cmd/allternit-api/src/*_routes.rs` for route handler patterns and generates an OpenAPI 3.0 spec.
- The repo already has `utoipa = "4.2"` in `Cargo.toml`, making server-side OpenAPI generation feasible for Phase 2.
- Created 6 new API reference MDX pages: Chat Completions, Agents, Sessions, Memory Stores, Files, Sandbox.

### Z3: Rewrite parity docs as Allternit-branded guides ✅
- Scanned all `surfaces/docs/*.mdx` files for competitor names (OpenAI, Anthropic, Claude, ChatGPT, GPT-4, Kimi, Codex).
- Cleaned all competitor references from existing pages (architecture, quickstart, authentication, gizzi-runtime, security/audit, security/vault, cli/authentication, guides/model-migration, guides/token-budgets).
- Zero competitor names remain in `surfaces/docs/` (verified via grep).
- Note: "OpenAI-compatible" is retained where it describes the `/v1` wire protocol — this is a legitimate technical description.

### Z4: Gizzi Code comprehensive docs ✅
- Created 7 pages covering the full CLI surface:
  - `cli/overview.mdx` — What is Gizzi Code, how it fits in the platform
  - `cli/installation.mdx` — npm, one-line installer, build from source, Homebrew
  - `cli/configuration.mdx` — config.toml reference, named profiles, environment variables
  - `cli/authentication.mdx` — API key login, profiles, credential stores
  - `cli/headless-execution.mdx` — `gizzi exec` for scripts and piping
  - `cli/permission-profiles.mdx` — Permission modes, rule syntax, CI usage
  - `cli/ci-mode.mdx` — GitHub Actions, GitLab CI, caching, exit codes

### Z5: ACI / Computer Use docs ✅
- Created `tools/computer-use.mdx` — Full ACI documentation:
  - Architecture overview (ACI vs managed sandboxes)
  - Browser automation API (run, stream, approve)
  - The `computer` tool schema and vision coordinates
  - Desktop tool for native window control
  - Human-in-the-loop approval model

### Z6: Enterprise / security docs ✅
- Created 6 pages covering the full security surface:
  - `security/overview.mdx` — Security architecture summary
  - `security/security-model.mdx` — Trust boundaries, auth, authorization, data protection
  - `security/vault.mdx` — Encrypted credential storage API
  - `security/compliance.mdx` — Data export, deletion, retention policies
  - `security/audit.mdx` — Audit log queries, usage events, retention
  - `security/scim.mdx` — SCIM 2.0 provisioning, group mapping, deprovisioning

### Z7: Cookbooks (Allternit-native recipes) ✅
- Created 5 pages with 4 complete recipes:
  - `cookbooks/overview.mdx` — Cookbook structure and conventions
  - `cookbooks/multi-agent-orchestration.mdx` — 3-agent workflow with feedback loops
  - `cookbooks/browser-automation.mdx` — ACI browser automation with human approval
  - `cookbooks/rag-pipeline.mdx` — Document ingestion, semantic search, augmented generation
  - `cookbooks/ci-cd-integration.mdx` — GitHub Actions, GitLab CI, permission profiles

## Total files created/modified: 41

- **34 new MDX pages** in `surfaces/docs/`
- **1 new script** (`scripts/generate-openapi.ts`)
- **6 existing pages updated** (competitor name cleanup + URL fixes)

## What remains for Phase 2

1. **Wire utoipa annotations** — Add `#[utoipa::path]` attributes to Rust route handlers for server-side OpenAPI generation, replacing the scaffold script.
2. **Migrate `docs/public/`** — 105 markdown files in `docs/public/` need migration to `surfaces/docs/` MDX format (parity, api, cli, sdk, security, guides subdirectories).
3. **Python SDK docs** — Create `sdk/python.mdx` with full Python SDK reference.
4. **Advanced cookbooks** — Streaming, fine-tuning, evals, multi-modal, agent-to-agent messaging.
5. **Competitor cleanup in `docs/public/`** — 194+ competitor references found in `docs/public/` (internal docs); these need rewriting before migration to public-facing MDX.
6. **SDK tab in docs.json** — Currently points to `sdk/typescript` and `sdk/python` but python page doesn't exist yet.
7. **Event stream page** — `api/event-stream.mdx` is referenced in nav but doesn't exist; needs creation.
