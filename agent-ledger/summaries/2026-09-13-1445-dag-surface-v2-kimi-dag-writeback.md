# Attestation — session/dag-surface-v2 (PR #481)

**When:** 2026-09-13 ~11:30–14:45 local · **Agent:** kimi-code · **Branch:** `session/dag-surface-v2` · **Merged:** `56def8294494ba7478ec294235b2f0545cdd7a3c` · **DAG:** `dag_580850` / `wih_2625` (closed + vaulted)

## What was done

DAG surface v2 (approved plan): DAG todos are now displayed and actionable on every surface. Five commits:

1. `feat(api)` — real `/wihs` write-back: pickup (gate, 409 conflicts), close with **agent-ownership check (403)** and gate evidence enforcement (400), context pack, sign.
2. `feat(surfaces)` — shared `RailsTaskList` web component + react-query dags hooks (5s poll, fail-closed), `organizeDagNodes` pure helper (frontier-first, depth cap 3, done-collapse, maxDags), 8 vitest cases; Take/Done… buttons with silent non-interactive degrade.
3. `feat(cowork)` — "Rails work" section in `CoworkRightRail` context area (collapsible, null until actionable, ≤2 dags).
4. `feat(bot-mode)` — `BotRailsDeck` top deck in `BotChatSessionView` (deck-rise, opens when work populates, mine + "Up next" sections, per-session collapse).
5. `feat(gizzi-code)` — TUI panel write-back: `tab` focus, `j/k` select, `t` take, `d` done, `esc` blur; overlay focus pattern; inline ⚠ errors verbatim from API; 9 unit tests.

## Verification evidence

- API live smoke: pickup → active in GET /wihs → wrong-agent close **403** → no-evidence **400** → evidence close 200 → /wihs empty → re-pickup **409**.
- Web: vitest 8/8; `tsc --noEmit` 0 err; vite build green. agentId = platform auth user id (fallback `web-user`).
- gizzi-code: typecheck 0 err; `bun run test` 1300 pass / 0 fail; 9 new tests pass.
- Release lock: `release-preflight.mjs` 35/0; `build-production.js` green.

## Incidents / honest deferrals

- **API test-suite timeout**: `cargo test -p allternit-api` exceeds 30 min compiling; verified via check + build + live HTTP smoke + the two existing integration test targets (20/20 previously). Known repo-wide cost, not new.
- **Pre-existing**: `bun test` needs `packages/sdk/dist` built (`script/ensure-sdk-dist.sh` self-heals; noted by the subagent).
- TUI `d` closes as DONE with auto-evidence; FAILED close from UI is a deliberate omission.
- Desktop rebuild skipped as before: preflight + production compile green; DMG refresh happens at next desktop release.
- Two subagents ran concurrently (web + TUI) on the same branch — coordinated by path isolation, verified no cross-contamination before merge.
