# KERNEL CONTRACT MAP

## Entrypoints
- **Runtime API**: `@allternit/runtime` (from `3-adapters/allternit-runtime/`)
- **Governance API**: `@allternit/governor` (from `2-governance/allternit-governor/`)
- **Execution Engine**: `1-kernel/allternit-engine/`

## Exported Types & Interfaces
- `AllternitKernel`: Governance interface (WIH, Receipts, Routing).
- `RuntimeBridge`: Main UI-facing orchestrator.
- `WihItem`: Work-In-Hand data model.
- `Receipt`: Canonical action record.
- `AuditLogEntry`: Structured event stream.

## Lifecycle Hooks
- `preSessionStart`, `postSessionStart`
- `preToolUse`, `postToolUse`
- `preFileAccess`, `postFileAccess`

## Persistence
- Stores live in `packages/allternit-kernel/dist/storage` (implied) or configured via `WihStorage` interface.
