---
name: personal-site
description: |
  Produce a portfolio or resume one-pager as a single HTML file. A name-first hero, selected work, a timeline or skills section, and contact — honest throughout, with no inflated claims.
triggers:
  - "portfolio site"
  - "personal site"
  - "resume page"
  - "cv one-pager"
od:
  mode: prototype
  scenario: personal
  preview:
    type: html
    entry: index.html
  design_system:
    requires: true
    sections: [color, typography, layout]
  craft:
    requires: [typography, color, anti-ai-slop]
  inputs:
    - name: name
      type: string
      required: true
      label: Full name
    - name: role
      type: string
      required: true
      label: Role or title
    - name: selected_work
      type: text
      label: Selected work
      placeholder: "Projects — one per line with a one-line description."
    - name: timeline
      type: text
      label: Timeline or skills
      placeholder: "Roles, dates, or skills — one per line."
    - name: contact
      type: text
      label: Contact details
  example_prompt: "Create a portfolio one-pager for me."
---

# Workflow

1. Read the active DESIGN.md. Bind its tokens to `:root`. Amber is the only accent family — quiet and sparing suits a personal page.
2. Plan the one-pager: name-first hero, selected work, timeline or skills, contact. One page, no navigation needed beyond anchor links.
3. Build `index.html` as a single file with all CSS and JS inlined.
4. Hero: the person's `name` at display scale, the `role` beneath it, and one line about what they actually do. The name is the largest element on the page.
5. Selected work: 3–5 real entries from `selected_work`. Each gets a title, one honest line on what it is, and what the person did on it.
6. Timeline or skills: render `timeline` as a dated list or a plain skills block — whichever the brief supports better. Real dates, real skills only.
7. Contact: render `contact` as plain, copyable text links (email, site, profile). No fake forms that go nowhere.
8. Write honest copy throughout. No inflated titles, no "award-winning" without a named award, no invented metrics or client counts. The linter flags invented social proof.
9. Keep text/background contrast ≥ 4.5:1. SVG icons only — never emoji.
10. Self-check against the amber law and the anti-slop rules in DESIGN.md.
11. Run the html-linter P0 gate. Findings block saving — fix every error before emitting.
12. Emit a single `<artifact>`. The result passes the studio lint gate: no purple, no emoji icons, no lorem, no invented metrics.
