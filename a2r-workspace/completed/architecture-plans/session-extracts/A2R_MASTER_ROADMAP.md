# A2R Master Roadmap (derived from laws + session corpus + Atlas gaps)

- Generated: 2026-01-27
- Scope: roadmap-level tasks/subtasks. Implementation details require repo-level code access beyond the Atlas.

## Phase 0 — Canonical law layer (boot truth)

- Add `/SOT.md` and adopt append-only `/spec/Deltas/` governance.
- Generate and maintain `CODEBASE.md` as the retrieval anchor (RCP-001).
- Add `/spec/Contracts/WIH.schema.json` (canonical WIH/beads schema) and enforce linting.
- Add `/spec/ADRs/` and require ADR IDs referenced from WIH.

## Phase 1 — Tasks engine parity (Claude Tasks inside A2R)

- Define canonical TaskGraph + TaskNode + Run + Environment data model under `/.a2r/`.
- Implement dependency gating (`blockedBy`) as scheduler truth (agents cannot bypass).
- Implement `/install` preset creation (env + tool scopes + memory mounts + artifact plan).
- Implement `/resume` deterministic rehydration (load WIH, env, cursor, last run receipts).
- Implement strict state machine and completion gates (artifacts + acceptance criteria).

## Phase 2 — Enforcement hardening (no drift)

- Upgrade Hooks/PreToolUse into hard gate: validate WIH, tools, write scopes, artifacts, deps.
- Enforce output law: all writes under `/.a2r/` with declared subpaths; deny all else.
- Eliminate/contain unsandboxed execution surfaces (e.g., python exec) or wrap with sandbox and path gates.
- Add provenance receipts for tool calls and filesystem deltas (hash manifests per run).

## Phase 3 — Memory substrate (layered + RLM policy + promotion path)

- Formalize memory layers: Law / Graph / Execution / Semantic / Proposal.
- Define workspace memory packs; allow cross-session/agent access only via WIH grants.
- Implement proposal store under `/.a2r/proposals/` and deterministic auto-approve promotion rules.
- Integrate RLM policy layer to tune retention/decay/confidence, without changing law memory silently.

## Phase 4 — Production networking (remove port sprawl)

- Introduce single Gateway as the only exposed endpoint per environment profile.
- Move internal services to name-based addressing (service discovery / UDS locally).
- Centralize config generation; remove arbitrary ports from scattered scripts.

## Phase 5 — UI cockpit (Workspace + Today + DAG-first)

- Workspace home (default) + Today cockpit tab (global).
- DAG graph viewer with node inspector showing WIH, tools, write scopes, artifacts, deps, cursor.
- Run replay: stdout/stderr, tool-call timeline, filesystem diff, provenance.
- Promotion dashboard: proposals, rules that auto-approved, diffs, rollback.

## Phase 6 — Multi-LLM routing (enterprise-grade)

- Router policy driven by WIH: allowed models, cost caps, latency, tool access, safety level.
- Per-run routing audit: why model chosen, alternatives, observed performance.
- Pluggable providers (Claude/GPT/Gemini/local) under unified adapter interface.

## Phase 7 — Optional product layers (only after harness is solid)

- Crypto layer integration (identity/wallet, transactions) behind contracts and policy gates.
- Social network layer (content/graph) treated as another capsule/service with strict boundaries.

