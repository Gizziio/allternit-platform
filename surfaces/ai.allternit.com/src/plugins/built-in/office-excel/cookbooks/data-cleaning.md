# Cookbook: Clean a Messy Dataset

## Prerequisites
- A sheet with raw data (CSV import, paste from web, ERP export, etc.)
- At least one header row

---

## Step 1: Identify Issues

**Command**: `excel:analyze` → "analyze this sheet and tell me what data quality issues exist"

The plugin scans for:
- Blank rows
- Leading/trailing whitespace in text cells
- Inconsistent casing ("active" vs "Active" vs "ACTIVE")
- Mixed data types in a column (numbers stored as text)
- Duplicate rows
- Missing values in required columns

**Example output**:
```
Sheet: RawData (1,247 rows × 8 columns)
Issues found:
- 43 blank rows
- 127 cells with leading/trailing whitespace (columns B, D)
- Column E: 89% text "Active"/"Inactive" — 11% variant spellings
- 12 duplicate rows detected
- Column C (Revenue): 34 values stored as text (left-aligned)
```

---

## Step 2: Remove Blank Rows

**Command**: `excel:clean` → "remove all blank rows"

```javascript
// Scans every row, keeps only rows with at least one non-empty cell
// Rewrites the sheet in a single batch write (one context.sync)
// Reports: "Removed 43 blank rows. 1,204 rows remain."
```

**Verify**: Row count reduced by expected amount. No data rows accidentally removed.

---

## Step 3: Trim Whitespace

**Command**: `excel:clean` → "trim whitespace from all text cells"

```javascript
// Applies .trim() to all string values in-memory
// Writes back in batch
// "Trimmed 127 cells across columns B and D"
```

Alternative — use a helper column with TRIM formula before replacing:
```
=TRIM(B2)
```
Paste-as-values over the original column, then delete the helper column.

---

## Step 4: Normalize Text Casing

**Command**: `excel:clean` → "normalize column E to proper case"

Options:
- **Proper case** (Title Case): "active" → "Active"
- **Uppercase**: "active" → "ACTIVE"
- **Lowercase**: "ACTIVE" → "active"

For status/category columns, use proper case as standard.

```javascript
// Applies to specified column only
// "Normalized 1,204 cells in column E to proper case"
```

---

## Step 5: Fix Numbers Stored as Text

**Command**: `excel:formula` → "convert text numbers in column C to real numbers"

Signs that numbers are stored as text:
- Left-aligned in cell (numbers are right-aligned by default)
- Green triangle warning in corner of cells
- `SUM()` returns 0

Fix pattern — Value conversion formula:
```
=VALUE(TRIM(C2))
```
Or use `excel:clean` → "convert column C from text to numbers using VALUE()"

```javascript
// Reads column, applies parseFloat() in JS to each cell
// Writes back numeric values
// "Converted 34 text values to numbers in column C"
```

---

## Step 6: Remove Duplicates

**Command**: `excel:clean` → "remove duplicate rows"

```javascript
// Compares full row JSON fingerprint
// Keeps first occurrence, removes subsequent duplicates
// "Removed 12 duplicate rows. 1,192 unique rows remain."
```

If deduplication should be based on a single key column:
```
excel:clean → "remove duplicates based on column A (ID)"
```

---

## Step 7: Validate with Data Validation

**Command**: `excel:formula` / `excel:format` → "add validation to column E to only allow Active or Inactive"

```javascript
// Adds dropdown list validation with stop-style error alert
// Highlights any existing cells that don't match
```

See skills/data-validation.md for full patterns.

---

## Step 8: Final Quality Check

**Command**: `excel:analyze` → "re-analyze this sheet for remaining issues"

Expected output after cleaning:
```
Sheet: RawData (1,192 rows × 8 columns)
✓ No blank rows
✓ No whitespace issues
✓ Column E: 100% "Active" or "Inactive"
✓ Column C: all numeric
✓ No duplicates
Data quality: CLEAN
```

---

## Tips
- Always work on a copy of the original data (`Ctrl+C` the sheet tab → "Move or Copy" → check "Create a copy")
- Use Ctrl+Z immediately if a clean operation produces unexpected results
- For datasets >50,000 rows, clean in chunks: split by column rather than all at once
