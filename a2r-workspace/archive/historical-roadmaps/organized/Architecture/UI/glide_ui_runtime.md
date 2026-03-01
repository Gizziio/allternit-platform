# Glide → a2rchitech: UI Runtime (Dynamic UI + Mini Apps)

## Core UI Primitive: WorkflowSlideDeck
A workflow is rendered as a guided sequence of steps.
Each step maps to a view node.
Each edge defines:
- transition primitive
- validation gates
- telemetry events

### Edge Transition Policy (Example)
```json
{
  "from": "step.collect_input",
  "to": "step.review",
  "transition": { "type": "shared_element_push", "durationMs": 260, "easing": "standard" },
  "telemetry": { "event": "workflow_step_completed" }
}
```

## Constrained Transition Set (Recommended)
To reproduce “workflow explanation” effects, keep primitives tight:
- push
- modal
- fade
- stepper_next
- shared_element_push

## Micro-interactions (Tied to Actions)
Micro-interactions should be a function of action lifecycle:
- pending → spinner / subtle motion
- success → toast + forward transition
- failure → shake + inline error + retry

No micro-interaction should exist without an action state.

## Deterministic UI
Determinism constraints:
- All navigation is navigate() action
- All mutations are typed actions
- All transitions are computed from workflow edge policy

## Chat → Capsule → App Pattern
Unified Chat UI should support:
- Chat message invokes mini-app
- Mini-app launches as an app capsule
- WorkflowSlideDeck renders the flow inside capsule

This eliminates context shift while preserving clarity.
