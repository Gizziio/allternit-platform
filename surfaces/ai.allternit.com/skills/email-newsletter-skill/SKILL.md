---
name: email-newsletter
description: |
  Produce an HTML email newsletter as a single HTML file. A 600px table-based layout with inline styles only, no external CSS or JS, dark-mode-tolerant, preview text first.
triggers:
  - "email newsletter"
  - "html email"
  - "email template"
  - "newsletter layout"
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
    - name: subject
      type: string
      required: true
      label: Subject line
    - name: preview_text
      type: string
      required: true
      label: Preview text
    - name: sections
      type: text
      required: true
      label: Content sections
      placeholder: "One block per line — headline, paragraph, or callout."
    - name: cta
      type: string
      label: Call to action
  example_prompt: "Create an email newsletter for my list."
---

# Workflow

1. Read the active DESIGN.md. Extract the brand's amber accent and neutral text colors. Amber is the only accent family — email clients render it fine, other accents are off-brand.
2. Plan the email from `sections`: preview text, header, content blocks, CTA, footer. One email, one main action.
3. Build `index.html` as a single file. Use table-based layout at 600px width — nested tables for structure, `<td>` padding for spacing.
4. Inline every style. No `<style>` blocks that mail clients strip unpredictably, no external stylesheets, no JavaScript, no web fonts. Use the system font stack with the brand's preferred families as fallbacks.
5. Put the `preview_text` first in the body, inside a hidden preheader div, before any visible content. Keep it under ~90 characters.
6. Build each content block from the brief with real copy. No lorem ipsum, no filler features, no invented open rates or subscriber numbers.
7. Render the `cta` as a bulletproof button: a table cell with a solid amber background, white or near-black text at ≥ 4.5:1 contrast, and a plain-text fallback link.
8. Make it dark-mode-tolerant: avoid hardcoded pure-white text on transparent backgrounds; use the neutral text colors from DESIGN.md and test the layout against a dark client backdrop.
9. Add a footer with the sender identity and a plain unsubscribe line. Use HTML entities for special characters and avoid margins, floats, and position.
10. Keep images out, or replace them with inline-SVG-free solid color and type (most clients block images by default). No emoji as icons — use text labels.
11. Self-check against the amber law and the anti-slop rules in DESIGN.md.
12. Run the html-linter P0 gate. Findings block saving — fix every error before emitting.
13. Emit a single `<artifact>`. The result passes the studio lint gate: no purple, no emoji icons, no lorem, no invented metrics.
