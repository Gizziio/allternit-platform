# Command: excel:analyze

Analyze the active sheet or a selected range and return a structured summary of the data.

## Triggers

- "analyze this sheet"
- "what's in this range"
- "summarize this data"
- "what does this data look like"
- "describe this spreadsheet"
- "give me an overview of this range"

## Steps

1. **Get the active sheet** — resolve the currently active worksheet context.
2. **Get the used range** — if no selection, use `sheet.getUsedRange()`; if a selection is active, use the selected address.
3. **Read values and formulas** — load `.values`, `.formulas`, `.numberFormat`, and `.address` from the range.
4. **Identify patterns** — scan each column for:
   - Data type (number, text, date, boolean, empty)
   - Presence of formulas vs. raw values
   - Outliers (values > 2 standard deviations from the mean for numeric columns)
   - Empty rows or columns
   - Duplicate rows
5. **Respond with a structured summary** — return bullet-point stats and a column-by-column breakdown.

## Office.js Code Pattern

```typescript
await Excel.run(async (context) => {
  const sheet = context.workbook.worksheets.getActiveWorksheet();
  const range = sheet.getUsedRange();

  range.load(["values", "formulas", "numberFormat", "address", "rowCount", "columnCount"]);
  await context.sync();

  const { values, formulas, rowCount, columnCount, address } = range;

  // Detect data shape per column
  const columnStats = [];
  for (let col = 0; col < columnCount; col++) {
    const header = values[0]?.[col] ?? `Column ${col + 1}`;
    const cells = values.slice(1).map((row) => row[col]);

    const types = new Set<string>();
    const numerics: number[] = [];
    let emptyCount = 0;
    let formulaCount = 0;

    cells.forEach((cell, rowIdx) => {
      if (cell === null || cell === "") {
        emptyCount++;
      } else if (typeof cell === "number") {
        types.add("number");
        numerics.push(cell as number);
      } else if (typeof cell === "boolean") {
        types.add("boolean");
      } else if (typeof cell === "string") {
        // Attempt date detection via numberFormat
        types.add("text");
      }
      if (formulas[rowIdx + 1]?.[col]?.toString().startsWith("=")) {
        formulaCount++;
      }
    });

    // Outlier detection for numeric columns
    let outliers: number[] = [];
    if (numerics.length > 2) {
      const mean = numerics.reduce((a, b) => a + b, 0) / numerics.length;
      const stdDev = Math.sqrt(
        numerics.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / numerics.length
      );
      outliers = numerics.filter((v) => Math.abs(v - mean) > 2 * stdDev);
    }

    columnStats.push({
      header,
      types: Array.from(types),
      emptyCount,
      formulaCount,
      min: numerics.length ? Math.min(...numerics) : null,
      max: numerics.length ? Math.max(...numerics) : null,
      avg: numerics.length
        ? numerics.reduce((a, b) => a + b, 0) / numerics.length
        : null,
      outlierCount: outliers.length,
    });
  }

  return {
    address,
    rowCount,
    columnCount,
    dataRows: rowCount - 1, // exclude header
    columnStats,
  };
});
```

## Output Format

Return a structured bullet summary:

```
Range: A1:F120
Rows: 120 (119 data rows + 1 header)
Columns: 6

Column breakdown:
- A (Date): text/date, 0 empty, 0 formulas
- B (Revenue): number, 2 empty, 119 formulas, min: 1200, max: 94500, avg: 42318, outliers: 3
- C (Expenses): number, 0 empty, 119 formulas, min: 800, max: 71000, avg: 31200, outliers: 1
- D (Region): text, 0 empty, 0 formulas
- E (Sales Rep): text, 4 empty, 0 formulas
- F (Margin %): number, 2 empty, 119 formulas, min: 0.12, max: 0.68, avg: 0.34, outliers: 2

Notable findings:
- Column B has 3 outlier values that may warrant review
- Column E (Sales Rep) has 4 blank cells
- All numeric columns are formula-driven
```

## Notes

- If the sheet is empty, report that and suggest the user select a range or import data.
- For very large ranges (>10,000 rows), sample every 10th row to avoid timeout and note the sampling in the output.
- Dates stored as serial numbers will appear as numbers; mention this if the numberFormat suggests date formatting.
