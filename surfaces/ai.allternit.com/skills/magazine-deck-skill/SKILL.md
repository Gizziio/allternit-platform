---
name: magazine-deck
description: |
  Produce a magazine-style horizontal-swipe web deck. Single-file HTML output with keyboard, scroll, and touch navigation.
triggers:
  - "magazine deck"
  - "pitch deck"
  - "presentation"
od:
  mode: deck
  scenario: marketing
  preview:
    type: html
    entry: index.html
  design_system:
    requires: true
    sections: [color, typography, layout]
  craft:
    requires: [typography, color, anti-ai-slop]
  inputs:
    - name: title
      type: string
      required: true
      label: Deck title
    - name: slide_count
      type: integer
      default: 8
      min: 4
      max: 20
      label: Slide count
    - name: theme
      type: enum
      values: [editorial, minimal, brutalist, dark-glass, warm]
      default: editorial
      label: Theme
  outputs:
    primary: index.html
    secondary: [slides.json]
  example_prompt: "Create a magazine-style pitch deck."
---

# Workflow

1. Read the active DESIGN.md. Bind its tokens to the deck `:root`.
2. Copy `assets/template.html` to `index.html`.
3. Generate exactly `slide_count` slides using the selected `theme` posture.
4. Each slide: one idea, headline ≥ 36px, body ≥ 22px, slide counter visible.
5. Add keyboard (← →), scroll, and touch swipe navigation.
6. Persist slide position to `localStorage`.
7. Output `slides.json` with slide titles and notes for PPTX export.
8. Run P0 self-check and 5-dimensional critique.
9. Emit a single `<artifact>`.
