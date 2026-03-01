# A2R Runtime Contract Notes

## Core Architecture

The system uses a two‑kernel structure:

1. **Execution Engine** (`1-kernel/a2r-engine/`)
   - Language: Rust
   - Role: Execution, scheduling, IO, intents

2. **Governance Kernel** (`2-governance/a2r-governor/`)
   - Language: TypeScript
   - Role: Policy, WIH routing, receipts

## Integration Chokepoint

The UI must bind only to the runtime bridge:

- `@a2r/runtime` (3-adapters/a2r-runtime/)

The bridge:
- Enforces governance and policy
- Adapts gateway/tool/file flows
- Exposes `RuntimeBridge` and helpers as the entry point

## Contract Exports

### @a2r/runtime
- `RuntimeBridge`
- `prepareSessionInit`
- `wrapToolExecution`
- `createWrappedFileOperations`
- `PluginAdapter`

### @a2r/governor
- `A2RKernelImpl`
- `WihStorage`, `WihItem`, `Receipt`

## UI Integration Rules

1. Do not import governance directly from UI.
2. Do not import vendor code directly.
3. Use only `@a2r/runtime` as the UI entrypoint.

