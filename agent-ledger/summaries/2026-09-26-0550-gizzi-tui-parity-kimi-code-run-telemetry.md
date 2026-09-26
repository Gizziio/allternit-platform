# Attestation — session/gizzi-tui-parity (P4): run telemetry + plan quota in the TUI

**Date:** 2026-09-26 05:50 · **Agent:** kimi-code (coder subagent implemented; parent reviewed + landed) · **Session branch:** `session/gizzi-tui-parity` · **DAG:** dag_625298 / wih_8397

## What was done

P4 of the gizzi-code TUI parity program — ported the desktop RunTelemetry surface to the terminal:

- **Per-turn telemetry line**: new `SystemRunTelemetryMessage` emitted in `onQuery`'s finally block. Segments: model · wall time · in/out tokens diffed from the ink-app cost tracker across the turn (no double-count on parallel tool calls; `est.` flag from runtime `usageEstimated`/`tokensEstimated` markers on this turn's messages) · cost when known · tool count · 10-block context bar · tightest ProviderQuotas chip. Never-fabricate assembly (`utils/telemetry/runTelemetryModel.ts`): absent data omits the segment, no message when empty; quota patched in exactly once, static thereafter; hidden in brief mode.
- **`/usage` Plan quota section**: per-window used-% bars + resets-in, honest unsupported/signed-out/expired/not-reported states, reasoning-token line.
- Formatters are verbatim ports of allternit-ai `RunTelemetry.tsx` pure helpers; quota bridge reuses the P3 `require()`-in-try/catch pattern.

**PR:** #748, merge commit `4847f9005064f107b29f465192ab84351ae0c51b`.

**Incident:** PR initially CONFLICTING — `.steering/checkpoint.md` is shared across parallel sessions and session/subsfab-p3 had rewritten it on main. Resolved by keeping both sessions' sections in one file (active session on top) and noting the convention in the file. Recurrence likely; a per-session checkpoint path would be the real fix (deferred — steering-infra decision, not this program's scope).

## Verification evidence

- 20 new telemetry tests (`test/components/RunTelemetry.test.ts`, re-run by parent: 18 pass/0 fail in-file plus usage test); `test/components/` + `test/commands/`: 45/45. 3 pre-existing `/status` env failures reproduced on the pristine tree — unrelated.
- `bun run typecheck`: clean. `release-preflight.mjs`: 52/0.
- Live pty smoke: `/usage` renders the Plan quota section with the honest not-reported state. Processes cleaned up.

## Honest deferrals

- The per-turn line has **not** been seen in a real transcript (no owner quota spent on render checks); unit tests cover creator + assembly. First real run should eyeball segment correctness.
- Kimi quota chip live path untested (fetcher read-only against owner sign-in; not invoked).
- `est.` segment mostly fires on harness/subprocess paths; legacy SDK path reports usage directly.
- ProviderQuotas still only has the kimi-cli fetcher (shared follow-up).
- Desktop binary rebuild still deferred to program end.
