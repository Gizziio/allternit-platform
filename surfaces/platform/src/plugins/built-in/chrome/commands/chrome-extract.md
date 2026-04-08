---
description: Extract structured data from the current page — tables, lists, contacts, prices, dates
argument-hint: "[table | list | contacts | prices | dates | json]"
---

# /chrome:extract

> If you see unfamiliar tool placeholders or need to check which connectors are active, see [CONNECTORS.md](../CONNECTORS.md).

Pull structured data out of the current page in a clean, portable format.

## What Can Be Extracted

```
┌─────────────────────────────────────────────────────────────────┐
│                       EXTRACT                                    │
├─────────────────────────────────────────────────────────────────┤
│  STANDALONE (always works)                                       │
│  ✓ Tables → CSV or markdown table                               │
│  ✓ Lists → numbered or bulleted                                 │
│  ✓ Contacts → name, email, role                                 │
│  ✓ Prices / numbers → structured list                           │
│  ✓ Dates / events → timeline format                             │
│  ✓ Any arbitrary structure → JSON                               │
├─────────────────────────────────────────────────────────────────┤
│  SUPERCHARGED (when tools are connected)                         │
│  + ~~knowledge base: save extracted data to Notion/Confluence   │
│  + ~~project tracker: create tickets from extracted action items │
│  + ~~spreadsheet: push table data directly to Google Sheets     │
└─────────────────────────────────────────────────────────────────┘
```

## Arguments

- `/chrome:extract table` — all tables on the page as markdown
- `/chrome:extract list` — all lists (ordered/unordered)
- `/chrome:extract contacts` — people mentioned with email/title/company
- `/chrome:extract prices` — all pricing, cost, or financial figures
- `/chrome:extract dates` — dates, deadlines, and event mentions
- `/chrome:extract json` — full structured JSON of key page entities

## Selection Mode

If the user has text selected before invoking, extract only from the selection.
Use `page.selection` as the target scope — do not process the full page.

## Output Format (table example)

```markdown
### Extracted: [Table Title or "Table 1"]
**Source**: [section heading this appeared under]

| Column A | Column B | Column C |
|----------|----------|----------|
| value    | value    | value    |

*[N rows extracted. Ambiguous values flagged with ?]*
```

## If Connectors Available

If **~~knowledge base** is connected:
- Offer to push extracted data to a new page or database entry

If **~~project tracker** is connected:
- For lists of tasks or action items, offer to create tickets in bulk

If **~~spreadsheet** is connected:
- Offer to push extracted tables directly to a Google Sheet or new tab
