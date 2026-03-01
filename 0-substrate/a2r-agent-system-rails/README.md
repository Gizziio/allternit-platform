# A2R Agent System Rails

Unified system for **work execution under policy gates** across DAG/WIH/runs/leases/ledger/vault.

## Naming Locks

- **Gate** = WIH policy enforcer for dag/node/run transitions and tool execution.
- Do **not** use “kernel” or “control plane” in this subsystem.
- Event `actor.type` uses `"gate"` (not `"kernel"`).

## Structure

All code for this system lives under this folder.

```
a2r-agent-system-rails/
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

See [docs/architecture/README.md](./docs/architecture/README.md) for a full feature/architecture breakdown before you run the test suites.
Hidden runtime stores (`.a2r/`) are documented in [docs/architecture/README.md](./docs/architecture/README.md#layer-c---ledger-bus-transports) and tracked during `a2r rails init`.
