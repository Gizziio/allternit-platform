---
name: dashboard
description: |
  Produce a data-dense admin or analytics dashboard with sidebar nav, KPI cards, charts, and tables.
triggers:
  - "dashboard"
  - "analytics"
  - "admin panel"
od:
  mode: prototype
  scenario: product
  preview:
    type: html
    entry: index.html
  design_system:
    requires: true
    sections: [color, typography, components, layout]
  craft:
    requires: [typography, color]
  inputs:
    - name: product_name
      type: string
      required: true
      label: Product name
    - name: kpis
      type: string
      label: Key metrics
      placeholder: "e.g. Revenue, Active users, Churn"
  example_prompt: "Create an analytics dashboard for my product."
---

# Workflow

1. Read the active DESIGN.md. Adopt its color, typography, component, and layout rules.
2. Build a single-page dashboard: fixed sidebar, header, KPI cards, primary chart area, secondary table/list.
3. Use `font-variant-numeric: tabular-nums` for all numbers.
4. Use the provided KPI list or infer 3–4 meaningful metrics from the product name.
5. Inline all CSS and any minimal chart SVGs.
6. Run the P0 self-check and 5-dimensional critique.
7. Emit a single `<artifact>`.
