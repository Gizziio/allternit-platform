# PHASE 1B REMAINING — tests + sentinel only

Read `docs/FABRIC_PWA_BOT_MODE_MAP.md` and `docs/FABRIC_PWA_BOT_MODE_PHASE_1B_TASK.md` first. They are binding.

The previous executor (kimi) wrote the implementation, then died on a 5-hour usage quota **before tests and the NOTES sentinel**. Your job is to **finish 1B, not redo it**.

## Already on disk — preserve unless a test proves a real bug

All under `surfaces/ai.allternit.com/src/components/bot-chat/`:

- `haptics.ts` — `vibrateSend` / `vibrateApproval`, guarded `navigator.vibrate`
- `ApprovalCard.tsx` — pending tint, settled labels, per-option capsules, Always-allow only with `grantKey`
- `ApprovalPill.tsx` — collapsed capsule, inline expand
- `WaitingOnYouPill.tsx`
- `BotComposer.tsx` — growing textarea, chips, slash HUD, bottom sheet, guarded dictation
- `BotTranscript.tsx` — already imports `ApprovalCard` and pass-through `onApprovalAnswer` / `onApprovalGrant`

**Do not rewrite these.** If a test fails, make the smallest fix that makes the task's contract true.

## Missing (this is the work)

1. `approval-card.test.tsx` — pending tint vs settled; one capsule per option; approve/deny tinting; **"Always allow" renders only with grantKey**; `onAnswer` / `onGrant` fire.
2. `composer.test.tsx` — Enter sends + clears; chips from props tap-send; `/` opens HUD, filtering works, `prompt` command fills input without sending; dictation no-ops when `SpeechRecognition` is undefined (jsdom — mic disabled, no throw). Growth/maxRows: assert if present, otherwise skip with a one-line comment.
3. `haptics.test.ts` — vibrate called when present, silent no-op when absent.
4. `docs/FABRIC_PWA_BOT_MODE_PHASE_1B_NOTES.md` — same frontmatter as 1A (`status`, `files_changed`, `deviations`, `remaining`) + prose (what was built, independent test summary, open questions). `status: done` = done.

Use `@testing-library/react` (`render`, `screen`, `fireEvent`) — already a dep. Vitest environment is already `jsdom`. Mirror 1A test style: `import { describe, expect, it } from "vitest"`. Named exports only.

## Verify

From `surfaces/ai.allternit.com`:

```
npx vitest run src/components/bot-chat
npx tsc --noEmit
```

Do **not** start Phase 1C. No git operations. No new runtime deps. No imports from `src/fabric-session/` or `src/views/**`. No edits outside `src/components/bot-chat/` except the NOTES sentinel and the mandated `.steering/checkpoint.md` / `.allternit/shared-context.md` appends.

Existing NOTES file with `status: done` = you are finished. Do not keep going.
