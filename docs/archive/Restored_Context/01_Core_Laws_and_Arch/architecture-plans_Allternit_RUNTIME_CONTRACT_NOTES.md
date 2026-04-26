# Allternit Runtime Contract Notes

## Core Architecture

The system uses a two‑kernel structure:

1. **Execution Engine** (`domains/kernel/allternit-engine/`)
   - Language: Rust
   - Role: Execution, scheduling, IO, intents

2. **Governance Kernel** (`domains/governance/allternit-governor/`)
   - Language: TypeScript
   - Role: Policy, WIH routing, receipts

## Integration Chokepoint

The UI must bind only to the runtime bridge:

- `@allternit/runtime` (services/allternit-runtime/)

The bridge:
- Enforces governance and policy
- Adapts gateway/tool/file flows
- Exposes `RuntimeBridge` and helpers as the entry point

## Contract Exports

### @allternit/runtime
- `RuntimeBridge`
- `prepareSessionInit`
- `wrapToolExecution`
- `createWrappedFileOperations`
- `PluginAdapter`

### @allternit/governor
- `AllternitKernelImpl`
- `WihStorage`, `WihItem`, `Receipt`

## UI Integration Rules

1. Do not import governance directly from UI.
2. Do not import vendor code directly.
3. Use only `@allternit/runtime` as the UI entrypoint.

