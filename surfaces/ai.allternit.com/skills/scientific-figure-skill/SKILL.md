---
name: scientific-figure
description: |
  Produce a paper-ready scientific figure as a single HTML file. One figure with labeled axes, units, an honest scale, a legend where needed, a caption, and the plot drawn as inline SVG.
triggers:
  - "scientific figure"
  - "research figure"
  - "paper figure"
  - "chart for publication"
od:
  mode: prototype
  scenario: engineering
  preview:
    type: html
    entry: index.html
  design_system:
    requires: true
    sections: [color, typography, layout]
  craft:
    requires: [typography, color, anti-ai-slop]
  inputs:
    - name: figure_title
      type: string
      required: true
      label: Figure title
    - name: data
      type: text
      required: true
      label: Data series
      placeholder: "Series name followed by values with units — e.g. Control: 12.1, 13.4, ..."
    - name: chart_type
      type: enum
      values: [line, scatter, bar]
      default: line
      label: Chart type
    - name: caption
      type: text
      label: Caption
  example_prompt: "Create a publication figure from my data."
---

# Workflow

1. Read the active DESIGN.md. Bind its tokens to `:root`. Amber and its muted family members are the only accent hues — reserve them for the data series and keep everything else neutral.
2. Parse the `data` into named series with real values and units from the brief. Every plotted number must come from the brief. If a value is missing, ask or label `[DATA]` — never fabricate one.
3. Pick the `chart_type` that matches the data: line for trends, scatter for relationships, bar for comparisons.
4. Build `index.html` as a single file with all CSS inlined, on a white surface sized like a single-column figure (about 600–800px wide).
5. Draw the plot as inline SVG. Label every axis with its name and units. Add tick marks and gridlines at regular intervals.
6. Keep the scale honest: start bar charts at zero; for line/scatter, start at zero when the magnitude matters, or clearly mark a broken axis. Never truncate an axis to exaggerate an effect.
7. Add a legend when there is more than one series. Directly label series instead when there is room.
8. Write the caption below the figure: what it shows, the sample or condition if known, and the takeaway. Use the supplied `caption` or derive one strictly from the brief.
9. Use `font-variant-numeric: tabular-nums` for all numbers. Keep text/background contrast ≥ 4.5:1. SVG only — never emoji.
10. Self-check against the amber law and the anti-slop rules in DESIGN.md.
11. Run the html-linter P0 gate. Findings block saving — fix every error before emitting.
12. Emit a single `<artifact>`. The result passes the studio lint gate: no purple, no emoji icons, no lorem, no invented metrics.
