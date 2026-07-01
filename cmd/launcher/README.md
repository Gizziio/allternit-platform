# Allternit Platform Launcher

Single-binary launcher that embeds the Rust API server and UI assets and self-extracts on first run.

## Status

**Temporarily disabled from the workspace build.**

The launcher relies on two build-time artifacts that are not currently produced by the repository:

- `allternit/api/embed/allternit-api` — the compiled API binary to embed
- `allternit/cmd/shell-ui/dist` — the built UI assets to embed

Until an embed pipeline (e.g., a `build.rs` or CI step) creates these files, the crate cannot compile because `include_bytes!` and `include_dir!` require the paths to exist at compile time.

## History

This crate was previously duplicated at `allternit/api/kernel/launcher`. That copy has been removed; this directory (`allternit/cmd/launcher`) is now the canonical home.

## To re-enable

1. Add a build step that produces the artifacts above.
2. Uncomment `"allternit/cmd/launcher"` in the workspace `Cargo.toml`.
3. Verify with `cargo build --release -p allternit-platform-launcher`.
