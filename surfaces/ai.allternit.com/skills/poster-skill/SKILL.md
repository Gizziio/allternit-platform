---
name: poster
description: |
  Produce a bold single-focus poster as a self-contained HTML canvas. One dominant message, big type hierarchy, one image or none, sized for print (A3) or social (4:5).
triggers:
  - "poster"
  - "event poster"
  - "promo poster"
  - "print poster"
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
    - name: headline
      type: string
      required: true
      label: Headline
    - name: size
      type: enum
      values: [a3-print, social-4x5]
      default: social-4x5
      label: Canvas size
    - name: subhead
      type: string
      label: Subhead
    - name: details
      type: text
      label: Event or promo details
      placeholder: "Date, venue, price, CTA — one per line."
  example_prompt: "Create a poster for my event."
---

# Workflow

1. Read the active DESIGN.md. Bind its tokens to `:root`. Amber is the only accent family — never introduce any other accent hue.
2. Plan the composition from the brief: one focal point, one headline, supporting details. If the brief carries no real image, use none — type and layout carry the poster.
3. Set the canvas to `size`: A3 print at 297×420mm with `@page` margins, or a 1080×1350 (4:5) social canvas centered on a neutral backdrop.
4. Build `index.html` as a single file with all CSS inlined in `<style>`.
5. Set the type hierarchy: headline at display scale (the largest element on the canvas), subhead at roughly half that, details in the text size from DESIGN.md. Big type is the poster.
6. Place one image maximum. If used, it is an inline SVG or a solid-color composition — no external assets, no stock URLs, no placeholder CDNs.
7. Write real, specific copy from the brief: real event names, dates, venues. No lorem ipsum, no filler features, no invented metrics or attendance claims.
8. Check contrast ≥ 4.5:1 for every text/background pair. Check legibility at arm's length (print) and at thumbnail size (social).
9. Use SVG icons only — never emoji as icons.
10. Self-check against the amber law and the anti-slop rules in DESIGN.md.
11. Run the html-linter P0 gate. Findings block saving — fix every error before emitting.
12. Emit a single `<artifact>`. The result passes the studio lint gate: no purple, no emoji icons, no lorem, no invented metrics.
