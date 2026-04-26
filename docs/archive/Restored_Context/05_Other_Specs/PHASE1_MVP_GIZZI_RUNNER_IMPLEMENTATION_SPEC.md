# GIZZI_RUNNER_IMPLEMENTATION_SPEC.md
**Concrete implementation spec for coding agents**
_version 1.0 — build law_

## Purpose
This document tells a coding agent **exactly how to implement Gizzi (Runner)** as the single execution authority of allternitOS.  
No interpretation. No shortcuts. No side effects outside Runner.

---

## 1. Authority & invariants (must enforce)

1. Runner is the **only** component allowed to execute tools or mutate state.
2. Kernel is **pure** and deterministic (planning only).
3. UI / CLI / TUI may only talk to Runner.
4. Every execution step emits journal events (append‑only).
5. All tools are invoked via typed skills with policy gates.
6. Evidence & artifacts are immutable and content‑addressed.

Breaking any invariant is a **hard error**.

---

## 2. Service topology

### Public
- Runner API: `localhost:3010`
- Shell UI: `localhost:5173` (proxy → Runner)

### Private (Runner‑only)
- Kernel: `localhost:3000` or crate
- Framework service: `localhost:3003`
- Voice service: `localhost:8001`
- WebVM service: `localhost:8002`

**Rule:** UI/CLI/TUI must never call private services directly.

---

## 3. Repository layout

Create a new service:

```
services/runner/
  Cargo.toml
  src/
    main.rs
    api/
      routes.rs
      schemas.rs
    core/
      orchestrator.rs
      policy.rs
      registry.rs
      journal.rs
      capsule_store.rs
      evidence_store.rs
      artifact_store.rs
      sessions.rs
    exec/
      sandbox.rs
      skill_executor.rs
      adapters/
        bash.rs
        agent_browser.rs
        http_service.rs
    kernel/
      client.rs
      types.rs
```

Runner may link Kernel as a crate instead of HTTP.

---

## 4. Runner API (authoritative)

### Health
- `GET /v1/health`

### Jobs
- `POST /v1/jobs`
- `GET /v1/jobs/{job_id}`
- `GET /v1/jobs/{job_id}/events`

### Intent dispatch
- `POST /v1/intent/dispatch`

### Skills
- `GET /v1/skills`
- `POST /v1/skills/invoke`

### Capsules (read‑only)
- `GET /v1/capsules`
- `GET /v1/capsules/{cap_id}`

### Journal
- `GET /v1/journal/stream` (SSE)

---

## 5. Job lifecycle (mandatory)

1. Receive request → create Job
2. Snapshot context
3. Call Kernel → Plan
4. Policy evaluation
5. Execute skills in sandbox
6. Update capsule state
7. Compile CapsuleSpec
8. Respond to client
9. Emit journal events at every step

---

## 6. Storage (MVP)

```
var/gizzi/
  journal/runs/{run_id}.jsonl
  capsules/{cap_id}.json
  evidence/{evidence_id}.json
  artifacts/sha256/...
  registry/registry.json
  policy/policy.json
```

Large payloads stored by hash only.

---

## 7. Skill registry

Each skill defines:
- `skill_id`
- `executor` (bash | agent_browser | http_service)
- `safety_class`
- `input_schema`
- `output_schema`
- `timeouts`
- `resource_limits`
- optional allowlists

**No raw shell strings from Kernel. Ever.**

---

## 8. Sandbox execution

- Containerized execution
- Read‑only root FS
- Scoped workspace mount
- No Docker socket
- No root
- Network denied unless policy allows
- Exec via argv array only (no `sh -c`)

---

## 9. Policy engine (must block destruction)

Default denies:
- deleting repo root `Cargo.toml`
- modifying `.git/`
- overwriting compose files
- wildcard writes outside scoped workspace

Safety classes:
- read_only
- write
- network_read
- network_write
- dangerous (explicit confirmation required)

---

## 10. UI integration rules

- Vite proxy routes `/api/*` → Runner
- UI renders CapsuleSpecs only
- Journal visible only via debug overlay
- No direct execution logic in UI

---

## 11. Migration steps

1. Add Runner service + health endpoint
2. Route UI & CLI exclusively through Runner
3. Move skill registry into Runner
4. Enforce policy gates
5. Add journal persistence
6. Wire Kernel planning
7. Add browser operator skill

---

## 12. Acceptance tests

- UI intent creates capsule via Runner
- Journal shows full lifecycle
- Dangerous ops denied by default
- Replay reproduces same plan hash
- Runner restart preserves capsules

---

## 13. DO NOT list

- Do not execute tools outside Runner
- Do not bypass policy for “speed”
- Do not store blobs in journal
- Do not allow kernel side effects
- Do not let UI call internal services

---

## Definition of Done

Runner is complete when:
- All side effects flow through Runner
- Gizzi identity persists across restarts
- UI/CLI/TUI are thin clients
- Destructive mistakes are structurally impossible
