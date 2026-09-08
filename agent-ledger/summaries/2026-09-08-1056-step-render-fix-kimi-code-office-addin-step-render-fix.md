# Agent Work Attestation — Office add-in completed step loses streamed text

- **Date:** 2026-09-08 10:56
- **Session ID:** step-render-fix
- **Branch:** `session/step-render-fix`
- **Agent:** kimi-code
- **PR:** #147 → merge `81dec055ec43c2e6b70e5cac712b4aea7702d678`

## What was done

Fixed the Office add-in task-pane bug where a streaming chat reply renders
live but the completed step card shows only "Step #N" — the accumulated
assistant text disappears exactly at the stream-Done transition
(reproduced 4/4 in the deployed pane by the owner).

## Root cause (file:line, at merge commit)

- `surfaces/allternit-extensions/allternit-office-addin/src/agent/useOfficeAgent.ts:725`
  commits each finished assistant turn to history as
  `{ type: 'step', content: displayText }` — a plain-text step with no
  `action` and no `reflection`.
- `surfaces/allternit-extensions/extension-shared/extension-sidepanel/ExtensionSidepanelShell.tsx`
  `StepCard` rendered only `event.reflection`, `event.action`, and the raw
  request/response tabs — never `event.content`.
- Mid-stream text renders through a separate path (`StreamingCard`, fed by
  `activity: { type: 'streaming' }`), which is why live rendering worked
  while the committed step card was empty. This is a render-contract bug,
  not a stream-parsing bug: `callAI` accumulates deltas correctly.

## Fix

- `ExtensionSidepanelShell.types.ts` — added optional `content?: string` to
  the `step` historical-event variant.
- `ExtensionSidepanelShell.tsx` `StepCard` — renders `event.content` as
  pre-wrapped text when present. Additive: computer-use step cards
  (reflection/action) are unchanged.

## Verification

- `npm run typecheck` — clean.
- `npm test` — 157/157 passing (14 files) on the rebased base.
- `vite build` — clean. Note: `npm run build`'s `icons:build` pre-step fails
  on missing `@resvg/resvg-js` in every checkout including shared main —
  pre-existing, unrelated to this change.
- Live Playwright repro (playwright-core from /tmp/pwtest, chromium-1234)
  against the built dist served on 127.0.0.1:8098 + a mock OpenAI-style SSE
  endpoint on 127.0.0.1:8123 (the real gateway's gizzi 4096 upstream was
  unreachable, as flagged — "Gizzi runtime unreachable"). Bootstrap injected
  via `sessionStorage['allternit-office-bootstrap-state']`, config model
  `kimi-for-coding`, Office shim for full-ai mode:
  - **Pre-fix build (negative control):** mid-stream text renders; after
    Done the step card contains only "Step #1" — bug reproduced.
  - **Post-fix build:** completed step retains the full streamed reply
    under "Step #N" with status Done. Screenshots:
    `/tmp/step-render-repro/completed-postfix.png` (PASS),
    `/tmp/step-render-repro/completed-prefix-bug.png` (FAIL, negative
    control).
- PR checks: gitleaks + validate-typography pass; Vercel preview checks fail
  account-wide with "Deployment rate limited — retry in 24 hours" —
  pre-existing infra state, unrelated to this diff.

## Incidents / deferrals

- The mock-SSE path verifies the add-in state-commit + render contract end
  to end, but not the real gateway model path — gizzi 4096 was down during
  the session (same flake the owner hit). Worth one live re-run against the
  real `kimi-for-coding` stream when gizzi is healthy.
- `icons:build` / `@resvg/resvg-js` missing from installed deps — pre-existing;
  not fixed here (out of scope).
