---
status: done
files_changed:
  - surfaces/ai.allternit.com/src/components/bot-chat/types.ts
  - surfaces/ai.allternit.com/src/components/bot-chat/transcript.ts
  - surfaces/ai.allternit.com/src/components/bot-chat/sse-cursor.ts
  - surfaces/ai.allternit.com/src/components/bot-chat/SettledBubble.tsx
  - surfaces/ai.allternit.com/src/components/bot-chat/StreamingBubble.tsx
  - surfaces/ai.allternit.com/src/components/bot-chat/TypingDots.tsx
  - surfaces/ai.allternit.com/src/components/bot-chat/WorkingChamber.tsx
  - surfaces/ai.allternit.com/src/components/bot-chat/ToolReceiptChip.tsx
  - surfaces/ai.allternit.com/src/components/bot-chat/ToolRunCapsule.tsx
  - surfaces/ai.allternit.com/src/components/bot-chat/GapTimestamp.tsx
  - surfaces/ai.allternit.com/src/components/bot-chat/ErrorRow.tsx
  - surfaces/ai.allternit.com/src/components/bot-chat/BotTranscript.tsx
  - surfaces/ai.allternit.com/src/components/bot-chat/transcript.test.ts
  - surfaces/ai.allternit.com/src/components/bot-chat/run-folding.test.ts
  - surfaces/ai.allternit.com/src/components/bot-chat/sse-cursor.test.ts
deviations:
  - "`typing` rung provenance: the spec's event grammar has no explicit
    turn-start event, so `message.user` opens the active turn at rung
    `typing` (turn start → first token). `message.delta`/`thinking.delta`
    adopt the assistant message id from the first delta they carry, replacing
    the placeholder `turn:<userMsgId>` id. This is the only interpretation
    under which the `typing` rung is reachable."
  - "`formatGap` pins `en-US` locale (day names only; no timezone math) so
    labels are deterministic across machines. Labels match the spec example
    shape: `Yesterday 2:30 PM`, `Sep 3 9:15 AM`, `Dec 20, 2025 9:15 AM`."
  - "sse-cursor takes an optional `fetchImpl` injection (defaults to global
    `fetch`) in addition to the spec'd signature — keeps tests hermetic
    without touching globals. `openCursorSse(url, { onEvent, onCursor?, signal })`
    is unchanged otherwise."
  - "Backoff resets to 1s after any connection that received an HTTP
    response (standard SSE client behavior); the exponential ladder (1s →
    2s → 4s → 8s → 15s cap) applies to consecutive failures before a
    response, which is what the backoff test exercises."
  - "Approval rows render as a quiet placeholder capsule in BotTranscript
    (title + status). The approval card/pill are explicitly 1B scope; the 1A
    row model (`ApprovalRequest` normalization, default approve/deny pair,
    server-issued `grantKey` passthrough) is complete and tested."
remaining:
  - "1B: approval card + pill, composer (growth/chips/HUD/action sheet/dictation), haptics."
  - "1C: adapters (chatApi.streamChat callbacks + fabric relay events into fold events), PWA integration, ACI pull, web adoption of BotChatSessionView, smoke test."
  - "Bundle review for 1C: SettledBubble/StreamingBubble reuse `@/components/ai-elements/markdown` (Streamdown + mermaid/math/code plugins — already in the tree, zero new deps, but heavy for the desktop static bundle). Swap for a minimal renderer there if bundle audit flags it."
---

# Phase 1A notes — bot-chat foundation + transcript primitives

## What was built

`surfaces/ai.allternit.com/src/components/bot-chat/` — a surface-agnostic,
pure-data bot-chat component set. Fifteen new files, nothing existing
modified, zero new runtime dependencies, no imports from `src/fabric-session/`
or `src/views/**` (the `Markdown` reuse below is the spec-sanctioned
exception and drags no view state).

- **`types.ts`** — `BotChatMessage` (with `versions?` edit-retry placeholder),
  `ToolCallRecord`/`ToolResultRecord`, normalized `ApprovalRequest` (default
  approve/deny pair when the wire event omits options; `grantKey` server-issued
  only), `TranscriptRow` discriminated union, `ToolRunGroup`, `ActiveTurn`
  (rung + capped thinking buffer + partial text + pending tool calls),
  `BotChatTranscript`, plus `THINKING_BUFFER_CAP = 2000` and
  `GAP_THRESHOLD_MS = 30min`.
- **`transcript.ts`** — the pure fold. `initTranscript`, `applyEvent` over the
  nine spec'd events, `deriveRung`, `formatGap(from, to, now?)`.
- **`sse-cursor.ts`** — `openCursorSse(url, { onEvent, onCursor?, signal, fetchImpl? })`,
  fetch-based (repo `proxySse` idiom, never EventSource), `id:` parsed as
  `<streamId>:<seq>` cursor, `Last-Event-ID` replay, backoff 1s→15s, no retry
  on intentional abort.
- **Primitives** — `StreamingBubble` (caret at token frontier, CSS-only,
  reduced-motion static; swaps to the settled look via `status`), `SettledBubble`
  (tailed edge-aligned; shared `Markdown` for bot, plain text for user so `**`
  shows literally), `TypingDots` (sine-staggered scale, `motion-safe:`,
  accent-tinted), `WorkingChamber` (auto-collapses when rung leaves
  `thinking`; tap pins), `ToolReceiptChip` (mono `• 240ms`, ✓/✗/running badge,
  tap-expand mono blocks, 44px target), `ToolRunCapsule` ("Running N steps ➜" /
  "Ran N steps ✓", chevron expand, chips inside), `GapTimestamp`, `ErrorRow`
  (Register-1 copy), and `BotTranscript` (row composition + active-turn chrome,
  char-count-keyed unanimated follow-scroll only when near bottom,
  `touch-action: pan-y`, tap → `onDismissKeyboard?`).

## How the fold works

Single entry point, immutable updates, no I/O:

- **Rungs.** `message.user` opens the turn at `typing`. `thinking.delta`
  promotes to `thinking` (buffer kept as the last ≤2000 chars; a late thinking
  chunk never downgrades `streaming`). First `message.delta` collapses to
  `streaming` and accumulates `partialText`. `turn.completed` (or the next
  `message.user`) settles: non-empty partial text materializes as a `settled`
  bot `message` row, then `activeTurn` clears. `deriveRung` reads
  `activeTurn.rung ?? null`.
- **Tool-run folding.** `tool.call` appends a running `toolCall` row. If the
  immediately previous row is a non-error `toolCall`, the pair becomes a
  `toolRun` group; if it is a `toolRun`, the call joins it. Anything else
  (message, approval, gap, error tool) leaves it standalone — a
  `timestamp-gap` row therefore blocks folding, since 30+ minutes apart is a
  new burst, not a run. `tool.result` patches the call in place; group status
  is derived (any running → `running`, else `success`). **Error never folds:**
  if a result comes back `error` for a call that was previewed inside a run,
  the run closes before it — a 2-call run collapses back to the single
  surviving `toolCall`, a 3-call run shrinks to 2 — and the error renders as a
  standalone `toolCall` row right after.
- **Gaps.** Every content-row append compares against the previous content
  timestamp; ≥30 minutes inserts a `timestamp-gap` row labeled by `formatGap`
  ("Yesterday 2:30 PM").
- **Approvals.** `approval.requested` normalizes to `ApprovalRequest`
  (default approve/deny pair, `kind` inferred from wire option ids/labels when
  absent, `grantKey` passed through untouched). `approval.resolved` updates
  the row status. The client never invents grant keys.
- **Expand state.** `ToolRunGroup.expanded` exists in the model (extension
  point) but the fold never toggles it — `ToolRunCapsule` owns expansion in
  component state; a test pins this.

## Verification

```
npx vitest run src/components/bot-chat   (from surfaces/ai.allternit.com)

 ✓ src/components/bot-chat/run-folding.test.ts  (10 tests)
 ✓ src/components/bot-chat/sse-cursor.test.ts  (5 tests)
 ✓ src/components/bot-chat/transcript.test.ts  (16 tests)

 Test Files  3 passed (3)
      Tests  31 passed (31)
```

```
npx tsc --noEmit   (from surfaces/ai.allternit.com)
0 errors — no pre-existing failures on this branch either.
```

(Worktree needed a fresh `pnpm install --frozen-lockfile` first — the surface
had no `node_modules`.)

Evidence: `~/.agent-orchestrator/evidence/fabric-pwa-bot-mode-ui/`
(`vitest-bot-chat.txt`, `tsc-noemit.txt`).

## Open questions for 1B/1C

- Streamdown weight: the shared `Markdown` pulls mermaid/math/code plugins.
  Already in the dependency tree and fine for the platform; 1C should audit
  the desktop static bundle and swap in a minimal renderer if it matters.
- Gap labels use the viewer's local timezone (Date methods, no TZ math) —
  correct for a device-local transcript; relay-fed multi-device views may
  want pinned tz later.
- `turn.completed` without a timestamp falls back to the turn's start time;
  adapters should always emit one.
