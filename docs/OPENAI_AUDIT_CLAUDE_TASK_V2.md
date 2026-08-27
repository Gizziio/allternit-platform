# Task: Audit Allternit User-Facing Surfaces Against OpenAI ChatGPT / Codex / Plugins

**Agent:** Claude Code
**Worktree:** this repo
**Deliverable:** `docs/openai-audit/CLAUDE_AUDIT.json` and `docs/openai-audit/CLAUDE_AUDIT.md`

## Context

We have crawled the full OpenAI developer documentation (API, Ads, Plugins, Workspace Agents, Codex, ChatGPT, Cookbook, Learn) and produced a structured capability catalog.

For this audit, use only the focused input:

- `docs/openai-audit/openai_user_facing_capabilities.md` — user-facing capability headings for `chatgpt-codex` and `plugins` only (~2,200 headings).
- `docs/openai-audit/openai_summary.md` — category/page summary.

Allternit is an enterprise agentic operating system that now passes hosting infrastructure to users (self-host / BYOC) but may also package agents as a service. Key docs:

- `README.md` — platform overview, architecture, service ports.
- `REPO_STRUCTURE.md` — monorepo + satellite layout.

Your job is to **audit Allternit's user-facing surfaces and agent packaging** and compare them to OpenAI's. Focus on:

- `surfaces/ai.allternit.com/` — main web surface.
- `surfaces/allternit-desktop/` — desktop shell.
- `sdk/allternit-sdk/` — public SDK.
- `packages/@allternit/plugin-sdk/` — plugin SDK.
- `platform/plugins/` — plugin runtime.
- `mcp/` — Model Context Protocol support.
- `ui/` — React components / platform UI.
- `cmd/cli`, `cmd/cli-typescript`, `cmd/gizzi-code/` — CLI tools.
- `services/voice/`, `services/computer-use/`, `services/registry/`, `services/orchestration/` — user-relevant services.

## Instructions

1. Read `docs/openai-audit/openai_user_facing_capabilities.md`. It lists OpenAI capabilities in two categories:
   - `chatgpt-codex` — ChatGPT Work, Codex CLI, Codex IDE, Codex cloud, desktop app, commands, settings, automations, browser, computer use, voice, customization, memories, skills, subagents, AGENTS.md, rules, speed, sandboxing, agent approvals & security, enterprise controls.
   - `plugins` — ChatGPT plugins / Apps SDK: MCP servers, tools, UI components, authentication, metadata, testing, deployment, review, submission, monetization.

2. Explore the Allternit codebase to find existing equivalent user-facing capabilities. Cite evidence (file path + a few lines) for every `present` or `partial` claim.

3. For each major capability heading, decide:
   - `present` — Allternit has a direct equivalent.
   - `partial` — Allternit has something related but not equivalent.
   - `gap` — Allternit has nothing equivalent.
   - `not-applicable` — OpenAI-specific (e.g., OpenAI's consumer app store, ChatGPT.com).

   It is OK to group very similar headings. Aim to cover at least 80% of the headings.

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
          "allternit_equivalent": "gizzi-code CLI",
          "status": "present|partial|gap|not-applicable",
          "evidence": ["cmd/gizzi-code/..."],
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
