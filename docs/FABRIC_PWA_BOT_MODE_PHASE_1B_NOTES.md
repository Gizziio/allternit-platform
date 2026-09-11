---
status: done
files_changed:
  - surfaces/ai.allternit.com/src/components/bot-chat/ApprovalCard.tsx
  - surfaces/ai.allternit.com/src/components/bot-chat/ApprovalPill.tsx
  - surfaces/ai.allternit.com/src/components/bot-chat/WaitingOnYouPill.tsx
  - surfaces/ai.allternit.com/src/components/bot-chat/BotComposer.tsx
  - surfaces/ai.allternit.com/src/components/bot-chat/haptics.ts
  - surfaces/ai.allternit.com/src/components/bot-chat/BotTranscript.tsx
  - surfaces/ai.allternit.com/src/components/bot-chat/approval-card.test.tsx
  - surfaces/ai.allternit.com/src/components/bot-chat/composer.test.tsx
  - surfaces/ai.allternit.com/src/components/bot-chat/haptics.test.ts
  - docs/FABRIC_PWA_BOT_MODE_PHASE_1B_NOTES.md
  - .steering/checkpoint.md
  - .allternit/shared-context.md
deviations:
  - "Vitest's classic JSX transform (surface tsconfig is `jsx: preserve`)
    requires a React identifier in scope. Added `import React from \"react\"`
    to ApprovalCard.tsx and BotComposer.tsx — the two files the new tests
    render. No other components rewritten."
  - "ApprovalCard settled-label lookup: `const pending = status === \"pending\"`
    does not narrow `approval.status` for tsc, so `SETTLED_LABEL[approval.status]`
    was TS7053. Smallest fix: compute `settledLabel` from a direct
    `approval.status === \"pending\"` ternary, then reuse it in both settled
    slots. Behavior unchanged."
  - "Composer growth/maxRows: jsdom does not layout textarea height. The
    component already stamps `data-max-rows={5}` (and `rows={1}`); the test
    asserts those attributes rather than computed pixel height."
remaining:
  - "1C: adapters (chatApi.streamChat callbacks + fabric relay events into fold events), PWA integration (App view switch, Bots section + chat page), ACI watch-toggle pull mode, touch/safe-area chrome, web adoption of BotChatSessionView, 390×844 standalone smoke, docs, release-preflight."
  - "Bundle review carried from 1A: SettledBubble/StreamingBubble reuse `@/components/ai-elements/markdown` (Streamdown + mermaid/math/code plugins). Swap for a minimal renderer in 1C if the desktop static bundle audit flags it."
---

# Phase 1B notes — approvals layer + one-handed composer

## What was built

`surfaces/ai.allternit.com/src/components/bot-chat/` — approvals + composer on
top of the 1A fold/primitives. Implementation landed in a prior executor
pass; this remaining pass wrote the three colocated test files, the two
smallest type/JSX fixes the contract required, and this sentinel. Zero new
runtime dependencies. No imports from `src/fabric-session/` or
`src/views/**`. Phase 1C not started.

- **`ApprovalCard.tsx`** — inline card for one `ApprovalRequest`. Pending:
  accent at ~12% (`color-mix`) + 1.5px accent stroke, raised-hand header
  (`{botName} is waiting on you`), one capsule per `approval.options`
  (approve = accent fill, deny = grey fill, neutral = outline), ≥40px
  tall. Settled: quiet grey, `"Approved ✓"` / `"Denied"` / `"Expired"`.
  **"Always allow this tool" renders only when `approval.grantKey` is
  present** (server-issued; never invented). `onAnswer(optionId)` /
  `onGrant?(grantKey)`; `vibrateApproval()` on answer.
- **`ApprovalPill.tsx`** — collapsed `{botName} needs you` capsule (+ count
  when >1 pending). Tap expands inline below (question + per-option
  capsules, same tinting). Tap-outside or answering collapses. Positioning
  stays with the parent (1C). Expansion is height/opacity, `motion-safe:`.
- **`WaitingOnYouPill.tsx`** — roster-row capsule, raised-hand + "Waiting
  on you", optional `onClick`.
- **`haptics.ts`** — `vibrateSend()` / `vibrateApproval()`. `navigator.vibrate`
  guarded; silent no-op when absent or when it throws. No haptics on
  streamed tokens.
- **`BotComposer.tsx`** — sibling-of-scroll bar, pure props. Growing
  textarea (1–5 lines, `data-max-rows={5}`), Enter sends / Shift+Enter
  newline, accent send circle when non-empty. Predictive chips from
  `suggestions` (idle only; tap → `onSend`). `/` opens slash HUD
  ("Routines"); filter by title; `prompt` fills the input without sending;
  `navigate` calls `onNavigate(id)`. `+` rotates to × and opens a
  bottom-anchored action sheet (never a centered modal). Dictation via
  `webkitSpeechRecognition`/`SpeechRecognition` when present; absent API →
  disabled mic + tooltip, no throw. Status row slot via `status?`.
- **`BotTranscript.tsx`** — 1A approval placeholder replaced with
  `<ApprovalCard>` wired to pass-through `onApprovalAnswer?` /
  `onApprovalGrant?`. Orchestrator review: the map initially omitted those
  props; they are now passed into `TranscriptRowView`. Fold still owns
  state in 1C.

## Independent test summary

Colocated vitest, jsdom. New suites cover the 1B contract; 1A suites
unchanged.

- **`approval-card.test.tsx`** — pending tint vs settled (`alertdialog` →
  `status`, accent stroke vs grey, settled labels); one capsule per option
  with approve/deny/neutral tinting; Always-allow only with `grantKey`;
  `onAnswer` / `onGrant` fire.
- **`composer.test.tsx`** — Enter sends + clears; chips from props tap-send
  (`prompt` or `label` fallback); `/` opens HUD, title filter, prompt
  command fills input without sending; dictation no-ops when
  `SpeechRecognition` is undefined (jsdom — mic disabled, no throw);
  growth asserted via `data-max-rows="5"`.
- **`haptics.test.ts`** — vibrate called with the send tick / approval
  double-tap when present; silent no-op when absent or when vibrate throws.

## Verification

```
npx vitest run src/components/bot-chat   (from surfaces/ai.allternit.com)

 ✓ src/components/bot-chat/haptics.test.ts  (3 tests)
 ✓ src/components/bot-chat/run-folding.test.ts  (10 tests)
 ✓ src/components/bot-chat/transcript.test.ts  (16 tests)
 ✓ src/components/bot-chat/sse-cursor.test.ts  (5 tests)
 ✓ src/components/bot-chat/approval-card.test.tsx  (4 tests)
 ✓ src/components/bot-chat/composer.test.tsx  (5 tests)

 Test Files  6 passed (6)
      Tests  43 passed (43)
```

```
npx tsc --noEmit   (from surfaces/ai.allternit.com)
0 errors
```

Evidence: `~/.agent-orchestrator/evidence/fabric-pwa-bot-mode-ui/`
(`vitest-bot-chat-1b.txt`, `tsc-noemit-1b.txt`).

## Open questions

- None blocking 1B. 1C owns adapters, PWA view-switch, ACI pull, web
  `BotChatSessionView` adoption, and the 390×844 smoke.
- Dictation is a graceful no-op in jsdom / iOS Safari without the API —
  acceptable per the MAP. Live Web Speech behavior is 1C smoke, not this
  suite.
- Streamdown bundle-weight question from 1A still stands for 1C.
