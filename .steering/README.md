# Steering checkpoints

Hook-based steering for agent sessions working in this repo — works across every
agent CLI used here, not just one. When a session ends a turn, a `Stop` hook
(`.steering/bin/steer-stop.sh`) consults a **separate steering agent** — but only
if `checkpoint.md` changed since the last review.

Flow:

1. The working agent updates `checkpoint.md` (Goal / Just did / Next / Open questions)
   at meaningful checkpoints. Its AGENTS.md instructions require this.
2. The hook sends `prompt.md` + checkpoint + git state to the steering agent.
3. Steering replies `APPROVE` (turn ends) or `STEER` + answers/guidance, which is
   injected back into the working session as a `[steering]` message.

## Per-CLI wiring

Run `.steering/bin/steer-install.sh` once per machine (idempotent; re-run after
`git pull`). It registers:

| CLI | Mechanism | Where |
|---|---|---|
| kimi | `[[hooks]]` Stop entry | `~/.kimi-code/config.toml` |
| Claude Code | project `Stop` hook | `.claude/settings.json` — **committed**, active automatically (approve the trust prompt on first run) |
| codex | Claude-style `Stop` hook + `codex_hooks` feature flag | `~/.codex/hooks.json`, `~/.codex/config.toml` |
| gizzi-code | `allternit-steering` plugin (`session.stop` hook) | copied to `~/.gizzi/plugins/` from `tools/agent-orchestrator/gizzi-plugin/` |
| agy | no hook support | convention only (AGENTS.md checkpoint rule) |

The hook script speaks every CLI's block protocol at once: stderr + exit 2
(kimi, Claude Code) and `{"decision":"block","reason":...}` JSON on stdout
(codex, gizzi-code). It no-ops in any project without `.steering/checkpoint.md`,
so the global registrations are safe for other repos.

## Controls

- Kill switch: `touch .steering/off` (delete to re-enable).
- State and consult log: `.steering/state/` (gitignored).
- Consult backend: `ao-consult` (tools/agent-orchestrator/scripts/, on PATH via
  `~/.local/bin`) — a persistent `ao-steer` tmux session that accumulates context
  across checkpoints. Falls back to `kimi -p` (fresh session per consult) when
  ao-consult is unavailable. Override either with `STEER_CONSULT_CMD` (reads the
  prompt on stdin, writes the answer on stdout). The steering agent itself is
  CLI-agnostic too: set `AO_CONSULT_AGENT_CMD` (e.g. `"claude"`,
  `"codex --dangerously-bypass-approvals-and-sandbox"`) to change it.
