# Cookbook: Data Pipeline

**Use case:** Scrape → transform → output pipelines. Extract structured data from multiple sources and produce clean, typed output in CSV, JSON, or delivered to a connector.

---

## Overview

```
[source pages] → extract → normalize → deduplicate → transform → validate → output
```

---

## Full Pipeline Template

### Phase 1: Source Collection

```
sources = [url1, url2, url3, ...]
all_items = []

for url in sources:
    navigate(url)
    wait for page load
    items = extract(mode="accessibility")
    all_items.extend(items)
    delay 500ms  ← respect rate limits
```

### Phase 2: Normalization (run_code)

```python
import json, re
from datetime import datetime

def normalize_price(raw):
    return float(re.sub(r'[^\d.]', '', raw))

def normalize_date(raw):
    # Try multiple formats
    for fmt in ["%B %d, %Y", "%m/%d/%Y", "%Y-%m-%d"]:
        try: return datetime.strptime(raw.strip(), fmt).isoformat()
        except: pass
    return raw

items = json.loads(raw_items)
normalized = [{
    "name": i["name"].strip(),
    "price": normalize_price(i.get("price", "0")),
    "date": normalize_date(i.get("date", "")),
    "url": i.get("url", "").strip(),
} for i in items]
```

### Phase 3: Deduplication

```python
seen = set()
deduped = []
for item in normalized:
    key = item.get("url") or item.get("name")
    if key not in seen:
        seen.add(key)
        deduped.append(item)
```

### Phase 4: Transformation

Apply any domain-specific transformations:
- Currency conversion
- Unit standardization
- Category mapping
- Score calculation

### Phase 5: Validation

```python
errors = []
for i, item in enumerate(deduped):
    if not item.get("name"): errors.append(f"Row {i}: missing name")
    if item.get("price", -1) < 0: errors.append(f"Row {i}: negative price")
if errors:
    print(f"Validation errors: {errors}")
    # Surface to user before outputting
```

### Phase 6: Output

```python
import csv, io, json

# JSON output
print(json.dumps(deduped, indent=2))

# CSV output
buf = io.StringIO()
writer = csv.DictWriter(buf, fieldnames=deduped[0].keys())
writer.writeheader()
writer.writerows(deduped)
print(buf.getvalue())
```

---

## Connector Output (when active)

If `~~file storage` connector active:
- Save JSON/CSV directly to connected storage
- Return download URL

If `~~database` connector active:
- Insert/upsert normalized rows
- Return affected row count

---

## Error Handling

| Phase | Error | Action |
|-------|-------|--------|
| Collection | Page load failure | Skip URL, log, continue |
| Collection | Rate limit (429) | Wait 30s, retry once |
| Normalization | Parse error | Keep raw value, flag field |
| Validation | Schema violation | Surface to user before output |
| Output | Write failure | Retry once, then report |
