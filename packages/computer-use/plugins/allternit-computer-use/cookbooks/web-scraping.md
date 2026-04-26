# Cookbook: Web Scraping

**Use case:** Extract structured data from any website — product listings, search results, directories, tables, pricing pages.

---

## Overview

```
navigate → read structure → extract items → paginate → normalize → output
```

---

## Step-by-Step

### 1. Navigate and Assess

```
navigate(url)
screenshot()                    ← observe what's there
read_screen(mode="structured")  ← understand the page layout
```

Look for:
- Table structure → use selector strategy with `table tbody tr`
- Card/grid layout → infer card selector from a11y tree
- List structure → `ul li`, `ol li`, `[role="list"] [role="listitem"]`
- Pagination → check for `.pagination`, `[aria-label="Next page"]`, URL `?page=N`

### 2. Define Extraction Schema

Based on the page structure, define what fields to extract:
```
Items to extract: name, price, url, rating, availability
Strategy: accessibility (default) or selector (if cards have consistent class)
```

### 3. Extract Current Page

```
extract(session_id, mode="accessibility")
```

For selector-based:
```
find_element(session_id, description=".product-card", strategy="selector")
```

### 4. Handle Pagination

```python
while has_next_page:
    extract current page items
    find "Next" button or increment page param
    navigate to next page
    wait for new content to load
    repeat (up to max_pages=10 default)
```

Pagination patterns:
- **Button:** `find_element("Next page", strategy="text")` → `click(selector)`
- **URL param:** replace `?page=N` → `navigate(url_with_next_page)`
- **Infinite scroll:** `scroll(direction="down", amount=10)` → wait 1s → check for new items

### 5. Normalize Output

```python
# via run_code
import json
items = [...]
# Normalize prices: "$1,299.00" → 1299.00
# Normalize dates: "Apr 22, 2026" → "2026-04-22"
# Deduplicate by URL or ID
# Sort by specified field
print(json.dumps(items, indent=2))
```

### 6. Output

Return as JSON (default), CSV, or Markdown table based on user preference.

---

## Common Selector Patterns

| Data type | Likely selectors |
|-----------|-----------------|
| Products | `.product-card`, `[data-product-id]`, `article.item` |
| Prices | `[class*="price"]`, `[itemprop="price"]`, `.cost`, `.amount` |
| Job listings | `.job-card`, `[data-job-id]`, `.position-row` |
| News articles | `article`, `.story`, `.post-card`, `[role="article"]` |
| Table data | `table tbody tr td` |
| Search results | `#search-results li`, `.result-item` |

---

## Policy Notes

- Respect `robots.txt` if operator compliance mode is active
- Default 500ms delay between paginated requests
- Max 1000 items per run unless explicitly overridden
- Do not scrape content behind login without explicit user authorization
