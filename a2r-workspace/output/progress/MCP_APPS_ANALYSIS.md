# MCP Apps / Interactive Capsules - Implementation Analysis

**Date**: 2026-02-24  
**Status**: Reorganized to 3-adapters layer, gaps identified

---

## 1. Code Reorganization Complete ✅

### Moved from `packages/mcp-apps/` to `3-adapters/mcp-apps/`

The MCP Apps TypeScript adapter has been moved to the correct isolation layer:

```
3-adapters/
├── mcp/                    # Rust MCP core implementation
├── mcp-apps/              # TypeScript MCP Apps adapter (MOVED HERE)
│   ├── src/types/
│   │   ├── InteractiveCapsule.ts
│   │   ├── MCPBridge.ts
│   │   └── index.ts
│   ├── package.json       # @a2r/mcp-apps-adapter
│   └── tsconfig.json
└── ...
```

### Updated References

All imports updated from `@a2r/mcp-apps` to `@a2r/mcp-apps-adapter`:

| File | Updated |
|------|---------|
| `6-ui/a2r-platform/src/store/slices/mcpAppsSlice.ts` | ✅ |
| `6-ui/a2r-platform/src/views/AgentView.tsx` | ✅ |
| `6-ui/a2r-platform/src/components/CapsuleFrame/CapsuleFrame.tsx` | ✅ |
| `6-ui/a2r-platform/src/components/CapsuleFrame/useCapsuleBridge.ts` | ✅ |
| `6-ui/a2r-platform/src/hooks/useCapsule.ts` | ✅ |
| `6-ui/a2r-platform/src/policies/mcp-apps.policy.ts` | ✅ |
| `6-ui/a2r-platform/package.json` | ✅ |

---

## 2. API Implementation Status

### Location: `7-apps/api/src/mcp_apps_routes.rs`

**Routes Implemented**:
```rust
POST   /mcp-apps/capsules              # Create capsule
GET    /mcp-apps/capsules              # List capsules
GET    /mcp-apps/capsules/:id          # Get capsule
DELETE /mcp-apps/capsules/:id          # Delete capsule
POST   /mcp-apps/capsules/:id/event    # Post event (UI → Tool)
GET    /mcp-apps/capsules/:id/stream   # SSE stream (Tool → UI)
```

**Wired in main.rs** ✅:
```rust
// Line 1055
.merge(mcp_apps_routes::router())
```

**State Management** ✅:
```rust
// Line 315
mcp_capsule_registry: Option<Arc<RwLock<std::collections::HashMap<String, mcp_apps_routes::CapsuleEntry>>>>,
```

### Gaps in API Implementation:

1. **No Capsule State Updates**: The API has no endpoint to update capsule state (e.g., from `pending` to `active`)
2. **No Tool Integration**: The capsule events are broadcast but not connected to actual tool execution
3. **No Permission Enforcement**: The permissions in `CapsulePermission` are stored but not validated
4. **Registry Initialization**: The `mcp_capsule_registry` is declared but may not be initialized in AppState

---

## 3. UI Components Status

### Location: `6-ui/a2r-platform/src/components/CapsuleFrame/`

**Components**:
```
CapsuleFrame/
├── CapsuleFrame.tsx         # Main sandboxed iframe component
├── useCapsuleBridge.ts      # PostMessage bridge hook
├── index.ts                 # Exports
└── CapsuleFrame.module.css  # Styles
```

**Features**:
- ✅ Sandboxed iframe with CSP
- ✅ window.a2r API injection
- ✅ Bidirectional postMessage
- ✅ Connection status indicator
- ✅ Error handling

### Location: `6-ui/a2r-platform/src/views/AgentView.tsx`

**Integration** ✅:
- "Capsule" tab added to AgentDetailView
- `AgentCapsuleView` component created
- Event log panel for debugging
- Tool invocation testing UI

### Gaps in UI Implementation:

1. **ShellUI Integration Missing**: No MCP Apps components in `6-ui/shell-ui/`
2. **No Standalone Capsule View**: Capsules only accessible through Agent Studio
3. **Limited Debug Tools**: Event log is basic, needs better dev tools
4. **No Capsule Management UI**: No list view for all active capsules

---

## 4. TypeScript Adapter Status

### Location: `3-adapters/mcp-apps/`

**Package**: `@a2r/mcp-apps-adapter`

**Types Exported** ✅:
- `InteractiveCapsule` / `InteractiveCapsuleSchema`
- `ToolUISurface` / `ToolUISurfaceSchema`
- `CapsuleEvent` / `CapsuleEventSchema`
- `CapsulePermission` / `CapsulePermissionSchema`
- `CreateCapsuleRequest` / `CreateCapsuleRequestSchema`
- `MCPMessage`, `MCPMessageType` and related

**Build Status** ✅:
```bash
pnpm --filter @a2r/mcp-apps-adapter build
# ✅ Success
```

---

## 5. Gaps Summary

### Critical Gaps (Blocking)

1. **Workspace Cargo.toml**: The root Cargo.toml only has `3-adapters/mcp` as member, but API depends on many workspace crates. **BLOCKS RUST COMPILATION**

2. **Registry Initialization**: Need to verify `mcp_capsule_registry` is properly initialized in AppState

3. **Tool Bridge**: Capsule events need to be connected to actual tool execution

### Medium Priority

4. **ShellUI Components**: `6-ui/shell-ui/` has no MCP Apps integration

5. **Permission Enforcement**: Permissions are defined but not enforced

6. **State Management**: No way to update capsule state via API

### Low Priority

7. **Testing**: No unit tests for API routes or UI components

8. **Documentation**: README needs update for new location

9. **Dev Tools**: Limited debugging capabilities for capsules

---

## 6. Recommendations

### Immediate Actions

1. **Fix Workspace Cargo.toml**: Restore full workspace configuration or create minimal one for API
2. **Initialize Registry**: Add `mcp_capsule_registry` initialization in AppState
3. **Connect Tool Bridge**: Wire capsule events to tool execution system

### Short Term

4. **Add ShellUI Components**: Create capsule management views in shell-ui
5. **Implement Permission Checks**: Add middleware for permission validation
6. **Add State Update Endpoint**: `PATCH /mcp-apps/capsules/:id/state`

### Long Term

7. **Comprehensive Testing**: Unit tests, E2E tests, security audit
8. **Dev Tools Panel**: Better debugging for capsule lifecycle
9. **Performance Optimization**: Registry cleanup, connection pooling

---

## 7. File Locations Summary

```
3-adapters/mcp-apps/                          # TypeScript adapter
├── src/types/InteractiveCapsule.ts
├── src/types/MCPBridge.ts
└── src/index.ts

7-apps/api/src/mcp_apps_routes.rs            # API routes
7-apps/api/src/main.rs                       # Route registration

6-ui/a2r-platform/src/components/CapsuleFrame/  # UI components
6-ui/a2r-platform/src/views/AgentView.tsx        # Agent Studio integration
6-ui/a2r-platform/src/store/slices/mcpAppsSlice.ts  # State management
6-ui/a2r-platform/src/hooks/useCapsule.ts       # React hook
6-ui/a2r-platform/src/policies/mcp-apps.policy.ts # Security policies
```

---

## 8. Build Verification

**TypeScript Adapter** ✅:
```bash
cd /Users/macbook/Desktop/a2rchitech-workspace/a2rchitech
pnpm --filter @a2r/mcp-apps-adapter build
# Success
```

**UI Type Check** ✅:
```bash
cd 6-ui/a2r-platform
npm run typecheck
# No errors in our files
```

**Rust API** ❌:
```bash
cd 7-apps/api
cargo check
# Fails - workspace Cargo.toml needs fix
```
