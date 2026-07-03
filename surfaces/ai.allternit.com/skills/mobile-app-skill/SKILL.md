---
name: mobile-app
description: |
  Produce a multi-screen mobile app prototype with iOS-style chrome, shared frames, and tap-through flows.
triggers:
  - "mobile app"
  - "ios prototype"
  - "android prototype"
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
    - name: app_name
      type: string
      required: true
      label: App name
    - name: screens
      type: integer
      default: 4
      min: 2
      max: 10
      label: Number of screens
  example_prompt: "Create a mobile app prototype."
---

# Workflow

1. Read the active DESIGN.md. Bind tokens to `:root`.
2. Build a single-file HTML prototype with a device frame (iPhone 15 Pro style).
3. Generate `screens` linked screens with tap targets and smooth transitions.
4. Use the shared `/frames/` assets pattern: status bar, home indicator, nav chrome.
5. Inline all CSS and JS.
6. Run P0 self-check and 5-dimensional critique.
7. Emit a single `<artifact>`.
