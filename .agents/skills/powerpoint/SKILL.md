---
name: powerpoint
description: "Generate PowerPoint presentations (.pptx) from prompts, data outlines, or Excel summaries. Supports title slides, bullet slides, chart slides, and speaker notes. Uses the Summit Copilot Skills FastAPI service for production output."
tags: ["presentations", "powerpoint", "pptx", "office", "slides"]
tools: ["llm", "filesystem"]
entrypoint: "SKILL.md"
---

# PowerPoint

Generate production-ready Microsoft PowerPoint presentations (.pptx) from structured outlines, user prompts, or Excel data summaries. This skill wraps the Summit Copilot Skills FastAPI service with opinionated styling and slide patterns so agents can produce consistent, professional decks without wrestling with low-level formatting.

> **STATUS:** Production  
> **Backend Tool:** `domains/agent-swarm/tools/document-generator/mod.ts` (action: `generatePhotoCardDeck`)

---

## When to Use

- **Pitch Deck** — presenting a product, service, or startup to investors or partners
- **Quarterly Report** — financial or operational review for leadership and stakeholders
- **Data Summary** — key metrics, trends, and insights distilled into visual slides
- **Training Material** — onboarding, process walkthroughs, or skill-building content for teams
- **Conference Talk** — speaker deck for keynotes, panels, or breakout sessions
- **Investor Update** — progress, milestones, and forward-looking plans for existing backers
- **Project Status Report** — timeline, blockers, risks, and next steps for leadership
- **Strategic Roadmap** — vision, priorities, and phased initiatives over the coming quarters

---

## Output Format

Every invocation of this skill produces:

1. **A `.pptx` file path** — the absolute path to the generated presentation on the local filesystem
2. **Slide count and narrative arc summary** — JSON or bulleted overview of each slide, its type, and the story it tells
3. **Optional: speaker notes per slide** — suggested talking points or context for the presenter, when `notes` are provided

The agent should always surface the file path first so the user can open or share it immediately.

---

## Slide Type Library

Use these layout types as the default palette when building a deck. Ask clarifying questions only if the slide mix is ambiguous.

| Type | Layout | Best For |
|------|--------|----------|
| **title** | Title + subtitle, centered, large typography | Opening slide, closing slide, transition |
| **bullets** | Title + 3–5 bullet points, left-aligned | Key takeaways, feature lists, summaries |
| **two-column** | Title + two content areas side by side | Comparisons, pros/cons, before/after |
| **image-right** | Title + bullets left, image placeholder right | Visual storytelling, product screenshots |
| **chart** | Title + chart data rendered as bar/line chart | Metrics, trends, financial data |
| **section-divider** | Full-bleed background, section title | Chapter breaks, topic transitions |

---

## Agent Instructions

Follow this 4-step workflow when generating a presentation:

### Step 1: Clarify

Confirm with the user:
- **Audience** (executive, investor, customer, internal team, conference attendees)
- **Duration** (10 min, 30 min, 60 min — determines slide count)
- **Key message** (the one takeaway the audience must remember)
- **Tone** (formal, casual, persuasive, technical)
- **Must-include slides or data** (charts, quotes, logos, specific stats)

If the user provides a raw prompt like *"Make me a deck about Q3"*, map it to the closest pattern above before proceeding.

### Step 2: Outline

Generate a structured outline as a JSON array. Example:

```json
[
  { "type": "title", "title": "Q3 Infrastructure Review", "subtitle": "Platform Team | October 2026" },
  { "type": "bullets", "title": "Executive Summary", "bullets": ["Uptime improved to 99.99%", "Migration completed 2 weeks early", "Cost reduced by 18%"] },
  { "type": "chart", "title": "Monthly Uptime Trend", "chartData": { "labels": ["Jul", "Aug", "Sep"], "values": [99.95, 99.97, 99.99] } },
  { "type": "section-divider", "title": "Looking Ahead to Q4" },
  { "type": "two-column", "title": "Q4 Priorities", "leftContent": "Launch regional clusters", "rightContent": "Implement auto-scaling" }
]
```

Show the outline to the user for approval before rendering.

### Step 3: Render

Call the backend tool at:

```
domains/agent-swarm/tools/powerpoint/index.ts
```

Import `createDeck` and pass the approved outline as `CreatePptxParams`:

```typescript
import { createDeck } from '../domains/agent-swarm/tools/powerpoint/index.ts';

const result = await createDeck({
  title: "Q3 Infrastructure Review",
  slides: outline,
  outputPath: `/tmp/allternit-pptx-${Date.now()}.pptx`,
  theme: 'dark-blue'
});
```

### Step 4: Deliver

Return to the user:
- **File path:** `result.path`
- **Slide count:** `result.slideCount`
- **Narrative summary:** bullet list of the story arc (setup → conflict → resolution)
- **Suggested speaker notes:** 1–2 talking points per slide when notes are provided
- **Revision suggestions:** 1–2 optional improvements (e.g., "Add a chart slide for revenue trend" or "Consider a section divider before the roadmap")

---

## Styling Guidelines

All presentations rendered by this skill use the following defaults. Do not override unless the user explicitly requests a different style.

| Element | Style |
|---------|-------|
| **Default theme** | Dark blue master slide (#1a237e) with white text |
| **Title slides** | 44 pt bold white, centered |
| **Slide titles** | 32 pt bold white |
| **Body text** | 18 pt white or #e0e0e0 |
| **Accent color** | #00bcd4 (cyan) for bullets, highlights, and charts |
| **Bullet constraints** | Max 10 words per bullet, max 5 bullets per slide |
| **Aspect ratio** | 16:9 default |
| **Speaker notes** | Added automatically when `slide.notes` is present |

If the user requests custom branding (colors, logos, custom fonts), note that the current backend supports text and chart styling with preset themes. Direct them to a design tool for advanced branding.

---

## Excel → PowerPoint Bridge

When the user wants to convert Excel data into a presentation, follow the golden workflow extracted from the Anthropic Office plugin research:

```
Input: workbook_file, sheet_name, max_slides
1. office-local.excel.read-workbook
2. office-local.excel.summarize-sheet
3. office-local.powerpoint.create-deck
4. office-local.powerpoint.add-title-slide
5. office-local.powerpoint.add-bullets-slide (for each insight)
6. office-local.powerpoint.save-deck
7. receipt.create
```

**Detailed steps:**

1. Read the workbook with `office-local.excel.read-workbook(workbook_file)`
2. Summarize the target sheet with `office-local.excel.summarize-sheet(data)`
3. Create a new deck with `office-local.powerpoint.create-deck({ title: summary.title, slides: [] })`
4. Add a title slide with `office-local.powerpoint.add-title-slide(pptx, { title: summary.title, subtitle: summary.subtitle })`
5. For each key insight or finding, add a bullet slide with `office-local.powerpoint.add-bullets-slide(pptx, { title: insight.title, bullets: insight.bullets })`
6. Save the deck with `office-local.powerpoint.save-deck(pptx, outputPath)`
7. Create a receipt with `receipt.create({ type: "excel_to_ppt", output: outputPath })`

**Output:**
- `pptx_path`: string
- `slide_count`: number
- `receipt`: object

---

## Backend Tool Reference

| Export | Path |
|--------|------|
| Export | Path |
|--------|------|
| `execute` | `domains/agent-swarm/tools/document-generator/mod.ts` |
| `inputSchema` | `domains/agent-swarm/tools/document-generator/mod.ts` |

Dependencies: `document-generator-skills` FastAPI service (Python) running at `SUMMIT_COPILOT_URL`.

---

## Quick Reference

**Generate a pitch deck:**
1. Confirm audience = `investors`, duration = `10 min`
2. Build JSON outline with Title, Problem, Solution, Market, Traction, Team, Ask
3. Call `execute({ action: 'generatePhotoCardDeck', title, slide_count, key_points })`
4. Return path + slide count + narrative summary

**Generate a quarterly report:**
1. Confirm audience = `leadership`, duration = `20 min`
2. Build JSON outline with Title, Executive Summary, KPI Chart, Wins, Challenges, Roadmap
3. Call `execute({ action: 'generatePhotoCardDeck', title, slide_count, key_points })`
4. Return path + summary + suggested speaker notes

**Excel to PowerPoint:**
1. Read and summarize the Excel workbook
2. Map summary insights to bullet slides
3. Call `execute({ action: 'generatePhotoCardDeck', title, slide_count, key_points })`
4. Save with `saveDeck(pptx, path)` and create receipt
