# Command: excel:formula

Insert a new formula or fix an existing broken formula in the selected cell or range.

## Triggers

- "write a formula for"
- "fix this formula"
- "calculate X"
- "create a formula that"
- "what formula should I use for"
- "formula to sum / average / count / lookup"

## Steps

1. **Understand intent** — parse what the user wants to calculate (sum, average, lookup, conditional, financial, etc.).
2. **Check selected range** — load the current selection address; if nothing is selected, default to the active cell.
3. **Generate formula** — use patterns from `skills/formula-generation.md`. Choose the appropriate function family:
   - Aggregation: SUM, AVERAGE, COUNT, COUNTA, COUNTIF, SUMIF, AVERAGEIF
   - Lookup: VLOOKUP, XLOOKUP, INDEX/MATCH
   - Logical: IF, IFS, SWITCH, AND, OR
   - Text: CONCAT, TEXTJOIN, LEFT, RIGHT, MID, TRIM, UPPER, LOWER
   - Date: TODAY, NOW, DATEDIF, EOMONTH, WORKDAY
   - Financial: NPV, IRR, PMT, PV, FV
4. **Wrap in IFERROR** — always wrap in `IFERROR(formula, "")` or `IFERROR(formula, 0)` unless the user explicitly opts out.
5. **Insert via `.formulas` property** — write the formula string to the range.
6. **Validate** — after writing, re-read the cell value to confirm it resolved (not `#NAME?`, `#REF!`, etc.).

## Zero-Error Rules

1. Test the formula logic in cell A1 of a scratch context first when uncertain.
2. Never write a formula that references its own cell (circular reference).
3. Use absolute references (`$A$1`) for lookup tables; relative references for ranges that extend down.
4. Always check that named ranges referenced in the formula exist on the sheet before inserting.

## Office.js Code Pattern

```typescript
await Excel.run(async (context) => {
  const sheet = context.workbook.worksheets.getActiveWorksheet();

  // Get the selected range (or fallback to active cell)
  const selection = context.workbook.getSelectedRange();
  selection.load(["address", "values"]);
  await context.sync();

  const targetAddress = selection.address;
  const targetRange = sheet.getRange(targetAddress);

  // Example: insert a SUMIF formula with IFERROR wrapper
  const formula = `=IFERROR(SUMIF($B$2:$B$100,"Criteria",$C$2:$C$100),0)`;
  targetRange.formulas = [[formula]];

  await context.sync();

  // Validate: re-read the computed value
  targetRange.load(["values"]);
  await context.sync();

  const computedValue = targetRange.values[0][0];

  // Check for error strings
  const errorIndicators = ["#NAME?", "#REF!", "#VALUE!", "#DIV/0!", "#N/A", "#NUM!", "#NULL!"];
  const hasError = typeof computedValue === "string" && errorIndicators.includes(computedValue);

  if (hasError) {
    // Roll back: clear the formula
    targetRange.clear(Excel.ClearApplyTo.contents);
    await context.sync();
    throw new Error(`Formula resolved to error: ${computedValue}. Check source ranges and try again.`);
  }

  return { address: targetAddress, formula, value: computedValue };
});
```

## Extending a Formula Down a Column

```typescript
// After verifying the formula in the first row, extend it down
await Excel.run(async (context) => {
  const sheet = context.workbook.worksheets.getActiveWorksheet();
  const usedRange = sheet.getUsedRange();
  usedRange.load("rowCount");
  await context.sync();

  const dataRows = usedRange.rowCount - 1; // exclude header
  const formulaRange = sheet.getRange(`D2:D${dataRows + 1}`);

  // Fill down using the same formula with relative row reference
  const formulas = Array.from({ length: dataRows }, (_, i) => [
    `=IFERROR(SUMIF($B$2:$B$100,A${i + 2},$C$2:$C$100),0)`,
  ]);
  formulaRange.formulas = formulas;

  await context.sync();
});
```

## Common Formula Patterns

| Intent | Formula Pattern |
|--------|----------------|
| Sum if condition | `=IFERROR(SUMIF(range,criteria,sum_range),0)` |
| Lookup with fallback | `=IFERROR(XLOOKUP(value,lookup,return,"Not found"),"-")` |
| Year-over-year growth | `=IFERROR((B2-B1)/B1,0)` |
| Conditional category | `=IFS(A2>1000,"High",A2>500,"Mid",TRUE,"Low")` |
| Days between dates | `=DATEDIF(A2,B2,"D")` |
| Running total | `=SUM($C$2:C2)` |

## Notes

- When fixing a broken formula, first load the current `.formulas` value of the cell and show the user what was there before replacing it.
- If the user asks to "fix" without specifying what is wrong, run `excel:analyze` on the range first to identify the error type.
- Prefer XLOOKUP over VLOOKUP for new workbooks (available in Excel 365+); use VLOOKUP only if compatibility with older Excel versions is needed.
