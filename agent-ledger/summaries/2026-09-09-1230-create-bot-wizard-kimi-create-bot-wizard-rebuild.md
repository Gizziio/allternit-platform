# Attestation — session/create-bot-wizard (Create Bot wizard rebuild)

- **Date:** 2026-09-09
- **Session:** `allternit-session-create-bot-wizard`, branch `session/create-bot-wizard`
- **Agent family:** kimi (Kimi Code CLI; implementation delegated to a coder subagent, independently verified by the orchestrator)
- **PR:** #221 (merged, merge SHA `cd6e5cbd6`; commits `c7090598d`, `5e5a3e20b`, `b0b6d4483`, merge `3896fc306`)

## What was done

Owner-directed rebuild of the Create Bot wizard in the Allternit desktop surface
(`surfaces/ai.allternit.com`), designed from research on Hermes Agent's Profile
Builder (5-step identity→model→skills→hub→MCP guided flow) and Grok Bot (named
bots, persistent cloud computer, role-first creation):

- Replaced the 2240-line 7-step click-through `CreateBotForm` with a 4-step
  full-screen builder: Start (real `BOT_TEMPLATES` catalog + blank), Identity
  (`Name — Role` convention, existing 5 avatar modes lifted unchanged), Job
  (system prompt + tool chips from `BOT_NATIVE_TOOLS`), Computer & Runtime
  (persistent desktop on by default, model/provider/brain pickers, Advanced
  disclosure). Inline `START_TEMPLATES` deleted; template selection now seeds
  real authored system prompts.
- Right rail renders the actual `BotHubCard` fed the in-progress bot (live
  preview); replaces the old text-table review step and the dead checklist panel.
- Real gating: Create bot exists only on step 4, disabled until
  `validateAgentCreationChecklist` passes; identity blocks Next without a name.
- Visible provisioning: success state streams `GET /api/v1/computers?bot_id=…`
  (60s cap) before bot-home handoff; inline error + retry replaces the swallowed
  `logger.warn`.
- Optional describe-to-prefill accelerator: one call on the platform's existing
  `/api/chat/completions` route (playground request shape, forced JSON + defensive
  validation, 20s abort, null-on-any-failure → silent template fallback) prefills
  identity/job/tools/starter prompts; Job step has a "Refine from my description"
  helper on the same call.
- Register 1 copy centralized in `wizard-copy.ts`; design tokens only; A://
  brand-mark header; framer-motion transitions.

## Launch contract

Unchanged: same `isOpen/onClose/draft` modal API, all 5 call sites untouched,
same atomic submit path (`createAgent` → `ensureBotComputer` → `saveBotAvatar` →
bot-home). `BOT_AGENT_CONTRACT.md`'s atomic-create rule holds; backend untouched.

## Verification evidence

- `typecheck:fast`: exactly the 15 pre-existing errors (office-pdf/sheets/slides,
  harfbuzzjs, UnifiedTerminal); zero new. Re-run independently by orchestrator.
- `vitest create-bot`: 29/29 (state machine/gating, payload-checklist parity,
  template contract, provisioning poll incl. timeout/transient failures,
  describeBot happy path + malformed/rejected/timeout → null).
- `vitest src/lib/bots`: 431/432 — the 1 failure is a pre-existing vm-operator
  snapshot expectation, reproduces on clean HEAD via stash.
- `pnpm build` (vite production): green, 13.3s.

## Incidents / honest deferrals

- Live `pnpm dev` click-through smoke NOT run (needs the local API + models
  route); deferred to owner preview. The production build + 29 unit tests are
  the evidence base.
- Implementation was delegated to a coder subagent per plan; orchestrator
  independently re-ran typecheck and the full create-bot test suite, reviewed
  the wrapper/launch seam, and reviewed the diff before PR.
- Pre-existing duplicate `BotProfile` declaration in `agent.types.ts` flagged in
  the PR, deliberately not refactored here.
- Preview rail polls `/api/v1/computers` with a placeholder id while open
  (returns `[]`, renders the faithful provisioning chip) — harmless, noted.
