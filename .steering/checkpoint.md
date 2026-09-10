# Session checkpoint — session/dispatch-0910

## Goal
Implement dispatch semantics for ao-engine per spec `Allternit Brain/Research/specs/dispatch-semantics.md`:
- A1 dispatch registry (extend ~/.agent-orchestrator/state.json from spawn/kill, backward-compatible)
- A2 Bus-backed mailbox (queue-not-drop via allternit-agent-system-rails, single drainer, settle-only-after-verified-delivery)
- A3 fail-closed lead→runner ownership (--lead/AO_LEAD/--as-human)
- A4 `ao recover` (reconcile registry vs tmux, respawn from .cmd.sh with resume argv, --dry-run default)
- A5 docs (~/.agent-orchestrator/ORCHESTRATOR.md, kimi+claude SKILL.md) + ~/.local/bin symlink repair (steer*, ao-consult, allternit-rails)

## Just did
- Picked up after Kimi session_f2e12560 died on 5-hour quota. A1–A5 committed, pushed, PR #277.
- Verified `tests/dispatch_demo/run.sh -v`: **23 passed, 0 failed**. 7 unit tests. `ao doctor` green.
- Rebased onto main after openbot-policy-gateway landed; checkpoint histories preserved.

## Next
- Human merge of PR #277 once CI (non-Vercel) is green.
- Physical iPhone acceptance for phone-remote is a sibling PR (#276).

## Open questions
- Answered spec open question 1 in-code: bash ao-send stays immediate-only; engine owns queueing.

---

# Prior session (landed) — ao/openbot-policy-gateway

OpenBot-style policy gateway + bot-mode governance UI. PR #275 merged. Task A (permission_policy / policy_config / policy_audit seats) and Task B (PolicyEditor / PolicyGovernance / vitest) are on main. Phase 2 UX (avatars / @mentions / group chat) remains out of scope.
