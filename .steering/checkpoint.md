# Steering checkpoint — ao/allternit-runtime-fork (P0)

## Goal
Phase P0 of the ao v3 engine fork (queue rq-20260908-028, decision fork_reskin): vendor herdr v0.9.0 into `infrastructure/executor/ao-engine/`, gut the herdr.dev phone-home surface, build as `ao` binary, keep diff mergeable with upstream. Spec: docs/ALLTERNIT_RUNTIME_MAP.md + docs/ALLTERNIT_RUNTIME_P0_TASK.md.

## Just did
- Vendored herdr v0.9.0 (SHA b99002ac99b09e00b4ca692436cb15a6b0d676f1) into infrastructure/executor/ao-engine/ (src/, tests/, vendor/ incl. patched portable-pty + libghostty-vt, build.rs, LICENSE, build-referenced assets/docs/skills). Excluded .git, rust-toolchain.toml (conflict documented).
- Workspace wiring: member added; `[[bin]] name = "ao"`; portable-pty [patch.crates-io] at workspace root (version-specific 0.9.x, other members on 0.8 unaffected).
- Gut list applied: update.rs trimmed to residue (Version + pkg-manager path detection, no network); product_announcements.rs deleted + wiring neutralized (UI/API surface left inert); manifest_update.rs remote catalog fetch removed (offline local-cache verification; local override cache mechanism kept); remote/attach.rs release-asset download from herdr.dev manifests removed (offline error with HERDR_REMOTE_BINARY guidance); `herdr update` + `herdr channel` subcommands removed.
- Remaining herdr.dev hits: comments/docs + `herdr:devin` protocol identifier only (grep evidence pending in build evidence step).
- THIRD_PARTY_NOTICES.md herdr entry added.

## Next
- DONE: final commit (docs/ALLTERNIT_RUNTIME_P0_NOTES.md) + push. P0 complete; NOTES is the deliverable sentinel.

## Open questions
- RESOLVED: katakana test regression was workspace dep drift, not the gut — ratatui-core 0.1.2 breaks it (bisected; ratatui 0.30.2/line-clipping 0.3.8/unicode-segmentation 1.13.3/compact_str 0.9.1 all PASS). Pinned ratatui =0.30.0 + ratatui-core =0.1.0 in ao-engine; test passes in-workspace now.
- RESOLVED: unit-suite SIGPIPE death is pre-existing — pristine herdr v0.9.0 (built standalone, rustc 1.94.1) dies identically (signal 13 after ~2185 ok; also env failure plugin_link_creates_stable_config_and_state_dirs which passes in isolation). Documented, not fixed (out of scope: unrelated pre-existing breakage).
- rustc 1.94.1 compiles herdr 0.9.0 cleanly; the 1.96.1 pin is not needed. zig 0.15.2 required (ZIG env var or PATH; /opt/homebrew/opt/zig@0.15/bin/zig).
