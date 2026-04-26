# A://Labs — Curriculum-as-Code Pipeline

> **STATUS:** Production-ready. 10 courses, 65 modules, 0 audit issues.
>
> **LAST UPDATED:** 2026-04-17

## What Is This?

A://Labs is Allternit's learning platform. It turns the Allternit codebase into interactive, self-contained HTML course modules that are synced to Canvas LMS. The entire pipeline is automated — from code analysis → module generation → Canvas publishing → progress tracking.

## Quick Stats

| Metric | Value |
|--------|-------|
| Total Courses | 10 (7 original + 3 ADV) |
| Total Modules | 65 |
| Total Assignments | 51 |
| Canvas Launch Audit | 0 issues |
| Interactive Demo Modules | 10 |

## Course Catalog

| Code | Title | Tier | Course ID | Modules |
|------|-------|------|-----------|---------|
| ALABS-CORE-COPILOT | Build AI-Assisted Software | CORE | 14593493 | 7 |
| ALABS-CORE-PROMPTS | Prompt Engineering | CORE | 14593495 | 7 |
| ALABS-OPS-N8N | Orchestrate Agents & Automations | OPS | 14593499 | 9 |
| ALABS-OPS-VISION | Computer Vision for Agent Systems | OPS | 14593501 | 6 |
| ALABS-OPS-RAG | Local RAG & Document Intelligence | OPS | 14593503 | 7 |
| ALABS-AGENTS-ML | ML Models as Agent Tools | AGENTS | 14593505 | 6 |
| ALABS-AGENTS-AGENTS | Multi-Agent Systems & Orchestration | AGENTS | 14593507 | 7 |
| ALABS-ADV-PLUGINSDK | Build Plugins for Allternit | ADV | 14612851 | 4 |
| ALABS-ADV-WORKFLOW | The Allternit Workflow Engine | ADV | 14612861 | 3 |
| ALABS-ADV-ADAPTERS | Provider Adapters & Unified APIs | ADV | 14612869 | 3 |

## Directory Structure

```
allternit/
├── AGENTS.md                              ← YOU ARE HERE
├── alabs-generated-courses/               ← Generated HTML modules
│   ├── ALABS-ADV-PLUGINSDK-module1.html
│   ├── ALABS-ADV-PLUGINSDK-module2.html
│   ├── ALABS-ADV-PLUGINSDK-module3.html
│   ├── ALABS-ADV-PLUGINSDK-bridge.html
│   ├── ALABS-ADV-WORKFLOW-module1.html
│   ├── ALABS-ADV-WORKFLOW-module2.html
│   ├── ALABS-ADV-WORKFLOW-bridge.html
│   ├── ALABS-ADV-ADAPTERS-module1.html
│   ├── ALABS-ADV-ADAPTERS-module2.html
│   ├── ALABS-ADV-ADAPTERS-bridge.html
│   ├── quizzes/                          ← Quiz JSON files for Canvas Quiz API
│   │   ├── pluginsdk-m1.json
│   │   ├── workflow-m1.json
│   │   └── adapters-m1.json
│   └── analysis/                         ← Package analysis outputs
│       ├── package-analysis.json
│       ├── curriculum-map.json
│       └── platform-course-outline.json
├── alabs-demos/                          ← Standalone demo site
│   ├── index.html                        ← Auto-generated landing page
│   └── *.html                            ← All demo modules (copied from generated)
├── alabs-module-template/                ← Shared template system
│   ├── shell/shell.html                  ← Common CSS + JS wrapper
│   ├── scripts/build.ts                  ← Build: content JSON → HTML
│   ├── scripts/convert-existing.ts       ← Migrate old modules to new format
│   └── README.md
├── alabs-curator/                        ← Generalizable CLI (WIP)
│   ├── package.json
│   ├── src/cli.ts
│   └── src/commands/
│       ├── ingest.ts
│       ├── analyze.ts
│       ├── generate.ts
│       ├── build.ts
│       └── publish.ts
├── scripts/                              ← Pipeline scripts
│   ├── sync-course-from-package.ts       ← Main sync (fixed page_url bug)
│   ├── sync-incremental.ts               ← Hash-based incremental sync
│   ├── canvas-quiz-sync.ts               ← Canvas Quiz API integration
│   ├── progress-tracker.ts               ← Poll Canvas → SQLite progress
│   ├── add-module-challenges.ts          ← Adds challenge assignments
│   ├── launch-audit.ts                   ← Validates all courses
│   ├── polish-adv-courses.ts             ← One-shot polish for ADV courses
│   ├── generate-demo-index.ts            ← Auto-builds demo landing page
│   ├── analyze-packages.ts               ← Codebase → topics/challenges
│   ├── platform-as-course.ts             ← Platform → course outline
│   └── fix-unpublished-modules.ts        ← Publishes + sets prerequisites
├── surfaces/allternit-platform/
│   └── src/views/
│       ├── LabsView.tsx                  ← Platform UI (shows all courses)
│       └── CertificationsPanel.tsx       ← Certification badge gallery
└── .agents/skills/
    └── alabs-course-pipeline/
        └── SKILL.md                      ← Agent skill for pipeline usage
```

## The Pipeline

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│  Code Analysis  │────▶│ Module Generate │────▶│  Canvas Publish │
│  (TypeScript)   │     │  (Agent Swarms) │     │  (REST API)     │
└─────────────────┘     └─────────────────┘     └─────────────────┘
         │                       │                       │
         ▼                       ▼                       ▼
  analyze-packages.ts     Agent prompts in          sync-incremental.ts
  platform-as-course.ts   .agents/skills/           canvas-quiz-sync.ts
                          alabs-course-pipeline/    progress-tracker.ts
                          SKILL.md
```

## How To: Common Tasks

### 1. Generate a New Module

Use an agent swarm. The skill at `.agents/skills/alabs-course-pipeline/SKILL.md` has the full prompts. Short version:

```bash
# Read source package
# Generate interactive HTML module
# Write to alabs-generated-courses/ALABS-ADV-{COURSE}-module{N}.html
```

Module requirements:
- Self-contained single HTML file
- Dark theme (`#0b0b0c` bg, tier-colored accent)
- JetBrains Mono + Inter typography
- Progress bar + fixed nav + scroll-reveal
- Syntax-highlighted code blocks
- 3 interactive quizzes with instant feedback
- 1 Canvas animation (DAG, scheduler, circuit breaker, etc.)
- Capstone project section

### 2. Sync Module to Canvas

**Incremental (recommended):**
```bash
cd /Users/macbook/Desktop/allternit-workspace/allternit
npx tsx scripts/sync-incremental.ts \
  --html-file alabs-generated-courses/ALABS-ADV-WORKFLOW-module2.html \
  --course-id 14612861 \
  --module-title "Module 2: The Scheduler & Execution Model" \
  --position 2
```

**Legacy (if incremental fails):**
```bash
npx tsx scripts/sync-course-from-package.ts \
  --html-file alabs-generated-courses/ALABS-ADV-WORKFLOW-module2.html \
  --course-id 14612861 \
  --module-title "Module 2: The Scheduler & Execution Model" \
  --position 2
```

> ⚠️ **KNOWN BUG & FIX:** The original `sync-course-from-package.ts` generated `page_url` from the module title, which could mismatch Canvas's URL slug. It was fixed to use `page.url` from the Canvas API response. If you see `invalid page_url parameter`, the script needs this fix.

### 3. Publish Module & Set Prerequisites

```bash
npx tsx scripts/fix-unpublished-modules.ts
```

This publishes all unpublished modules and sets sequential prerequisites (M1 → M2 → M3 → Bridge).

### 4. Add Canvas Quiz (Real Scoring)

Create a quiz JSON:
```json
{
  "title": "Module 1 Quiz: Topic Name",
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

Result: Real Canvas Quiz with scoring, attached to the module.

### 5. Add Module Challenge

Edit `scripts/add-module-challenges.ts` — add entry to `CHALLENGE_ASSIGNMENTS` map:
```typescript
'ALABS-ADV-WORKFLOW': {
  'Module 2: The Scheduler & Execution Model': {
    title: 'Challenge: Build a Retry-Aware Scheduler',
    description: '...',
  },
},
```

Run:
```bash
npx tsx scripts/add-module-challenges.ts
```

### 6. Run Launch Audit

```bash
npx tsx scripts/launch-audit.ts
```

Checks all 10 courses for:
- Unpublished modules
- Missing prerequisites
- Module/item counts
- Assignment completeness

### 7. Update Demo Site

```bash
npx tsx scripts/generate-demo-index.ts
```

Scans `alabs-generated-courses/` and `alabs-demos/` → generates `alabs-demos/index.html`.

### 8. Analyze a Package for Topics

```bash
npx tsx scripts/analyze-packages.ts --package packages/@allternit/plugin-sdk
```

Outputs:
- `alabs-generated-courses/analysis/package-analysis.json` — exports, types, complexity
- `alabs-generated-courses/analysis/curriculum-map.json` — auto-generated syllabus

### 9. Track Student Progress

```bash
npx tsx scripts/progress-tracker.ts --user-id 12345
```

Polls Canvas for module completion → updates SQLite `certifications` table.

## Canvas API Constraints

- **Free For Teacher plan** on `canvas.instructure.com`
- `POST /accounts/self/courses` returns **403** — course creation requires browser automation (Playwright)
- Token is hardcoded in scripts (production would use env var)
- Rate limits: ~100 requests/minute

## Database Schema (Certifications)

```sql
CREATE TABLE certifications (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  userId TEXT NOT NULL,
  courseCode TEXT NOT NULL,
  progress INTEGER DEFAULT 0,
  completedAt TEXT,
  status TEXT DEFAULT 'in_progress',
  updatedAt TEXT,
  UNIQUE(userId, courseCode)
);
```

## Design System (Module Template)

| Token | Value | Usage |
|-------|-------|-------|
| `--bg` | `#0b0b0c` | Page background |
| `--accent` | Tier color | Highlights, badges, links |
| `--accent-dim` | `rgba(color, 0.15)` | Subtle backgrounds |
| `--text` | `#e5e5e5` | Primary text |
| `--text-secondary` | `#a1a1aa` | Secondary text |
| Font body | Inter | All text |
| Font code | JetBrains Mono | Code blocks |

Tier colors:
- CORE: `#3b82f6` (blue)
- OPS: `#8b5cf6` (purple)
- AGENTS: `#ec4899` (pink)
- ADV: `#f59e0b` (amber/gold)

## Troubleshooting

| Symptom | Cause | Fix |
|---------|-------|-----|
| `invalid page_url parameter` on sync | URL slug mismatch | Use `sync-incremental.ts` or the fixed `sync-course-from-package.ts` |
| `pnpm` commands fail | Workspace name conflict (`@allternit/visual-state` in two places) | Use `npx tsx` directly instead of `pnpm` |
| `better-sqlite3` migration fails | Native bindings missing | Use system `sqlite3` CLI for migrations |
| Canvas quiz not attaching | Module doesn't exist yet | Sync the HTML module first, then attach quiz |
| Agent generation timeouts | Large codebase to analyze | Give agent specific file paths, not broad globs |

## Agent Swarm Prompt Template

When generating a new module, use this structure:

```
Generate an interactive HTML course module for A://Labs ADV tier.

Source: Read [specific files]
Title: Module N: [Topic]
Course: ALABS-ADV-[COURSE]
Tier: ADV (amber #f59e0b)

Required sections:
1. Hero
2. The Problem
3. [3-5 content sections with real code]
4. 3 Interactive Quizzes
5. Capstone Project

Design: Self-contained, dark theme, JetBrains Mono + Inter,
  progress bar, fixed nav, scroll-reveal, syntax highlighting,
  ONE Canvas animation, fully inline CSS/JS.

Output: /Users/macbook/Desktop/allternit-workspace/allternit/alabs-generated-courses/ALABS-ADV-[COURSE]-module[N].html
```

## Future Work (Backlog)

- [ ] Migrate all existing modules to shared template shell (reduces size ~60%)
- [ ] Complete `alabs-curator` CLI (generalize for any codebase)
- [ ] Add "Platform as Course" (ALABS-PLATFORM: 5 modules, ~15 hours)
- [ ] Build module generation directly into template system (agents output JSON, build script wraps)
- [ ] Auto-extract quiz JSON from generated modules (instead of hand-writing)
- [ ] Add completion webhooks (Canvas → platform notifications)
- [ ] Migrate Canvas token from hardcoded to env-based

## Key Contacts / Context

- **Canvas Instance:** Free For Teacher, `canvas.instructure.com`
- **Node Version:** v25.6.1 with `tsx`
- **Database:** SQLite (`better-sqlite3`) + PostgreSQL (Prisma)
- **Platform:** Next.js in `surfaces/allternit-platform/`
- **Course IDs:** See catalog table above
- **Generated modules:** Stored in `alabs-generated-courses/`
- **Demo site:** `alabs-demos/index.html` — works offline

---

**If you are an agent reading this:** You have everything you need to generate, sync, quiz, audit, and track courses. Do NOT start from scratch. Build on what's here.

---

## Platform Integration

### Demo Files in Platform

Demo HTML files must be copied to the platform's public directory to be served:

```bash
cp alabs-demos/*.html surfaces/allternit-platform/public/demos/
```

The `LabsView.tsx` "Try Demo" buttons link to `/demos/ALABS-ADV-{COURSE}-module1.html` which resolves to `public/demos/` in Next.js.

### Keeping Demos In Sync

After generating new modules:
1. Copy to `alabs-demos/`
2. Copy to `surfaces/allternit-platform/public/demos/`
3. Regenerate index: `npx tsx scripts/generate-demo-index.ts`
4. Copy updated index to both locations

### Platform UI Updates

When adding new courses/modules, update:
- `surfaces/allternit-platform/src/views/LabsView.tsx` — `ALABS_COURSES` array
- Module counts, descriptions, demo URLs
- Ensure `ADV` tier is included in the rendering loop
