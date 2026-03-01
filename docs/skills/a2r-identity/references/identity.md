# A2Rchitech Identity System

The A2Rchitech identity system is built on the principles of precision, structure, and technical sophistication. It moves away from organic, rounded shapes toward rectilinear, architectural constructs.

## Core Visual: The Architect Monolith

The primary identity is the **Architect Monolith**, a geometric construct composed of rectilinear blocks and technical markers.

### Visual Characteristics:
- **Geometry**: Rectangles, right angles, crosshairs, and grids.
- **Form**: A technical "burst" of blocks that suggest an unfolding schematic or blueprint.
- **Hand-drawn feel**: Strictly avoided. Lines should be crisp and precise.

### Dynamic States:
- **Idle**: Subtle breathing scale and opacity shifts.
- **Thinking**: Rotates slowly like a scanning radar; inner blocks slide in/out.
- **Speaking**: Expands outwards in response to audio energy level.
- **Listening**: Full opacity, pulsing glow.

## Color Palette: Obsidian & Sand

The identity uses a high-contrast, professional palette that is distinct from standard AI assistants.

| Element | Color | Name | Usage |
|---------|-------|------|-------|
| Primary Background | `#1A1612` | Obsidian | App backgrounds, containers |
| Secondary Background | `#2A211A` | Dark Sand | Hover states, secondary panels |
| **Identity Accent** | **`#D4B08C`** | **Sand/Gold** | **Persona, branding, checkmarks** |
| Assistant Accent | `#D97757` | Coral | Status indicators (Legacy/Secondary) |
| Text Primary | `#ECECEC` | Off-white | Main readability |
| Text Secondary | `#9B9B9B` | Muted Sand | Labels, descriptions |

## Component Implementation

### Persona Component
Always use `variant="gizzi"` for the primary identity. This variant is now mapped to the `ArchitectLogo` component.

### CSS Integration
- **Gradients**: Use Sand-to-Obsidian gradients for sophisticated depth.
- **Blurs**: Use `backdrop-filter: blur(12px)` for glass effects.
- **Borders**: Thin, high-contrast borders (`1px solid rgba(212, 176, 140, 0.2)`).

## Logo: A2R & Coffee
The primary greeting combines the technical identity with the "A2R & Coffee" motif.
- The `&` symbol should always be in the **Sand** accent color (`#D4B08C`).
- Font: Serif (Georgia/Times) for the "Coffee" warmth, combined with technical Sans for "A2R".
