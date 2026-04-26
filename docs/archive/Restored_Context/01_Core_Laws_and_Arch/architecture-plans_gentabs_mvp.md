# GenTabs/Capsules MVP Implementation Guide

## Capsule Lifecycle

A capsule is a container for:
- goal
- evidence set
- compiled mini-app spec
- actions
- journal stream

### Capsule State Structure
```typescript
interface CapsuleState {
  capsule_id: string;
  goal: string;
  evidence: EvidenceObject[];
  framework_id: string; // selected
  canvas_spec: CanvasSpec; // compiled output
  updated_at: number;
}
```

### Evidence Loop
1. User adds evidence → triggers `evidence.add` journal event
2. Kernel/compiler produces new `CanvasSpec`
3. UI re-renders with diff-aware reflow (no reset)

### Synthesis Moment
Explicit transition: Evidence collection → synthesis animation → mini-app appears

## Evidence Panel Implementation

### Evidence Strip/Panel
- Shows evidence items (url/doc/note)
- Add evidence input
- Remove evidence button per item

### Evidence Actions
- Add evidence triggers: POST to IO/kernel: `capsule.evidence.add`
- Journal event: `evidence.added`
- Remove evidence triggers: POST: `capsule.evidence.remove`
- Journal: `evidence.removed`

## Compile-on-Delta Implementation

When evidence is added/removed:
1. Trigger compiler (kernel or IO): `capsule.compile(goal, evidence[])` → `CanvasSpec`
2. Update `canvasesByCapsuleId[capsule_id]` with returned `CanvasSpec`
3. Render updates as reflow, not reset (preserve capsule_id, preserve tab)

## Tab/Capsule Switching

### State Requirements
- `activeCapsuleId`
- `canvasesByCapsuleId: Map<capsule_id, CanvasSpec>`

### Switching Behavior
Clicking a tab must:
- Set `activeCapsuleId`
- Re-render canvas mount from `canvasesByCapsuleId.get(activeCapsuleId)`
- Do not recreate tabs in a way that drops event handlers