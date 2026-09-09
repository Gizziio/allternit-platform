# Steering checkpoint

**Goal:** Rebuild the Create Bot wizard (session/create-bot-wizard, 2026-09-09): Allternit-branded, 4-step click-through with a live Bot Hub card preview rail, real gating, single real template catalog (`BOT_TEMPLATES`), visible desktop provisioning, and an optional describe-to-prefill accelerator. Approved plan: `.steering/plan-create-bot-wizard.md`.

**Just did:** Milestone 5 + polish committed as `5e5a3e20b`: `describeBot.ts` (one call on the platform's existing `/api/chat/completions` route — playground request shape, `getDefaultAgentModel().id`, forced JSON + defensive validation; null on any failure incl. 20s abort), Start-step "Describe the bot you want" prefill box (suggested template defaults underneath, blank card otherwise, silent fallback), Job-step "Refine from my description" (same call, replaces systemPrompt on success). Polish: identity auto-focus, Esc-closes-only-when-idle, copy Register 1 sweep. Verified: typecheck:fast = exactly the 15 pre-existing errors; vitest src/lib/bots 431/432 (same 1 pre-existing vm-operator failure); create-bot tests 29/29 (12 new). Two commits on `session/create-bot-wizard`, not pushed.

**Next:** PR + merge + ledger attestation per session ritual (owner drives merge); milestones 1–6 all landed.

**Open questions:** None — plan approved by owner.

---

<!-- merged checkpoint from origin/main (session/shell-rail-home-cleanup) below -->

# Steering checkpoint — session/shell-rail-home-cleanup

Goal: Home-mode shell rail cleanup in the Allternit desktop surface
(`surfaces/ai.allternit.com`): remove collapsed-rail mascot pill, move Groups
to a bot-mode-only tab, fold Inbox into the (renamed) Bot Activity widget, move
Remote peers into the Fabric Transport view, inline the New button with the
tabs, move "Continue CLI session" into Recents (home + code), sticky tab
highlights, rename Agent Activity → Bot Activity everywhere user-visible.

Just did: re-applied the full edit set on top of newer origin/main
(2c7d3c990) after an outside process checked out origin/main in this worktree
and wiped the first (never-committed) pass. Reconciled with upstream
effe862b5 (mascot pill had been folded into the 44px collapsed-controls row —
removed from there) and kept upstream's `aci-recordings` browser view type.
Verification: typecheck:fast clean except the pre-existing unrelated error set
(office-* asset declarations, UnifiedTerminal xterm css); 31/31 targeted
vitest pass. A packaged build of the first pass exists at
`surfaces/allternit-desktop/release/Allternit-Desktop-1.1.0-arm64.dmg`
(unsigned, arm64) and was bundle-verified.

Next: commit on `session/shell-rail-home-cleanup`; user decides on PR/merge.
Packaged binary from the first pass predates the rebase but is functionally
identical (re-application verified equivalent); rebuild after merge if wanted.

Open questions: whether to PR/merge per the normal ritual (user said
edits + binary only so far). Note: the vite.config.ts PREVIEW-ONLY univerjs
patch from the earlier preview session did not survive the checkout — the
build of this branch may need that path fix re-staged locally.
