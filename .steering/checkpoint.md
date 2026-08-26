# Steering checkpoint

## Goal
Fork Anthropic Academy at full section depth, map it to Allternit, and generate production-grade A://Labs modules with real open-source media replacing lecture videos.

## Just did
- Created session worktree `allternit-session-5e9f20da-b157-41e1-a340-91ec19bdef56` from `main`.
- Scraped 22 Anthropic Academy courses and extracted deep section/lesson structure.
- Wrote mapping, outlines, and analysis files.
- Rewrote `.agents/skills/alabs-course-generator/SKILL.md` for deep section mapping + media stack.
- Implemented **Phase 1 and Phase 2 of the media pipeline**:
  - `build-mermaid.ts` — Mermaid diagrams
  - `build-asciinema.ts` — Asciinema terminal recordings
  - `build-walkthrough.ts` — Code-Hike-style step-through code walkthroughs
  - Extended `build.ts` to process all three media types and inject runtime loaders.
  - Added dark-themed media CSS and a walkthrough JS engine to `shell.html`.
- Generated, built, and audited all outlined modules for the three starter courses:
  - `ALABS-AGENTS-API`: Modules 1–10 (including Harness and Graph engineering deep-dives)
  - `ALABS-OPS-COWORK`: Modules 1–5
  - `ALABS-CORE-FLUENCY`: Modules 1–6
- All 21 modules pass the audit: zero `{{` placeholders, zero learner-facing vendor mentions, and every HTML file exceeds 20 KB.
- Updated `course-outlines.json` and `.agents/skills/alabs-course-generator/SKILL.md` barometers to reflect the full catalog.

## Next
- Add polished static images (course/module thumbnails, hero art, concept illustrations) using ChatGPT-generated image prompts.
- Evaluate and produce a "seed dance" intro/brand video for the A://Labs experience.
- Then decide whether to proceed to Phase 3 (Sandpack runnable demos) or polish/publish the current catalog.

## Open questions
- Which modules/courses need hero/thumbnail images vs. inline concept illustrations?
- What is the intended use and format of the seed-dance video (intro reel, course trailer, brand loop)?
