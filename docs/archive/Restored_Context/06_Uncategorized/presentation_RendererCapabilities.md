# RendererCapabilities
## Capability Profile for UI Renderers (Kernel-Selectable)

Renderers must declare capabilities so the Presentation Kernel can adapt output without branching logic.

---

## Core Capabilities

- supports_motion_semantics
- supports_transition_continuity
- supports_physics (optional)
- supports_interactive_explainers
- supports_rich_tables
- supports_graphs
- supports_inline_media

---

## Degradation Rule

If a renderer lacks a capability, it must:
1) emit an explicit downgrade notice in UI, and
2) provide an alternative view.

No silent degradation.
