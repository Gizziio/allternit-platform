# PHASE 1A TASK — bot-chat foundation + transcript primitives

Read `docs/FABRIC_PWA_BOT_MODE_MAP.md` first — it is binding. Spec slug: `fabric-pwa-bot-mode-ui`
(rq-20260910-007, approved). This is sub-phase **1A of 3** (1A foundation → 1B approvals+composer →
1C PWA integration + web adoption). **Do NOT start 1B or 1C.** Do NOT modify any existing file
outside the new `src/components/bot-chat/` tree except the NOTES/sentinel files named below.

## Context

We are porting OpenMausBot's mobile bot-mode transcript grammar into a surface-agnostic component
set consumed later by both the Fabric Session PWA and `src/views/bots/BotChatSessionView.tsx`.
1A builds the pure foundation: types, the transcript fold reducer (rungs + tool-run folding + gap
timestamps), a cursor-based SSE reconnect client, and the presentational transcript primitives.
Adapters to real transports land in 1C — 1A components are pure and data-driven.

## Exact scope (create all under `surfaces/ai.allternit.com/src/components/bot-chat/`)

1. **`types.ts`** — named exports:
   - `BotChatMessage` (`id`, `role: 'user'|'bot'`, `text`, `createdAt`, `status: 'streaming'|'settled'|'error'`, `versions?: string[]` placeholder for later edit-retry)
   - `ToolCallRecord` / `ToolResultRecord` (`id`, `tool`, `inputSummary`, `outputSummary`, `durationMs?`, `status: 'running'|'success'|'error'`, `error?`)
   - `ApprovalRequest` — normalized: `id`, `botId`, `botName`, `title`, `detail?`, `options: ApprovalOption[]` (default approve/deny pair when the wire event has none), `grantKey?: string` (server-issued only), `timeout?`, `status: 'pending'|'approved'|'denied'|'expired'`
   - `TranscriptRow` discriminated union: `message` | `toolCall` | `toolRun` (folded group) | `approval` | `timestamp-gap` | `error`
   - `BotChatTranscript` — `{ rows: TranscriptRow[]; activeTurn: ActiveTurn | null }` where `ActiveTurn` tracks the current streaming turn: rung (`thinking` | `typing` | `streaming`), thinking buffer (cap 2000 chars), partial text, pending tool calls.
2. **`transcript.ts`** — pure fold, NO I/O:
   - `initTranscript()`, `applyEvent(transcript, event): BotChatTranscript` with events: `message.user`, `message.delta`, `thinking.delta`, `tool.call`, `tool.result`, `approval.requested`, `approval.resolved`, `turn.completed`, `error`.
   - Rungs: `thinking` (buffer fills; collapses automatically on first `message.delta`), `typing` (turn start → first token), `streaming` (tokens → `turn.completed`).
   - **Tool-run folding**: 2+ consecutive tool rows fold into one `toolRun` row ("Running N steps" / "Ran N steps", `expanded` flag toggled separately, not part of the fold). **A tool row with `status:'error'` NEVER folds** — it breaks the run (run closes before it; the error renders standalone). Single tool call = `toolCall` row.
   - Gap timestamps: a `timestamp-gap` row appears between adjacent rows whose `createdAt` differs by ≥ 30 min (label like "Yesterday 2:30 PM"; expose a `formatGap(from, to)` helper taking an injectable now for tests).
   - `deriveRung(transcript)` selector.
3. **`sse-cursor.ts`** — `openCursorSse(url: string, { onEvent, onCursor?, signal }): { close() }`:
   fetch-based SSE (repo idiom — see `sdk/allternit-sdk/src/ai-runtime/runtime/index.ts` `proxySse`
   for the established pattern), parses `id:` as `<streamId>:<seq>`, reconnects with
   `Last-Event-ID` after dropped connections (respect `signal`), exponential backoff capped at 15s,
   no retry after intentional abort. Keep it small.
4. **Presentational primitives** (all pure, props-only, zero data fetching):
   - `StreamingBubble.tsx` — bot bubble rendered in the SAME shape/style as the settled message with a **caret at the token frontier** (CSS caret, no blinking spinner); swaps to `SettledBubble` look on settle. Markdown for bot text; **plain text for user messages** (a message about `**` should show the asterisks).
   - `SettledBubble.tsx` — reuse the repo's existing markdown renderer if one is importable without view coupling (check `src/views/chat/` for the component `BotChatSessionView` uses); otherwise a minimal renderer. Tailed, edge-aligned bubbles; bot accent `var(--accent-primary)` fill for bot, neutral for user.
   - `TypingDots.tsx` — three-dot capsule, sine-staggered scale animation, respects `prefers-reduced-motion`, tinted with bot accent.
   - `WorkingChamber.tsx` — expandable "working" panel showing the thinking buffer (last 2000 chars), collapses when answer tokens start.
   - `ToolReceiptChip.tsx` — quiet capsule: tool name, mono `• 240ms` duration, status badge (running / ✓ / ✗), tap-to-expand input/output mono blocks.
   - `ToolRunCapsule.tsx` — "Running N steps ➜" / "Ran N steps ✓", chevron expand inline, individual `ToolReceiptChip`s inside.
   - `GapTimestamp.tsx`, `ErrorRow.tsx` (inline orange banner row, Register-1 copy).
   - `BotTranscript.tsx` — composes rows → the full transcript list; auto-scroll keyed on **character count, unanimated** (follow only when already near-bottom); `touch-action: pan-y`; tap-on-transcript dismisses keyboard (call an optional `onDismissKeyboard` prop).
5. **Tests** (colocated, vitest): `transcript.test.ts` (fold + rungs + gap injection), `run-folding.test.ts` (2+ fold, single stays, error breaks run, expand toggle), `sse-cursor.test.ts` (reconnect sends cursor id; abort stops retry). Mock fetch.

## Conventions (match repo idiom exactly)

- Tailwind inline + `cn` from `@/lib/utils` + theme tokens `var(--bg-elevated)`, `var(--text-tertiary)`, `var(--accent-primary)`.
- Icons: `@phosphor-icons/react`. Named exports only. No barrel file (consumers import paths directly).
- **Zero new runtime dependencies.** Zero imports from `src/fabric-session/` or `src/views/**` (components must be surface-agnostic; the markdown-renderer reuse above is the only allowed exception, and only if it doesn't drag view state).
- Voice: any user-visible copy is plain Register 1 — no hype, no guarantees.
- Client-facing UI must respect `prefers-reduced-motion`; 44px minimum touch targets on interactive chrome.

## Constraints

- NO git operations (no commit/push/branch) — the orchestrator handles git.
- NO dev servers, NO production builds. Verification = `npx vitest run src/components/bot-chat` from `surfaces/ai.allternit.com` + `npx tsc --noEmit` from the same directory (report pre-existing failures as pre-existing; do not fix unrelated files).
- Do not modify any existing source file in this phase. If you find you must, STOP and record it in NOTES deviations instead.
- Keep `.steering/checkpoint.md` updated (Goal / Just did / Next / Open questions) at each milestone — a steering agent reviews it.
- If `.allternit/shared-context.md` exists, append a `### fabric-pwa-bot-mode-ui <ISO ts>` milestone note per completed milestone.
- Drop evidence artifacts (test output) in `~/.agent-orchestrator/evidence/fabric-pwa-bot-mode-ui/`.

## Deliverable sentinel (mandatory)

When finished, write `docs/FABRIC_PWA_BOT_MODE_PHASE_1A_NOTES.md` starting with YAML frontmatter:

```yaml
---
status: done | blocked
files_changed: [paths]
deviations: [what + why]
remaining: [items]
---
```

then prose notes: what was built, how the fold works, test results (paste the vitest summary),
any open questions. **That file existing with `status: done` = done.**
