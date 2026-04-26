# Canvas Runtime Mapping

## Overview
This document maps the relationship between `CapsuleState`, `CanvasSpec`, and the renderer.

## State Mapping

### CapsuleState → CanvasSpec
```
CapsuleState {
  capsule_id: string,
  goal: string,
  evidence: EvidenceObject[],
  framework_id: string,
  canvas_spec: CanvasSpec,
  updated_at: number
}
→
CanvasSpec {
  title: string,
  views: ViewSpec[],
  actions: ActionSpec[],
  update_rules: UpdateRule[]
}
```

### CanvasSpec → Renderer
The UI renderer consumes only `CanvasSpec` objects, not ad-hoc components.

## Contract Enforcement

### Input: CapsuleSpec
```typescript
interface CapsuleSpec {
  goal: string;
  evidence: EvidenceObject[];
  constraints: any;
  permissions: any;
}
```

### Output: CanvasSpec
```typescript
interface CanvasSpec {
  title: string;
  views: TypedViewSpec[]; // list/table/cards/timeline/forms
  actions: ActionSpec[]; // buttons, suggestions
  update_rules: UpdateRuleSpec; // how to react to evidence changes
}
```

## Typed View Specifications

### Available View Types
- `list_view` - for lists of items
- `table_view` - for tabular data
- `cards_view` - for card-based layouts
- `timeline_view` - for chronological data
- `form_view` - for data entry

### Action Specifications
- Buttons with safety tiers
- Suggestions for next actions
- Framework-specific actions

## Update Rules

### Evidence Change Handling
When evidence changes:
1. IO journals `evidence.added` / `evidence.removed`
2. Kernel/Compiler produces `capsule.compiled` with new `CanvasSpec`
3. UI re-renders with diff-aware reflow

### Update Rule Format
```typescript
interface UpdateRule {
  when: {
    event: 'evidence_added' | 'evidence_removed' | 'goal_changed';
    filter: any;
  };
  then: {
    strategy: 'recompile_full' | 'recompile_partial' | 'patch_ui' | 'patch_data_model';
    diff_mode: 'stable_ids' | 'position_aware' | 'content_hash';
  };
}
```

## Renderer Contract

### CanvasRenderer Input
The `CanvasRenderer` accepts only `CanvasSpec` objects, ensuring a consistent contract between the compiler output and UI rendering.

### View Registry
All views must be registered in the `ViewRegistry` to ensure type safety and consistent rendering behavior.