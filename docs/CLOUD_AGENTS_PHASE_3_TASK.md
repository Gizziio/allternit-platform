# Cloud Agents Phase 3 task

Read `docs/CLOUD_AGENTS_MAP.md` first. **Do not start sandbox provision, schedules, tool_search, fabric/desktop workers, dollar budget, or Bot Agents.**

## Goal

Session create actually binds a brain and vaults. Unknown ids are `400`. Public session JSON includes `brain_id` and `vault_ids`. `/api/v1/vaults` is an alias of `/api/v1/beta/vaults` CRUD.

## Implement exactly

See MAP. Hard rules: no OpenAI/Anthropic wrap, no `/runtimes`, no Completions/Responses edits, no Bot Agents, no git, no Docker, no Stripe, no dollar budget, no cargo as a required done step.

## Done sentinel

Write `docs/CLOUD_AGENTS_PHASE_3_NOTES.md` with YAML frontmatter `status`, `files_changed`, `deviations`, `remaining`, `brain_updates`.
