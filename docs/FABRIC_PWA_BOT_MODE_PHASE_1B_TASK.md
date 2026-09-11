# PHASE 1B TASK — approvals layer + one-handed composer

Read `docs/FABRIC_PWA_BOT_MODE_MAP.md` first — it is binding. Phase 1A is **reviewed and approved**
(commit `63e9cb96e`): `src/components/bot-chat/` already contains types.ts, transcript.ts (fold),
sse-cursor.ts, SettledBubble, StreamingBubble, TypingDots, WorkingChamber, ToolReceiptChip,
ToolRunCapsule, GapTimestamp, ErrorRow, BotTranscript (+ 3 test files, 31 tests green). **Preserve
all of it.** This phase adds the approvals layer and the composer. **Do NOT start 1C** (no PWA
integration, no adapters, no edits outside `src/components/bot-chat/` except the sentinel/checkpoint
files).

## Context

OpenMausBot's signature mobile patterns, adapted per the MAP's binding decisions: approvals are
answerable inline (card), from the roster (pill), and without opening the chat (top-pinned pill);
the composer is one-handed (chips, `/` HUD, bottom-anchored action sheet, tap-to-talk).

## Exact scope (all under `surfaces/ai.allternit.com/src/components/bot-chat/`)

1. **`ApprovalCard.tsx`** — inline card for a `ApprovalRequest` (import the type from `./types`):
   - Full-width rounded card (22px radius equivalent in Tailwind), tinted background (bot accent at
     ~12% opacity) + 1.5px accent stroke **while pending**; fades to a quiet grey settled state
     ("Approved ✓" / "Denied" / "Expired") after resolution.
   - Header row: raised-hand icon + "{botName} is waiting on you" in accent color.
   - Title (semibold) + optional detail.
   - **One capsule button per option** in `approval.options` (from the fold's normalization):
     `kind === 'approve'` → accent fill; `kind === 'deny'` → neutral/grey fill; `kind === 'neutral'`
     → outline. Capsules ≥40px tall, full option label.
   - **"Always allow this tool" text link renders ONLY when `approval.grantKey` is present**
     (server-issued); emits `onGrant(key)`. Never invent keys.
   - Props: `approval: ApprovalRequest`, `accentColor?: string`, `onAnswer: (optionId: string) => void`,
     `onGrant?: (grantKey: string) => void`. Fires `vibrateApproval()` from `haptics.ts` on answer.
2. **`ApprovalPill.tsx`** — the fake-island surface for phone chrome:
   - Collapsed: a small dark capsule pinned by the PARENT to the top safe-area inset showing
     "{botName} needs you" (+ count when the parent passes multiple). This component renders only
     the pill UI; positioning stays with the consumer (1C).
   - Tap expands **inline below the capsule** (not a modal): the question + per-option capsules,
     same tinting rules as the card. Tap-outside or answering collapses it. Expansion is
     height/opacity, `motion-safe:` only.
   - Props: `approvals: ApprovalRequest[]` (usually 1), `accentColor?: string`, same callbacks.
3. **`WaitingOnYouPill.tsx`** — roster-row pill: accent-tinted capsule, raised-hand icon,
   "Waiting on you". Props: `accentColor?: string`, optional `onClick`.
4. **`haptics.ts`** — `vibrateSend()`, `vibrateApproval()` — `navigator.vibrate` guarded (no-op when
   absent, e.g. iOS Safari; never throws). No haptics on streamed tokens.
5. **`BotComposer.tsx`** — the one-handed composer (pure props, no fetching):
   - Sibling-of-scroll layout (the parent positions it; this renders the bar only).
   - Vertically growing textarea, 1–5 lines, Enter/Return sends (calls `onSend(text)`), Shift+Enter
     newline (desktop). Send arrow: accent circle when non-empty, grey ghost otherwise, 0.15s
     crossfade. `vibrateSend()` on successful send.
   - **PredictiveActionChips** (same file or colocated): when idle (no draft, not busy), a
     horizontally scrolling row of capsule chips from prop `suggestions: { id, label }[]`; tap →
     `onSend(routinePrompt)` immediately. Parent supplies routines via `getRoutinesForBot` in 1C —
     here just render what you're given. Match repo tokens: caption-size semibold, subtle fill +
     hairline stroke.
   - **SlashCommandHud**: typing `/` as the first character opens a filtering HUD above the bar:
     header "ROUTINES" + close; one card per prop `commands: { id, title, description, accentColor?,
     action: 'navigate' | 'prompt', prompt? }[]`; filtering by title; selecting a `prompt` command
     expands it into the full natural-language prompt in the input (does NOT send until user hits
     return); `navigate` calls `onNavigate(id)`.
   - **+ button** rotates 45° into × and opens a **bottom-anchored action sheet** (slides up above
     the bar, backdrop-dismiss, half-height max): rows from prop `actions: { id, icon, title,
     subtitle, danger?, disabled?, onSelect }[]` — icon-in-circle + title + one-line subtitle;
     `danger` rows render red (this is where 1C puts Interrupt). Never a centered modal.
   - **Dictation** (tap-to-talk mic, phosphor mic icon): tap starts `webkitSpeechRecognition`/
     `SpeechRecognition` when available; mic turns red with pulse; placeholder switches to
     "Listening…"; **partial transcripts REPLACE against the frozen draft base** (never stack);
     tap again stops and leaves text editable. Cancellation on send/close. When the API is absent,
     the mic renders disabled with `title` tooltip — no error state theater.
     Use a minimal local type declaration for the non-standard API; guard everything.
   - Status row slot above the bar (parent passes `status?: string` — e.g. "Sending…", error text).
6. **BotTranscript.tsx edit** — replace the 1A approval placeholder block with
   `<ApprovalCard approval={row.approval} …>` wired to new optional props
   `onApprovalAnswer?: (approvalId, optionId) => void` and `onApprovalGrant?: (approvalId, grantKey) => void`
   (pass-through; the fold adapter in 1C owns state). Keep everything else byte-identical.
7. **Tests** (colocated vitest, jsdom where needed):
   - `approval-card.test.tsx` — pending tint vs settled state; one capsule per option; approve/deny
     tinting; **"Always allow" renders only with grantKey**; onAnswer/onGrant fire.
   - `composer.test.tsx` — growth is textarea behavior (assert maxRows attr or skip); Enter sends +
     clears; chips render from props and tap sends; `/` opens HUD, filtering works, prompt-command
     fills input without sending; dictation gracefully no-ops when `SpeechRecognition` is undefined
     (jsdom has neither — assert mic disabled, no throw).
   - `haptics.test.ts` — vibrate called when present, silent no-op when absent.

## Conventions + constraints (unchanged from 1A)

- Tailwind + `cn` from `@/lib/utils` + `var(--…)` tokens; `@phosphor-icons/react`; named exports;
  no barrel; zero new runtime deps; zero imports from `src/fabric-session/` or `src/views/**`.
- Any user-visible copy: voice Register 1 — plain, direct, no hype, no guarantees.
- 44px minimum touch targets on interactive chrome; `prefers-reduced-motion` honored everywhere.
- NO git operations; NO dev servers. Verification = `npx vitest run src/components/bot-chat` +
  `npx tsc --noEmit` from `surfaces/ai.allternit.com`.
- Update `.steering/checkpoint.md` at milestones; append `### fabric-pwa-bot-mode-ui <ts>` to
  `.allternit/shared-context.md` when present; evidence to `~/.agent-orchestrator/evidence/fabric-pwa-bot-mode-ui/`.

## Deliverable sentinel

Write `docs/FABRIC_PWA_BOT_MODE_PHASE_1B_NOTES.md` with the same frontmatter shape as 1A
(`status`, `files_changed`, `deviations`, `remaining`) + prose (what was built, test summary,
open questions). Existing with `status: done` = done.
