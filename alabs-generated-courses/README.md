# A://Labs Generated Courses

> **DO NOT DELETE FILES IN THIS DIRECTORY** — They are the source of truth for Canvas course content.

This directory contains all generated interactive HTML modules for A://Labs courses.

## What's Here

```
alabs-generated-courses/
├── ALABS-ADV-PLUGINSDK-module1.html    # Module 1: Plugin SDK Architecture
├── ALABS-ADV-PLUGINSDK-module2.html    # Module 2: Adapters & PluginHost
├── ALABS-ADV-PLUGINSDK-module3.html    # Module 3: Publishing, Manifests & Distribution
├── ALABS-ADV-PLUGINSDK-bridge.html     # Bridge: Production integration
├── ALABS-ADV-WORKFLOW-module1.html     # Module 1: The Workflow Engine
├── ALABS-ADV-WORKFLOW-module2.html     # Module 2: The Scheduler & Execution Model
├── ALABS-ADV-WORKFLOW-bridge.html      # Bridge: Production workflows
├── ALABS-ADV-ADAPTERS-module1.html     # Module 1: Provider Adapters
├── ALABS-ADV-ADAPTERS-module2.html     # Module 2: Resilience Patterns
├── ALABS-ADV-ADAPTERS-bridge.html      # Bridge: Production API integration
├── quizzes/                            # Canvas Quiz JSON files
│   ├── pluginsdk-m1.json
│   ├── workflow-m1.json
│   └── adapters-m1.json
├── analysis/                           # Package analysis outputs
│   ├── package-analysis.json
│   ├── curriculum-map.json
│   └── platform-course-outline.json
└── .sync-hashes.json                   # Incremental sync hash store
```

## How These Are Used

1. **Canvas Sync** — Scripts upload these HTML files as Canvas wiki pages
2. **Demo Site** — Files are copied to `alabs-demos/` for standalone browsing
3. **Backup** — These are the master copies. Canvas is the deployment target.

## Regenerating a Module

If you need to regenerate a module:
1. Read the source code in `packages/@allternit/{package}/src/`
2. Use the agent prompt from `../AGENTS.md` or `../.agents/skills/alabs-course-pipeline/SKILL.md`
3. Write to this directory with the same filename
4. Run `npx tsx scripts/sync-incremental.ts` to sync changes

## Adding a New Module

Follow the naming convention:
```
ALABS-ADV-{COURSE}-module{N}.html    # Numbered modules
ALABS-ADV-{COURSE}-bridge.html       # Bridge module (final)
```

## Quiz Files

Quiz JSON files feed into `scripts/canvas-quiz-sync.ts` to create real Canvas Quizzes.

Format:
```json
{
  "title": "Module N Quiz: Topic",
  "questions": [
    {
      "question": "...",
      "options": ["...", "...", "...", "..."],
      "correctIndex": 0,
      "explanation": "..."
    }
  ]
}
```
