---
name: saas-landing
description: |
  Produce a single-page SaaS landing page with hero, features, social proof, pricing, and CTA.
triggers:
  - "saas landing"
  - "marketing page"
  - "product landing"
od:
  mode: prototype
  scenario: marketing
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
    - name: has_pricing
      type: boolean
      default: true
      label: Include pricing section
  example_prompt: "Create a SaaS landing page for my product."
---

# Workflow

1. Read the active DESIGN.md. Adopt its color, typography, layout, and component rules.
2. Copy `assets/base.html` to `index.html` in the artifact workspace.
3. Fill sections: hero, features (3–6), social proof, pricing (if `has_pricing`), CTA, footer.
4. Replace placeholders with real, specific copy from the brief.
5. Inline all CSS. Use system font stack as fallback if DESIGN.md typography fails to load.
6. Run the P0 self-check and 5-dimensional critique.
7. Emit a single `<artifact>`.
