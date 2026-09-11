---
name: edu-visual
description: |
  Produce an educational illustration as a single HTML file. An annotated inline-SVG diagram or numbered step sequence that teaches exactly one concept from the brief, caption-first, on a print-friendly light surface.
triggers:
  - "educational diagram"
  - "explainer visual"
  - "step by step diagram"
  - "teaching illustration"
od:
  mode: prototype
  scenario: design
  preview:
    type: html
    entry: index.html
  design_system:
    requires: true
    sections: [color, typography, layout]
  craft:
    requires: [typography, color, anti-ai-slop]
  inputs:
    - name: concept
      type: string
      required: true
      label: Concept to teach
    - name: format
      type: enum
      values: [annotated-diagram, step-sequence]
      default: annotated-diagram
      label: Visual format
    - name: steps
      type: text
      label: Steps or parts
      placeholder: "Numbered parts/steps with a one-line caption each."
    - name: audience
      type: string
      label: Intended audience
  example_prompt: "Create an explainer diagram for my concept."
---

# Workflow

1. Read the active DESIGN.md. Bind its tokens to `:root`. Amber is the only accent family — use it for annotation leaders, numbers, and emphasis.
2. Distill the brief into exactly one learning objective. If the brief contains several concepts, pick the one that matters most and note the rest as out of scope.
3. Choose the `format`: an `annotated-diagram` (one SVG with labeled callouts) or a `step-sequence` (numbered panels that build the idea in order).
4. Build `index.html` as a single file with all CSS inlined, on a light print-friendly surface with generous margins.
5. Lead with the caption: a one-sentence explanation of the concept above the visual. The illustration supports the caption, not the reverse.
6. Draw the visual as inline SVG. Diagram first, decoration never. Label every part the reader must identify.
7. For `step-sequence`, number the steps clearly and keep each step's caption to one line. For `annotated-diagram`, connect labels to parts with leader lines and keep labels close to their targets.
8. Write real copy from the brief. No lorem ipsum, no filler features, no invented statistics — if a number would help but the brief has none, label it `[METRIC]`.
9. Check the piece in grayscale: the diagram must still read when printed. Keep text/background contrast ≥ 4.5:1. SVG icons only — never emoji.
10. Self-check against the amber law and the anti-slop rules in DESIGN.md.
11. Run the html-linter P0 gate. Findings block saving — fix every error before emitting.
12. Emit a single `<artifact>`. The result passes the studio lint gate: no purple, no emoji icons, no lorem, no invented metrics.
