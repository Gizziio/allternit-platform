---
name: a2r-identity
description: Visual identity guidelines and implementation patterns for A2Rchitech. Use when designing UI components, updating branding, or maintaining the Architect Monolith persona.
---

# A2Rchitech Identity Skill

This skill provides procedural knowledge for maintaining and extending the A2Rchitech visual identity system.

## Core Identity: The Architect Monolith

The A2Rchitech persona, internally referred to as `gizzi`, is a technical geometric construct.

### Implementation Pattern
When using the `Persona` component for the primary assistant identity:
```tsx
<Persona 
  variant="gizzi" 
  state="auto" 
  className="color-[#D4B08C]" 
/>
```

## Visual Standards

Refer to [identity.md](references/identity.md) for the complete brand specification, including:
- **Rectilinear Geometry**: Use `ArchitectLogo.tsx` for all assistant visualizations.
- **Obsidian & Sand Palette**: Primary color `#1A1612`, Accent color `#D4B08C`.
- **Branding**: The "A2R & Coffee" greeting.

## Guidelines for New Components

1.  **Precision over Fluidity**: Avoid organic blobs or hand-drawn sketches. Use grids and right angles.
2.  **Sophisticated Glass**: Combine `backdrop-filter: blur()` with thin high-contrast borders.
3.  **Accent Consistency**: Use the Sand/Gold color (`#D4B08C`) for primary actions, success states, and the assistant's visual presence.
4.  **A2R & Coffee**: Maintain the balance between technical "A2R" (Architect) and warm "Coffee" ritual.
