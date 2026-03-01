# KERNEL CONTRACT MAP

## Entrypoints
- **Runtime API**: `@a2r/runtime` (from `3-adapters/a2r-runtime/`)
- **Governance API**: `@a2r/governor` (from `2-governance/a2r-governor/`)
- **Execution Engine**: `1-kernel/a2r-engine/`

## Exported Types & Interfaces
- `A2RKernel`: Governance interface (WIH, Receipts, Routing).
- `RuntimeBridge`: Main UI-facing orchestrator.
- `WihItem`: Work-In-Hand data model.
- `Receipt`: Canonical action record.
- `AuditLogEntry`: Structured event stream.

## Lifecycle Hooks
- `preSessionStart`, `postSessionStart`
- `preToolUse`, `postToolUse`
- `preFileAccess`, `postFileAccess`

## Persistence
- Stores live in `packages/a2r-kernel/dist/storage` (implied) or configured via `WihStorage` interface.
