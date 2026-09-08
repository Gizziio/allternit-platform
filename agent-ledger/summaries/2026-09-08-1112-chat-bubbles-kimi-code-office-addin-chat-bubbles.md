# Agent Work Attestation — Office add-in chat bubble UI for plain replies

- **Date:** 2026-09-08 11:12
- **Session ID:** chat-bubbles
- **Branch:** `session/chat-bubbles`
- **Agent:** kimi-code
- **PR:** #151 → merge `f76d26235fcc5669e6ba88baa50d9c52e1666ba7`

## What was done

Owner feedback on the Connected pane chat: "i dont like how all the responses
are in these ugly boxes and says step — even the responses need to fix that ugly
ui". Plain assistant text replies rendered as boxed "Step #N" cards
(`StepCard`), reading like an agent debug log instead of a chat. Presentation
fix only, building directly on #147 (which made StepCard render `content`).

## How it works (file:line, at merge commit)

- `surfaces/allternit-extensions/extension-shared/extension-sidepanel/ExtensionSidepanelShell.types.ts`
  — new `{ type: "user", content: string }` historical-event variant. The
  office adapter's history always carried user events, but the union had no
  variant for them, so they silently rendered nothing (`EventCardInner` fell
  through to `null`; only the "Task" banner showed the prompt).
- `ExtensionSidepanelShell.tsx`
  - `UserMessageBubble` — right-aligned, accent-brand (`--accent-brand`,
    coral `#D97757`) tinted bubble, `rounded-2xl rounded-br-md` tail.
  - `AssistantMessageBubble` — mirrors `StreamingCard` chrome exactly (border,
    muted bg, Sparkles mark, pre-wrapped text) minus cursor/ping, so a
    completed turn is visually continuous with its stream.
  - `EventCardInner` dispatch: a `step` with `action` / `reflection` /
    rawRequest/rawResponse keeps the structured `StepCard` (genuine agent
    steps; #147's in-card content rendering untouched). A step with **only**
    `content` is a chat message → assistant bubble. Persisted legacy
    content-only step events render as bubbles automatically. The
    `action.name === "done"` StepCard+ResultCard path is unchanged.

Empty state, MotionOverlay, composer, history views: untouched. Chrome
extension boundary is a cast (`platformState.history as
ExtensionSidepanelHistoricalEvent[]`), so the new variant is inert there.

## Verification

- `npm run typecheck` — clean; `npm test` — 158/158 (14 files); `vite build` —
  clean (same pre-existing `@resvg/resvg-js` icons:build gap noted in #147).
- Playwright (playwright-core from /tmp/pwtest, chromium-1234, 360x640, light
  **and** dark OS color scheme) against the built dist on 127.0.0.1:8098 + mock
  OpenAI-style SSE on 127.0.0.1:8123 (gizzi 4096 still unreachable):
  - `chat-light.png` / `chat-dark.png` — user bubble right (coral), assistant
    bubble left, NO "Step #N" for the plain reply; pane stays pinned light
    under dark OS (#139 `appearance="light"` preserved).
  - `structured-step.png` — seeded history with a real tool-call step
    (reflection + action + tool_execution): StepCard + tool cards still
    render, user bubble intact.
  - `before-boxed-step.png` — the old boxed "Step #1" rendering (#147 state).
  - Screenshots in `/tmp/chat-bubbles-repro/`.
- PR checks: gitleaks + validate-typography pass; Vercel previews fail
  account-wide "Deployment rate limited — retry in 24 hours" (pre-existing).

## Incidents / deferrals

- Dark-OS emulation renders light by design (office pane pins light theme);
  the dark run verifies no regression, not a dark chat theme.
- Live-gateway visual pass still deferred on gizzi 4096 health (same flake as
  #147); the mock-SSE path exercises the full pane state → render pipeline.
