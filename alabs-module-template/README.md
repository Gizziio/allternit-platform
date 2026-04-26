# A://Labs Module Template

A shared template system for building self-contained, interactive HTML course modules.

## Structure

```
alabs-module-template/
├── shell/
│   └── shell.html          # Shared HTML wrapper with CSS & JS
├── scripts/
│   └── build.ts            # Build script: content JSON → HTML module
└── README.md
```

## How It Works

1. **Generate content** as a JSON file (see `example-content.json`)
2. **Run build** to inject content into the shared shell
3. **Output** is a self-contained HTML file ready for Canvas sync

## Usage

```bash
npx tsx alabs-module-template/scripts/build.ts \
  --content alabs-generated-courses/content/workflow-m2.json \
  --output alabs-generated-courses/ALABS-ADV-WORKFLOW-module2.html
```

## Content JSON Format

```json
{
  "title": "Module 2: The Scheduler & Execution Model",
  "tier": "ADV",
  "sourcePackage": "packages/@allternit/workflow-engine",
  "accentColor": "#f59e0b",
  "navLinks": [
    { "label": "Overview", "section": "overview" },
    { "label": "Scheduler", "section": "scheduler" },
    { "label": "Quizzes", "section": "quizzes" },
    { "label": "Capstone", "section": "capstone" }
  ],
  "moduleCss": "/* Module-specific CSS */",
  "moduleContent": "<!-- Module HTML body content -->",
  "moduleJs": "// Module-specific JS (canvas animations, etc.)",
  "quizAnswers": { "1": 1, "2": 1, "3": 2 },
  "quizFeedback": {
    "1": { "correct": "Correct! ...", "wrong": "Not quite..." }
  }
}
```

## Shared Features (in shell)

- Dark theme with tier-colored accents
- Progress bar (top)
- Fixed navigation with section links
- Scroll-reveal animations
- Quiz engine (select, feedback, retry)
- Code block copy buttons
- Mobile responsive
- Self-contained (only Google Fonts CDN)

## Benefits

- **Consistency**: All modules share the same CSS/JS foundation
- **Smaller modules**: Common code is ~18KB shared, not duplicated per module
- **Easier maintenance**: Fix a bug in the shell, rebuild all modules
- **Faster generation**: Agents only generate content, not boilerplate
