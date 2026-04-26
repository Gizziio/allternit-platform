# Agent Runner System — Folder + Module Spec (v1)

## 0) Purpose
Agent Runner is the **execution plane** that:
- builds deterministic ContextPacks (policy + DAG slice + evidence)
- spawns/scopes worker agents
- runs bounded iteration loops (Ralph)
- records receipts/evidence back to Rails
- maintains observability + replay tooling (execution-plane)

Rails remains the control plane.

---

## 1) Proposed repo layout

/workspace/agent/
  README.md

  runner/
    agent-runner.ts            # main loop: poll → claim → execute → report
    claim_store.sqlite         # idempotent claim/processed store
    config.ts                  # runner-local config (non-authoritative)

  packs/
    index.md                   # Prompt Pack Index (versioned)
    templates/                 # Prompt templates (strict format)
    schemas/                   # Prompt metadata schema if desired
    cookbook/                  # “how to run the kernel” playbooks

  policy/
    bundle_builder.ts          # builds PolicyBundle from AGENTS.md + .allternit/agents/*
    injection_marker.ts        # emits injection marker receipt
    agents_md/                 # cached render / hash snapshots (derived)

  context/
    builder.ts                 # ContextPack builder + slicer
    slicer.ts                  # deps / receipts slicing rules
    seal.ts                    # integrity metadata (hashes, method_version)

  hooks/
    runtime.ts                 # stage dispatcher (SessionStart..SessionEnd)
    claude_code_adapter.ts     # optional adapter (if running Claude Code)
    mcp_adapter.ts             # tool resolution adapter

  tools/
    registry.ts                # ToolRegistry (schemas)
    enforce.ts                 # schema + scope checks
    snapshots/                 # webfetch/websearch snapshots for replay

  policy_engine/
    engine.ts                  # block/allow/transform/require approval
    rules/                     # protected_paths, bash_patterns, write_rules

  loop/
    ralph.ts                   # iteration state machine
    escalation.ts              # PromptDeltaNeeded envelopes
    roles.ts                   # orchestrator/planner/builder/validator/security

  workers/
    worker_manager.ts          # spawn/supervise/kill/timebox
    contexts.ts                # inheritance/intersection rules
    providers/                 # claude-code, local-llm, etc.

  observability/
    events.jsonl               # per-run append-only logs
    ingest.ts                  # optional server
    store.sqlite               # optional store
    diff.ts                    # run diff
    replay.ts                  # deterministic replay

  adapters/
    rails_api.ts               # Rails event/lease/gate/receipt client

  tests/
    determinism/
    idempotency/
    policy/
    slicing/
    loop/

---

## 2) Where the uploaded “gameplanning” docs belong

These are **design seed** docs; they should live under a durable “agents folder” section as reference specs for Runner behavior:

- `/mnt/data/allternit_session_workflow_enforcement_layer_2026-02-04.md`
  → place as: `.allternit/runner/reference/workflow-enforcement-layer.md`

- `/mnt/data/allternit-session-summary-DAK-claude-tools-planning-with-files-2026-02-04.md`
  → place as: `.allternit/runner/reference/dak-claude-tools-planning-with-files.md`

- `/mnt/data/gmksession.md`
  → place as: `.allternit/runner/reference/gmk-session.md`

- `/mnt/data/semantic memory injection.md`
  → place as: `.allternit/runner/reference/semantic-memory-injection.md`

They should be treated as:
- **reference** (read-only, not executable truth)
- used to generate prompt packs + policies + hook wiring rules

---

## 3) “No drift” enforcement inside Runner

Runner must implement:
- **workspace allowlist**: only write under `.allternit/runner/**` and designated artifacts dir
- **all repo mutations go through Rails** (leases + gates + receipts)
- **cleanup**: every run produces a `run_manifest.json` listing created artifacts; cleanup deletes only those

