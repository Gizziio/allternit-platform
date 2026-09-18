# Cookbook: Invoice Processing

**Use case:** Navigate to invoice portals, download invoices, extract line items, and organize them — inspired by Skyvern's most popular workflow.

---

## Overview

```
login → navigate to invoices → list → download/extract → parse line items → output
```

---

## Step-by-Step

### 1. Authenticate

Follow [login-flow](./login-flow.md) cookbook for the billing portal.

Common portals: Stripe, QuickBooks, Xero, FreshBooks, SAP, NetSuite, vendor billing pages.

### 2. Navigate to Invoices

```
# Try standard paths first
common_paths = ["/invoices", "/billing", "/billing/invoices", "/payments/history"]

for path in common_paths:
    navigate(base_url + path)
    if "invoice" in read_screen(mode="text").lower():
        break
else:
    # Search via a11y tree
    find_element("Invoices", strategy="text") → click
```

### 3. List Available Invoices

```
read_screen(mode="accessibility")
# Look for: table with Date, Amount, Status, Download columns
# Or: list of invoice cards with amount and period

extract(mode="structured")
# → invoice list with IDs, dates, amounts, status, download links
```

Apply date filter if specified:
```
if date_range:
    find_element("Date range filter") → interact
    set start/end dates
    apply filter
```

### 4. Download / Extract Each Invoice

#### For downloadable PDFs:
```
for invoice in invoice_list:
    click(invoice.download_link)
    # Playwright intercepts download
    save to local path or ~~file storage
```

#### For web-only invoice views:
```
for invoice in invoice_list:
    navigate(invoice.detail_url)
    screenshot()               ← capture for records
    extract(mode="text")       ← extract line items
    parse_invoice_text(raw)    ← via run_code
```

### 5. Parse Line Items (run_code)

```python
import re, json

def parse_invoice(text):
    lines = text.split('\n')
    items = []
    for line in lines:
        # Match: description | quantity | unit price | total
        m = re.match(r'(.+?)\s+(\d+)\s+\$?([\d,\.]+)\s+\$?([\d,\.]+)', line)
        if m:
            items.append({
                "description": m.group(1).strip(),
                "quantity": int(m.group(2)),
                "unit_price": float(m.group(3).replace(',','')),
                "total": float(m.group(4).replace(',',''))
            })
    return items

invoices = [{"id": "INV-001", "items": parse_invoice(raw_text)}]
print(json.dumps(invoices, indent=2))
```

### 6. Output

```json
{
  "invoices": [
    {
      "id": "INV-2026-001",
      "date": "2026-04-01",
      "vendor": "Stripe",
      "total_usd": 299.00,
      "status": "paid",
      "line_items": [
        { "description": "Platform fee - April", "quantity": 1, "unit_price": 299.00, "total": 299.00 }
      ],
      "pdf_path": "/invoices/INV-2026-001.pdf"
    }
  ],
  "total_extracted": 12,
  "date_range": "2026-01-01 to 2026-04-30"
}
```

---

## Approval Gate

Before downloading multiple invoices: show count and total amount, ask for confirmation.
