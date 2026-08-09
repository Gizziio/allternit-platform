# Swarm D — Phase 7 Task

**Worktree:** `/Users/joe/Desktop/allternit-parity-p2-swarm-d`  
**Branch:** `ao/p7-d`  
**Base:** `parity/swarm-sprint`

## Goal
Ship a minimal but functional Python SDK parity layer.

## Deliverables

1. **Python SDK scaffold**
   - Create `sdk/allternit-python/` with `pyproject.toml` (package name `allternit`).
   - Implement `allternit.Harness` class with:
     - `__init__(mode, byok=None, cloud=None, local=None)`
     - `stream(request)` async generator yielding text/tool_call/done chunks
     - `complete(request)` returning a response dict
   - Support BYOK for `anthropic`, `openai`, `kimi`, and `vertex` (if Swarm A lands first, mirror its mapping).
   - Include `Tool`, `Message`, `StreamRequest` dataclasses.

2. **Provider request mapping**
   - Implement `to_anthropic_request`, `to_openai_request`, `to_kimi_request` mirroring the TypeScript SDK transforms.
   - Include prompt caching (`cache_control`), reasoning/thinking, JSON schema response format, and tool support.

3. **Tests**
   - Add `pytest` tests in `sdk/allternit-python/tests/` covering Anthropic/OpenAI request transforms and a simple mocked stream.

4. **Docs**
   - Add `docs/public/sdk/python-quickstart.md`.

## Validation
- `python -m pytest sdk/allternit-python/tests` — pass (or `pytest` from the package directory)
- `cargo check -p allternit-api` — pass

## Commit
Commit on `ao/p7-d` with message: `feat(p7): Swarm D Python SDK scaffold with chat completions and provider mapping`.
