---
name: design-system-from-brief
description: |
  Codify a brand brief, screenshot, or URL into a reusable 9-section DESIGN.md.
triggers:
  - "design system"
  - "brand spec"
  - "create design.md"
od:
  mode: design-system
  scenario: design
  preview:
    type: markdown
    entry: DESIGN.md
  design_system:
    requires: false
  craft:
    requires: [color, anti-ai-slop]
  inputs:
    - name: brand_name
      type: string
      required: true
      label: Brand name
    - name: source
      type: text
      label: Brand context
      placeholder: "Paste URL, describe the brand, or attach a screenshot."
  example_prompt: "Create a design system for my brand."
---

# Workflow

1. Read the provided source (URL, screenshot, or brief).
2. Extract real values: hex codes, font families, spacing rhythm, radii, motion preferences.
3. Draft a 9-section DESIGN.md:
   - Visual Theme & Atmosphere
   - Color Palette & Roles
   - Typography Rules
   - Component Stylings
   - Layout Principles
   - Depth & Elevation
   - Do's and Don'ts
   - Responsive Behavior
   - Agent Prompt Guide
4. Generate a small sample-components preview HTML.
5. Emit the DESIGN.md as the primary artifact.
