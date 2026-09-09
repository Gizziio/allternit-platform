# Attestation — session ao/tui-machines (P2 TUI + machines)

- Date: 2026-09-09
- Agent family: kimi (executor, two session halves + orchestrator recovery/commit)
- Branch: `ao/tui-machines` → PR #215, merged `6c65b4ee0ada78003ca3de188dfee68506c6231c`
- Queue: `rq-20260908-028` (fork_reskin) — P0, P1, P2 all landed

## What was done

P2 per `Products/AgentOrchestratorRuntime.md` §5 + spec
`Research/specs/ao-tui-machines.md`: rebrand of the vendored herdr TUI to the
ao face (66 files, +728/−641 — fixed string list + `app_dir_name()` lever per
binding decisions), `ao machine connect <profile-id> [--keybindings
local|server]` (~75 lines additive over `remote::run_remote`), Allternit
`DEFAULT_CONFIG` ([theme.custom] palette + window_title). Paths:
`~/.config/ao`, `~/.local/state/ao`, worktrees `~/.ao/worktrees`; migration =
manual dir rename, no data transform.

One integration fix beyond the rebrand list (NOTES §4): P1's ao-contract
`status` shadowed engine `status` at the dispatcher, breaking the remote
machinery's `ao status server --json` probe; ao status now forwards engine
forms (`--json|server|client|help`) and keeps the ao contract otherwise.

## How it works / verification

- Orchestrator smokes: `ao --version` → `ao 0.9.0`; `ao machine --help`
  lists `connect`.
- Test parity: only pre-existing detect:: parallel flakes + upstream SIGPIPE
  (P0 baseline identical); detect serial 111/111; machine_setup 5/5;
  `--bin ao` 2409 passed pre-SIGPIPE. Fork-diff guardrail PASS.
- **Pilot (real Ubuntu host `vps`):** cross-built x86_64 binary runs on host;
  `machine add` → remote headless server up; TUI combined sidebar
  Local + vps; killed bridge → reconnect ~22 s (≤30 s backoff);
  `machine connect` attached into remote pane (hostname proof); cleanup
  verified. Evidence: `~/.agent-orchestrator/evidence/ao-tui-machines/pilot/`.

## Incidents

- First executor session died mid-pilot (uncommitted work rescued via
  `.steering/checkpoint.md`; recovery session completed pilot + NOTES).
- Recovery session then stalled unresponsive at the commit step;
  orchestrator committed/pushed/PR'd the verified tree directly.

## Honest deferrals

- Combined agent list piloted empty (no agent CLI panes spawned).
- Remote-install approval path not exercised end-to-end (tty by design; scp
  seed used; approval flows covered by machine_setup tests).
