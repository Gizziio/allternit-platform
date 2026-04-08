# Command: excel:model

## Trigger
"build a DCF model", "create a P&L", "set up a 3-statement model", "build a financial model", "create a budget template", "LBO model"

## Steps

Follow skills/financial-modeling.md sheet organization exactly.

1. **Confirm model type** — DCF, 3-statement, P&L, LBO, budget
2. **Create sheet structure**:
```javascript
await Excel.run(async (context) => {
  const wb = context.workbook;
  const sheetOrder = ["Cover", "Assumptions", "IS", "BS", "CFS", "Output", "Sensitivity"];

  for (const name of sheetOrder) {
    const existing = wb.worksheets.getItemOrNullObject(name);
    existing.load("isNullObject");
    await context.sync();
    if (existing.isNullObject) {
      wb.worksheets.add(name);
    }
  }
  await context.sync();

  // Tab colors
  const tabColors: Record<string, string> = {
    Cover:       "#2A1F16",
    Assumptions: "#0070C0",
    IS:          "#00B050",
    BS:          "#00B050",
    CFS:         "#00B050",
    Output:      "#B08D6E",
    Sensitivity: "#9A7658",
  };
  for (const [name, color] of Object.entries(tabColors)) {
    const sheet = wb.worksheets.getItemOrNullObject(name);
    sheet.load("isNullObject");
    await context.sync();
    if (!sheet.isNullObject) {
      sheet.tabColor = color;
    }
  }
  await context.sync();
});
```

3. **Populate Assumptions sheet** (blue font, all hardcoded inputs):
```javascript
await Excel.run(async (context) => {
  const sheet = context.workbook.worksheets.getItem("Assumptions");
  const inputs = [
    ["Assumption", "Value", "Units", "Source"],
    ["Revenue Growth Rate", 0.12, "%", "Management"],
    ["EBITDA Margin", 0.25, "%", "Historical avg"],
    ["Tax Rate", 0.21, "%", "Statutory"],
    ["Discount Rate (WACC)", 0.10, "%", "Calculated"],
    ["Terminal Growth Rate", 0.025, "%", "GDP growth"],
    ["CapEx % Revenue", 0.05, "%", "Historical avg"],
    ["NWC % Revenue", 0.08, "%", "Historical avg"],
  ];
  const range = sheet.getRange(`A1:D${inputs.length}`);
  range.values = inputs;
  range.getRow(0).format.font.bold = true;
  sheet.getRange("B2:B100").format.font.color = "#0070C0"; // blue = input
  sheet.getRange("B2:B100").numberFormat = [["0.0%"]];
  sheet.getUsedRange().format.autofitColumns();
  await context.sync();
});
```

4. **Build Income Statement with linked formulas**:
```javascript
// Year headers as text format
// All row formulas reference Assumptions sheet with green font
// Subtotals in black
```

5. **Add balance check**:
```javascript
// Per financial-modeling.md pattern
// Conditional format: red background if check ≠ 0
```

6. **Run validation checklist** after build:
   - No `#REF!`, `#DIV/0!`, `#VALUE!`, `#N/A` anywhere
   - Balance sheet balances
   - CFS ties to BS change in cash
   - All inputs in blue, cross-sheet links in green

## Output Format
- List sheets created with their purpose
- Highlight any assumptions pre-filled (user should verify)
- Flag: "Blue cells are your inputs — update Assumptions sheet to customize the model"
- Run balance check and report result
