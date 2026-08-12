# Task: Audit Allternit User-Facing Surfaces Against OpenAI ChatGPT / Codex / Plugins

**Agent:** Claude Code
**Worktree:** this repo
**Deliverable:** `docs/openai-audit/CLAUDE_AUDIT.json` and `docs/openai-audit/CLAUDE_AUDIT.md`

## Context

We have crawled the full OpenAI developer documentation (API, Ads, Plugins, Workspace Agents, Codex, ChatGPT, Cookbook, Learn) and produced a structured capability catalog:

- `docs/openai-audit/openai_capability_areas.md` — condensed capability headings grouped by product area.
- `docs/openai-audit/openai_summary.md` — category/page summary.
- `docs/openai-audit/openai_catalog.json` — full structured catalog (8.7 MB, use only if you need details).

Allternit is an enterprise agentic operating system that now passes hosting infrastructure to users (self-host / BYOC) but may also package agents as a service. Key docs:

- `README.md` — platform overview, 7-layer architecture, service ports.
- `REPO_STRUCTURE.md` — monorepo + satellite layout.
- `AGENTS.md` — A://Labs curriculum and agent workflow notes.

Your job is to **audit Allternit's user-facing surfaces and agent packaging** and compare them to OpenAI's. Focus on:

- `surfaces/ai.allternit.com/` — main web surface.
- `7-apps/shell/web/`, `7-apps/shell/desktop/`, `7-apps/shell/terminal/` — shell family.
- `6-ui/allternit-platform/` — React component library, hooks, services, views.
- `platform/plugins/`, `packages/@allternit/plugin-sdk/` — plugin runtime and SDK.
- `mcp/` — Model Context Protocol support.
- `tools/`, `drivers/`, `infrastructure/` — integrations and deployment options.
- `sdk/`, `packages/@allternit/` — public SDKs and packages.

## Instructions

1. Read `docs/openai-audit/openai_capability_areas.md`. Focus especially on these OpenAI areas:
   - `chatgpt-codex` — ChatGPT Work, Codex CLI, Codex IDE extension, Codex cloud, desktop app, commands, settings, automations, browser, computer use, voice, customization, memories, skills, subagents, AGENTS.md, rules, speed, sandboxing, agent approvals & security, enterprise controls.
   - `plugins` — ChatGPT plugins / Apps SDK: MCP servers, tools, UI components, authentication, metadata, testing, deployment, review, submission, monetization.
   - `workspace-agents` — trigger published workspace agents, inspect runs.
   - `api` — SDKs, quickstart, guides (focus on developer experience, not deep API parity).
   - `cookbook` — examples and patterns.

2. Explore the Allternit codebase to find existing equivalent user-facing capabilities. Cite evidence (file path + a few lines) for every `present` or `partial` claim.

3. For each major OpenAI capability heading, decide:
   - `present` — Allternit has a direct equivalent.
   - `partial` — Allternit has something related but not equivalent.
   - `gap` — Allternit has nothing equivalent.
   - `not-applicable` — OpenAI-specific (e.g., OpenAI's own app store, ChatGPT.com consumer product).

4. Produce `docs/openai-audit/CLAUDE_AUDIT.json` with this schema:

```json
{
  "auditor": "claude-code",
  "focus": "surfaces-ui-plugins-shell-sdk-user-experience",
  "categories": [
    {
      "category": "chatgpt-codex",
      "findings": [
        {
          "openai_feature": "Codex CLI",
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

5. Produce a human-readable `docs/openai-audit/CLAUDE_AUDIT.md` summarizing the audit, top gaps, and quick wins.

## Important product context

Allternit's direction has shifted: it is **not** a host of agents; it passes hosting infrastructure to users (self-host / BYOC). However, it is not against packaging agents as a service like Anthropic/OpenAI. Do not treat this as a hard demarcation. A capability gap remains a gap even if Allternit could be self-hosted, unless it is truly impossible or against the architecture.

## Constraints

- Do NOT modify production code. This is read-only audit work.
- Do NOT run builds, dev servers, or typechecks.
- Do NOT commit or push.
- Be evidence-based: every `present` or `partial` claim must cite a file path.
- Aim for comprehensive coverage of the OpenAI capability headings. It is acceptable to group very similar headings.

## Completion sentinel

When finished, write `docs/openai-audit/CLAUDE_AUDIT_NOTES.md` starting with YAML frontmatter:

```yaml
---
status: done
files_changed:
  - docs/openai-audit/CLAUDE_AUDIT.json
  - docs/openai-audit/CLAUDE_AUDIT.md
  - docs/openai-audit/CLAUDE_AUDIT_NOTES.md
deviations: []
remaining: []
---
```

Then add any prose notes you want.
