---
description: Extract structured data from the current page — tables, lists, prices, contacts, any schema
argument-hint: "[what to extract]"
---

# /cu:extract

Pull structured data from the active browser page using accessibility, DOM, or vision strategies.

## Usage

```
/cu:extract all product names and prices
/cu:extract --strategy selector --selector "table.results" as csv
/cu:extract --format json the contact details from this page
/cu:extract --strategy vision Find all the dates mentioned on this page
```

## Strategies

| Strategy | When to use |
|----------|-------------|
| `accessibility` | Default. Best for most pages — reads semantic structure. |
| `text` | Raw visible text extraction. Fast, no structure. |
| `selector` | When you know the CSS selector. Most reliable for known schemas. |
| `vision` | When content is image-based or non-semantic (charts, PDFs). |

## Output Formats

| Format | Description |
|--------|-------------|
| `json` | Structured JSON object (default) |
| `csv` | Comma-separated values |
| `markdown` | Markdown table |
| `raw` | Raw extracted text |

## Options

| Option | Default | Description |
|--------|---------|-------------|
| `--strategy` | `accessibility` | Extraction strategy (see above) |
| `--format` | `json` | Output format |
| `--selector` | — | CSS selector (when `strategy=selector`) |
| `--session` | current | Session to extract from |
| `--max-items` | 1000 | Max items to return |

## Examples

```
/cu:extract all job listings with company, title, and salary
/cu:extract --format csv the leaderboard table on this page
/cu:extract --strategy selector --selector ".product-card" name, price, rating as json
/cu:extract --strategy vision Read all text from the chart on this page
/cu:extract the article author, publish date, and word count
```

## Output Schema

```json
{
  "strategy": "accessibility",
  "items": [...],
  "count": 42,
  "url": "https://...",
  "extracted_at": "2026-04-22T09:00:00Z"
}
```
