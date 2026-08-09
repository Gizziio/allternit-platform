# Swarm A — Core API / Gateway — Phase 3 Map

Master handoff: `/Users/joe/Desktop/allternit-parity-handoff.md`

## Scope

1. **Idempotency keys** — Add `Idempotency-Key` header support in `allternit-api`:
   - Idempotency cache table or in-memory store (per-org, per-key).
   - Replay detection: return cached response for duplicate keys within a TTL window.
   - Wire into the public API router so POST/PUT/PATCH requests honor the header.
   - Add unit tests covering first request, replay, and key scope isolation.

2. **Rate-limit enforcement** (companion to Swarm A Phase 2 `/rate-limits`) — Add middleware that rejects requests when quota is exhausted with `429` and `Retry-After` header. Derive limits from existing quota tables or defaults.

## Known starting files
- `cmd/allternit-api/src/main.rs`
- `cmd/allternit-api/src/llm_gateway/proxy.rs`
- `cmd/allternit-api/src/llm_gateway/auth.rs`
- `cmd/allternit-api/src/lib.rs`

## Constraints
- Do NOT start Phase 4 work.
- Do NOT run builds/dev servers/tests requiring external services.
- Match existing repo idioms.
- Work only in `/Users/joe/Desktop/allternit-parity-p2-swarm-a`.
