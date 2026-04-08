# Connectors — Allternit for Word

## How tool references work

Command and skill files use `~~category` as a placeholder for whatever tool the user
has connected in that category. For example, `~~knowledge base` might mean Notion,
Confluence, or any other knowledge store with an MCP server.

Word plugin files are **tool-agnostic**: they describe workflows in terms of content
categories rather than specific products. The `.mcp.json` pre-configures sensible
defaults, but any compatible MCP server works as a drop-in.

---

## Connectors for this plugin

| Category | Placeholder | Included servers | Other options |
|----------|-------------|-----------------|---------------|
| Microsoft 365 | `~~microsoft 365` | Microsoft Graph | SharePoint direct, Exchange |
| Knowledge base | `~~knowledge base` | Notion | Confluence, Coda, Guru |
| Source control | `~~source control` | GitHub | GitLab, Bitbucket |
| Document store | `~~document store` | Google Docs | Dropbox Paper, Box Notes |
| Translation | `~~translation` | DeepL | Google Translate, Azure Translator |
| Chat | `~~chat` | Slack | Microsoft Teams |

---

## What each connector enables

### `~~microsoft 365` — Microsoft Graph
- Pull SharePoint document library content as context
- Import email threads as draft material
- Sync document metadata with OneDrive properties

### `~~knowledge base` — Notion
- Pull Notion pages as document context or source material
- Import wiki articles to inform drafts or summaries
- Sync structured content from databases into Word sections

### `~~source control` — GitHub
- Pull README files or documentation for technical rewriting
- Import code comments to generate developer documentation
- Reference open issues when writing specs or RFCs

### `~~document store` — Google Docs
- Pull Google Docs as context for cross-platform editing
- Compare versions across platforms
- Mirror content between Google Docs and Word

### `~~translation` — DeepL
- Translate full documents or selected sections
- Generate multilingual versions of contracts or reports
- Apply localized formatting conventions

### `~~chat` — Slack
- Post document summaries to channels
- Pull Slack threads as context for meeting notes or recaps

---

## Standalone mode (no connectors)

All Word commands and skills work without any connected tools. When connectors are
absent, Allternit operates entirely on the document currently open — reading body text,
paragraphs, selections, tracked changes, and comments — and applies transformations
using only what it can observe within Word.
