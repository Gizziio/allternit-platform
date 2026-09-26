# Attestation — session/gizzi-tui-parity (P2): streaming reveal + tool-card polish

**Date:** 2026-09-26 04:47 · **Agent:** kimi-code · **Session branch:** `session/gizzi-tui-parity` (multi-phase program) · **DAG:** dag_625298 / wih_8397

## What was done

P2 of the gizzi-code TUI parity program — streaming text and tool-call presentation polish:

1. **Progressive reveal** (`REPL.tsx`, `Messages.tsx`): the in-progress streaming line was hidden until its newline landed (line-block pops). The trailing line now renders dimmed via a new `streamingTail` prop and inks in when completed; layout height identical so scroll stays stable. Stable lines unchanged (`StreamingMarkdown`); `prefersReducedMotion` and the `hasCursorUpViewportYankBug()` env gate still suppress the preview.
2. **Highlight flash fix** (`app.tsx`): `tui()` warms `getCliHighlightPromise()` at startup so the first streamed code block renders colored instead of painting plain then swapping when the lazy `cli-highlight` import resolved.
3. **ToolUseCard polish** (`messages/ToolUseCard.tsx`): state label gains ● / ◌ glyphs, bold for active states, dim for queued.

**PR:** #745, merge commit `68dd173a420f0bfed31732145b47d425c4d727e2`.

## Verification evidence

- `bun test test/components/` + `test/cli/tui/`: 24/24 pass. `bun run typecheck`: clean. `release-preflight.mjs`: 52/0.

## Honest deferrals

- The dim-tail reveal was verified by prop-flow inspection and unit tests, **not** with a live model turn (declined to spend owner quota on a render check). First real run should eyeball: tail line dims, inks in per line, no scroll jump, no spinner bounce (the `showSpinner` logic still keys off the stable-part-only `visibleStreamingText`, unchanged).
- No test covers the tail rendering — Messages has no render harness in repo conventions (component tests are export smoke tests).
- Desktop binary rebuild still deferred to program end.
