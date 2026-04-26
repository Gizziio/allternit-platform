# Glide Apps → allternit Unified Chat UI Integration

## Purpose
This document is a **canonical integration artifact** for the Unified Chat UI within **allternit**.  
It captures **all research, architectural mappings, and implementation guidance** derived from the Glide Apps platform, with emphasis on **dynamic UI, mini‑apps, workflow‑driven transitions, and template‑based execution**.

This file is intended to be **drop‑in compatible** with the unified architecture chat and future spec unification.

---

## 1. What Glide Is (At First Principles)

Glide is not “no‑code.”
Glide is a **workflow‑native application runtime** with:

- A **data‑first execution model**
- A **constrained but expressive UI grammar**
- **Stateful navigation encoded as actions**
- **Templates as executable blueprints**

Glide’s real innovation is not visual design — it is **making workflows legible through UI motion**.

---

## 2. Core Glide System Layers

### 2.1 Data Layer
- Native tables + external data sources
- Relational links between tables
- Support for very large datasets (Big Tables, up to ~10M rows)
- Computed fields (deterministic transforms)

**Key Insight:**  
Data is treated as *live state*, not static content.

---

### 2.2 UI Layer
- Screen‑based layouts composed of constrained components
- Predictable navigation patterns (list → detail → action → result)
- Visual hierarchy over flexibility

**Key Insight:**  
UI is optimized for *clarity of flow*, not expressive freedom.

---

### 2.3 Actions Layer
Actions are atomic operations triggered by UI or workflows.

Categories:
- Data mutations
- Navigation (go to screen, back, modal, etc.)
- Communication (notifications, emails)
- Advanced (API calls, conditional logic)

**Critical Observation:**  
Transitions are just **navigation actions with animation semantics**.

---

### 2.4 Workflow Layer
- Visual, multi‑step automation graphs
- Triggered by UI events, schedules, or integrations
- Supports branching, conditions, and chained actions

**Key Insight:**  
Workflows are **state machines rendered through UI**.

---

### 2.5 Integration Layer
Integrations extend Glide by injecting:
- New actions
- Computed transforms
- Widgets
- Analytics hooks

This is Glide’s *plugin contract*.

---

### 2.6 Template System
Templates are:
- Fully wired apps
- Containing data schema, UI, workflows, actions
- Instantly clonable
- Designed for modification, not inspection

**Template = Mini App Blueprint**

---

## 3. Why Glide “Explains” Workflows Visually

The perceived quality of Glide transitions comes from:

1. Constrained transition primitives
2. Predictable screen hierarchy
3. Stateful progress indicators
4. Micro‑interactions tied to success/failure

There is no magic animation system.
There is **discipline in workflow visualization**.

---

## 4. Direct Mapping to allternit

### 4.1 MiniAppManifest (Required Abstraction)

Every allternit mini‑app must compile to a manifest:

```
MiniAppManifest
├─ data_models
├─ views
├─ actions
├─ workflows
├─ transitions
├─ permissions
└─ integrations
```

This mirrors Glide’s separation of concerns and enables:
- Template registry
- Deterministic execution
- Visual workflow rendering

---

### 4.2 Workflow Slide Deck Renderer

Introduce a native allternit primitive:

**WorkflowSlideDeck(viewGraph, workflowGraph)**

Capabilities:
- Stepper UI
- Progress gates
- Edge‑based transition policies
- Telemetry hooks

Transitions belong to **edges**, not screens:

```
edge.transition = {
  type: "sharedElementPush",
  duration: 260ms,
  easing: "standard"
}
```

---

### 4.3 Action System (Glide‑Compatible)

Minimum viable action set:
- setValue
- addRow
- updateRow
- navigate
- showToast
- callAPI

Actions must be:
- Typed
- Discoverable
- Composable

---

### 4.4 Integration Contract

Adopt Glide’s extension philosophy:

Integrations may provide:
- Action providers
- Computed transforms
- UI widgets
- Analytics sinks

No integration may directly mutate UI state without an action.

---

### 4.5 Data Tier Strategy

Two‑tier model:
1. Local‑first tables (offline, personal, fast)
2. Big collections (indexed, permissioned, scalable)

Templates declare which tier they bind to.

---

## 5. Template Registry for allternit

Equivalent to Glide’s gallery:

Template sources:
- Core allternit
- Community
- Organization‑scoped

Install flow:
1. Get Template
2. Bind data + roles + integrations
3. Launch directly into WorkflowSlideDeck

Customization is **guided**, not free‑form.

---

## 6. Why This Matters for Unified Chat UI

This approach enables:
- Mini‑apps as executable chat artifacts
- Visual explanation of agent workflows
- Reduced cognitive load
- Deterministic UI behavior across agents

Chat becomes a **launcher, explainer, and executor** — not a text box.

---

## 7. Build Order (Concrete Execution Plan)

1. Define MiniAppManifest schema
2. Implement WorkflowSlideDeck renderer
3. Implement typed Action engine
4. Add Integration registration system
5. Launch internal Template Registry
6. Seed with 10–20 workflow‑driven mini apps

---

## 8. Strategic Conclusion

Glide proves that:
- UX clarity beats expressive freedom
- Workflows should be seen, not read
- Templates outperform blank canvases

allternit should not copy Glide’s UI.

It should **generalize Glide’s execution grammar** and embed it natively into the Unified Chat UI.

---

END OF FILE
