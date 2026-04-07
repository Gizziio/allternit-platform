# Command: excel:format

## Trigger
"format as currency", "highlight negatives in red", "apply financial formatting", "make headers bold", "color code inputs", "format as percentage", "apply Allternit styling"

## Steps

1. **Detect selection**
```javascript
await Excel.run(async (context) => {
  const range = context.workbook.getSelectedRange();
  range.load("address,rowCount,columnCount,values,numberFormat");
  await context.sync();
  return {
    address: range.address,
    sampleValue: range.values[0]?.[0],
    currentFormat: range.numberFormat[0]?.[0],
  };
});
```

2. **Apply number format** based on intent:
```javascript
await Excel.run(async (context) => {
  const sheet = context.workbook.worksheets.getActiveWorksheet();
  const range = sheet.getRange(targetAddress);

  // Map user intent → format string
  const formatMap: Record<string, string> = {
    currency:     "$#,##0",
    currencyMM:   '$#,##0.0,,',         // in $mm
    percentage:   "0.0%",
    multiple:     "0.0x",
    integer:      "#,##0",
    date:         "mmm-yy",
    zeroAsDash:   '_($* #,##0_);_($* (#,##0);_($* "-"_);_(@_)',
    negative:     "(#,##0)",
  };

  range.numberFormat = [[formatMap[formatType]]];
  await context.sync();
});
```

3. **Apply color coding** (financial standard):
```javascript
await Excel.run(async (context) => {
  const sheet = context.workbook.worksheets.getActiveWorksheet();

  if (colorCoding === "financial") {
    // Blue — hardcoded inputs
    sheet.getRange(inputsRange).format.font.color = "#0070C0";
    // Green — cross-sheet links (formulas with sheet references)
    sheet.getRange(linksRange).format.font.color = "#00B050";
    // Black — all other formulas
    sheet.getRange(formulasRange).format.font.color = "#000000";
  }

  if (colorCoding === "allternit") {
    // Headers: sand-900 bold
    sheet.getRange(headersRange).format.font.color = "#2A1F16";
    sheet.getRange(headersRange).format.font.bold = true;
    sheet.getRange(headersRange).format.fill.color = "#F5EDE3";
    // Data: sand-900
    sheet.getRange(dataRange).format.font.color = "#2A1F16";
  }

  await context.sync();
});
```

4. **Conditional format for negatives**:
```javascript
await Excel.run(async (context) => {
  const range = sheet.getRange(targetAddress);
  const cf = range.conditionalFormats.add(Excel.ConditionalFormatType.cellValue);
  cf.cellValue.format.font.color = "#C00000"; // dark red
  cf.cellValue.rule = {
    formula1: "0",
    operator: Excel.ConditionalCellValueOperator.lessThan
  };
  await context.sync();
});
```

5. **Autofit columns**:
```javascript
sheet.getUsedRange().format.autofitColumns();
await context.sync();
```

## Output Format
- Confirm format applied and range affected
- If financial color coding applied, list which ranges got which colors
- Offer next step: "Say 'highlight negatives' to add red conditional formatting"
