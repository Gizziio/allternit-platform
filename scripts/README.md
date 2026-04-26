# A://Labs Pipeline Scripts

> **Read `../AGENTS.md` for the full system overview.**

This directory contains all automation scripts for the A://Labs curriculum pipeline.

## Script Reference

### Core Pipeline

| Script | Purpose | When to Run |
|--------|---------|-------------|
| `alabs-course-pipeline.ts` | Orchestrator — runs all phases | Full pipeline execution |
| `create-advanced-courses-browser.ts` | Playwright course creation | New ADV courses only |
| `generate-course-covers.py` | PIL cover image generation | After course creation |
| `upload-course-images.ts` | Upload covers to Canvas | After cover generation |

### Module Sync

| Script | Purpose | When to Run |
|--------|---------|-------------|
| `sync-incremental.ts` | **RECOMMENDED** — Hash-based sync, skips unchanged | Every module update |
| `sync-course-from-package.ts` | Legacy sync (has page_url fix) | Fallback if incremental fails |

### Content Enhancement

| Script | Purpose | When to Run |
|--------|---------|-------------|
| `canvas-quiz-sync.ts` | Canvas Quiz API — real scored quizzes | After module sync |
| `add-module-challenges.ts` | Challenge assignments per module | After adding new module |
| `polish-adv-courses.ts` | Full polish (welcome, syllabus, capstones) | After all modules synced |
| `fix-unpublished-modules.ts` | Publish + set prerequisites | After sync |

### Quality & Monitoring

| Script | Purpose | When to Run |
|--------|---------|-------------|
| `launch-audit.ts` | Validates all 10 courses | Before go-live, after changes |
| `progress-tracker.ts` | Polls Canvas → SQLite progress | Periodic (cron) |

### Analysis & Generation

| Script | Purpose | When to Run |
|--------|---------|-------------|
| `analyze-packages.ts` | Package → topics/challenges/curriculum | Exploring new packages |
| `platform-as-course.ts` | Platform codebase → course outline | Building meta-course |
| `generate-demo-index.ts` | Builds demo landing page | After module changes |

## Quick Commands

```bash
# Sync a new module (incremental)
npx tsx scripts/sync-incremental.ts \
  --html-file alabs-generated-courses/ALABS-ADV-WORKFLOW-module2.html \
  --course-id 14612861 \
  --module-title "Module 2: The Scheduler & Execution Model" \
  --position 2

# Publish all unpublished modules + set prerequisites
npx tsx scripts/fix-unpublished-modules.ts

# Add Canvas quiz
npx tsx scripts/canvas-quiz-sync.ts \
  --course-id 14612851 \
  --module-title "Module 1: Plugin SDK Architecture" \
  --quiz-json alabs-generated-courses/quizzes/pluginsdk-m1.json

# Full audit
npx tsx scripts/launch-audit.ts

# Update demo site
npx tsx scripts/generate-demo-index.ts
```

## Canvas Course IDs

| Course | ID |
|--------|-----|
| ALABS-CORE-COPILOT | 14593493 |
| ALABS-CORE-PROMPTS | 14593495 |
| ALABS-OPS-N8N | 14593499 |
| ALABS-OPS-VISION | 14593501 |
| ALABS-OPS-RAG | 14593503 |
| ALABS-AGENTS-ML | 14593505 |
| ALABS-AGENTS-AGENTS | 14593507 |
| ALABS-ADV-PLUGINSDK | 14612851 |
| ALABS-ADV-WORKFLOW | 14612861 |
| ALABS-ADV-ADAPTERS | 14612869 |
