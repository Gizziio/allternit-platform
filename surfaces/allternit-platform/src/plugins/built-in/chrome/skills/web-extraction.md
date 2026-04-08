---
name: web-extraction
description: Extract structured data from web pages. Trigger with "extract", "get all", "list all", "pull out", "find all the [X]", "grab the table", "get the prices", "find the emails", or any request to collect specific data points from the page.
---

# Web Extraction

Structured data extraction from any webpage. Identifies and pulls tables, lists,
contacts, prices, dates, and custom entities into clean, portable formats.

## Extraction Targets

### Tables
- HTML `<table>` elements → markdown table or JSON array
- CSS Grid / Flexbox-rendered "tables" → best-effort extraction via text structure
- Label each table by its surrounding heading or caption
- Flag merged cells or complex headers with a note

### Lists
- `<ol>` / `<ul>` → numbered or bulleted list
- Nested lists → indented structure preserved
- Definition lists `<dl>` → `term: definition` format

### Contacts & People
- Pattern-match: Name + Title + Email + Company + Phone
- Sources: about pages, team pages, press releases, footers
- Output: structured list or JSON

### Prices & Financial Figures
- Currency amounts, percentages, basis points
- Table context preserved (what the price refers to)
- Comparison tables → structured side-by-side

### Dates & Events
- ISO dates, natural language dates, ranges
- Event names paired with their dates
- Deadline language ("by", "before", "until") flagged explicitly

### Custom Entities
- User-defined: "extract all company names" / "get all GitHub links" / "list all file sizes"
- Uses page text + link hrefs as sources

## Output Quality Rules

1. Never fabricate data not present on the page
2. Mark ambiguous values with `?`
3. Cite the section or heading each item came from
4. If extraction is partial (page not fully loaded, paywalled), say so explicitly
