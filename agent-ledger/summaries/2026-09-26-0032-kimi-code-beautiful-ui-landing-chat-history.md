# 2026-09-26 00:32 — kimi-code — Beautiful UI landing + chat history renderer fixes

## What was done

1. **Rescued the stranded `session/polish-desktop-ui` work (allternit-ai).** The
   Beautiful UI adoption (committed 2026-09-20, merged into the *local* main
   checkout only) had never been pushed, PR'd, or deployed. Landed as:
   - PR Gizziio/allternit-ai#45 — the 4 stranded local-main commits (Beautiful UI
     workspace-ui suite, fabric fixes) + `dd8ecb7f` (tldraw 2.x `editor.mark()`
     fix; branch used the 3.x name).
   - PR #46 — fabric-session SW CACHE_NAME v47→v48 (guard failure follow-up).
2. **Fixed chat history rendering (PR #47).** Resumed sessions rendered literal
   `[Tool Bash]` / `[No text content]` and never showed the new tool
   chips/thinking. Root cause: agent-session routes ship structured gizzi parts
   in `metadata.parts`, but `CoworkTranscript` only read the live-stream
   `agentElementsParts` field and fell back to the server-flattened `content`.
   Fix: `wirePartsToUIParts` converter (tool → dynamic-tool with real
   input/output/error, thinking → reasoning, text/file passthrough) for main +
   linked sessions; placeholder suppressed in all fallbacks. User bubble tan
   (`--chat-composer-soft`) replaced with neutral `--chat-user-bubble-bg`.
3. **PR #48** — history tool chips default to completed (missing status ≠
   running). Partial: see open issue below.
4. **Desktop:** rebuilt platform-static from merged main and rsynced
   `resources/platform/` into the installed `/Applications/Allternit
   Desktop.app` (unsigned local build). Built
   `release/Allternit-Desktop-1.1.1-b3703-arm64.dmg` (contains PR #45/#46
   only — **predates #47/#48**). Old `-local` DMG deleted per one-DMG rule.

## Verification evidence

- allternit-ai full vitest 3577/3577 green at #45 landing; cowork/chat/ai-elements
  68/68 + 8 converter tests for #47/#48; vite build clean; typecheck at main parity.
- Live Desktop CDP verification (remote debugging port): `[Tool Bash]` and
  `[No text content]` literals gone; tool call renders as GlassPill chip
  ("Ran code"); both user bubbles confirmed `var(--chat-user-bubble-bg)` 4% wash
  via computed style.

## OPEN ISSUES (owner-reported 2026-09-26, not yet fixed)

1. **Incoherent concurrent activity indicators.** During a run the transcript
   shows three simultaneous "thinking" affordances: the dot + status label
   ("Plotting"), the thinking shimmer orb, and the tool "running" orb — reads
   as three parallel thinking threads instead of one coherent activity line.
2. **Stale active/shimmer states after completion.** Elements keep shimmering /
   badged "Running" after work is done. Concrete instance: the 5-day-old "Ran
   code" chip still badges **Running** after PR #48 — its wire part is
   `{"tool":"Bash","state":{"status":"running"|absent}}` with empty input and
   no result (fiber: `toolCallId: msg_…-wire-2, state: 'input-available'`).
   PR #48 only fixed the *default*; this part's stored status is likely
   explicitly `running` (interrupted pre-compat call never marked error).
   Next agent: decide a history-time rule (age-based settle, or treat
   result-less `running` in loaded history as interrupted/error) and check the
   same staleness in WorkingChamber/activity-indicator/ThinkingOrb paths.
3. **Abrupt text reveal.** Streamed text "drops onto the screen" — owner wants
   a tasteful progressive reveal in UnifiedMessageRenderer / StreamingBubble.

## Deferrals and notes

- Desktop left running with `--remote-debugging-port=9222` during verification;
  relaunched clean at session end.
- Installed app bundle was hot-patched by rsync (unsigned local). The next
  proper DMG should be rebuilt from current main to include #47/#48.
- allternit-ai shared checkout still holds unrelated uncommitted cloud-console
  changes (another session's in-flight work) — left untouched.
- Worktree gotcha: `pnpm install` fails on better-sqlite3 gyp under node 26;
  use `pnpm install --ignore-scripts` (bins link fine; sqlite only needed by
  some backend tests).
- Libraries.dev review (23 ranked spots) was delivered; effects NOT applied
  (owner chose branch-landing first). Top picks: ThinkingOrb swap inside
  `activity-indicator.tsx`, BorderBeam `line` on composers, VoiceBeam replacing
  the hand-rolled voice bars in `ChatComposer.tsx:1758`.
- Brain update draft filed at `Allternit Brain/.incoming/draft-1790397363999.json`.

Handoff doc for the next agent:
`/Users/joe/Desktop/allternit-workspace/HANDOFF-chat-ui-renderer-2026-09-26.md`
