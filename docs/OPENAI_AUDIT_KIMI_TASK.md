# Task: Audit Allternit Platform Against OpenAI API / ChatGPT / Codex Capabilities

**Agent:** Kimi (k3 model)
**Worktree:** this repo
**Deliverable:** `docs/openai-audit/KIMI_AUDIT.json` and `docs/openai-audit/KIMI_AUDIT.md`

## Context

We have crawled the full OpenAI developer documentation (API, Ads, Plugins, Workspace Agents, Codex, ChatGPT, Cookbook, Learn) and produced a structured capability catalog:

- `docs/openai-audit/openai_capability_areas.md` — condensed capability headings grouped by product area.
- `docs/openai-audit/openai_summary.md` — category/page summary.
- `docs/openai-audit/openai_catalog.json` — full structured catalog (8.7 MB, use only if you need details).

Allternit is an enterprise agentic operating system. The platform is in this repo. Key docs:

- `README.md` — platform overview, 7-layer architecture, service ports.
- `REPO_STRUCTURE.md` — monorepo + satellite layout.
- `DESIGN.md` — design system v2.
- `AGENTS.md` — A://Labs and agent workflow notes.

Your job is to **audit Allternit's platform capabilities** and compare them to OpenAI's. Focus on the layers you can read: substrate, kernel, governance, adapters, services, registry, orchestration, API (`api/`, `cmd/allternit-api/`, `platform/`, `sdk/`, `packages/@allternit/`, `services/`, `domains/`, `infrastructure/`).

## Instructions

1. Read `docs/openai-audit/openai_capability_areas.md`. Focus especially on these OpenAI areas:
   - `api` — Responses API, chat completions, function calling, tools, embeddings, fine-tuning, evals, files, images, audio, realtime, batch, containers, moderations, vector stores, assistants, graders, etc.
   - `chatgpt-codex` — ChatGPT Work, Codex CLI, Codex IDE, Codex cloud, agents, skills, MCP, plugins, automations, browser, computer use, voice, subagents, sandboxing, approvals, governance.
   - `plugins` — ChatGPT plugins / Apps SDK with MCP servers and optional UI.
   - `workspace-agents` — triggering and inspecting workspace agent runs.
   - `cookbook` — code examples and patterns.

2. Explore the Allternit codebase to find existing equivalent capabilities. Look at:
   - `platform/` — contracts, protocols, SDK, plugin runtime.
   - `api/` and `cmd/allternit-api/` — API surface.
   - `sdk/` — public SDK packages.
   - `services/` — memory, registry, orchestration, voice, operator.
   - `domains/` — agent, computer-use, governance, kernel.
   - `infrastructure/` — executors, cloud providers.
   - `packages/@allternit/` — internal packages.
   - `surfaces/` — web/desktop surfaces.
   - `docs/` — architecture and gap analysis docs.

3. For each major OpenAI capability heading, decide:
   - `present` — Allternit has a direct equivalent. Quote evidence (file path + a few lines).
   - `partial` — Allternit has something related but not equivalent. Note what is missing.
   - `gap` — Allternit has nothing equivalent.
   - `not-applicable` — OpenAI-specific (e.g., OpenAI Ads, OpenAI-hosted models, billing in USD).

4. Produce `docs/openai-audit/KIMI_AUDIT.json` with this schema:

```json
{
  "auditor": "kimi-k3",
  "focus": "platform-services-api-kernel-governance",
  "categories": [
    {
      "category": "api",
      "findings": [
        {
          "openai_feature": "Responses API create",
          "allternit_equivalent": "...",
          "status": "present|partial|gap|not-applicable",
          "evidence": ["path/to/file.ts:42"],
          "notes": "..."
        }
      ]
    }
  ]
}
```

5. Produce a human-readable `docs/openai-audit/KIMI_AUDIT.md` summarizing the audit, top gaps, and quick wins.

## Constraints

- Do NOT modify production code. This is read-only audit work.
- Do NOT run builds, dev servers, or typechecks.
- Do NOT commit or push.
- Be evidence-based: every `present` or `partial` claim must cite a file path.
- Aim for comprehensive coverage of the OpenAI capability headings. It is acceptable to group very similar headings.

## Completion sentinel

When finished, write `docs/openai-audit/KIMI_AUDIT_NOTES.md` starting with YAML frontmatter:

```yaml
---
status: done
files_changed:
  - docs/openai-audit/KIMI_AUDIT.json
  - docs/openai-audit/KIMI_AUDIT.md
  - docs/openai-audit/KIMI_AUDIT_NOTES.md
deviations: []
remaining: []
---
```

Then add any prose notes you want.
