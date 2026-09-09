# Session attestation — 50d4cec6 (kimi) — bot-identity-computer Phase 1

- **Date:** 2026-09-09
- **Branch:** `session/50d4cec6` → **PR:** #190 (merged, merge SHA `d61530a3d`)
- **Spec:** Allternit Brain `Research/specs/bot-identity-computer.md` (approved at the human gate same day, rq-20260909-003)

## What was done

Shipped Phase 1: Create Bot is one atomic submit packaging an Agent as a Bot with Identity (`Name — Role`), Instructions (JOB system prompt), Tools (real allowlist), and a persistent Computer Cloud desktop bound via `bot_id` (default 2 vCPU / 4 GB / 100 GB).

- `CreateBotForm.tsx`: new **Job & Tools** step (systemPrompt + tool checkboxes from the new native `bot-tool-registry`) and **Computer** step (persistent-desktop switch + summary); identity placeholder now `Name — Role`; review step shows all four fields; template apply seeds per-category tool defaults. On submit, after `createAgent`, it fire-and-forgets `ensureBotComputer` — create returns immediately, the rail streams status.
- `vm-operator.ts`: `defaultBotVMOperatorConfig()` (persistent, `computerKind: 'cloud_desktop'`, resources 2/4096/102400, `autoStart: false`) and `ensureBotComputer(botId, config, {displayName})` — list-by-`bot_id`, bind newest non-deleted desktop (stopped counts — same computer), else POST `/api/v1/computers` with `persistence: 'persistent'`.
- `useStartBotSession.ts`: reopening a bot resolves the bound desktop by `bot_id` and refreshes session metadata (never creates); new sessions always find the bound desktop, create-if-missing only when `autoStart !== false`. Non-bot agents unchanged.
- Bots rail: `BotHubCard` shows live computer status (provisioning / running / stopped / error) via new `useBotComputer` hook (15 s poll of `computers?bot_id=`).
- `BOT_AGENT_CONTRACT.md`: new **Atomic create rule** section.
- New files: `bot-tool-registry.ts`, `useBotComputer.ts`, `bot-tool-registry.test.ts`.

## How it works

`POST /api/v1/computers` (cloud_desktop) already provisions through Incus/Tart and upserts a `computers` row with `bot_id` (backend verified: `cmd/allternit-api/src/computer_routes.rs` create path, `bot_id` filter supported in list). Phase 1 adds no new substrate — only the client-side join: the create form writes all four fields, then binds-or-provisions the desktop; sessions resolve by `bot_id` instead of minting ephemeral sandboxes.

## Verification evidence

- `vitest run src/lib/bots/vm-operator.test.ts src/lib/bots/bot-tool-registry.test.ts` — **23/23 pass**, including the scripted smoke equivalent: create → list by `bot_id` → reopen returns the **same computer id** with exactly one POST; bind-stopped (no POST); deleted-desktop skip; provision body asserts `kind`/`bot_id`/`persistence: 'persistent'`/`name`.
- `pnpm run typecheck:fast` — no errors in touched files; worktree error set is a strict subset of the main-checkout baseline (15 pre-existing env errors in `packages/@allternit/office-*` asset/type declarations — pre-existing, noted, not fixed per ritual).

## Incidents / honest deferrals

- **Merge conflict** on `.steering/checkpoint.md` (concurrent session landing on main) — resolved keeping this session's checkpoint; no code overlap.
- **Theater removal**: the canonical Create Bot path (`CreateBotForm`, the component behind every "Create bot" CTA) never had RPG stats / Big Five / forge steps; that theater lives only in the separate agent wizard (`CreateAgentForm`), which was intentionally left untouched. Documented in the contract — the spec's "removed or skipped on the Create Bot path" is satisfied by the path already being theater-free.
- **Live VM provisioning not exercised end-to-end** — no Incus desktop was actually booted during this session; verification is at the API-contract level (mocked fetch) plus existing backend routes. First real create in a live environment should be watched once.
- **Phase 2 non-goals** (per spec): fleet "provision all bots", size presets UI, Orgo/Codex, pricing, monitor model, ao v3.

## State

Worktree, session branch (local + remote), and scratch removed after attestation; shared `main` synced to `d61530a3d`.
