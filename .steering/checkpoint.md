# Steering checkpoint — session/50d4cec6

## Goal
Ship Phase 1 of spec `bot-identity-computer` (Allternit Brain Research/specs/bot-identity-computer.md): atomic Create Bot = Identity (Name — Role) + Instructions (JOB system prompt) + persistent Computer Cloud desktop bound via bot_id (default 2 vCPU / 4 GB / 100 GB) + Tools (real allowlist), in `~/Desktop/allternit-workspace/allternit`. Reuse `provisionBotDesktop` / `/api/v1/computers` / `vmOperator`. No Orgo, no Docker-required path, no paid deps, no pricing, no fleet provisioning.

## Just did
- Worktree `allternit-session-50d4cec6` on `session/50d4cec6` (from origin/main 83de96076).
- `vm-operator.ts`: added `defaultBotVMOperatorConfig()` (persistent, 2/4096/102400, autoStart false) + `ensureBotComputer(botId, config, {displayName})` — list-by-bot_id, bind newest non-deleted (stopped counts), else POST /api/v1/computers with persistence persistent.
- New `bot-tool-registry.ts`: 8 real native tools + per-category defaults + toggle; template apply seeds allowlist.
- `CreateBotForm.tsx`: new "Job & Tools" step (systemPrompt + tool checkboxes) and "Computer" step (persistent-desktop switch + summary); formData carries systemPrompt + vmOperator defaults; handleCreate fire-and-forgets `ensureBotComputer` after createAgent (returns immediately, rail streams status); identity placeholder now "Name — Role"; review step shows all four fields; checklist + step grid updated for 7 steps.
- `useStartBotSession.ts`: reopen path resolves the bound desktop by bot_id and refreshes session metadata (never creates); new-session path resolves existing sandbox always, creates only when autoStart !== false.
- New `useBotComputer.ts` hook (polls computers?bot_id, maps creating→provisioning); `BotHubCard` shows live computer status chip.
- `BOT_AGENT_CONTRACT.md`: added "Atomic create rule" section.
- Tests: ensureBotComputer suite (defaults, provision, bind stopped, create→reopen same id, deleted skip) in vm-operator.test.ts; bot-tool-registry.test.ts (registry integrity, toggle, status map).

## Next
1. pnpm install finishes → run vitest for touched tests + typecheck:fast.
2. Commit, push, PR, merge, ledger attestation, cleanup per AGENTS.md ritual.

## Open questions (resolved per spec recommendations)
- Return-immediately + stream status: implemented (fire-and-forget provision, rail polls).
- Incus Linux default: provider 'cloud-desktop' → backend default Incus; no Tart path added.
- Bots default persistent on, non-bot agents unchanged: implemented.
- Theater: Create Bot path is CreateBotForm, which has no RPG/Big Five/forge steps (theater lives only in the separate CreateAgentForm agent wizard — left untouched, out of Phase 1 scope; documented in contract).
