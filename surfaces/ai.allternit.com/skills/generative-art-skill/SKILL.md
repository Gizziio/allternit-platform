---
name: generative-art
description: |
  Produce a seeded generative art piece as a single self-contained HTML canvas. A deterministic inline-SVG or canvas composition driven by the seed and a palette constrained to the amber family.
triggers:
  - "generative art"
  - "procedural art"
  - "seeded artwork"
  - "digital art canvas"
od:
  mode: prototype
  scenario: design
  preview:
    type: html
    entry: index.html
  design_system:
    requires: true
    sections: [color, layout]
  craft:
    requires: [color, anti-ai-slop]
  inputs:
    - name: seed
      type: integer
      default: 42
      label: Random seed
    - name: palette
      type: enum
      values: [amber-mono, amber-neutral, amber-deep]
      default: amber-mono
      label: Palette constraint
    - name: style
      type: enum
      values: [flow-field, tiling, strands]
      default: flow-field
      label: Composition style
    - name: density
      type: integer
      default: 60
      min: 10
      max: 100
      label: Density (1–100)
  example_prompt: "Create a generative art piece from a seed."
---

# Workflow

1. Read the active DESIGN.md. Bind its tokens to `:root`. The palette is constrained to the amber accent family plus neutrals from DESIGN.md — no other hue enters the piece.
2. Map `palette` to a concrete ramp: `amber-mono` (amber tints on one neutral), `amber-neutral` (amber plus warm grays), `amber-deep` (muted amber on a dark neutral).
3. Build `index.html` as a single file with all CSS and JS inlined. No external assets, fonts, libraries, or network calls.
4. Implement a small seeded PRNG (e.g. mulberry32) initialized from `seed`. The same seed must always produce the same piece.
5. Compose the piece from the `style`: a flow field of strokes, a generative tiling, or layered strands. Let `density` control element count.
6. Render to an inline `<svg>` or a `<canvas>` drawn on load. Prefer SVG when the piece is stroke-based so it stays crisp and DOM-inspectable.
7. Keep the composition deliberate: one focal structure, real negative space, no uniform random noise sprayed across the canvas.
8. Show the seed and palette as a small caption line so the piece can be regenerated.
9. Keep any text contrast ≥ 4.5:1 against its backdrop. SVG only — never emoji.
10. Self-check against the amber law and the anti-slop rules in DESIGN.md.
11. Run the html-linter P0 gate. Findings block saving — fix every error before emitting.
12. Emit a single `<artifact>`. The result passes the studio lint gate: no purple, no emoji icons, no lorem, no invented metrics.
