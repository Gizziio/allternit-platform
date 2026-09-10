# AO Harness Install Notes — P7 (ao v3 runtime build)

Date: 2026-09-10
Branch: `ao/harness-install` (session worktree `allternit-ao-harness-install`)
Spec: `Allternit Brain/Research/specs/ao-harness-install.md` (binding);
positioning note `Research/drafts/prep-p6-p7-positioning.md` wins on
disagreement (no disagreements surfaced).
Reference: HarnessRouter CE `docker/entrypoint.sh` (read-only; fetched from
`github.com/HarnessRouter/harnessrouter` at exec time — HR CE is not yet
vendored in-repo, that is P6 step 0).

## What was implemented

### 1. `ao harness install <tool>` — Rust port of HR CE's entrypoint install scripts

Install is **data + logic**, never a shipped Python/shell layer (spec binding
1). Each manifest tool entry gained an `install` block:

```json
"install": { "method": "npm", "pinnedVersion": "0.154.0",
             "installArgs": ["@openai/codex@0.154.0"], "verifyCmd": "codex --version" }
```

Methods (ported from the HR CE entrypoint, which was read in full):

| method | HR CE form | tools |
|--------|-----------|-------|
| `npm` | `npm install -g --prefix <managed> --no-audit --no-fund <pkg@pin>` (`-g` is what creates `<prefix>/bin/<cmd>` — HR's own comment) | claude, codex, kimi, opencode, qwen, openclaw |
| `venv-pip` | isolated `python3 -m venv <managed>/venv-<tool>` + `pip install --no-cache-dir <pins>`, then a `<managed>/bin/<tool>` shim **only after pip produced the entry point** (HR's dsh-ready lesson) | hermes, dsh |
| `unsupported` | refuse with guidance naming the vendor channel | grok, cursor, gizzi, agy, antigravity, codebuddy, workbuddy, qoder |

Carried-over HR rules, in code:

- **The executable IS the definition of "installed"** — a backend that exits 0
  without producing `<managed>/bin/<tool>` is a failed install.
- **Pins are explicit data, never "latest"** — bump = manifest edit + re-run;
  doctor surfaces drift (pin mismatch = a doctor PROBLEM row).
- **Failure must say why** — `run_logged` tails the npm/pip log into the error
  (HR's `try_install` comment: silence cost someone a day).
- **Idempotency** — binary present + verifyCmd output contains the pin →
  `AlreadyInstalled`, no re-fetch.

### 2. License tags + hard gate (spec binding 2 — tags verified ABSENT before P7)

Every tool entry gained `license: apache|mit|bsd|proprietary-terms|undeclared`
with the evidence URL in a `_licenseNote` (npm registry, package tarballs,
on-machine README/LICENSE files, HR CE annotations — all checked 2026-09-10):

- **proprietary-terms:** claude (Anthropic Commercial Terms), cursor,
  antigravity (Google), codebuddy/workbuddy (Tencent), qoder (Alibaba)
- **undeclared:** hermes (HR CE's own words: "check its upstream license
  before use"), dsh (HR CE annotates "MIT, developer preview" but that is
  secondhand — spec says undeclared until independent upstream evidence),
  agy (gemini-heritage fork; upstream license does not automatically cover a
  fork — no evidence found)
- **apache:** codex, qwen, grok (per its installed README)
- **mit:** kimi (per the published npm tarball LICENSE — note: GitHub repo
  metadata says Apache-2.0; tarball is what ao installs, free class either
  way), opencode, openclaw (npm metadata, not live-verified), gizzi
  (cmd/gizzi-code/LICENSE — Allternit-original MIT; Anthropic-derived
  portions per NOTICE are not relicensed)

Gate: only apache/mit/bsd install without ceremony. Gated classes refuse
with an error naming the tool, class, and remedy; `--accept-terms <tool>`
records `{tool, licenseClass, pin, acceptedAt}` in
`<managed>/accepted-terms.json` and a **pin or class change re-flags** (the
old acceptance does not carry over — install refuses and doctor reports
TERMS STALE until re-acceptance). Acceptance is per-pin, not blanket.

### 3. One managed dir (spec binding 3)

`AO_HARNESS_HOME` or `~/.ao/harness`; binaries in `<root>/bin/`; receipts in
`<root>/installed/<tool>.json`. PATH gains the managed bin **only inside
ao-spawned subprocesses**: the P4 `FsCtx` probe context prepends it (so
`installed()` and `ao harness sync` reach ao-managed tools — spec binding 5,
no fork of P4 registration) and install/doctor verify runs use it. The
user's shell rc is never touched (test asserts nothing is written outside
the managed root).

### 4. `ao doctor` extension (spec binding 7)

New `ao-doctor: harness` section: managed-dir health (absent = fine),
per-tool binary present + verifyCmd pin match, license acceptance state
(Current/STALE/NOT ACCEPTED), sync reachability (`installed()` probe).
Verdict: transport broken → 2 (unchanged); no usable executors → 1
(unchanged); executors usable but harness problems → **3 (new)**; all green
→ 0. Parity-safety: with no managed dir the section prints one "absent" row
and stays green, and `tests/ao_parity/run.sh` strips the section (to the
next `ao-doctor:` header) exactly like the `ao-engine:` line, with a
comment saying why.

### 5. Network behind a trait (spec binding 4)

`InstallBackend { npm_global, venv_pip }` is the only exec/network surface.
`SystemBackend` is used by the CLI; unit tests inject `FakeBackend`
(writes a runnable `<bin>/<tool>` echoing its pin, so the real verify path
runs end-to-end) plus `EmptyBackend`/`WrongVersionBackend` for the two
failure rules. Real npm/pip runs happen only in the hard-gate demo below.

## File map

| File | Role |
|------|------|
| `src/ao/harness/install.rs` (~900 incl. tests) | managed dir, terms state, gate, backends, install flow, `cmd_install`, `doctor`, 17 unit tests |
| `src/ao/harness/mod.rs` | ToolCfg `license`+`install`, `LicenseClass`, `InstallBlock`, FsCtx managed-bin PATH, `install` dispatch + `--accept-terms` parse, `doctor_for_cli`, conformance test |
| `src/ao/harness/harness.json` | grew: license+install blocks for all 16 tools (Brain `Ops/harness.json` updated first; copies `cmp`-verified byte-identical; parity harness enforces) |
| `src/cli/ao.rs` | doctor: harness section + exit 3; one-line parity fix: `spawn --worktree` git stderr → null to match the golden script's 09-09 10:26 suppression (see ao_parity section) |
| `tests/ao_parity/run.sh` | strips the doctor harness section (allowed divergence, documented) |

Engine crate internals untouched (spec binding 8 — fork-diff guardrail).

## Test evidence (exact commands + results)

Unit (after every change, final state):

```
PATH="/opt/homebrew/opt/zig@0.15/bin:$PATH" cargo test -p herdr --bin ao harness::
test result: ok. 50 passed; 0 failed; ... 2964 filtered out
```

P4 harness parity (JS reference vs Rust, enlarged manifest):

```
PATH="/opt/homebrew/opt/zig@0.15/bin:$PATH" bash infrastructure/executor/ao-engine/tests/ao_harness_parity/run.sh
== ao harness parity: 21 passed, 0 failed ==
```

One real catch on the first parity run: the unknown-command error text is
byte-diffed and my added `| install` broke it — reverted to the JS-exact
string (the parity list stays `status | sync | uninstall`; `install` is
discoverable via `ao harness install --help` usage line on empty args).

P1 ao parity — final result **62 passed, 0 failed** (PARITY_EXIT=0), but
getting there required root-causing two PRE-EXISTING environment drifts
that were masquerading as regressions. Recorded honestly because the
first runs were red:

**First runs: 50 passed, 10 failed — identical mismatch set across 5
runs** (spawn-wt, kill-wt.out/err, wt-list, wt-branch, status,
status-tail, spawn-exit, burst ×2). Root cause, proven by minimal repro:
the machine-global tmux server (pid 70283, started 2026-09-09 10:41 —
after P1's green runs, which is why P1 was green) has its process cwd in
the DELETED `allternit-ao-tui-machines` P2 worktree. On this server
`tmux new-session -d -c /tmp 'pwd…'` runs the pane IN the deleted
directory (`pwd` → "getcwd: cannot access parent directories") and
`pane_current_path` reports the deleted path. That single poisoning
explains all 10 mismatches: wrong status workdirs, refused worktree
removal, getcwd noise in captured panes. Cannot be repaired from this
session — the server hosts the live `ao-harness-install` orchestrator
pane — so the suite was run under an isolated tmux server:

```
env -u TMUX TMUX_TMPDIR=/tmp/ao-p7-tmux-isolated … bash tests/ao_parity/run.sh
golden parity: 61 passed, 1 failed        # 9 of 10 were the poisoned server
```

**Remaining 1 mismatch — golden-script drift, not engine output.** Only
`spawn-wt.err` differed: the ao world printed git's `Preparing worktree
(new branch 'ao/goldwt')`; the script world printed nothing. The ao
world's bytes are IDENTICAL to P1's golden evidence
(`ao-engine-parity/golden-run/ao/spawn-wt.err`) — the SCRIPT changed:
`~/.claude/skills/agent-orchestrator/scripts/ao-spawn` was edited
2026-09-09 10:26 (between P1's 09:42 green run and now) to suppress git's
worktree stderr (`>/dev/null 2>&1`). The parity contract moved; the
engine was still honoring the old contract (`stderr(Stdio::inherit())`,
deliberate at P1 — see the comment in `src/cli/ao.rs`). Fixed the engine
to the new golden contract (`stderr(Stdio::null())` on the worktree-add
call only; rev-parse stderr stays inherited, matching the script). Risk
noted for the orchestrator owner: if the 10:26 script edit was
unintentional, revert BOTH sides together.

Final run (isolated server, fixed engine):

```
env -u TMUX TMUX_TMPDIR=/tmp/ao-p7-tmux-isolated PATH="…zig@0.15/bin:$PATH" \
  bash infrastructure/executor/ao-engine/tests/ao_parity/run.sh
golden parity: 62 passed, 0 failed   (PARITY_EXIT=0)
```

Machine follow-up (human, not P7): restart the default tmux server when
no live session depends on it — every pane-spawning test on this machine
is poisoned until then.

<!-- AO_Parity_RESULT -->

Steering commit-gate caught one real bug during the session:
`positionals[1..]` panicked on a bare `ao harness` (empty positional vec) —
fixed with `positionals.get(1..)`, verified by hand, tests re-run.

Full crate suite (final state, full log `/tmp/ao-p7-full-suite.log`):

```
PATH="/opt/homebrew/opt/zig@0.15/bin:$PATH" cargo test -p herdr
2504 tests passed, then the `ao` test binary died with:
  signal: 13, SIGPIPE: write on a pipe with no one to read   (cargo exit 101)
```

Classification: the two spec-sanctioned pre-existing flake classes, no
regression. (1) The SIGPIPE death is upstream-pristine-verified (P0:
standalone herdr v0.9.0 crashes identically); death point moves between
runs (P1: 2164 passed, P2: 2409, P4: 2456, this run: 2504 — including
all 50 harness tests). (2) Nine `detect::manifest*` FAILED lines under
the default parallel run are the documented shared-cache parallel race —
re-run serially in this session:

```
cargo test -p herdr --bin ao detect:: -- --test-threads=1
test result: ok. 111 passed; 0 failed; ... 2903 filtered out
```

No new failures introduced by this diff; both classes predate P7 and are
explicitly excluded by the spec's verify section.

## Hard gate (spec verify plan #3) — evidence in ~/.agent-orchestrator/evidence/ao-harness-install/

Script: `hard-gate.sh` (copied into the evidence dir). Clean prefix via
`mktemp -d`, `HOME=<prefix>/home`, `AO_HARNESS_HOME=<prefix>/harness`,
`HERDR_SOCKET_PATH=<prefix>/herdr.sock`; real npm network. Also seeded
`KIMI_CODE_HOME=<prefix>/.kimi-code` with this machine's own kimi
credentials/config so the installed kimi can actually run a session —
prefix-local, mode 0700, never copied into evidence or commits, deleted
with the prefix. (A clean-HOME kimi has no auth: the v1 run failed honestly
at this step with "No model configured" — recorded as `99-verdict-v1.txt`.)

<!-- HARD_GATE_RESULT -->

Final verdict (v3 run, `99-verdict.txt`):

```
install exit: 0 (0 = ok)
doctor exit code: 0 (0 = green)
sync exit: 0 (0 = ok)
kimi run exit: 0 (0 = a real session ran)
kimi sessions in catalog: 1
b644ff39-474d-446d-a462-9feac9cc1635 /private/tmp/ao-p7-gate.W9wb6t/workspace /tmp/ao-p7-gate.W9wb6t/.kimi-code/sessions/wd_workspace_6391f88758ed/session_b644ff39-474d-446d-a462-9feac9cc1635
HARD GATE: PASS
```

Key evidence excerpts:

- `ao harness install claude` (no flag) refuses, exit 1:
  `ERROR: claude is proprietary-terms — ... re-run with --accept-terms claude`
- `ao harness install kimi codex` (real npm), exit 0:
  `verify: 0.42.0 (pin match)` / `verify: codex-cli 0.154.0 (pin match)`
- `ao harness install claude --accept-terms claude` (real npm), exit 0;
  second identical run: `already installed — 2.1.267 (Claude Code) (pin match)`
- `accepted-terms.json`: `[{ "tool": "claude", "licenseClass":
  "proprietary-terms", "pin": "2.1.267", "acceptedAt":
  "2026-09-10T18:47:29.552Z" }]`
- `ao doctor` exit 0, including:
  `Kimi Code CLI: ok — 0.42.0 · license mit`,
  `Codex CLI: ok — codex-cli 0.154.0 · license apache`,
  `Claude Code: ok — 2.1.267 (Claude Code) · license proprietary-terms ·
   terms accepted 2026-09-10T18:47:29.552Z`,
  `Grok CLI: external — not ao-managed (no pinned install channel)`
- `ao harness sync --tools=kimi,codex,claude` exit 0 — 60 skill/MCP/rules
  actions into the prefix HOME (`~/.kimi-code/mcp.json`, `AGENTS.md`,
  skills dirs) — the P4 machinery reached the ao-managed tools untouched.
- The installed kimi ran a real session (`kimi -p 'Reply with exactly:
  P7-GATE-OK'` → `P7-GATE-OK`), writing
  `.kimi-code/sessions/wd_*/session_*/state.json + wire.jsonl`, and
  `ao visibility --home <prefix>` listed it in the native catalog
  (session id, cwd, path above).

The plan verify line is satisfied end to end: install → doctor green →
sync reaches → installed-CLI session appears in native-session listing.

## Honest deferrals / limitations

- **venv-pip is fixture-tested only** — the real hermes/dsh pip path is
  ported faithfully (HR pins, isolated venv, shim-after-pip) but the demo
  installs only kimi+codex; first real hermes/dsh install should confirm.
- **venv-pip is POSIX-only** (spec non-goal: Windows install methods).
- **grok/cursor/gizzi/agy/antigravity/codebuddy/workbuddy/qoder are
  `unsupported`** — no verified version-pinned public channel (npm name
  squatters checked and rejected for grok/codebuddy). License gate still
  applies if a channel lands: manifest edit first.
- **dsh verifyCmd** (`dsh --version`) is assumed from the HR entrypoint's
  dsh-ready pattern, not live-verified — flagged in its `_licenseNote`.
- **openclaw npm package not live-verified** (not installed on this
  machine); class is free either way, noted in `_licenseNote`.
- **ao doctor transport** still requires the engine socket (P2 contract,
  unchanged) — the demo starts one via `ao spawn`.
- Pre-existing upstream full-suite SIGPIPE flake class (P1/P4-documented)
  expected; the final full-suite run is recorded below as it happened.

## Ledger

Attestation on land per repo ritual (after merge).
