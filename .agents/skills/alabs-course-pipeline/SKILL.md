---
name: alabs-course-pipeline
description: "End-to-end A://Labs course creation pipeline. Creates Canvas courses, generates interactive HTML modules from Allternit packages, syncs quizzes, tracks progress, and audits. Use this whenever creating, updating, or managing A://Labs courses."
---

# A://Labs Course Pipeline

> **STATUS:** Production — 10 courses, 65 modules, 0 audit issues
>
> **Last Updated:** 2026-04-17

A reusable end-to-end workflow for creating, populating, and managing A://Labs courses on Canvas LMS.

## When to Use This

- Creating a new A://Labs course (CORE, OPS, AGENTS, or ADV)
- Adding a new interactive module to an existing course
- Generating bridge modules (theory → production code)
- Adding real Canvas quizzes with scoring
- Tracking student progress
- Re-polishing courses after content updates
- Running launch audits before go-live
- Analyzing a codebase for curriculum topics

## Course Catalog (10 Courses)

| Code | Title | Tier | Course ID | Modules |
|------|-------|------|-----------|---------|
| ALABS-CORE-COPILOT | Build AI-Assisted Software | CORE | 14593493 | 7 |
| ALABS-CORE-PROMPTS | Prompt Engineering | CORE | 14593495 | 7 |
| ALABS-OPS-N8N | Orchestrate Agents & Automations | OPS | 14593499 | 9 |
| ALABS-OPS-VISION | Computer Vision for Agent Systems | OPS | 14593501 | 6 |
| ALABS-OPS-RAG | Local RAG & Document Intelligence | OPS | 14593503 | 7 |
| ALABS-AGENTS-ML | ML Models as Agent Tools | AGENTS | 14593505 | 6 |
| ALABS-AGENTS-AGENTS | Multi-Agent Systems | AGENTS | 14593507 | 7 |
| ALABS-ADV-PLUGINSDK | Build Plugins for Allternit | ADV | 14612851 | 4 |
| ALABS-ADV-WORKFLOW | The Allternit Workflow Engine | ADV | 14612861 | 3 |
| ALABS-ADV-ADAPTERS | Provider Adapters & Unified APIs | ADV | 14612869 | 3 |

**ADV Module Structure:** Each ADV course has M1, M2, (M3 for PLUGINSDK), and a Bridge module. Bridge modules connect theory to actual production code in the Allternit platform.

## Directory Map

| Path | Purpose |
|------|---------|
| `alabs-generated-courses/` | Generated HTML modules + quiz JSONs + analysis outputs |
| `alabs-demos/` | Standalone demo site (works offline) |
| `alabs-module-template/` | Shared template shell, build script, converter |
| `alabs-curator/` | Generalizable CLI for any codebase (WIP) |
| `scripts/sync-incremental.ts` | **Recommended** sync — hash-based skip |
| `scripts/sync-course-from-package.ts` | Legacy sync (has page_url fix) |
| `scripts/canvas-quiz-sync.ts` | Canvas Quiz API — real scored quizzes |
| `scripts/progress-tracker.ts` | Poll Canvas → SQLite progress tracking |
| `scripts/add-module-challenges.ts` | Adds challenge assignments |
| `scripts/launch-audit.ts` | Validates all 10 courses |
| `scripts/polish-adv-courses.ts` | One-shot polish for ADV courses |
| `scripts/generate-demo-index.ts` | Auto-builds demo landing page |
| `scripts/analyze-packages.ts` | Codebase → topics/challenges/curriculum |
| `scripts/platform-as-course.ts` | Platform codebase → course outline |
| `scripts/fix-unpublished-modules.ts` | Publishes modules + sets prerequisites |
| `surfaces/allternit-platform/src/views/LabsView.tsx` | Platform UI showing all courses |

## Pipeline Phases

### Phase 1: Create (Browser Automation)

Canvas Free For Teacher does not allow course creation via API. Use Playwright:

```bash
export CANVAS_EMAIL="your@email.com"
export CANVAS_PASSWORD="your-password"
npx tsx scripts/create-advanced-courses-browser.ts
```

### Phase 2: Covers

```bash
python3 scripts/generate-course-covers.py
npx tsx scripts/upload-course-images.ts
```

### Phase 3: Generate Modules (Agent Swarm)

Use an agent to generate interactive HTML modules. The prompt template:

```
Generate an interactive HTML course module for A://Labs ADV tier.

Read these source files: [list specific files]

Title: Module N: [Topic Name]
Course: ALABS-ADV-[COURSE]
Tier: ADV (amber #f59e0b)

Content sections:
1. Hero with badge and tagline
2. The Problem
3. [3-5 deep-dive sections with real code from source]
4. 3 Interactive Quizzes (4 options each, instant feedback, retry)
5. Capstone Project

Design:
- Self-contained single HTML file
- Dark theme: #0b0b0c background, #f59e0b accent
- JetBrains Mono + Inter via Google Fonts CDN
- Progress bar, fixed nav with scroll-spy, scroll-reveal
- Syntax-highlighted code blocks (custom CSS, no Prism)
- ONE interactive Canvas animation (DAG, scheduler, circuit breaker, etc.)
- Fully inline CSS and JS

Write to: alabs-generated-courses/ALABS-ADV-[COURSE]-module{N}.html
```

For **Bridge modules**, the prompt adds:
```
This is a BRIDGE module — connect theory to how Allternit ACTUALLY
uses this in production. Show real code from the platform:
- surfaces/allternit-platform/src/lib/...
- Actual production imports, function calls, config
- Mark code with "🟢 Production" badges
- Include system architecture diagrams
```

### Phase 4: Sync to Canvas

**Use incremental sync (recommended):**
```bash
npx tsx scripts/sync-incremental.ts \
  --html-file alabs-generated-courses/ALABS-ADV-WORKFLOW-module2.html \
  --course-id 14612861 \
  --module-title "Module 2: The Scheduler & Execution Model" \
  --position 2
```

This computes SHA256 hash and skips unchanged modules.

Hash store: `alabs-generated-courses/.sync-hashes.json`

### Phase 5: Publish & Prerequisites

```bash
npx tsx scripts/fix-unpublished-modules.ts
```

Publishes all modules/items and sets sequential prerequisites (M1 → M2 → M3 → Bridge).

### Phase 6: Add Quizzes

Create quiz JSON in `alabs-generated-courses/quizzes/`:
```json
{
  "title": "Module 1 Quiz: Topic",
  "questions": [
    {
      "question": "What is...?",
      "options": ["A", "B", "C", "D"],
      "correctIndex": 1,
      "explanation": "Because..."
    }
  ]
}
```

Sync to Canvas:
```bash
npx tsx scripts/canvas-quiz-sync.ts \
  --course-id 14612851 \
  --module-title "Module 1: Plugin SDK Architecture" \
  --quiz-json alabs-generated-courses/quizzes/pluginsdk-m1.json
```

Creates a real Canvas Quiz (scored, 3 attempts, keep highest) and attaches it to the module.

### Phase 7: Add Challenges

Edit `scripts/add-module-challenges.ts` — add to `CHALLENGE_ASSIGNMENTS` map, then run:
```bash
npx tsx scripts/add-module-challenges.ts
```

### Phase 8: Polish

```bash
npx tsx scripts/polish-adv-courses.ts
```

Publishes courses, creates welcome pages, syllabi, curriculum maps, announcements, capstones, assignment groups.

### Phase 9: Audit

```bash
npx tsx scripts/launch-audit.ts
```

Expect: `Summary: 0 issue(s) across 10 course(s)`

### Phase 10: Update Demo Site

```bash
npx tsx scripts/generate-demo-index.ts
```

Scans modules → generates `alabs-demos/index.html` with stats and links.

## New Tools (Not in Original Pipeline)

### Incremental Sync
`scripts/sync-incremental.ts` — Hash-based skip. Only uploads changed modules.

### Canvas Quiz Sync
`scripts/canvas-quiz-sync.ts` — Converts quiz JSON to real Canvas Quiz objects with scoring.

### Progress Tracker
`scripts/progress-tracker.ts` — Polls Canvas module completion → updates SQLite certifications table.

### Package Analyzer
`scripts/analyze-packages.ts` — Scans any package, extracts exports/types/topics/complexity. Auto-generates curriculum map and challenge ideas.

### Platform as Course
`scripts/platform-as-course.ts` — Scans `surfaces/allternit-platform/` → generates course outline for "How A://Labs Works".

### Demo Index Generator
`scripts/generate-demo-index.ts` — Auto-generates demo landing page from scanned modules.

## Module Template System

`alabs-module-template/` contains a shared HTML shell with common CSS and JS. Agents can generate content JSON instead of full HTML, and `build.ts` injects it into the shell.

**Benefits:**
- Consistent styling across all modules
- ~60% smaller generated files
- Bug fixes in one place

**Files:**
- `shell/shell.html` — Template with `{{MODULE_CONTENT}}`, `{{MODULE_CSS}}`, `{{MODULE_JS}}` placeholders
- `scripts/build.ts` — Builds final HTML from content JSON + shell
- `scripts/convert-existing.ts` — Migrates old full-HTML modules to content JSON

## alabs-curator CLI (Generalizable Pipeline)

`alabs-curator/` is a standalone CLI for turning ANY codebase into courseware:

```bash
alabs-curator ingest -r ./my-project -e src
ealabs-curator analyze -i ingestion.json
ealabs-curator generate -a analysis.json -t "State Management"
alabs-curator build -c ./modules
alabs-curator publish -d ./dist --course-id 12345
```

Status: Scaffolded. Commands implemented but not production-tested on non-Allternit codebases.

## Known Issues & Workarounds

| Issue | Workaround |
|-------|------------|
| `pnpm` fails with workspace conflict | Use `npx tsx` directly |
| `better-sqlite3` native bindings missing | Use system `sqlite3` CLI for migrations |
| Canvas API 403 on course creation | Use Playwright browser automation |
| `invalid page_url parameter` on sync | Fixed in both sync scripts — uses Canvas-returned `page.url` |
| Assignment group names reset to "Assignments" | Use group position instead of name |
| Rubric API returns 500 | Include grading criteria in assignment description |

## Design System Reference

```css
/* Dark theme */
--bg: #0b0b0c;
--surface: #151517;
--border: #27272a;
--text: #e5e5e5;
--text-secondary: #a1a1aa;

/* Tier accents */
CORE:    #3b82f6 (blue)
OPS:     #8b5cf6 (purple)
AGENTS:  #ec4899 (pink)
ADV:     #f59e0b (amber/gold)

/* Typography */
Body:  Inter, system-ui
Code:  JetBrains Mono
```

## Agent Quick Reference

**Generate a module:**
1. Read source package files
2. Use agent prompt template above
3. Output to `alabs-generated-courses/ALABS-ADV-{COURSE}-module{N}.html`

**Sync a module:**
1. `npx tsx scripts/sync-incremental.ts --html-file ... --course-id ... --module-title ... --position N`

**Add a quiz:**
1. Write JSON to `alabs-generated-courses/quizzes/{course}-m{N}.json`
2. `npx tsx scripts/canvas-quiz-sync.ts --course-id ... --module-title ... --quiz-json ...`

**Everything else:**
1. `npx tsx scripts/fix-unpublished-modules.ts`
2. `npx tsx scripts/add-module-challenges.ts`
3. `npx tsx scripts/launch-audit.ts`

**Read the root AGENTS.md for full documentation.**
