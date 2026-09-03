# Phase 1.2 Checkpoint — Computer Cloud REST API Routes

## Feature
Substrate-agnostic HTTP lifecycle API for agent desktops in `cmd/allternit-computer-cloud/src/routes/computers.rs`.

## Constraint compliance
- **LOC:** 406 lines for the routes module; 847 lines total for the crate (well under 1,500 limit).
- **No Orgo dependency:** only depends on the internal `Substrate` trait.
- **Tests:** 6 new mock-substrate route tests, all passing.

## What it does
- Exposes `POST /v1/computers`, `GET /v1/computers/:id`, `DELETE /v1/computers/:id`, `POST /v1/computers/:id/start`, `POST /v1/computers/:id/stop`, `POST /v1/computers/:id/exec`.
- Maps `SubstrateError` to HTTP statuses (`404` for not found, `504` for timeout, `502` for upstream failures).
- Returns `201 Created` on create, `204 No Content` on delete, `200 OK` for everything else.
- Uses an `Arc<dyn Substrate>` state so the same router can be backed by Incus, Tart, or a test mock.

## Verification

```bash
cd /Users/joe/Desktop/allternit-workspace/allternit-session-desktop-cloud-mvp
cargo test -p allternit-computer-cloud
```

Result:

```
running 10 tests
test substrate::tests::create_returns_native_id_from_resources ... ok
test substrate::tests::get_parses_running_state ... ok
test substrate::tests::start_then_get_updates_state ... ok
test substrate::tests::not_found_returns_error ... ok
test routes::computers::tests::missing_computer_returns_404 ... ok
test routes::computers::tests::get_computer_returns_state ... ok
test routes::computers::tests::delete_computer_returns_204 ... ok
test routes::computers::tests::create_computer_returns_201 ... ok
test routes::computers::tests::exec_runs_command ... ok
test routes::computers::tests::start_and_stop_update_state ... ok

test result: ok. 10 passed; 0 failed; 0 ignored
```

## Files changed
- `cmd/allternit-computer-cloud/src/routes/computers.rs` — new lifecycle router + tests.
- `cmd/allternit-computer-cloud/src/routes/mod.rs` — route module entry.
- `cmd/allternit-computer-cloud/src/lib.rs` — re-export routes module.
- `cmd/allternit-computer-cloud/Cargo.toml` — added `axum`, `tower`, `http`, `http-body-util`.

## Next step
Phase 2: build a reproducible Linux guest runtime image and cloud-init config so the substrate can launch desktops that are ready for browser automation instead of manually installing packages.
