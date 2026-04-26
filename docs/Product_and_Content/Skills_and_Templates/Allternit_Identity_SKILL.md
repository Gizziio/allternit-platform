---
name: allternit-identity
description: Visual identity guidelines and implementation patterns for Allternit. Use when designing UI components, updating branding, or maintaining the Architect Monolith persona.
---

# Allternit Identity Skill

This skill provides procedural knowledge for maintaining and extending the Allternit visual identity system.

## Core Identity: The Architect Monolith

The Allternit persona, internally referred to as `gizzi`, is a technical geometric construct.

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
- **Branding**: The "Allternit & Coffee" greeting.

## Guidelines for New Components

1.  **Precision over Fluidity**: Avoid organic blobs or hand-drawn sketches. Use grids and right angles.
2.  **Sophisticated Glass**: Combine `backdrop-filter: blur()` with thin high-contrast borders.
3.  **Accent Consistency**: Use the Sand/Gold color (`#D4B08C`) for primary actions, success states, and the assistant's visual presence.
4.  **Allternit & Coffee**: Maintain the balance between technical "Allternit" (Architect) and warm "Coffee" ritual.
