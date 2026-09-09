# Checkpoint — session/cu19-sandbox-env

## Goal
Wire ACU-side consumption of the `sandbox_env` credential-injection channel (Rust PR #177): accept the top-level `sandbox_env` field on /v1/computer-use/execute, thread it into the run's child-process environment, and leak-proof it.

## Just did
- New `core/sandbox_env.py`: validate_sandbox_env (key-only errors), sandbox_env_context (os.environ set/restore), scrub_secrets (recursive *** replace).
- `gateway/computer_use_router.py`: ExecuteBody.sandbox_env field + masked __repr__/__str__; RunState/RunStore carry sandbox_secrets (never serialized); execute endpoint validates (400, key-only message) and wraps run_impl in sandbox_env_context; push_event scrubs frames; result/error assignments + canonical payloads + log lines scrubbed.
- `core/replay_engine.py`: capture_screenshot(_capture_via_action) gained optional `secrets` param scrubbing its two warning logs (replay callers default None → unchanged).
- Documented: no Python VM/microVM session path exists (Firecracker sandbox/ is separate provisioning; the cloud-VM /etc/environment bootstrap is Rust-side vm_session_routes only) — run-scoped os.environ injection is the whole Python-side channel.

## Verification
- New tests: `cd domains/computer-use/core/gateway && PYTHONPATH=".." python -m pytest tests/test_sandbox_env.py -q` → 15 passed.
- Existing suite (from core/): `python -m pytest tests/ -q --ignore=tests/test_e2e.py --ignore=tests/test_real_adapters.py` → 227 passed, 21 skipped, 2 env-dependent desktop flakes (both pass in isolation; baseline on clean main had 1; flake set varies run to run and none touch this change).

## Next
Commit, push, open PR, stop (orchestrator merges).

## Open questions
- Concurrent runs share os.environ for overlapping windows (documented v1 tradeoff in core/sandbox_env.py).

## Done
- PR #187 opened (https://github.com/Gizziio/allternit-platform/pull/187), branch session/cu19-sandbox-env, single commit b091b4932. Stopped here per instructions — orchestrator merges.
