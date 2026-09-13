---
name: social-creative
description: |
  Produce a brand-safe social media creative as a single HTML canvas. The hook lands in the first 20% of the canvas, the layout stays legible at thumbnail size, and the aspect fits the target platform.
triggers:
  - "social post"
  - "instagram post"
  - "social creative"
  - "ad creative"
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
    - name: hook
      type: string
      required: true
      label: Hook text
    - name: aspect
      type: enum
      values: ["1:1", "9:16", "16:9"]
      default: "1:1"
      label: Aspect ratio
    - name: body
      type: text
      label: Supporting text
    - name: cta
      type: string
      label: Call to action
  example_prompt: "Create a social post for my launch."
---

# Workflow

1. Read the active DESIGN.md. Bind its tokens to `:root`. Amber is the only accent family — no other accent hue anywhere.
2. Map `aspect` to a canvas: 1080×1080 (1:1), 1080×1920 (9:16), or 1920×1080 (16:9), centered on a neutral backdrop.
3. Place the `hook` in the first 20% of the canvas — top band for 1:1 and 16:9, upper third for 9:16. The hook is the largest text on the canvas.
4. Build `index.html` as a single file with all CSS inlined.
5. Support the hook with at most one image (inline SVG or solid composition) and the `body` copy. One idea per creative.
6. Keep every text element legible at thumbnail size: hook ≥ 64px on a 1080-wide canvas, nothing critical below ~28px.
7. Add the `cta` as a clear, high-contrast button or closing line.
8. Write real copy from the brief. No lorem ipsum, no filler features, no invented engagement numbers, no "trusted by 50,000" claims.
9. Keep text/background contrast ≥ 4.5:1. SVG icons only — never emoji.
10. Self-check against the amber law and the anti-slop rules in DESIGN.md.
11. Run the html-linter P0 gate. Findings block saving — fix every error before emitting.
12. Emit a single `<artifact>`. The result passes the studio lint gate: no purple, no emoji icons, no lorem, no invented metrics.
