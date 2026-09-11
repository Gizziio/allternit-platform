---
name: product-launch
description: |
  Produce a product reveal one-pager as interactive single-file HTML. Product hero, benefit-led copy, a spec strip, and one clear CTA — with no fabricated testimonials or invented social proof.
triggers:
  - "product launch"
  - "product reveal"
  - "launch page"
  - "product one-pager"
od:
  mode: prototype
  scenario: product
  preview:
    type: html
    entry: index.html
  design_system:
    requires: true
    sections: [color, typography, layout, components]
  craft:
    requires: [typography, color, anti-ai-slop]
  inputs:
    - name: product_name
      type: string
      required: true
      label: Product name
    - name: tagline
      type: string
      required: true
      label: Tagline
    - name: key_benefits
      type: text
      required: true
      label: Key benefits
      placeholder: "Three to five real benefits — one per line."
    - name: specs
      type: text
      label: Specifications
      placeholder: "Spec strip entries — one per line."
    - name: cta
      type: string
      default: "Get early access"
      label: Call to action
  example_prompt: "Create a product launch page for my product."
---

# Workflow

1. Read the active DESIGN.md. Adopt its color, typography, layout, and component rules. Amber is the only accent family.
2. Plan the page from the brief: product hero → benefits → spec strip → CTA. One page, one product, one ask.
3. Build `index.html` as a single file with all CSS and JS inlined.
4. Product hero: product name at display scale, the `tagline`, and a product visual. With no real product photo, build the visual as an inline SVG or solid-color composition — no external assets, no placeholder CDNs.
5. Benefits section: turn `key_benefits` into 3–5 benefit blocks. Lead with the outcome, keep each to a headline plus one or two lines.
6. Spec strip: a single horizontal band of `specs` rendered with `font-variant-numeric: tabular-nums`. Real specs only.
7. CTA: one primary button with the `cta` label, high contrast, above the fold and repeated once at the end.
8. Write real copy from the brief. No lorem ipsum, no filler features. No testimonials, review counts, or "trusted by N teams" claims unless the brief supplies verifiable ones — the linter flags invented social proof.
9. Add light interactivity where it helps: a spec hover state, a benefit reveal on scroll. No scroll-jacking.
10. Keep text/background contrast ≥ 4.5:1. SVG icons only — never emoji.
11. Self-check against the amber law and the anti-slop rules in DESIGN.md.
12. Run the html-linter P0 gate. Findings block saving — fix every error before emitting.
13. Emit a single `<artifact>`. The result passes the studio lint gate: no purple, no emoji icons, no lorem, no invented metrics.
