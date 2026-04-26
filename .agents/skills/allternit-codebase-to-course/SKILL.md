---
name: allternit-codebase-to-course
description: "Turn any Allternit package or codebase into a beautiful, interactive single-page HTML course module for the A://Labs curriculum. Use this skill whenever someone wants to create an interactive course, tutorial, or educational walkthrough from an Allternit package or project. Trigger when users mention 'turn this package into a course,' 'explain this codebase interactively,' 'teach this code,' 'interactive tutorial from code,' 'codebase walkthrough,' 'learn from this codebase,' or 'make a course from this project.' This skill produces a stunning, self-contained HTML file with scroll-based navigation, animated visualizations, embedded quizzes, and code-with-plain-English side-by-side translations. The output is branded for A://Labs and targets agent-native operators."
---

# Allternit Codebase-to-Course

Transform any Allternit package or codebase into a stunning, interactive A://Labs course module. The output is a **single self-contained HTML file** — open it directly in the browser with no setup required. The course teaches how the code works through scroll-based modules, animated visualizations, embedded quizzes, and plain-English translations of code.

## First-Run Welcome

When the skill is first triggered and the user hasn't specified a codebase yet, introduce yourself and explain what you do:

> **I can turn any Allternit package into an interactive A://Labs course module.**
>
> Just point me at a package:
> - **A local folder** — e.g., "turn packages/@allternit/plugin-sdk into a course"
> - **The current project** — if you're already in a codebase, just say "turn this package into a course"
>
> I'll read through the code, figure out how everything fits together, and generate a beautiful single-page HTML course with animated diagrams, plain-English code explanations, and interactive quizzes. The whole thing runs in the browser — no setup needed. The output is ready to drop directly into a Canvas course as a wiki page.

## Who This Is For

The target learner is an **agent-native operator** — someone who builds software by instructing AI coding tools in natural language. They may have used Allternit products or built with the platform, but they want to understand what's happening under the hood so they can steer AI better, debug faster, and make smarter architectural decisions.

**Their goals are practical, not academic:**
- **Steer AI coding tools better** — make better architectural and tech stack decisions
- **Detect when AI is wrong** — spot hallucinations, catch bad patterns
- **Intervene when AI gets stuck** — break out of bug loops, debug issues
- **Build production-quality integrations** on top of Allternit
- **Acquire the vocabulary** to describe requirements clearly to AI agents

**They are NOT trying to become software engineers.** They want coding as a superpower that amplifies what they're already good at.

## A://Labs Brand Guidelines

The output MUST feel like it belongs in the A://Labs curriculum:

- **Color palette:** Dark backgrounds (`#0b0b0c`, `#111113`), tier accents (CORE `#3b82f6`, OPS `#8b5cf6`, AGENTS `#ec4899`), white text with muted secondary (`#d4d4d8`) and muted (`#a1a1aa`)
- **Typography:** Clean, modern sans-serif (Inter, system-ui, or Helvetica)
- **Voice:** Direct, practical, no fluff. Use "you" and "your". Every section should answer "why should I care?"
- **Structure:** Each module should feel like an A://Labs lesson — with a clear concept, a concrete example from the real codebase, and a "try this yourself" moment
- **Capstone-ready:** The final screen should propose a capstone project that uses the actual package

## The Process

### Phase 1: Codebase Analysis

Before writing course HTML, deeply understand the codebase. Read all the key files, trace the data flows, identify the "cast of characters" (main components/modules), and map how they communicate.

**What to extract:**
- The main "actors" (components, services, modules) and their responsibilities
- The primary developer journey (what happens when someone uses this package end-to-end)
- Key APIs, data flows, and communication patterns
- Clever engineering patterns (caching, lazy loading, error handling, schema validation, etc.)
- The tech stack and why each piece was chosen

### Phase 2: Curriculum Design

Structure the module as **4-6 screens** (sub-sections). Most modules need 4-6 screens. The arc always starts from what the learner already knows (the user-facing behavior) and moves toward what they don't (the code underneath).

| Screen Position | Purpose | Why it matters for an agent-native operator |
|---|---|---|
| 1 | "Here's what this package does — and what happens when you use it" | Start with the product, then trace a core action into the code. |
| 2 | Meet the actors | Know which components exist so you can tell AI "put this logic in X, not Y" |
| 3 | How the pieces talk | Understand data flow so you can debug "it's not showing up" problems |
| 4 | The clever tricks | Learn patterns so you can request them from AI |
| 5 | When things break | Build debugging intuition so you can escape AI bug loops |
| 6 | The capstone | A concrete project that uses the actual package |

**Each screen should contain:**
- At least one code-with-English translation
- At least one interactive element (quiz, visualization, or animation)
- One or two "aha!" callout boxes with universal insights
- A metaphor that grounds the technical concept in everyday life — but NEVER reuse the same metaphor across screens, and NEVER default to the "restaurant" metaphor

**Mandatory interactive elements (every course must include ALL of these):**
- **Group Chat Animation** — at least one across the course. iMessage/WeChat-style conversations between components.
- **Message Flow / Data Flow Animation** — at least one across the course. Step-by-step packet animation between actors.
- **Code ↔ English Translation Blocks** — at least one per screen.
- **Quizzes** — at least one per screen (multiple-choice, scenario, drag-and-drop, or spot-the-bug).

### Phase 3: HTML Output

The output must be a **single self-contained HTML file** with:
- All CSS in a `<style>` block
- All JavaScript in a `<script>` block
- No external dependencies except Google Fonts CDN (optional)
- Scroll-based navigation with a progress indicator
- Keyboard navigation (arrow keys, space)
- Mobile-responsive design

Use the reference files in this skill's `references/` directory for:
- `design-system.md` — CSS structure, color tokens, typography scale
- `interactive-elements.md` — Quiz, animation, and visualization patterns
- `main.js` — Navigation, progress tracking, and interaction handlers
- `styles.css` — Base styling (adapt to A://Labs dark theme)

**IMPORTANT:** The HTML must be copy-paste ready into a Canvas wiki page. That means:
- No `<html>`, `<head>`, or `<body>` tags if the user says they're dropping it into Canvas (Canvas strips these). Instead, output a `<div>` wrapper with all CSS/JS self-contained.
- If the user wants a standalone file, wrap it in a full HTML document.

By default, assume the output will be pasted into a Canvas wiki page body.

## Design Philosophy

This skill inverts traditional CS education. The old model is: memorize concepts for years → eventually build something → finally see the point. This model is: **use the tool first → experience it working → now understand how it works.**

Every screen is at least 50% visual. Max 2-3 sentences per text block. If something can be a diagram, animation, or interactive element — it shouldn't be a paragraph.

No "What does API stand for?" Instead: "A user reports stale data after switching pages. Where would you look first?" Quizzes test whether you can use what you learned to solve a new problem.

Code snippets are exact copies from the real codebase — never modified or simplified. The learner should be able to open the actual file and see the same code they learned from.
