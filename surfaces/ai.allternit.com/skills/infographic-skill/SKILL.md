---
name: infographic
description: |
  Produce a long-scroll vertical infographic as a single HTML file. A sectioned data story with a clear reading order, where every number comes from the user's brief and every chart is inline SVG.
triggers:
  - "infographic"
  - "data infographic"
  - "visual data story"
od:
  mode: prototype
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
    - name: topic
      type: string
      required: true
      label: Topic
    - name: data_points
      type: text
      required: true
      label: Data points
      placeholder: "The numbers and facts to visualize — one per line."
    - name: sections
      type: integer
      default: 5
      min: 3
      max: 10
      label: Number of sections
  example_prompt: "Create an infographic from my data."
---

# Workflow

1. Read the active DESIGN.md. Bind its tokens to `:root`. Amber is the only accent family for highlights and chart emphasis.
2. Inventory the `data_points` from the brief. Every number, percentage, and comparison in the final piece must trace back to this list. If the brief lacks a needed figure, label the slot `[METRIC]` — never invent one. The linter flags invented metrics.
3. Plan the reading order: a title block, then `sections` sections that flow top to bottom as one continuous story. Each section gets one idea.
4. Build `index.html` as a single file with all CSS inlined. Fixed content width (720–860px) centered on a neutral surface.
5. Render every chart as inline SVG — bars, lines, donut, or pictogram — sized from the real data. Choose the chart type that fits the comparison, not the fanciest one.
6. Sequence the story: context → the key comparison → breakdown → takeaway. Number the sections if the order matters.
7. Annotate charts directly (labels, units, short callouts) instead of relying on a distant legend where possible.
8. Write real copy from the brief. No lorem ipsum, no filler features, no rounding up, no "10× better" claims the data does not support.
9. Keep text/background contrast ≥ 4.5:1. Use SVG icons only — never emoji.
10. Self-check against the amber law and the anti-slop rules in DESIGN.md.
11. Run the html-linter P0 gate. Findings block saving — fix every error before emitting.
12. Emit a single `<artifact>`. The result passes the studio lint gate: no purple, no emoji icons, no lorem, no invented metrics.
