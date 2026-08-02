# Steering checkpoints

Hook-based steering for agent sessions working in this repo — works across every
agent CLI used here, not just one. When a session ends a turn, a `Stop` hook
(`.steering/bin/steer-stop.sh`) consults a **separate steering agent** — but only
if `checkpoint.md` changed since the last review.

Flow:

1. The working agent updates `checkpoint.md` (Goal / Just did / Next / Open questions)
   at meaningful checkpoints. Its AGENTS.md instructions require this.
2. The hook sends `prompt.md` (the review rubric) + checkpoint + **evidence** —
   git status, diff stat, the actual diff (capped at 16KB), and test output when
   `.steering/test-command` exists (a shell script the hook runs, tail 4KB kept) —
   to the steering agent.
3. **Gap analysis**: `.steering/spec.md` is the source of truth for what "done"
   means. Write it when the feature is scoped, keep it current, and make each
   requirement checkable. Every consult, the steering agent maps each requirement
   to DONE / PARTIAL / MISSING with code evidence — a MISSING core requirement
   blocks approval.
4. Steering replies `APPROVE` (turn ends) or `STEER` + the gap analysis, answers,
   and severity-tagged findings (BLOCKER/MAJOR/MINOR), which is injected back
   into the working session as a `[steering]` message.

There is also a **hard commit gate** (`steer-pre-commit-gate.sh`, `PreToolUse` on
shell tools): `git commit` / `git push` only execute after the steering agent
APPROVES them. All other commands pass without a consult.

The steering agent is deliberately a **different model family** than the usual
worker — same-model reviewers share the worker's blind spots. Default: claude
(see `AO_CONSULT_AGENT_CMD` below).

Operational note: a cold consult (fresh `ao-steer` spawn) includes the agent's
first-turn repo exploration and can exceed five minutes; the hook's 600s timeout
covers it, and subsequent consults reuse the warm session.

## Per-CLI wiring

Run `.steering/bin/steer-install.sh` once per machine (idempotent; re-run after
`git pull`). It registers:

| CLI | Mechanism | Where |
|---|---|---|
| kimi | `[[hooks]]` Stop + PreToolUse entries | `~/.kimi-code/config.toml` |
| Claude Code | project Stop + PreToolUse hooks | `.claude/settings.json` — **committed**, active automatically (approve the trust prompt on first run) |
| codex | Claude-style Stop + PreToolUse hooks + `codex_hooks` feature flag | `~/.codex/hooks.json`, `~/.codex/config.toml` |
| gizzi-code | `allternit-steering` plugin (`session.stop` hook) | copied to `~/.gizzi/plugins/` from `tools/agent-orchestrator/gizzi-plugin/` |
| agy | no hook support | convention only (AGENTS.md checkpoint rule) |

The hook script speaks every CLI's block protocol at once: stderr + exit 2
(kimi, Claude Code) and `{"decision":"block","reason":...}` JSON on stdout
(codex, gizzi-code). It no-ops in any project without `.steering/checkpoint.md`,
so the global registrations are safe for other repos.

## Session worktree hooks

Two more hooks ride the same registrations (all four CLIs; gizzi-code also has
native `--worktree`, default-on tracked as phase W2):

- `session-worktree.sh` (UserPromptSubmit; also SessionStart for Claude Code) —
  injects the per-session worktree ritual once per session when the cwd is the
  shared main checkout.
- `guard-main-checkout.sh` (PreToolUse on shell tools) — blocks git mutations
  in the shared checkout; linked worktrees pass automatically. Escape hatch for
  human/orchestrator merges: `STEER_GUARD_OFF=1`.

Tests: `bash .steering/bin/worktree-guard-test.sh`.

## Controls

- Kill switch: `touch .steering/off` (delete to re-enable).
- Status: `.steering/bin/steer-status.sh` prints `steering: ENABLED|DISABLED` and
  the last 5 consults (exit 0 enabled, 1 disabled).
- State and consult log: `.steering/state/` (gitignored).
- Consult backend: `ao-consult` (tools/agent-orchestrator/scripts/, on PATH via
  `~/.local/bin`) — a persistent `ao-steer` tmux session that accumulates context
  across checkpoints. Falls back to `kimi -p` (fresh session per consult) when
  ao-consult is unavailable. Override either with `STEER_CONSULT_CMD` (reads the
  prompt on stdin, writes the answer on stdout). The steering agent itself is
  CLI-agnostic: set `AO_CONSULT_AGENT_CMD` to change it (default
  `claude --dangerously-skip-permissions`; takes effect when `ao-steer` is
  (re)spawned — `ao-kill steer` to force a respawn).
- Test evidence: put a runnable shell script at `.steering/test-command` and the
  Stop hook will run it (2 min cap where `timeout`/`gtimeout` exists) and attach
  the output tail to every consult.
