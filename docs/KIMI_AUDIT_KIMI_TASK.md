# Task: Audit Allternit Platform Against Kimi API Platform Capabilities

**Agent:** Kimi (k3 model)
**Worktree:** this repo
**Deliverable:** `docs/kimi-audit/KIMI_AUDIT.json` and `docs/kimi-audit/KIMI_AUDIT.md`

## Context

We have crawled the Kimi API Platform docs (`platform.moonshot.cn/docs`) and produced a structured capability catalog:

- `docs/kimi-audit/kimi_catalog.json` — 75 pages, ~428 feature headings.
- `docs/kimi-audit/kimi_summary.md` — category/page summary.

Allternit is an enterprise agentic operating system. Key docs:

- `README.md` — platform overview, architecture, service ports.
- `REPO_STRUCTURE.md` — monorepo + satellite layout.

Your job is to **audit Allternit's platform capabilities** and compare them to Kimi's. Focus on the layers you can read: `api/`, `cmd/allternit-api/`, `platform/`, `sdk/`, `packages/@allternit/`, `services/`, `domains/`, `infrastructure/`, `mcp/`, `surfaces/`.

## Kimi capability areas to audit

Kimi's docs cover:

- **api** — chat completions, token estimation, file CRUD, batch jobs, models, errors, balance.
- **guide** — quickstart, tool calling, JSON mode, response_format, context caching, web search, reasoning effort, thinking models, partial mode, multi-modal (image/video), file-based QA, batch API, org setup, playground, integrations (Claude Code, Codex CLI, Kimi Code CLI, OpenCode, Hermes Agent, OpenClaw).
- **pricing** — chat, batch, tools, limits.
- **changelog** — model releases, research notes.
- **agreement** — legal/privacy (N/A for platform parity).

## Instructions

1. Read `docs/kimi-audit/kimi_summary.md` and skim `docs/kimi-audit/kimi_catalog.json`.

2. Explore the Allternit codebase to find existing equivalent capabilities. Look at:
   - `cmd/allternit-api/src/llm_gateway/` — OpenAI-compatible gateway.
   - `services/open-connector/` — provider connectors.
   - `services/voice/`, `services/computer-use/`, `services/registry/`, `services/orchestration/`.
   - `platform/`, `sdk/`, `packages/@allternit/`.
   - `cmd/gizzi-code/` — CLI agent runtime.
   - `surfaces/ai.allternit.com/` — web surface.

3. For each major Kimi capability heading, decide:
   - `present` — Allternit has a direct equivalent. Quote evidence.
   - `partial` — Allternit has something related but not equivalent.
   - `gap` — Allternit has nothing equivalent.
   - `not-applicable` — Kimi-specific (e.g., Kimi K3 model itself, Kimi-specific pricing, legal agreements).

4. Produce `docs/kimi-audit/KIMI_AUDIT.json` with this schema:

```json
{
  "auditor": "kimi-k3",
  "focus": "kimi-api-platform-vs-allternit",
  "categories": [
    {
      "category": "api",
      "findings": [
        {
          "kimi_feature": "创建对话补全 (chat completions)",
          "allternit_equivalent": "...",
          "status": "present|partial|gap|not-applicable",
          "evidence": ["path/to/file.rs:42"],
          "notes": "..."
        }
      ]
    }
  ]
}
```

5. Produce a human-readable `docs/kimi-audit/KIMI_AUDIT.md` summarizing the audit, top gaps, and quick wins.

## Constraints

- Do NOT modify production code. Read-only audit.
- Do NOT run builds, dev servers, or typechecks.
- Do NOT commit or push.
- Every `present`/`partial` claim must cite a file path.

## Completion sentinel

When finished, write `docs/kimi-audit/KIMI_AUDIT_NOTES.md` starting with YAML frontmatter:

```yaml
---
status: done
files_changed:
  - docs/kimi-audit/KIMI_AUDIT.json
  - docs/kimi-audit/KIMI_AUDIT.md
  - docs/kimi-audit/KIMI_AUDIT_NOTES.md
deviations: []
remaining: []
---
```
