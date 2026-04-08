# Skill: Cell Formatting

## Trigger
Use this skill when applying number formats, fonts, fills, borders, or conditional formatting.

## Number Format Patterns
```javascript
range.numberFormat = [["$#,##0.00"]];          // currency
range.numberFormat = [["0.0%"]];               // percentage (1 decimal)
range.numberFormat = [["#,##0"]];              // integer with comma separator
range.numberFormat = [["0.0x"]];               // multiples (1.5x, 2.3x)
range.numberFormat = [["mmm-yy"]];             // date as "Jan-24"
range.numberFormat = [["yyyy"]];               // year as "2024" (text-like)
// Zeros as dashes (financial convention):
range.numberFormat = [['_($* #,##0_);_($* (#,##0);_($* "-"_);_(@_)']];
```

Note: `numberFormat` takes a 2D array matching the range dimensions, or a single value applied to all cells.

## Financial Model Color Coding (from tfriedel/claude-office-skills)
```javascript
// Blue — user inputs / hardcoded values
inputRange.format.font.color = "#0070C0";

// Black — formulas and calculations (default, but set explicitly)
formulaRange.format.font.color = "#000000";

// Green — cross-sheet links
linkRange.format.font.color = "#00B050";

// Red — external file links
externalRange.format.font.color = "#FF0000";

// Yellow background — key assumptions
assumptionRange.format.fill.color = "#FFFF00";
```

## Font Formatting
```javascript
range.format.font.bold = true;
range.format.font.italic = false;
range.format.font.size = 11;
range.format.font.name = "Calibri";
range.format.font.color = "#1F2937";
range.format.font.underline = Excel.RangeUnderlineStyle.single;
```

## Fill (Background)
```javascript
range.format.fill.color = "#F5EDE3";  // sand-100 (Allternit)
range.format.fill.clear();             // remove fill
```

## Borders
```javascript
// All borders
range.format.borders.getItem("EdgeBottom").style = Excel.BorderLineStyle.continuous;
range.format.borders.getItem("EdgeBottom").color = "#D4BFA8";
range.format.borders.getItem("EdgeBottom").weight = Excel.BorderWeight.thin;

// Border items: EdgeTop, EdgeBottom, EdgeLeft, EdgeRight, InsideHorizontal, InsideVertical
```

## Alignment
```javascript
range.format.horizontalAlignment = Excel.HorizontalAlignment.right;   // numbers
range.format.horizontalAlignment = Excel.HorizontalAlignment.left;    // text
range.format.horizontalAlignment = Excel.HorizontalAlignment.center;  // headers
range.format.verticalAlignment = Excel.VerticalAlignment.center;
range.format.wrapText = true;
```

## Column Width / Row Height
```javascript
sheet.getRange("A:A").format.columnWidth = 150;
sheet.getRange("1:1").format.rowHeight = 20;
sheet.getUsedRange().format.autofitColumns();
sheet.getUsedRange().format.autofitRows();
```

## Merge Cells (use sparingly — breaks table operations)
```javascript
const mergeRange = sheet.getRange("A1:D1");
mergeRange.merge(true); // true = merge across (each row merged separately)
```

## Conditional Formatting
```javascript
const cfRange = sheet.getRange("B2:B20");

// Color scale (low=red, mid=yellow, high=green)
const colorScale = cfRange.conditionalFormats.add(
  Excel.ConditionalFormatType.colorScale
);
colorScale.colorScale.criteria = {
  minimum: { formula: null, type: Excel.ConditionalFormatColorCriterionType.lowestValue, color: "#FF0000" },
  midpoint: { formula: "50", type: Excel.ConditionalFormatColorCriterionType.percentile, color: "#FFFF00" },
  maximum: { formula: null, type: Excel.ConditionalFormatColorCriterionType.highestValue, color: "#00B050" }
};

// Data bar
const dataBar = cfRange.conditionalFormats.add(Excel.ConditionalFormatType.dataBar);
dataBar.dataBar.barFillType = Excel.ConditionalDataBarFillType.gradient;
dataBar.dataBar.barDirection = Excel.ConditionalDataBarDirection.leftToRight;
dataBar.dataBar.positiveFormat.fillColor = "#B08D6E";
await context.sync();
```
