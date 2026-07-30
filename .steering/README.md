# Steering checkpoints

Hook-based steering for agent sessions working in this repo. When a Kimi Code
session ends a turn, a `Stop` hook (`.steering/bin/steer-stop.sh`, registered in
`~/.kimi-code/config.toml`) consults a **separate steering agent** — but only if
`checkpoint.md` changed since the last review.

Flow:

1. The working agent updates `checkpoint.md` (Goal / Just did / Next / Open questions)
   at meaningful checkpoints. Its AGENTS.md instructions require this.
2. The hook sends `prompt.md` + checkpoint + git state to the steering agent.
3. Steering replies `APPROVE` (turn ends) or `STEER` + answers/guidance, which is
   injected back into the working session as a `[steering]` message.

Controls:

- Kill switch: `touch .steering/off` (delete to re-enable).
- State and consult log: `.steering/state/` (gitignored).
- Consult backend: `ao-consult` (tools/agent-orchestrator/scripts/, on PATH via
  `~/.local/bin`) — a persistent `ao-steer` tmux session that accumulates context
  across checkpoints. Falls back to `kimi -p` (fresh session per consult) when
  ao-consult is unavailable. Override either with `STEER_CONSULT_CMD` (reads the
  prompt on stdin, writes the answer on stdout).
- The hook is registered globally, but guards on `.steering/checkpoint.md`
  existing in the session's project dir, so other projects are unaffected.
