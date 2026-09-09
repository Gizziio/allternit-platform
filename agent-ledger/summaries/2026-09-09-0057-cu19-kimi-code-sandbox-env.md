# Session cu19 — ACU-side sandbox_env consumption (credential injection channel)

- **Date:** 2026-09-09
- **Agent:** kimi-code (orchestrated swarm task B)
- **PR:** #187 → merge 568a1e466
- **Branch:** session/cu19-sandbox-env

## What was done

Wired the Python ACU engine to consume the `sandbox_env` credential-injection channel that PR #177's Rust vault (`cmd/allternit-api/src/aci_credentials.rs`) emits on run creation (`aci_routes.rs` posts it as a top-level field to `/v1/computer-use/execute`). Previously the field was silently ignored on the Python side.

- New `domains/computer-use/core/core/sandbox_env.py`: `validate_sandbox_env` (shell-identifier keys, ≤16 KiB values, errors name the key only), `sandbox_env_context` (run-scoped `os.environ` set/restore so adapter child processes — Playwright browser launches, desktop subprocesses — inherit vars), `scrub_secrets` (recursive `***` replacement, mirrors Rust `scrub_frame`).
- `computer_use_router.py` execute path: `ExecuteBody.sandbox_env: Dict[str,str] = {}` with masked `__repr__`/`__str__`; validated before run creation (400, key-only message); values held as in-memory-only `RunState.sandbox_secrets` (never in `to_dict()`, persistence, or frames); both run paths wrapped in `sandbox_env_context`; `RunStore.push_event` scrubs stream frames; result/error assignments, canonical payloads, and router log lines scrubbed.
- `core/replay_engine.py`: `capture_screenshot`/`_capture_via_action` gained optional `secrets` param scrubbing their warning logs — a real leak found by the new tests.

## Verification

- `tests/test_sandbox_env.py` (new, 15 tests): delivery (adapter sees var mid-run, env restored, invalid key → 400 without echo) + unit tests + canary `ACI_CANARY_SECRET_ZZ9` leak checks across response bodies, SSE stream, event queue, SQLite persistence, and caplog through both intent-mode and direct-mode paths. 15 passed.
- Gateway suite (`--ignore=test_e2e.py --ignore=test_real_adapters.py`): 227 passed, 21 skipped, 2 failed — both the documented env-dependent desktop flakes, same envelope as clean main.
- Post-merge on main (combined with cu18): 30/30 green.

## Honest deferrals

- No Python VM/microVM path exists for the Rust `extra_env → /etc/environment` pattern (`vm_session_routes.rs` is Rust-side; `sandbox/` Firecracker is separate provisioning) — run-scoped `os.environ` injection is documented as the entire Python channel.
- Concurrent runs share `os.environ` (last-writer-wins during overlap) — documented v1 tradeoff.
- `core/planning_loop.py`'s internal action-failure log is outside the router's scrub boundary (same stance as Rust) — noted in PR.
- Merge with #186 (same router file) auto-merged cleanly; only `.steering/checkpoint.md` conflicted, resolved per convention.
