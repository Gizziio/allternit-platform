# 2026-09-26 — session/provider-events + allternit-ai session/claude-parity-renderer (Claude Code)

**PRs:** Gizziio/allternit-platform #741 (merge `cc6dacaf8`), Gizziio/allternit-ai #49 (merge `f30c188e`).
**Picked up from:** kimi-code handoff `HANDOFF-chat-ui-renderer-2026-09-26.md` (incoherent indicators, stale Running, abrupt text), expanded by Eoj to full Claude Desktop parity + run telemetry.

## What was done
- **Audit + mapping** (`allternit-ai/docs/CHAT_RENDERER_PARITY_AUDIT.md`), with Claude Desktop recorded frame-by-frame (window captures; Claude refuses CDP) and live CDP inspection of Allternit Desktop.
- **Root causes found live:** Kimi's ACP thoughts mapped to reply text (driver); one text part per turn (subprocess LM); bridges dropped tool parts; allternit-api awaited gizzi's blocking `/session/:id/message` before reading events → every turn arrived in one burst at the end; fake cycling status labels; `$` in prose parsed as a terminal command.
- **Platform (#741):** reasoning_delta for ACP / stream-json / Codex; ordered text/reasoning blocks; tool frames forwarded by both bridges; live relay (prompt as spawned task); undeclared-part delta hold; finish usage with cache/reasoning/cost; `session.context.updated`; flagged usage estimates (`tokensEstimated` on assistant messages); `ProviderQuotas` (Kimi `/usages`: 5-hour/weekly/monthly) via `GET /provider/:id/quota` → `GET /api/v1/providers/:id/quota`; history message metadata carries run telemetry.
- **UI (#49):** ProcessBlock single activity line with dwelling thought cadence; AllternitOrb v2 (other agent's approved motion, master copy `Allternit Assets/Brand/Allternit/thinking-orb/`) + SmoothOrb crossfade; paced word-fade streaming; ordered live timeline; duplicate-turn collapse; typography/tables; masked scroll fades; borderless user bubble; footer (copy/votes/retry, hover follow-ups, resting orb); bubble-less bot chat; RunTelemetry beside the orb (hover/click) with plan quota.

## Verification
- allternit-api: `cargo check` clean; 5 new unit tests pass; `cargo build --release` ok.
- gizzi-code: 24/24 in new + driver suites; tsc clean except pre-existing unbuilt `@allternit/computer-use-protocol`; `build-production.js --target=darwin-arm64` ok.
- allternit-ai: full suite 3605 pass (1 intermittent PluginManager.flows under load, passes in isolation, untouched); tsc clean on touched files.
- Live (installed Desktop, hot-patched UI + ad-hoc-signed sidecars): Kimi turn streamed thinking → WebSearch → result → thinking → text over 45s (182 SSE chunks vs one end burst); telemetry hover/click showed real Kimi 5-hour/weekly quota.

## Incidents
- First sidecar swap overwrote signed binaries in place → macOS SIGKILL on launch (exit code null); fixed by rm + fresh copy + `codesign --force -s -`. Orphaned old sidecars had to be killed. Backup of original sidecars + data dir: `allternit-workspace/.backup-sidecars-2026-09-26`.

## Honest deferrals
- Kimi reports input tokens but not output → telemetry shows "0 out"; partial-usage estimation not yet implemented.
- gizzi's context window for kimi-cli/kimi-k3 reads 1.0M while Kimi's CLI listing says 262k — needs reconciliation.
- Plan quota only for Kimi For Coding; Claude/Codex subscription windows not wired.
- gizzi-code TUI does not render the new telemetry.
- Pre-existing batch-only test failures (`cowork-store-boundary`, `process-registry`) untouched.
- Signed DMG not rebuilt here — another agent is building from merged main.
