# Agent Work Attestation — bot-mode deck persistence + create-bot wizard overhaul

**Date:** 2026-09-13 14:28
**Session ID:** bote2e-0913
**Branch:** session/bote2e-0913
**Agent:** kimi-code
**Commit:** https://github.com/Gizziio/allternit-platform/pull/477 · merge commit 0a51d89db (branch tip ed9400d08)
**Ledger entry:** [../LEDGER.md](../LEDGER.md)

## What was done

Owner-requested 10-item overhaul of bot mode and the create-bot wizard on ai.allternit.com, plus the backend to make the wizard's promises real:

1. **Deck persistence** — the bottom mode dock (features deck) in bot mode now persists even when no bot is mounted. `ChatComposer.tsx` gate relaxed to `agentModeSurface === 'bot' || selectedSurfaceAgent`; `locallyEnabled` initializes true on the bot surface; `ModeDock.tsx` gained an unmounted-bot hint. Submit gate intentionally untouched. New `ModeDock.test.tsx` (5 tests).
2. **Wizard restyle** — removed `A://` prefix from all wizard copy; removed the tan chrome (shell now `bg-[var(--bg-elevated)]`, max-w-6xl, serif h1); fixed top-left collision with floating rail icons via `lg:pl-[320px]` (rail 248 + trafficLightClearance 72) while keeping z-index 100; removed the step rail and `WizardPreview` (now unreferenced). Done against the approved fabric-transport/automation-tasks/projects/artifacts-library layout criteria.
3. **Category dropdown fix** — `select.tsx` hardcoded `#fff` text → `var(--text-primary)` with proper hover state (was invisible on light background).
4. **Starter prompts** — new `starter-prompt-suggestions.ts` keyed by BotCategory ids with a default set (6–8 per category, capped at 5 shown); rendered as tappable suggestion chips in `IdentityStep.tsx`. 7 tests.
5. **Avatar overhaul** — new `avatar-packs.ts` manifest (15 packs / 120 sprites / 80 sheets across gizzi, openmaus-style real bots, grok-carry, codex-carry pets, mascots, initials); pack browser + theme filters in `AvatarEditor.tsx` (new `AvatarMode "packs"`, `PackSelection` state, `PackSpritePortrait` with onError placeholder); `AvatarImageCropper.tsx` (drag/zoom → 512×512 webp) for uploads. `AVATAR_PACKS.md` is the delegated art-generation handoff doc — owner generates the ~200 sprite assets via grok bot / ChatGPT image / higgsfield; placeholders show until they land. Wired through `CreateBotWizard.tsx` (`packSelection` state, reset, `buildAvatarConfig` "packs" case: sheet → pet renderer config, else image uri).
6. **Refine/tools wiring** — the "refine from my description" button now has loading + inline error states and actually prefills the wizard; the tools selection chain was verified end to end.
7. **Computer tiers** — presets replaced with backend-validated sizes: Small 2 CPU / 4096 MB / 20480 MB disk (default), Medium 4/8192/40960, Large 8/16384/81920 (matches `VALIDATED_CPU_CORES=[2,4,8]`, `VALIDATED_MEMORY_MB`, `VALIDATED_DISK_MB` in `cmd/allternit-api/src/bot_desktop_templates.rs`). Resources pass through `ensureBotComputer`; new Rust `quota_status()` + `GET /api/v1/computers/quota` route; quota UI + disk-tradeoff copy in `ComputerRuntimeStep.tsx`.
8. **Bot persistence on disk** — verified live, not just claimed.

## How it works

Deck: dock visibility no longer depends on a mounted bot on the bot surface. Wizard: single-screen elevated card, left padding clears the floating rail instead of raising z. Avatar: three modes (pack sprite / pet sheet / upload→crop); pack sprites resolve to static asset URLs with placeholder fallback until generated art lands in `public/avatar-packs/`. Computer: wizard sends cpus/memory/disk from preset allow-list; backend validates against the same lists and tracks per-user quota via the new quota endpoint.

## Verification

- `pnpm exec tsc --noEmit` — 0 errors (re-run after the main-merge).
- `npx vitest run` bot areas — 61/61 passed (including new ModeDock 5, starter-prompt 7, wizard-steps 8).
- `cargo test` quota tests — 4/4; `cargo check` — green (warnings only), re-run post-merge.
- Live persistence smoke on port 18013 with `ALLTERNIT_LOCAL_DEV_BYPASS=1`: created bot via API (serde note: `CreateAgentBody` renames `agent_type` → `"type"`; model, provider, `harness_config.mode`, `enabled_modes`, `trust_tier` also required), confirmed SQLite row in `/tmp/allternit-smoke/allternit.db` (vm_operator lands in `config`, not its own column), GET round-trip (response wrapped in `{"agent": {...}}`), restart → still listed. Smoke artifacts cleaned up.

## Known gaps / remaining work

- **Sprite art not generated** — ~200 HD sprite/sheet assets are deliberately delegated to the owner's generation agent (grok bot / ChatGPT image / higgsfield); `surfaces/ai.allternit.com/src/views/agent-view/components/create-bot/AVATAR_PACKS.md` is the handoff spec. Until they land, pack sprites render placeholders.
- **Worktree deletion incident (open concern)** — the previous incarnation of this session's worktree + branch were deleted externally mid-session (~10:08, never pushed; uncommitted work lost). The branch was re-created from origin/main and pushed early this time. Something on this machine deletes live session worktrees; flagged to owner, root cause not found.
- CommRails DAG `dag_612382` (all 8 nodes DONE) is session-local CLI state, not committed.
- Desktop rebuild (AGENTS.md step 8) was pending at attestation time — see follow-up.

## Files changed

- `surfaces/ai.allternit.com/src/components/chat/ChatComposer.tsx` — deck gate + locallyEnabled init
- `surfaces/ai.allternit.com/src/components/chat/ModeDock.tsx` + `__tests__/ModeDock.test.tsx` — unmounted-bot hint, tests
- `surfaces/ai.allternit.com/src/views/agent-view/components/create-bot/` — wizard-copy.ts (A:// removal, quota copy), shell restyle, IdentityStep (prompt chips), AvatarEditor (pack browser), AvatarImageCropper.tsx (new), avatar-packs.ts (new), starter-prompt-suggestions.ts (new), AVATAR_PACKS.md (new handoff), CreateBotWizard.tsx (pack wiring, refine states), ComputerRuntimeStep.tsx (presets + quota), vm-operator.ts (presets + resources pass-through), tests
- `cmd/allternit-api/src/bot_desktop_quotas.rs` — quota_status() refactor; `computer_routes.rs` — GET /api/v1/computers/quota
