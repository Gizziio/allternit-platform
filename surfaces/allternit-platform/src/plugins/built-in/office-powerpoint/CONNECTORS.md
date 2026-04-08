# Connectors — Allternit for PowerPoint

## How tool references work

Command and skill files use `~~category` as a placeholder for whatever tool the user
has connected in that category. For example, `~~content source` might mean Notion,
a Google Slide, or any knowledge store with an MCP server.

PowerPoint plugin files are **tool-agnostic**: they describe workflows in terms of
content categories rather than specific products. The `.mcp.json` pre-configures
sensible defaults, but any compatible MCP server works as a drop-in.

---

## Connectors for this plugin

| Category | Placeholder | Included servers | Other options |
|----------|-------------|-----------------|---------------|
| Microsoft 365 | `~~microsoft 365` | Microsoft Graph | SharePoint direct, OneDrive API |
| Content source | `~~content source` | Notion | Confluence, Coda, Google Docs |
| Image library | `~~image library` | Unsplash | Pexels, Getty, Adobe Stock |
| Slides | `~~slides` | Google Slides | Canva, Figma Slides |
| Project tracker | `~~project tracker` | Linear | Jira, Asana, Shortcut |
| Chat | `~~chat` | Slack | Microsoft Teams |

---

## What each connector enables

### `~~microsoft 365` — Microsoft Graph
- Pull SharePoint data into data-driven slides
- Import OneDrive documents as slide content sources
- Access Teams meeting notes to auto-generate recap decks

### `~~content source` — Notion
- Pull Notion pages as outline material for new decks
- Import database views as slide data (tables, charts)
- Sync project wikis into structured presentation sections

### `~~image library` — Unsplash
- Search and insert royalty-free images by keyword
- Auto-select on-brand imagery for section dividers
- Replace placeholder visuals with real photography

### `~~slides` — Google Slides
- Import Google Slides content into PowerPoint
- Cross-platform deck migration and reformatting
- Reference slide structures from existing Google decks

### `~~project tracker` — Linear
- Pull sprint metrics into status-update slides
- Auto-populate roadmap slides from active milestones
- Generate stakeholder update decks from ticket progress

### `~~chat` — Slack
- Post presentation exports to channels
- Pull Slack threads as context for recap slides

---

## Standalone mode (no connectors)

All PowerPoint commands and skills work without any connected tools. When connectors
are absent, Allternit operates entirely on the open presentation — reading slides,
shapes, text frames, speaker notes, and slide metadata — and generates or transforms
content using only what it can observe within PowerPoint.
