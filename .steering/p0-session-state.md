# P0 session state (for recovery after context compaction)

## Task
Execute docs/ALLTERNIT_RUNTIME_P0_TASK.md per docs/ALLTERNIT_RUNTIME_MAP.md: vendor herdr v0.9.0 (SHA b99002ac99b09e00b4ca692436cb15a6b0d676f1) into infrastructure/executor/ao-engine/ in worktree /Users/joe/Desktop/allternit-workspace/allternit-ao-allternit-runtime-fork (branch ao/allternit-runtime-fork), gut herdr.dev surface, build as `ao`, write docs/ALLTERNIT_RUNTIME_P0_NOTES.md with YAML frontmatter (status/files_changed/deviations/remaining). Evidence dir: ~/.agent-orchestrator/evidence/allternit-runtime-fork/.

## Done so far
- Vendored ao-engine (src, tests, vendor/ incl. portable-pty + libghostty-vt, build.rs, LICENSE, assets/sounds/{done,request}.mp3 — note: originally copied flat into assets/, MOVED to assets/sounds/; docs/next/api/herdr-api.schema.json; skills/herdr/SKILL.md). Excluded .git, rust-toolchain.toml.
- Root Cargo.toml: member added + [patch.crates-io] portable-pty path vendor (other members use portable-pty 0.8, unaffected — patch is version-specific 0.9.x).
- ao-engine/Cargo.toml: [[bin]] name="ao" path="src/main.rs"; upstream [patch] table replaced with comment (cargo only honors root patches).
- Gut: src/update.rs rewritten as residue (Version type + pkg-manager exe path detection, no network); src/product_announcements.rs DELETED + wiring neutralized in app/mod.rs (startup_product_announcement=None; dismiss=local only); detect/manifest_update.rs remote fetch removed → offline check_and_update_local() validating state-dir cache (state_root = config::state_dir()/agent-detection, remote_manifest_path kept = local override mechanism); auto_update fns + spawns removed (app/runtime.rs, app/mod.rs); remote/attach.rs download_release_asset/fetch_remote_manifest/remote_release_asset/manifest types/private_download_dir removed, call site → offline error w/ HERDR_REMOTE_BINARY guidance; STABLE/PREVIEW_UPDATE_MANIFEST_URL consts deleted; `herdr update` + `herdr channel` subcommands removed (main.rs, cli.rs + tests); cli.rs AGENT_HELP_FOOTER herdr.dev URLs → github.com; main.rs Home: → Repo: github line; [update] config template comments updated (keys kept parseable, inert).
- main.rs: accidentally over-cut a block (removed --help/--version/--default-config/--skill handlers + unknown-flag gate) — RESTORED from pristine with gut edits applied. VERIFY done: `ao --version` → "herdr 0.9.0" exit 0; `ao update` → unknown command exit 2; `ao --help` clean (no update/channel); `ao channel` → unknown.
- THIRD_PARTY_NOTICES.md: herdr entry added (Apache-2.0, SHA, Used in ao-engine).
- Dead-code warnings cleaned: config.rs UpdateChannelConfig import, attach.rs BTreeMap import, platform end_cli_output (mod.rs re-export + non-unix stub + unix_common fn), create_remote_private_dir (unix_common def + macos.rs/linux.rs re-exports). ~23 remaining dead-code warnings documented as gut residue (checksum, curl_command, UpdateReady/AgentDetectionManifestsUpdated variants, etc.) — intentionally kept inert.
- Tests fixed: tests/*.rs CARGO_BIN_EXE_herdr → CARGO_BIN_EXE_ao (14 files); app/mod.rs startup announcement test rewritten (asserts none); update_ready toast tests updated to raw install_command (app/actions.rs x2, client/shell/tests/startup_overlays.rs).

## Verification status
- cargo check -p herdr and --all-targets: GREEN (evidence cargo-check*.log).
- cargo build -p herdr: GREEN, target/debug/ao 63MB (build.log).
- Unit tests: cargo test -p herdr dies with SIGPIPE (signal 13) — VERIFIED PRE-EXISTING: pristine herdr v0.9.0 built standalone (/tmp/herdr-pristine, target /tmp/herdr-pristine-target, RUSTUP_TOOLCHAIN=1.94.1) crashes identically (2185 ok, then SIGPIPE; also 1 env failure plugin_link_creates_stable_config_and_state_dirs). My fork: 2169 ok then same SIGPIPE. Cause: cli tests flip SIGPIPE to SIG_DFL via platform::begin_cli_output; later socket-write tests die. Environmental/upstream, NOT gut-caused. NOTE: piping test output to `head` also SIGPIPEs the binary — redirect to file only.
- plugin_link_creates_stable: passes in isolation (parallel interference, pre-existing class).
- Katakana test REGRESSION (fails on fork, passes pristine): pane::terminal::tests::render_keeps_halfwidth_katakana_voiced_tail_empty — left:" " right:"". Root cause: workspace Cargo.lock resolved ratatui 0.30.2/ratatui-core 0.1.2/line-clipping 0.3.8 vs upstream 0.30.0/0.1.0/0.3.5. FIX IN PROGRESS: pin ratatui to =0.30.0 in ao-engine/Cargo.toml, rebuild, rerun that test.

## Remaining steps
1. Pin ratatui =0.30.0; verify katakana test passes; re-record evidence.
2. Decide final unit-test story: document SIGPIPE as pre-existing environmental (evidence: /tmp/pristine-unit.log; my test.log).
3. Optionally run integration tests (tests/*.rs) — heavy PTY/server tests.
4. Update .steering/checkpoint.md; commit (feat(ao-engine): ... — note: git commit goes through steering commit-gate hook); push branch ao/allternit-runtime-fork.
5. Write docs/ALLTERNIT_RUNTIME_P0_NOTES.md (frontmatter: status done, files_changed, deviations, remaining) + prose: what/how to verify/test results/pre-existing failures/grep evidence/conflicts (portable-pty patch scoping OK; toolchain 1.94.1 vs 1.96.1 pin — builds fine, pin not vendored; zig 0.15.2 required via ZIG env or PATH; ratatui pin deviation).
6. .allternit/shared-context.md ABSENT in worktree → skip append, note in NOTES.
7. TodoList: items 5 in_progress, 6-7 pending.
