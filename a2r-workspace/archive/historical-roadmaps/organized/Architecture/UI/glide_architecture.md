# Glide → a2rchitech: Architecture Mapping

## Why Glide Matters (System-Level)
Glide’s advantage is not “no-code”; it is a workflow-native runtime where:
- data is live state,
- UI is constrained for legibility,
- navigation is encoded as typed actions,
- templates are executable blueprints.

This document maps Glide’s layers into a2rchitech components.

---

## Layer Mapping

### 1) Data Layer → a2rchitech Data Plane
Glide behavior:
- internal tables + external sources
- relational links
- computed transforms
- “big tables” scale

a2rchitech mapping:
- DataPlane.LocalStore (offline, user scope)
- DataPlane.BigCollectionStore (indexed, permissioned)
- DataPlane.Transforms (deterministic computed transforms)

---

### 2) UI Layer → Unified Chat UI + Mini-App Views
Glide behavior:
- component-based screens
- consistent hierarchies

a2rchitech mapping:
- UnifiedShell (chat + app capsule host)
- MiniAppViewRenderer (component tree)
- NavigationGraph (routes as graph nodes)

---

### 3) Actions Layer → Action Engine
Glide behavior:
- atomic actions; composable chains
- navigation actions are transition triggers

a2rchitech mapping:
- ActionEngine executes typed actions
- ActionLog provides audit + replay
- ActionPolicy enforces permission gates

---

### 4) Workflow Layer → Workflow Engine + SlideDeck Renderer
Glide behavior:
- workflows as visual graphs with triggers

a2rchitech mapping:
- WorkflowEngine (graph execution)
- WorkflowSlideDeck (graph visualization in UI)
- Telemetry per step/edge

---

### 5) Integration Layer → Integration Packs
Glide behavior:
- integrations inject actions, transforms, widgets, analytics

a2rchitech mapping:
- IntegrationRegistry
- ActionProvider interface
- WidgetProvider interface
- TransformProvider interface
- AnalyticsProvider interface

---

### 6) Templates → Template Registry + Install Wizard
Glide behavior:
- clone template → bind data → publish

a2rchitech mapping:
- TemplateRegistry stores versioned manifests + assets
- InstallWizard binds:
  - data sources/tables
  - roles/permissions
  - integration secrets
  - branding tokens

---

## Architectural Guarantees
- UI mutations only via ActionEngine
- Workflows execute deterministically over typed actions
- Transitions are edge policies, not ad-hoc animations
- Integrations are sandboxed providers, not UI controllers
