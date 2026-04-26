# Allternit Codebase-to-Course

An agent skill that turns any Allternit package into a beautiful, interactive, single-page HTML course module for A://Labs.

## What it does

- Reads source code, architecture docs, and READMEs from an Allternit package
- Generates a scroll-based, animated HTML module with:
  - Code ↔ Plain English translations
  - Animated data flow visualizations
  - Component "group chat" animations
  - Interactive quizzes
  - Capstone project suggestion
- Outputs a single self-contained HTML file ready to drop into Canvas

## Usage

### As a Claude Code skill

Copy this folder into your skills directory:

```bash
# For Claude Code
cp -r .agents/skills/allternit-codebase-to-course ~/.claude/skills/

# For any other agent that supports SKILL.md workflows
cp -r .agents/skills/allternit-codebase-to-course ~/YOUR_AGENT/skills/
```

Then invoke it:

> "Turn `packages/@allternit/plugin-sdk` into an A://Labs module"

### Via the automated pipeline

```bash
npx tsx scripts/sync-course-from-package.ts \
  --package packages/@allternit/plugin-sdk \
  --course-id 14593499 \
  --module-title "ADV Module: Plugin SDK Deep Dive"
```

Or with a prebuilt HTML file:

```bash
npx tsx scripts/sync-course-from-package.ts \
  --course-id 14593499 \
  --module-title "ADV Module: Plugin SDK Deep Dive" \
  --html-file alabs-generated-courses/ALABS-ADV-PLUGINSDK-module1.html
```

## Pipeline overview

```
Allternit Package
       │
       ▼
  Read docs + source
       │
       ▼
  Generate interactive HTML
       │
       ▼
  Upload to Canvas wiki page
       │
       ▼
  Attach to course module
```

## A://Labs brand defaults

- **Background:** `#0b0b0c`
- **Tier accents:**
  - CORE: `#3b82f6`
  - OPS: `#8b5cf6`
  - AGENTS: `#ec4899`
  - ADV: `#f59e0b`
- **Typography:** Inter + JetBrains Mono
- **Target learner:** Agent-native operators (vibe-coders who steer AI tools)

## Files

- `SKILL.md` — Skill instructions for agents
- `references/design-system.md` — CSS tokens, layout rules
- `references/interactive-elements.md` — Quiz, animation, and visualization patterns
- `references/main.js` — Navigation and progress tracking
- `references/styles.css` — Base styling
