# Allternit Design: The Blueprint Studio Architecture

This document defines the high-fidelity design engineering engine behind **Allternit Studio** (formerly Design Mode). It bridges generative UI, multi-platform content strategy, and real-time visual manifestation.

---

## 1. Unified Manifestation Loop
The Studio follows a strict **Research -> Design -> Manifest** lifecycle. 
- **Discovery Hub:** Initial project calibration (Prototype, Slides, Content Engine).
- **Design.md Protocol:** Agents generate style tokens (Colors, Typography, Radii) in Markdown before streaming UI.
- **OpenUI Lang:** A bracket-based DSL (`[v:tag]`) used to stream complex, nested React components in real-time.
- **Handoff:** Automatic compilation of OpenUI streams into production-grade React + Tailwind CSS code.

## 2. Component Registry (`registry.tsx`)
A production-ready library of "Agentic Blocks" including:
- **`v:skill-graph`**: Neural network visualization of content strategy nodes.
- **`v:pipeline`**: Real-time multi-platform delivery tracker (X, LinkedIn, TikTok, etc.).
- **`v:orchestrator`**: Visual timeline of multi-step agent tasks.
- **`v:evaluator`**: Side-by-side A/B testing and design comparisons.
- **`v:video-use`**: Synchronized video players with reasoning transcripts.

## 3. Specialist Agent Personas
Project outcomes are calibrated by selecting a specialist in the Discovery Hub:
- **Systems Architect:** High-density, complex data structures, and structural integrity.
- **Growth Hacker:** Conversion-focused, bold CTAs, and scroll-stopping marketing hooks.
- **UI Purist:** Minimalist, airy spacing, and pixel-perfect aesthetic audits.

## 4. Content Skill Graph & Pipeline
The Studio is integrated with a local `/content-skill-graph` knowledge base.
- **Auto-Sync:** The agent automatically traverses local `.md` nodes (Voice, Tone, Platform rules) upon project start.
- **Manifest to Disk:** Clicking "Manifest" saves platform-native drafts to `/outputs`.
- **The "Ship" Action:** Clicking "Ship" physically deploys content by moving files from `_draft.md` to `_published.md` on the local file system.

## 5. Visual HUD (Live Token Sync)
The Studio features a real-time **Heads-Up Display (HUD)** for visual engineering:
- **Radius & Spacing:** Dynamic sliders linked to CSS variables (`--design-radius-base`, `--design-spacing-unit`).
- **Brand Colors:** Real-time color propagation through `--design-color-primary`.
- **Morphing Preview:** The UI canvas physically reacts to HUD adjustments instantly.

## 6. Engineering Integrity
- **Isolated Store:** Managed via `DesignSessionStore.ts`, keeping Design data separate from general Chat.
- **Recursive Compiler:** `code-compiler.ts` handles deeply nested tags via AST-style traversal for accurate React code generation.
- **Tool Logic:** `skill_graph_ops` tool provides native Node.js `fs` access for real-world file manipulation.
