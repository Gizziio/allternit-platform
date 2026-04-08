# Connectors — Allternit for Chrome

## How tool references work

Command and skill files use `~~category` as a placeholder for whatever tool the user
has connected in that category. For example, `~~search` might mean Brave Search,
Google, or any web search MCP server.

Chrome plugin files are **tool-agnostic**: they describe workflows in terms of content
categories rather than specific products. The `.mcp.json` pre-configures sensible
defaults, but any compatible MCP server works as a drop-in.

---

## Connectors for this plugin

| Category | Placeholder | Included servers | Other options |
|----------|-------------|-----------------|---------------|
| Web search | `~~search` | Brave Search | Google Search, Bing, Perplexity |
| Knowledge base | `~~knowledge base` | Notion | Confluence, Obsidian, Roam, Coda |
| Source control | `~~source control` | GitHub | GitLab, Bitbucket |
| Calendar | `~~calendar` | Google Calendar | Outlook, Calendly |
| Email | `~~email` | Gmail | Outlook, Fastmail |
| Chat | `~~chat` | Slack | Microsoft Teams, Discord |
| Project tracker | `~~project tracker` | Linear | Jira, Asana, Shortcut |
| Translation | `~~translation` | DeepL | Google Translate, Azure Translator |

---

## What each connector enables

### `~~search` — Brave Search
- Supplement page content with live web search results
- Fact-check claims by searching for corroborating sources
- Pull related articles during research workflows

### `~~knowledge base` — Notion
- Save page summaries directly to a Notion database
- Create new Notion pages from extracted content
- Pull existing notes as context while reading

### `~~source control` — GitHub
- When on a GitHub page: read issues, PRs, and code without navigating away
- Summarize repository activity or PR diffs in the sidebar
- Auto-link tickets from `~~project tracker` to code changes

### `~~calendar` — Google Calendar
- Extract dates and events from pages and add to calendar
- Create calendar events from meeting pages or announcements
- Check availability while scheduling from email or web forms

### `~~email` — Gmail
- Draft and send emails from extracted page content
- Summarize email threads in the sidebar when on Gmail
- Create follow-up tasks from email context

### `~~chat` — Slack
- Share page summaries or extracted content directly to channels
- Post research findings without leaving the browser
- Create Slack threads from any page with one command

### `~~project tracker` — Linear
- Create issues from bug reports or feature requests found on any page
- Link pages to existing tickets for research context
- Update ticket descriptions from documentation pages

### `~~translation` — DeepL
- Translate the full page or selected content inline
- Save translated summaries to `~~knowledge base`
- Cross-language research without switching tabs

---

## Standalone mode (no connectors)

All Chrome commands and skills work without any connected tools. When connectors are
absent, Allternit operates entirely on the active page — reading the DOM, extracting
visible text, summarizing content, and answering questions using only what is present
in the browser viewport.
