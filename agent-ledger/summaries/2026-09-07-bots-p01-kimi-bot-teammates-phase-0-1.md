# Session Attestation — session/bots-p01 (kimi) — Bot Teammates Phase 0+1

- **Date:** 2026-09-07
- **Branch:** `session/bots-p01` @ 64d424372 (fast-forwarded to `main`), ledger 153291895.
- **Spec:** `docs/BOT_TEAMMATES_SPEC.md` (Phase 0 + Phase 1 of 6).

## Phase 0 — Trust foundations

- `lib/bots/failure-reasons.ts` (new): 13-code failure vocabulary + ordered classifier (auth > quota), retry policy (`once` / `after_compact` / `never`), attention classes with hints. 19 tests.
- Reason codes threaded through `bot-wake.service.ts` (retry-at-most-once in wait mode), `mention-handoff.service.ts` (`failures[]` in results), `comrails-mail.store.ts`.
- Attention slice in `agent.store.ts` (note/clear, wired to run completion, lifecycle-aware `getVisibleAttention`). 5 tests.
- Capability epoch: `lib/bots/bot-capability-epoch.ts` (FNV-1a 12-hex) stamped into bot session identity prompts; rebuild-once-per-drift on session reuse. 9 tests.
- Canonical-chat hardening (root→tip re-point, auto-recreate, rail "New" reroute) + `versioned-persist.ts` on roster/routine stores.

## Phase 1 — Teammates rail + routines

- `lib/bots/bot-presence.ts` (90s window, working/active/idle). 6 tests.
- TEAMMATES rail section (ShellRail.tsx) above PINNED: presence/unread/attention membership, cap 6, self-pruning, hover actions, "All teammates" → Bot Hub.
- Routine timer (`use-routine-timer.ts`, 60s + missed-on-launch, mounted in ShellApp), continuity prepend, monitor mode w/ hash suppression + 4KB cap + local-API guard, scratchpad store. Fixed real bug: weekday rollover Sat→Mon. Delivery tests.
- Simple routine composer in BotHomeView automation tab (frequency-first picker above untouched advanced UI).
- Share-auth/clone inheritance documented (Hermes history-strip rule).

## Verification

- tsc clean on all touched files; vitest **1263 passed / 0 failed** (32 new). `bun run build` blocked by **pre-existing environmental breakage**: another session's in-flight univerjs bump in the shared checkout (stale install, wrong-version alias). Not caused by this diff — all 25,617 modules transform; link fails on univerjs only.

## Cross-session incident (resolved)

While landing, the shared checkout held another session's uncommitted WIP (Groups rail section + automation-tab refactor). Stash/rebase to push the ledger commit collided in `ShellRail.tsx` (imports) and `BotHomeView.tsx` (component rename). Union-resolved both (kept their `TasksAutomationTab`/`SectionHeading` rename + my composer/types); their WIP restored unstaged, stash dropped, tsc clean on merged files.

## Open items for later phases

- Attention slice is in-memory (agent.store has no persist); persist in Phase 2 if cross-reload attention is wanted.
- `AgentGalleryCard.handleDuplicate` passes `secretRefs` unredacted (pre-existing; documented).
- Build verification pending once the shared checkout's dependency install is repaired.
