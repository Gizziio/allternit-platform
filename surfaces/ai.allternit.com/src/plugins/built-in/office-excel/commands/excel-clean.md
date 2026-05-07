# Command: excel:clean

## Trigger
"clean this data", "remove duplicates", "trim whitespace", "normalize this column", "remove blank rows", "fix inconsistent formatting", "standardize dates"

## Steps

1. **Read the data range**
```javascript
await Excel.run(async (context) => {
  const sheet = context.workbook.worksheets.getActiveWorksheet();
  const usedRange = sheet.getUsedRange();
  usedRange.load("address,values,rowCount,columnCount");
  await context.sync();
  return {
    address: usedRange.address,
    values: usedRange.values,
    rowCount: usedRange.rowCount,
    colCount: usedRange.columnCount,
  };
});
```

2. **Detect issues**:
   - Count blank rows: `row.every(v => v === "" || v === null)`
   - Detect leading/trailing whitespace: `typeof v === "string" && v !== v.trim()`
   - Find duplicate rows: compare JSON.stringify of each row
   - Check inconsistent casing: mixed "active" / "Active" / "ACTIVE"

3. **Clean values in memory, write back in one batch**:
```javascript
await Excel.run(async (context) => {
  const sheet = context.workbook.worksheets.getActiveWorksheet();
  const usedRange = sheet.getUsedRange();
  usedRange.load("values,rowCount,columnCount");
  await context.sync();

  const raw = usedRange.values as any[][];
  const cleaned: any[][] = [];
  const removedRows: number[] = [];

  for (let r = 0; r < raw.length; r++) {
    const row = raw[r];
    const isBlank = row.every(v => v === "" || v === null);
    if (isBlank) { removedRows.push(r); continue; }

    const cleanRow = row.map(v => {
      if (typeof v === "string") return v.trim(); // trim whitespace
      return v;
    });
    cleaned.push(cleanRow);
  }

  // Write cleaned data back — resize range to match cleaned row count
  const newRange = sheet.getRange(`A1:${colLetter}${cleaned.length}`);
  newRange.values = cleaned;

  // Clear any leftover rows below cleaned data
  if (removedRows.length > 0) {
    const clearRange = sheet.getRange(`A${cleaned.length + 1}:${colLetter}${raw.length}`);
    clearRange.clear(Excel.ClearApplyTo.contents);
  }

  await context.sync();
  return {
    originalRows: raw.length,
    cleanedRows: cleaned.length,
    blankRowsRemoved: removedRows.length,
  };
});
```

4. **Normalize text casing** (if requested):
```javascript
// Options: "proper" (Title Case), "upper", "lower"
const normalize = (v: any, mode: string) => {
  if (typeof v !== "string") return v;
  if (mode === "upper") return v.toUpperCase();
  if (mode === "lower") return v.toLowerCase();
  if (mode === "proper") return v.replace(/\b\w/g, c => c.toUpperCase());
  return v;
};
```

5. **Remove duplicates** — keep first occurrence:
```javascript
const seen = new Set<string>();
const deduped = raw.filter((row, i) => {
  if (i === 0) return true; // keep header
  const key = JSON.stringify(row);
  if (seen.has(key)) return false;
  seen.add(key);
  return true;
});
```

## Output Format
- Report: rows processed, blank rows removed, duplicates removed, cells trimmed
- If normalization applied, state which columns and which case mode
- Show before/after row count
- Flag: "Original data replaced — use Ctrl+Z to undo if needed"
