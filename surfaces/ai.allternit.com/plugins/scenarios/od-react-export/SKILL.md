---
name: od-react-export
description: Export a design artifact to React components bound to the active design system.
triggers:
  - "react export"
  - "export to react"
---

# Workflow

1. Read the active DESIGN.md and the current artifact HTML.
2. Decompose the HTML into React components (layout, sections, atoms).
3. Bind design tokens as CSS custom properties in a global stylesheet.
4. Write `index.jsx`, `styles.css`, and `README.md`.
5. Emit a single `<artifact>` containing the file bundle.
