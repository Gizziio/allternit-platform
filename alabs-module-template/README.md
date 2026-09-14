# A://Labs Module Template

A shared template system for building self-contained, interactive HTML course modules.

## Structure

```
alabs-module-template/
├── shell/
│   └── shell.html          # Shared HTML wrapper with CSS & JS
├── scripts/
│   ├── build.ts            # Build script: content JSON → HTML module
│   └── media/              # Per-media build scripts
│       ├── build-mermaid.ts
│       ├── build-asciinema.ts
│       ├── build-walkthrough.ts
│       ├── build-sandpack.ts (Phase 3)
│       ├── build-manim.ts    (Phase 4)
│       └── build-remotion.ts (Phase 4)
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
  },
  "mediaAssets": [
    { "id": "adapter-flow", "type": "mermaid", "src": "alabs-generated-courses/media/src/adapter-flow.mmd" },
    { "id": "cowork-setup", "type": "asciinema", "src": "alabs-generated-courses/media/src/cowork-setup.cast" },
    { "id": "adapter-walkthrough", "type": "walkthrough", "src": "alabs-generated-courses/media/src/adapter-walkthrough.json" }
  ]
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

## Media assets

The builder supports open-source video replacements via the `mediaAssets` array and `{{MEDIA:asset-id}}` placeholders in `moduleContent`.

### Supported media types

| Type | Source file | Runtime loader | Use case |
|---|---|---|---|
| `mermaid` | `.mmd` | Mermaid 10 CDN | Architecture diagrams, flowcharts |
| `asciinema` | `.cast` | Asciinema Player 3 CDN | Terminal recordings |
| `walkthrough` | `.json` | Built-in | Code-Hike-style step-through code walkthroughs |
| `sandpack` | demo folder | iframe | Runnable code playgrounds |
| `manim` | `.py` | `<video>` | Programmatic animations |
| `remotion` | `.tsx` | `<video>` | Generated lecture videos |

Store source files in `alabs-generated-courses/media/src/`. The builder will inline small assets (Mermaid, Asciinema) and link larger outputs (Manim/Remotion MP4s, Sandpack demos).

## Benefits

- **Consistency**: All modules share the same CSS/JS foundation
- **Smaller modules**: Common code is ~18KB shared, not duplicated per module
- **Easier maintenance**: Fix a bug in the shell, rebuild all modules
- **Faster generation**: Agents only generate content, not boilerplate
- **Production media**: Open-source, self-hostable replacements for lecture videos
