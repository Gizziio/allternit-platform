# Plan — Rebuild the Create Bot wizard (one design, no forks)

## The idea, in plain words

It stays a **click-through wizard**. You click Next, you land on a Bot Hub with a new bot.
What changes is what happens *while* you click through:

1. **You watch the bot come together.** A live preview of the actual Bot Hub card sits on
   the right the whole time. Type a name — the card updates. Pick an accent — the card
   updates. By the last step you're not "reviewing a form", you're looking at your bot.
2. **The steps are mostly done for you.** Pick a template (Deep Researcher, Code Reviewer…)
   and every field arrives pre-filled with real, authored content — you edit, you don't
   compose. Blank start is still there.
3. **Typing one paragraph is an accelerator, not a mode.** Step 1 has an optional
   "or describe the bot you want" box. If you use it, one AI call pre-fills the steps from
   your sentence and you continue clicking through to adjust. If you never touch it, you
   never know it exists. No separate "mode", no conversation UI, no dead end if the call
   fails (it just falls back to the template defaults).
4. **The ending lands.** After Create, the wizard shows the bot's cloud desktop actually
   provisioning (live status, per the contract's streaming endpoint) and then hands you to
   the Bot Home. The computer — the thing Grok Bot charges $200/mo for — is front and
   center in the copy: "your bot gets its own always-on desktop."
5. **It looks like Allternit.** Allternit Sans, design tokens, `A://` brand mark in the
   wizard header, phosphor icons, motion on step transitions. Register 1 voice: plain,
   direct, no hype.

That's the wow: a builder, not a form. No theater (the contract already bans it), no RPG
sliders — just a product that feels finished.

## Why the current one fails (verified, `CreateBotForm.tsx`)

- 7 flat steps, "Create bot" button visible on *every* step — nothing is gated, nothing
  builds anticipation, the checklist computes validity and never uses it.
- Two disconnected template catalogs: inline `START_TEMPLATES` (6 thin presets,
  CreateBotForm.tsx:142) vs the real `BOT_TEMPLATES` (7 fully-authored factory templates,
  `src/lib/bots/bots.manifest.ts:122`) used only by the landing page.
- Provisioning is fire-and-forget; a failed desktop is a `logger.warn` the user never sees.
- 2240-line file with local step components shadowing the agent wizard's `steps/`
  components, two `MASCOT_TEMPLATES`, and a side panel that does nothing.

## The flow (4 steps + persistent preview)

**Shell:** full-screen takeover (desktop product — the wizard earns the real estate),
left step rail (numbered with validation checkmarks), center content, right live preview.
Footer is Back / Next on steps 1–3. **Create bot exists only on step 4**, disabled until
the creation checklist passes (`lib/agents/agent-creation-checklist.ts`).

1. **Start** — template gallery from the single real catalog `BOT_TEMPLATES` (A:// Oracle,
   Deep Researcher, Code Reviewer, Writing Partner, Data Analyst, Social SDR, UX Auditor)
   with their custom SVG icons, plus a blank card. Collapsible "Describe the bot you want"
   box (the accelerator): one platform LLM call (existing chat-completions client, forced
   JSON matching `Partial<CreateAgentInput>`) prefills identity/job/tools/starter prompts
   and picks nearest template for accent/avatar; failure → template defaults, silently.
   Inline `START_TEMPLATES` deleted.
2. **Identity** — display name in the contract's `Name — Role` convention
   (`Quinn — Chief of Staff`), auto-derived `@handle`, tagline, category, welcome message,
   starter prompts, accent swatches, avatar (existing 5 avatar modes kept as-is — they
   work). Step validates before Next (name ≥2).
3. **Job** — system prompt textarea with a "refine from my description" helper (same LLM
   call, optional) + tool allowlist as toggle chips with one-line plain descriptions from
   `BOT_NATIVE_TOOLS` (`bot-tool-registry.ts:14-55`); category defaults pre-applied via
   `BOT_CATEGORY_DEFAULT_TOOLS`.
4. **Computer & Runtime** — persistent desktop ON by default with size presets from
   `BOT_DESKTOP_PRESETS` and plain copy about what the desktop is; model/provider/brain
   pickers (fix: brain names not truncated ids, drop the hard `brains[0]` card);
   maxIterations/temperature/voice under an "Advanced" disclosure.
   Then Create.

**Right rail (always visible):** the actual `BotHubCard`
(`src/views/agent-hub/main/BotHubCard.tsx`) fed the in-progress bot, over a compact
summary of job/tools/computer choices. Replaces the dead checklist panel and the old
text-table review step entirely.

**Success state:** after create, stream `GET /api/v1/computers?bot_id=…` inside the
wizard — "Provisioning your bot's desktop…" → running → auto-open Bot Home. Failure shows
an inline error with retry instead of a swallowed `logger.warn`.

**Launch contract unchanged:** same `isOpen/onClose` modal API, same 5 call sites
(`AgentHub.tsx:123`, `BotLaunchpadView.tsx:236`, `BotTopDeck.tsx:186`,
`BotPickerSheet.tsx:259`, `AgentView.tsx:284` draft path), same submit path
(`createAgent` → `ensureBotComputer` → `saveBotAvatar` → open `bot-home`). Backend
untouched; the atomic-create rule in `BOT_AGENT_CONTRACT.md` holds.

## Files

New: `surfaces/ai.allternit.com/src/views/agent-view/components/create-bot/`
- `CreateBotWizard.tsx` — shell, step state machine, gating
- `steps/StartStep.tsx`, `steps/IdentityStep.tsx`, `steps/JobStep.tsx`, `steps/ComputerRuntimeStep.tsx`
- `WizardPreview.tsx` — live BotHubCard + summary
- `useCreateBotSubmit.ts` — validation → create → streamed provisioning → avatar → navigate
- `describeBot.ts` — the one LLM prefill call + zod/JSON-schema guard + fallback
- `wizard-copy.ts` — all Register 1 strings in one place

Changed:
- `CreateBotForm.tsx` — thin wrapper mounting `CreateBotWizard` (call sites untouched)
- `bots.manifest.ts` — additive gallery metadata on `BotTemplate` only if grouping needs it

Cleanup folded in: delete the local shadow step components and duplicate
`MASCOT_TEMPLATES`; remove the unused checklist `isValid`. (The duplicate `BotProfile`
declaration in `agent.types.ts` is a pre-existing landmine — flag in the PR, don't
silently refactor.)

## Verification

- Surface `typecheck:fast` (compare error set to HEAD, must be identical modulo none).
- `vitest run src/lib/bots` + agent-view tests; new unit tests for the step state machine,
  gating, and `describeBot` fallback (mocked fetch).
- Manual smoke: `pnpm dev` (vite :3013) — template path, describe path, blank path,
  validation gates, provisioning success state, bot-home handoff.
- Rollout: session ritual — worktree `session/create-bot-wizard`, plan + steering
  checkpoint, PR with evidence, merge commit, ledger attestation, cleanup.

## Sequencing (each step lands green on its own)

1. Shell + step state machine + gating, wrapper swap (existing steps still render inside).
2. Start step with real `BOT_TEMPLATES` catalog; delete `START_TEMPLATES`.
3. Identity + Job steps + live `BotHubCard` preview rail.
4. Computer/Runtime + visible provisioning success state.
5. `describeBot` accelerator + "refine" helper + tests.
6. Polish pass: motion, copy, empty/edge states; PR.
