# Agent Quick Start Guide

> **For coding agents implementing the Unified UI system**

## TL;DR

Build these 4 things in order:

1. **A2UI Renderer MVP** - Card, Text, DataTable, List, Button, TextField
2. **CapsuleSpec ingestion** - Load JSON → render
3. **One compiler path** - goal + evidence[] → CapsuleSpec
4. **Journal link** - stamp run_id + store provenance

## Files to Read First

1. `spec/UNIFIED_UI_IMPLEMENTATION.md` - Complete specification (Tier-0 UI Law)
2. `spec/schemas/capsule_spec.v0.1.schema.json` - JSON Schema for validation

## The Core Contract

```
Agent → CapsuleSpec JSON → A2UI Renderer → Native UI
```

**Never:**
- Execute agent-generated code
- Use imperative DOM manipulation
- Manage UI state in the agent

**Always:**
- Output declarative JSON only
- Let the client own rendering
- Cite evidence_id for all derived content

## Build Order

### PR-A: Foundation
```
crates/a2ui_types/
crates/capsule_spec/
```
- Define types
- Add JSON schema validation
- No runtime logic yet

### PR-B: Renderer MVP
```
apps/ui/
```
Implement these components:
- Container (layout: column/row/stack/grid)
- Card (title, variant)
- Text (text/textPath, style)
- Button (label, actionId)
- TextField (valuePath, label)
- List (itemsPath, itemTitlePath)
- DataTable (rowsPath, columns)

Test with hardcoded JSON → renders correctly.

### PR-C: Compiler MVP
```
crates/evidence_store/
crates/capsule_compiler/
```
- Evidence normalization
- Route goal → capsule_type
- Emit CapsuleSpec (compile_full only)

### PR-D: Kernel Wiring
```
services/kernel/
apps/shell/
```
- `/v1/intent/dispatch` returns CapsuleSpec
- Shell renders returned spec
- Journal events work

### PR-E: Incremental Updates
- `patch_dataModel`
- `patch_ui`
- Evidence delta triggers partial recompile

## Component Props Quick Reference

| Component | Required Props |
|-----------|---------------|
| Container | `layout` |
| Card | - |
| Text | `text` OR `textPath` |
| Button | `label`, `actionId` |
| TextField | `valuePath` |
| List | `itemsPath`, `itemTitlePath` |
| DataTable | `rowsPath`, `columns` |
| Tabs | `tabs`, `activeTabPath` |

## Kernel Response Shape

```typescript
interface KernelResponse {
  ui: {
    a2ui_payload: {
      schemaVersion: string;
      dataModel: Record<string, any>;
      surfaces: Surface[];
      uiState?: Record<string, any>;
    };
    surface_policy: {
      component_whitelist: string[];
      no_code_execution: true;
    };
  };
  journal: Event[];
}
```

## What NOT To Build Yet

- Streaming
- Animations
- Multiple surfaces
- Persistence
- Browser automation
- Complex physics/interactions

These are Phase 2+ concerns. Focus on correctness first.

## Test Your Implementation

1. Create a hardcoded CapsuleSpec (use examples from spec)
2. Pass to renderer → should display UI
3. Click button → should dispatch action to kernel
4. Kernel returns patch → UI should update

If this works, everything else scales naturally.

## Key Principle

> Agents generate UI specs, clients render them declaratively.

This is the entire architecture. Everything else is implementation detail.
