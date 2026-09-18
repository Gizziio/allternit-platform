# Skill: data-extraction

**Triggers:** "extract", "scrape", "get all", "list", "table", "prices", "names", "emails", "data", structured output requests

## Purpose

Extract structured data from web pages reliably across varying page structures, returning clean, typed output.

## Strategy Selection

```
if CSS selector known          → strategy: selector
else if semantic HTML present  → strategy: accessibility
else if plain text page        → strategy: text
else if image/canvas/PDF       → strategy: vision
```

## Accessibility Extraction (Default)

Use the accessibility tree to extract semantic content:
- `read_screen(mode="accessibility")` for full page tree
- `read_screen(mode="structured")` for JSON DOM outline
- Filter by role: `list`, `table`, `grid`, `article`, `region`
- Map roles to output schema fields

## Selector-Based Extraction

When a CSS selector is known or can be inferred:
```python
elements = page.query_selector_all(selector)
for el in elements:
    text = el.inner_text()
    href = el.get_attribute("href")
    # ... extract fields
```

Build selector inference rules:
- Product cards: `.product`, `.item`, `[data-product-id]`
- Price: `[class*="price"]`, `[itemprop="price"]`, `.cost`
- Table rows: `table tbody tr`, `[role="row"]`
- Articles: `article`, `.post`, `[role="article"]`

## Pagination Handling

If result count < expected or "next page" visible:
1. Extract current page
2. Check for `[aria-label="Next"]`, `.pagination .next`, `?page=N` pattern
3. Click next / increment URL param
4. Extract and merge
5. Repeat up to `max_pages` (default: 10)

## Output Normalization

Before returning:
- Trim whitespace from all string values
- Parse numbers: remove currency symbols, commas, spaces → `float`
- Parse dates: normalize to ISO 8601
- Deduplicate by primary key if detectable
- Flag missing/null fields

## Rate Limiting Respect

Between page requests:
- Add 500ms delay between pagination clicks (default)
- Do not parallelize requests (single session)
- Respect `robots.txt` if compliance mode is active

## Output Schema

```json
{
  "strategy": "accessibility",
  "url": "https://...",
  "extracted_at": "2026-04-22T09:00:00Z",
  "count": 42,
  "fields": ["name", "price", "rating"],
  "items": [
    { "name": "Product A", "price": 29.99, "rating": 4.5 },
    ...
  ],
  "truncated": false
}
```
