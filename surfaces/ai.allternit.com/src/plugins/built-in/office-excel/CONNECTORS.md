# Connectors — Allternit for Excel

## How tool references work

Command and skill files use `~~category` as a placeholder for whatever tool the user
has connected in that category. For example, `~~data source` might mean a Postgres
database, an Airtable base, or a Notion database — any MCP server in that category works.

Excel plugin files are **tool-agnostic**: they describe workflows in terms of data
categories rather than specific products. The `.mcp.json` pre-configures sensible
defaults, but any compatible MCP server works as a drop-in.

---

## Connectors for this plugin

| Category | Placeholder | Included servers | Other options |
|----------|-------------|-----------------|---------------|
| Microsoft 365 | `~~microsoft 365` | Microsoft Graph | SharePoint direct, OneDrive API |
| Database | `~~data source` | Postgres | MySQL, SQLite, Snowflake, BigQuery |
| Spreadsheet | `~~spreadsheet` | Google Sheets | Airtable, Smartsheet |
| Knowledge base | `~~knowledge base` | Notion | Confluence, Coda, Guru |
| Chat | `~~chat` | Slack | Microsoft Teams |
| No-code database | `~~no-code database` | Airtable | Notion databases, Monday.com |

---

## What each connector enables

### `~~microsoft 365` — Microsoft Graph
- Pull SharePoint list data directly into a worksheet
- Import OneDrive files as structured tables
- Sync Teams channel data for reporting

### `~~data source` — Postgres / SQL
- Run SQL queries and populate ranges with results
- Build live-refreshable reports from production databases
- Import lookup tables for VLOOKUP / INDEX-MATCH generation

### `~~spreadsheet` — Google Sheets
- Cross-platform data sync (pull Google Sheet into Excel)
- Mirror named ranges across workbooks
- Import public Google Sheet datasets

### `~~knowledge base` — Notion
- Pull Notion database views as tables
- Import page content as structured data
- Sync project trackers into Excel dashboards

### `~~chat` — Slack
- Post completed model outputs as Slack messages
- Fetch channel-level metrics for reporting

---

## Standalone mode (no connectors)

All Excel commands and skills work without any connected tools. When connectors are
absent, Allternit operates entirely on the data already present in the workbook —
reading ranges, running calculations, writing results, and generating formulas from
what it can see on screen.
