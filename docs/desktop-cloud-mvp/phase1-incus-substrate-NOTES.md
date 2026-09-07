# Phase 1 Checkpoint — Incus Substrate Client

## Feature
`allternit-computer-cloud` Incus substrate client (`cmd/allternit-computer-cloud/src/substrate.rs`).

## Constraint compliance
- **LOC:** 433 lines total across `Cargo.toml`, `lib.rs`, and `substrate.rs` (well under 1,500 limit).
- **No Orgo dependency:** only uses the Incus REST API.

## What it does
- Defines a `Substrate` trait abstracting desktop provisioning (create/start/stop/delete/get/exec).
- Implements `IncusSubstrate` that talks to the Incus `/1.0/instances` REST API.
- Parses async operations and waits for completion.
- Maps Incus instance states to `ComputerState`.
- Abstracts HTTP transport behind an internal `HttpClient` trait so tests can mock responses.

## Verification

```bash
cd /Users/joe/Desktop/allternit-workspace/allternit-session-desktop-cloud-mvp
cargo check -p allternit-computer-cloud
```

Result: clean build (zero warnings after fixing unused imports).

```bash
cargo test -p allternit-computer-cloud
```

Result:

```
running 4 tests
test substrate::tests::create_returns_native_id_from_resources ... ok
test substrate::tests::get_parses_running_state ... ok
test substrate::tests::start_then_get_updates_state ... ok
test substrate::tests::not_found_returns_error ... ok

test result: ok. 4 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out
```

## Files changed
- `Cargo.toml` — added `cmd/allternit-computer-cloud` to workspace.
- `cmd/allternit-computer-cloud/Cargo.toml` — new crate manifest.
- `cmd/allternit-computer-cloud/src/lib.rs` — crate exports.
- `cmd/allternit-computer-cloud/src/substrate.rs` — trait + Incus client + tests.

## Blocker / next step
Real end-to-end validation against a live Incus daemon requires a Linux host (Incus cannot run natively on macOS Sonoma, and Tart requires macOS Sequoia). Next feature will either:
1. Add a live Incus integration test once a Linux host is available, or
2. Build the next substrate-agnostic layer (REST API routes) using this client.
