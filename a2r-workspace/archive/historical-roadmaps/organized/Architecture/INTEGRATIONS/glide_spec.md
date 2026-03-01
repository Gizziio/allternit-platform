# Glide → a2rchitech: Specs (Unified Chat UI)

## Scope
This spec defines the required contract surface for adopting Glide-like strengths inside a2rchitech’s Unified Chat UI:
- Template-as-executable-blueprint
- Workflow-native navigation + transitions
- Typed actions as the only mutation mechanism
- Integration packs as action/widget/transform providers
- Two-tier data model (local-first + big collections)

## Non-Goals
- Copying Glide’s exact UI styling
- Rebuilding a no-code editor
- Supporting arbitrary animation; transitions are constrained primitives

## Core Requirements

### R1 — MiniAppManifest (Required)
Every mini-app MUST compile to a MiniAppManifest containing:
- data_models
- views
- actions
- workflows
- transitions
- permissions
- integrations

### R2 — Typed Actions (Required)
All state changes MUST occur through typed actions:
- Deterministic execution
- Auditable logs
- Replayable flows
- UI transition hooks

Minimum action set:
- setValue
- addRow
- updateRow
- navigate
- showToast
- callAPI

### R3 — WorkflowSlideDeck (Required)
The runtime MUST support a workflow visualization primitive:
- Stepper/progress UI
- Gates/validation per step
- Edge-based transition policy
- Telemetry per step and edge

Transitions MUST be defined on edges, not globally.

### R4 — Integration Contract (Required)
Integrations MAY provide:
- Action providers
- Computed transforms
- Widgets
- Analytics sinks

Integrations MUST NOT mutate UI state directly.

### R5 — Template Registry (Required)
Templates MUST be:
- Installable
- Versioned
- Signed/verified (recommended)
- Customizable via first-run binding wizard:
  - data binding
  - roles/permissions
  - integrations/secrets
  - branding tokens

Install flow:
1) Get template
2) Bind + validate
3) Launch into WorkflowSlideDeck

### R6 — Data Tiering (Required)
Two-tier storage model:
- Local-first: offline + fast iteration
- Big collections: indexed + permissioned + scalable

Templates declare tier usage per data model.

## Acceptance Criteria
A mini-app can be installed from a template, bound to data + permissions, and executed end-to-end in Unified Chat UI with:
- deterministic action logs
- visual workflow progression
- constrained transitions tied to workflow edges
