# Cloud Agents Phase 1 task

Read `docs/CLOUD_AGENTS_MAP.md` first. It is the full analysis. This file is the only work you do. **Do not start Phase 2.**

You are in the allternit-platform repo worktree. You cannot read `~/Desktop/Allternit/`. Everything you need is in the MAP + this task.

## Goal

Public **Cloud Agents** API: Agent + Computer + Session + Events with Allternit names. Product is **Allternit Agents**, not Runtime. Completions/Responses stay Layer A.

A caller can:

1. `POST /api/v1/sessions` with inline `{ agent: { model, instructions }, computer: { kind: "none" }, input: "…", stream: false }`
2. Stream or list events whose `type` is Allternit (`session.created`, not `agent.session.created`)
3. `POST /sessions/:id/events` with `user.message` / `user.interrupt` / `user.tool_result`
4. Archive; further sends fail
5. `@allternit/sdk` class `Allternit` with `sessions.create` / `events.stream` / `events.send` / `archive`
6. `/api/v1/beta/sessions` still works

## Implement exactly

Follow the tables in `docs/CLOUD_AGENTS_MAP.md` (routes, status map, event map, files, do-not list).

Hard rules (Allternit):

- Never wrap OpenAI or Anthropic paid agent APIs.
- Never add a public `/runtimes` resource.
- Never require `OpenAI-Beta` header.
- Never change `agents_v1_routes.rs` Completions/Responses behavior.
- Never rebuild Bot Agents.
- No git operations. No cargo/tsc as a required “done” step. No Docker. No Stripe. No deploys.
- Docs: Register 1 — plain, no hype, no guarantees, no “drop-in OpenAI/Anthropic” claim.

Inline agent writes `system_prompt` from `instructions`; public JSON may emit `instructions` (read from system_prompt).

`computer.kind: sandbox` without hosted entitlement → 400, not silent `none`.

Match repo idiom: Axum routers, `ApiError`, `spawn_blocking` + rusqlite like `beta_session_routes.rs`. SDK: ESM TypeScript like `src/ai-runtime/agents/client.ts`.

## Constraints

- No builds/typechecks/dev servers
- No git operations
- Do not edit files outside the MAP file list plus tests next to those modules
- Do not start Phase 2

## Platform

If `.allternit/shared-context.md` exists, append `### allternit-runtime-api <ISO ts>` with a one-line milestone when you finish.

## Done sentinel

When finished, write `docs/CLOUD_AGENTS_PHASE_1_NOTES.md` starting with YAML frontmatter:

```yaml
---
status: done | blocked
files_changed: []
deviations: []
remaining: []
brain_updates: []
---
```

Then prose notes. That file existing = done. `brain_updates` = facts the Allternit brain lacks (empty list if none).

Also `touch docs/CLOUD_AGENTS_PHASE_1_NOTES.sentinel` if you can.
