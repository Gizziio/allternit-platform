---
name: pitch-deck
description: |
  Produce a business pitch deck as a 16:9 single-file HTML slide deck. A narrative arc of problem, stakes, solution, proof, and ask, with one idea per slide. (For an editorial, magazine-style deck, use the magazine-deck skill instead.)
triggers:
  - "pitch deck"
  - "investor deck"
  - "funding pitch"
  - "business deck"
od:
  mode: prototype
  scenario: sale
  preview:
    type: html
    entry: index.html
  design_system:
    requires: true
    sections: [color, typography, layout]
  craft:
    requires: [typography, color, anti-ai-slop]
  inputs:
    - name: company
      type: string
      required: true
      label: Company or project name
    - name: problem
      type: text
      required: true
      label: Problem
    - name: solution
      type: text
      required: true
      label: Solution
    - name: ask
      type: string
      label: The ask
      placeholder: "e.g. Raising $500k pre-seed"
    - name: slide_count
      type: integer
      default: 10
      min: 5
      max: 15
      label: Slide count
  example_prompt: "Create a pitch deck for my startup."
---

# Workflow

1. Read the active DESIGN.md. Bind its tokens to `:root`. Amber is the only accent family — no other accent hue anywhere.
2. Plan the arc across `slide_count` slides: problem → stakes → solution → proof → ask. Allocate slides to each beat before building; never pad with filler slides.
3. Build `index.html` as a single file with all CSS and JS inlined, on a 16:9 stage (e.g. 1280×720) centered on a neutral backdrop.
4. One idea per slide: a headline that states the idea, plus at most one supporting visual or short evidence block.
5. Write the problem and stakes from the brief with real, specific copy. No generic "the world is changing" openers.
6. Present the solution as what it does for the customer, not a feature inventory. Show proof only from the brief — real traction numbers, real logos, real deployments. If the brief has none, say what would count as proof instead of inventing it. The linter flags invented metrics and social proof.
7. Make the ask slide concrete: the supplied `ask`, what it funds, and the contact or next step.
8. Add keyboard (← →), on-click, and swipe navigation with a visible slide counter.
9. Headline ≥ 36px, body ≥ 22px on the 1280-wide stage. Keep text/background contrast ≥ 4.5:1. SVG icons only — never emoji.
10. Self-check against the amber law and the anti-slop rules in DESIGN.md.
11. Run the html-linter P0 gate. Findings block saving — fix every error before emitting.
12. Emit a single `<artifact>`. The result passes the studio lint gate: no purple, no emoji icons, no lorem, no invented metrics.
