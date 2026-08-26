---
name: allternit/powerpoint
version: 0.1.0
description: Generate and edit .pptx presentations
tools:
  - create_presentation
  - add_slide
entrypoint: powerpoint.ts
progressive_disclosure:
  levels:
    - name: basic
      trigger: first user request to create a deck
      tools:
        - create_presentation
    - name: full
      trigger: user asks to edit an existing deck
      tools:
        - create_presentation
        - add_slide
---

# allternit/powerpoint

Generate and edit PowerPoint presentations. In basic mode, create a new deck
from a title and bullet outline. In full mode, add, reorder, and style slides.
