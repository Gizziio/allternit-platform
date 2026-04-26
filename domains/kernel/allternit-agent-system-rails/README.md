# Allternit Agent System Rails

Unified system for **work execution under policy gates** across DAG/WIH/runs/leases/ledger/vault.

## Naming Locks

- **Gate** = WIH policy enforcer for dag/node/run transitions and tool execution.
- Do **not** use “kernel” or “control plane” in this subsystem.
- Event `actor.type` uses `"gate"` (not `"kernel"`).

## Structure

All code for this system lives under this folder.

```
allternit-agent-system-rails/
  docs/
    architecture/      # layered breakdown + CLI command mapping
    runner/            # runner mutation catalog + README
    vendor-notes/      # harvested behavior from Beads/MCP Mail
  src/                 # implementation
  spec/                # locked invariants and contracts
  schemas/             # JSON schemas (event envelope + event payloads)
  projections/         # projection rules
```

## Scope

This system **reimplements** the best logic from Beads + MCP Agent Mail.
We reference their behavior for correctness but **do not** depend on them at runtime.

### Advanced Capabilities (V2)
The system has been enhanced with enterprise-grade features for swarm coordination, human-in-the-loop interaction, and deep observability.
See [spec/agent-system-rails/Allternit_AGENT_SYSTEM_RAILS_CAPABILITIES.md](../../../spec/agent-system-rails/Allternit_AGENT_SYSTEM_RAILS_CAPABILITIES.md) for details on:
- **Elicitation Protocol** (Interactive forms/prompts)
- **Swarm Handoffs** (Dynamic agent transitions)
- **Execution Sampling** (Pass-through LLM generation)
- **Signal Broadcasting** (High-performance coordination)
- **GenAI Telemetry** (Token tracking & OpenTelemetry compliance)
- **OAuth Vault** (Credential management)

See [docs/architecture/README.md](./docs/architecture/README.md) for a full feature/architecture breakdown before you run the test suites.
Hidden runtime stores (`.allternit/`) are documented in [docs/architecture/README.md](./docs/architecture/README.md#layer-c---ledger-bus-transports) and tracked during `allternit rails init`.
