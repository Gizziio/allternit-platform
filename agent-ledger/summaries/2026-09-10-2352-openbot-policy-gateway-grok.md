# openbot-policy-gateway — policy engine + bot-mode audit UI (rq-20260910-001)

- **Date:** 2026-09-10
- **Agent:** grok (pickup of kimi session `session_497f0582`; Task A by kimi executor in tmux `ao-openbot-policy-gateway`; Task B finished in grok after executor CLIs were blocked)
- **PR:** https://github.com/Gizziio/allternit-platform/pull/275 · merge commit `8b64e18051c225de5c86a8ac92ec68fc5a319b42`

## What landed

Phase 1 of `Research/specs/openbot-policy-gateway.md` (reverse-engineer OpenBot policy/audit patterns onto Allternit Computer Use):

- **Backend (`allternit-api`):** fail-closed declarative policy extending `permission_policy.rs` (no second engine). Loader `ALLTERNIT_ACI_POLICY_FILE` (unset = off; malformed = startup refuses, naming the rule). Audit-before-act JSONL with fsync before dispatch. Seats on `aci.run` (before safety/grants) and `execute_computer_tool` (before confirmation). `GET /api/aci/policy/audit?bot_id=&limit=`. No write API.
- **Bot-mode UI:** `PolicyGovernance` gated on `sessionMode === "agent"` or `isBot`. Verdict chips, audit list, structured editor in `BotChatSessionView`. Save fallback is copy-JSON to `ALLTERNIT_ACI_POLICY_FILE`.

## Verification

- `cargo test -p allternit-api --lib policy` → 51 passed (includes audit-before-act ordering).
- `cargo test -p allternit-api` → 855 passed / 4 failed: pre-existing `agent_cloud_routes` real-control-plane env failures on clean main.
- `cargo build --release -p allternit-api` green.
- `npx vitest run src/views/bots/PolicyGovernance.test.tsx src/views/bots/policy-audit.test.ts` → 11 passed.
- GitHub Actions on #275: vitest, desktop typecheck/build, gitleaks, typography, SW cache bump — all success.

## Incidents

- Kimi executor hit a 5-hour quota mid-Task B. Claude OAuth logged out. Codex usage-limited until 2026-09-16. Remaining UI finished in the grok pickup session.
- Vercel (`a2rchitech` / `allternit` / `platform`) and Cloudflare Pages (`ai-allternit`) Git auto-deploys failed on this PR and on #267–#274 independently. Not required checks; leftover GitHub app wiring. Production deploys are `cloudflare_deploy_pages`, not these preview builds. Merged with GitHub Actions green per that rule.

## Honest deferrals

- Phase 2 UX cluster still in the spec, not in this PR: pet-style bot avatars, `@mention` routing, multi-bot group chat, long-running session chrome.
- Seat B (`execute_computer_tool`) still evaluates with `bot_id` unset (documented Task A deviation); `aci.run` audit rows are bot-scoped.
