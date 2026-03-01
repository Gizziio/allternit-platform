# RUNTIME_BOUNDARY.MD

Runtime boundary specification for A2rchitech platform.

## Purpose

Define the single, canonical boundary between:
- UI layer (apps and UI components) 
- Runtime execution layer (A2R runtime integration)

This prevents direct imports from vendor code into UI and ensures all execution goes through governed interfaces.

## Boundary Definition

### Current Runtime Boundary: `@a2r/runtime`
- **Package**: `3-adapters/a2r-runtime/`
- **Exports**: All adapters, wrappers, and hooks for runtime integration
- **Interface**: `RuntimeBridge` class and helper functions

### Allowed Import Pattern
```
UI Layer → Runtime Boundary (@a2r/runtime) → Governance (@a2r/governor) → Engine (Rust kernel)
```

### Forbidden Import Patterns
```
❌ UI Layer → 3-adapters/vendor/ (direct vendor import)
❌ UI Layer → @a2r/governor (bypasses runtime governance)
❌ UI Layer → Rust kernel directly
```

## Runtime Contract

### UI → Runtime Boundary Interface

The UI layer may only call these exported functions/classes from the runtime boundary:

- `createRuntimeBridge()` - Create bridge instance
- `RuntimeBridge` class - Main interface
- `wrapGatewayClient()` - Wrap GatewayClient
- `wrapToolExecution()` - Tool execution wrapper
- `wrapFileOperations()` - File operations wrapper
- `isA2RGoverned()` - Governance check
- `getCurrentWihId()` - Current WIH context
- Session management functions
- Plugin adapter functions

### Runtime Boundary → Governance/Engine

The runtime boundary handles all communication with:
- `@a2r/governor` for governance and policy enforcement
- Rust kernel for execution (through kernel interfaces)

## Enforcement Status

✅ **ENFORCED**: No direct imports from quarantined vendor code found in UI layer
✅ **ENFORCED**: All UI code accesses runtime functionality through @a2r/runtime boundary
✅ **ENFORCED**: Vendor code properly quarantined in 3-adapters/vendor/
✅ **ENFORCED**: Runtime harness exists at 3-adapters/a2r-runtime/
