# Agent Runner Handoff (February 2026)

## Summary of the State
- The Agent Runner (DAK) must remain the deterministic execution kernel while Rails stays the control/ledger plane (ledger, leases, gates, receipts, mail, CLI).  
- We now have a concrete DAG plan (see `docs/agent-runner-dag-plan.md`) that phases the build into: compliance mapping, core hook/tool kernel, orchestration/plan files, observability/receipts, and prompt/role infrastructure.  
- All artifacts in `agent/` (ownership map, bridge specs, REC, DAK spec, CLAUDE delta, policy, prompt formats, WIH scheme, agent profiles, example requests/receipts) informed the plan, so future agents should read them before implementing.

## Key Documents
1. `docs/prompt-pack-service-spec.md` - **NEW** - Full Prompt Pack Service specification
2. `docs/prompt-pack-service-handoff.md` - **NEW** - Coordination guide for Prompt Pack Service
3. `agent/A2R_Rails_Ownership_Map_v1.md` – Rails responsibilities, gate rules, storage layout, CLI command contracts.  
4. `agent/BridgeSpec_AgentRunner_RailsRunner_v1.md` & `v2.md` – bridge interface, context pack handshake, integration primitives.  
5. `agent/Runner_Rails_Event_Contract_REC_v1.md` – canonical event payloads, REC schema for claims, receipts, completions, gate rules mapping to CLI.  
6. `agent/spec/bridge-rails-runner.md` – detailed bridge spec with lease context pack inputs, tool lifecycle, evidence contract.  
7. `agent/spec/AgentRunner_System_Spec_v1.md` – file/folder layout, enforcement rules, no-drift policies.  
8. `agent/spec/dak-runner.md` – locked DAK definition, capabilities, invariants, file commitments.  
9. `agent/ClaudeCode_Tools_Hooks_Delta_for_A2R.md` & `_v2.md` – hook lifecycle events, tool list, permission translation, async hooks.  
10. `agent/POLICY.md` – absolute law (ToolRegistry only, PreToolUse gating, write scope).  
11. `agent/agent_profiles.json` – profiles, write scope globs, receipts requirement.  
12. `agent/Agentic Prompts/prompt-packs-index*.md` – prompt pack definitions (core/orch/roles/evidence, compaction).  
13. `agent/Agentic Prompts/formats/prompt-format-spec-v1.md` & `wih-scheme.md` – canonical prompt schema and WIH envelope.  
14. `agent/examples/agent_execution_request.example.json` & `agent_execution_receipt.example.json` – sample request/receipt structures.

## Key Decisions Captured
- Rails gate events (Gate 0..5) are hard enforcement points; every tool call must call gate check/commit/fail and produce `ReceiptRecorded`.  
- WIH/DAG run: builders must produce artifacts under `.a2r/runner/**` or through leases; validators must PASS before WIH close.  
- ToolRegistry must include Claude/MCP tooling with regex matching for names and specifiers.  
- Prompt injection includes policy bundles derived from AGENTS + plan/packs; context loss (new iteration/spawn/compaction) must retrigger injection.  
- No production writes outside `.a2r/runner` without Rails lease; durable state is recorded in Rails ledger/vault.
- **PROMPT PACK SERVICE**: Prompts are served by a dedicated service (port 3005) for determinism - immutable versions, content-addressed, receipts for Rails ledger.

## Completed Work ✅

### Phase 0: Governance & Compliance Mapping ✅
- **`agents/AGENTS.md`** - Agent law, role definitions, hook lifecycle, invariants, prohibitions
- **`agents/spec/BRIDGE_RAILS_RUNNER.md`** - Locked bridge spec between Rails control plane and Runner execution plane
- **`1-kernel/dak-runner/package.json`** & **`tsconfig.json`** - Project structure initialized
- **`1-kernel/dak-runner/src/policy/bundle-builder.ts`** - Policy bundle builder with injection markers

### Phase 1: Core Execution Kernel ✅
- **`src/types/index.ts`** - Core TypeScript types for all modules
- **`src/hooks/runtime.ts`** - Hook lifecycle: SessionStart → PreToolUse → PostToolUse → SessionEnd
- **`src/tools/registry.ts`** - ToolRegistry with Claude/MCP tools, regex matching
- **`src/tools/enforce.ts`** - Tool enforcement layer (schema, WIH scope, path guards)
- **`src/policy_engine/engine.ts`** - PolicyEngine with ALLOW/BLOCK/TRANSFORM/REQUIRE_APPROVAL
- **`src/adapters/rails_api.ts`** - Rails adapter for lease/gate/receipt operations
- **`src/adapters/prompt_pack.ts`** - **NEW** - Prompt Pack Service client (file/service/hybrid modes)

### Phase 2: Planning, Workers, & Orchestration ✅
- **`src/context/builder.ts`** - ContextPack compiler from Rails truth
- **`src/plan/manager.ts`** - PlanManager for plan.md, todo.md, progress.md, findings.md
- **`src/workers/manager.ts`** - WorkerManager for spawn, supervise, terminate
- **`src/loop/ralph.ts`** - Ralph loop with bounded fix cycles, Builder/Validator mutual blocking

### Phase 3: Observability, Receipts, & Replay ✅
- **`src/observability/events.ts`** - Event logging to events.jsonl
- **`src/observability/replay.ts`** - Replay and diff tooling

### Phase 4: Prompt Packs & Role Implementations ✅
- **`agents/roles/orchestrator.md`** - Orchestrator role envelope
- **`agents/roles/builder.md`** - Builder role envelope
- **`agents/roles/validator.md`** - Validator role envelope
- **`agents/cookbooks/ralph-loop.md`** - Ralph loop procedure
- **`agents/cookbooks/policy-injection.md`** - Policy injection procedure
- **`src/runner/agent-runner.ts`** - Main orchestration class tying everything together
- **`src/index.ts`** - Complete module exports

### Phase 5: Prompt Pack Service (NEW) ✅
- **`4-services/prompt-pack-service/Cargo.toml`** - Rust project with Axum, Tera, SQLite
- **`src/main.rs`** - Service entry point
- **`src/config.rs`** - Environment configuration
- **`src/models.rs`** - Core models (PromptPack, RenderRequest, PromptReceipt)
- **`src/storage.rs`** - SQLite + filesystem with content-addressed cache
- **`src/renderer.rs`** - Tera (Jinja2) deterministic rendering
- **`src/registry.rs`** - Pack versioning, dependencies, semver
- **`src/api/routes.rs`** - HTTP API (/v1/packs, /v1/render, /v1/receipts)
- **`src/api/mod.rs`** - API module
- **`agents/packs/dak-core-v1.yaml`** - Core pack definition
- **`agents/packs/dak-orch-v1.yaml`** - Orchestration pack definition
- **`agents/packs/dak-tools-v1.yaml`** - Tools pack definition

## File Structure

```
agents/
├── AGENTS.md                    # Agent law (✅)
├── spec/
│   ├── BRIDGE_RAILS_RUNNER.md  # Bridge spec (✅)
│   └── ...                      # (existing specs in agent/spec/)
├── packs/                       # Pack definitions (✅)
│   ├── dak-core-v1.yaml
│   ├── dak-orch-v1.yaml
│   └── dak-tools-v1.yaml
├── roles/                       # Role envelopes (✅)
│   ├── orchestrator.md
│   ├── builder.md
│   └── validator.md
└── cookbooks/                   # Deterministic procedures (✅)
    ├── ralph-loop.md
    └── policy-injection.md

1-kernel/dak-runner/
├── package.json                # (✅)
├── tsconfig.json               # (✅)
└── src/
    ├── index.ts               # Module exports (✅)
    ├── types/
    │   └── index.ts           # Core types (✅)
    ├── hooks/
    │   └── runtime.ts         # Hook lifecycle (✅)
    ├── tools/
    │   ├── registry.ts        # Tool registry (✅)
    │   └── enforce.ts         # Tool enforcement (✅)
    ├── policy/
    │   └── bundle-builder.ts  # Policy bundles (✅)
    ├── policy_engine/
    │   └── engine.ts          # Policy engine (✅)
    ├── adapters/
    │   ├── rails_api.ts       # Rails adapter (✅)
    │   └── prompt_pack.ts     # Prompt Pack client (✅)
    ├── context/
    │   └── builder.ts         # Context packs (✅)
    ├── plan/
    │   └── manager.ts         # Plan files (✅)
    ├── workers/
    │   └── manager.ts         # Worker management (✅)
    ├── loop/
    │   └── ralph.ts           # Ralph loop (✅)
    ├── observability/
    │   ├── events.ts          # Event logging (✅)
    │   └── replay.ts          # Replay/diff (✅)
    └── runner/
        └── agent-runner.ts    # Main orchestration (✅)

4-services/prompt-pack-service/  # ✅ NEW
├── Cargo.toml
├── src/
│   ├── main.rs
│   ├── config.rs
│   ├── models.rs
│   ├── storage.rs
│   ├── renderer.rs
│   ├── registry.rs
│   └── api/
│       ├── mod.rs
│       └── routes.rs
└── data/                        # Runtime data
    ├── packs/                   # Git-backed pack storage
    ├── cache/                   # Content-addressed cache
    └── receipts/                # Render receipts
```

## How It All Fits Together

### Determinism Pipeline

```
┌────────────────────────────────────────────────────────────────┐
│                    DETERMINISM PIPELINE                        │
├────────────────────────────────────────────────────────────────┤
│                                                                │
│  INPUT:  Same (pack_id + version + variables)                 │
│            ↓                                                   │
│  PROCESS:  Prompt Pack Service renders template               │
│            ↓                                                   │
│  OUTPUT: IDENTICAL text every time                             │
│            ↓                                                   │
│  RECEIPT:  Hash recorded in Rails ledger                      │
│            ↓                                                   │
│  REPLAY:   Same inputs → Same execution path                  │
│                                                                │
└────────────────────────────────────────────────────────────────┘
```

### Integration Flow

```
┌──────────┐      ┌──────────────────┐      ┌────────────┐
│   DAK    │──────│ Prompt Pack      │──────│   Rails    │
│ (Kernel) │      │ Service (3005)   │      │  (Ledger)  │
└────┬─────┘      └──────────────────┘      └─────┬──────┘
     │                                            │
     │ 1. Request:                                │
     │    pack=dak.core                           │
     │    version=1.2.3 ←── EXACT VERSION         │
     │    prompt=system.builder                   │
     │    variables={wih_id: "123"}               │
     │                                            │
     │ 2. Render → "You are Builder-Alpha..."     │
     │                                            │
     │ 3. Receipt: {                              │
     │      hash: "sha256:abc...",                │
     │      receipt_id: "rpt-789"                 │
     │    }                                       │
     │                                            │
     │ 4. Record in ledger ───────────────────────┤
     │                                            │
     │ 5. Execute with deterministic prompt       │
     │                                            │
```

## Running the Prompt Pack Service

```bash
# Environment
export PROMPT_PACK_PORT=3005
export PROMPT_PACK_DATA_DIR=./data
export PROMPT_PACK_RAILS_URL=http://127.0.0.1:3011

# Build and run
cd 4-services/prompt-pack-service
cargo build --release
cargo run

# Health check
curl http://127.0.0.1:3005/health

# Create a pack
curl -X POST http://127.0.0.1:3005/v1/packs \
  -H "Content-Type: application/json" \
  -d @agents/packs/dak-core-v1.yaml

# Render a prompt
curl -X POST http://127.0.0.1:3005/v1/render \
  -H "Content-Type: application/json" \
  -d '{
    "pack_id": "dak.core",
    "prompt_id": "system.builder",
    "version": "1.0.0",
    "variables": {"agent_id": "builder-1", "role": "builder"}
  }'
```

## Outstanding Work (Next Steps)

### Testing
1. Add unit tests for all DAK modules
2. Add integration tests for full Ralph loop
3. Add Prompt Pack Service tests
4. Add determinism verification tests

### Integration
1. Wire up DAK to actual Rails CLI commands
2. Implement actual tool handlers (currently stubs)
3. Add HTTP mode to Rails adapter
4. Create example runs

### Prompt Pack Service
1. Add pack template files (Jinja2)
2. Implement pack validation
3. Add git integration for version control
4. Add Rails ledger integration
5. Create metrics endpoint

### Documentation
1. Add API documentation for Prompt Pack Service
2. Create usage examples
3. Document configuration options
4. Add troubleshooting guide

## Handoff Instructions
1. Read the DAG plan and each `agent/` doc listed above before coding; they contain locked laws/invariants.  
2. Any implementation must emit events/receipts through Rails APIs only. Link every artifact/receipt to WIH/DAG IDs.  
3. Keep `.a2r/runner/` as the only workspace for runner-generated files; reference the policy for allowed globs.  
4. After updating code, regenerate or extend prompt packs to reflect new capabilities and ensure policy injection track (`policy/`) remains accurate.  
5. When ready to hand off again, update this file with modifications to the plan or spec list so the next agent knows what changed.

## Status Summary

| Phase | Status | Files |
|-------|--------|-------|
| 0: Governance | ✅ Complete | AGENTS.md, BRIDGE_RAILS_RUNNER.md, bundle-builder.ts |
| 1: Core Kernel | ✅ Complete | hooks/, tools/, policy_engine/, adapters/ |
| 2: Orchestration | ✅ Complete | context/, plan/, workers/, loop/ |
| 3: Observability | ✅ Complete | observability/ |
| 4: Prompt Packs | ✅ Complete | roles/, cookbooks/, agent-runner.ts |
| 5: Pack Service | ✅ Complete | 4-services/prompt-pack-service/ |

**Next Priority:** 
1. Build and test the Prompt Pack Service
2. Add template files for packs
3. Integrate DAK with the service
4. Testing and end-to-end verification
