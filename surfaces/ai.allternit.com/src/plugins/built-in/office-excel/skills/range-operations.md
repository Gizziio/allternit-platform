# Skill: Range Operations

## Trigger
Use this skill whenever reading from, writing to, resizing, or navigating Excel ranges.

## Key API Patterns

### Get Active Selection
```javascript
const range = context.workbook.getSelectedRange();
range.load(["address", "values", "formulas", "rowCount", "columnCount", "cellCount"]);
await context.sync();
```

### Get Used Range (data extent)
```javascript
const sheet = context.workbook.worksheets.getActiveWorksheet();
const usedRange = sheet.getUsedRange();
usedRange.load(["address", "values", "rowCount", "columnCount"]);
await context.sync();
```

### Write Values to Range
```javascript
const range = sheet.getRange("A1:C3");
range.values = [
  ["Name",  "Q1",    "Q2"],
  ["Alpha", 100,     120],
  ["Beta",  90,      110]
];
await context.sync();
```

### Write Formulas to Range
```javascript
range.formulas = [
  ["=SUM(B2:B10)"],
  ["=AVERAGE(B2:B10)"],
  ["=MAX(B2:B10)"]
];
// Always use the .formulas property for formulas, never .values
await context.sync();
```

### Resize a Range
```javascript
// Extend by 2 rows and 1 column
const resized = range.getResizedRange(2, 1);
```

### Offset (navigate relative to a range)
```javascript
// 1 row down, 0 columns right
const nextRow = range.getOffsetRange(1, 0);
```

### Get Last Cell in Column
```javascript
const lastCell = sheet.getRange("A1").getColumnAfter().getEntireColumn().getLastCell();
lastCell.load("address");
await context.sync();
```

### Get Surrounding Region (like Ctrl+Shift+*)
```javascript
const region = sheet.getRange("A1").getSurroundingRegion();
region.load(["address", "values"]);
await context.sync();
```

## Safety Rules
- Always call `range.load()` before reading `.values`, `.address`, `.rowCount`, etc.
- Always `await context.sync()` after loading
- Use `getItemOrNullObject()` when the range/sheet may not exist
- Never write more data than the target range can hold — check `rowCount`/`columnCount` first
