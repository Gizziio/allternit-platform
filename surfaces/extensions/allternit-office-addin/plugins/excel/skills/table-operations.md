# Skill: Table Operations (ListObject API)

## Trigger
Use this skill when creating, modifying, filtering, or sorting Excel tables.

## Creating a Table
```javascript
await Excel.run(async (context) => {
  const sheet = context.workbook.worksheets.getActiveWorksheet();
  const range = sheet.getRange("A1:D10");
  const table = sheet.tables.add(range, true); // true = has headers
  table.name = "SalesData";
  table.style = "TableStyleMedium2";  // professional default
  await context.sync();
  return { success: true, tableName: "SalesData" };
});
```

## Table Styles Reference
- Light: `TableStyleLight1` through `TableStyleLight21`
- Medium: `TableStyleMedium1` through `TableStyleMedium28`
- Dark: `TableStyleDark1` through `TableStyleDark11`

## Adding Rows to a Table
```javascript
const table = sheet.tables.getItem("SalesData");
table.rows.add(null, [["New Product", 500, 0.15, "Active"]]);
// null = append to end; use index to insert at specific position
await context.sync();
```

## Adding a Column with a Formula
```javascript
const table = sheet.tables.getItem("SalesData");
const newCol = table.columns.add(null, null, "Total");
// Set formula for entire column (Excel will auto-apply to all rows)
const bodyRange = newCol.getDataBodyRange();
bodyRange.formulas = [["=[@Units]*[@Price]"]];  // structured reference
await context.sync();
```

## Sorting a Table
```javascript
const table = sheet.tables.getItem("SalesData");
table.sort.apply([{
  key: 2,          // column index (0-based)
  ascending: false
}]);
await context.sync();
```

## Auto-Filter by Value
```javascript
const table = sheet.tables.getItem("SalesData");
table.autoFilter.apply(sheet.getRange("A1:D10"), 3, {
  criterion1: "Active",
  filterOn: Excel.FilterOn.values
});
await context.sync();
```

## Converting Table Back to Range
```javascript
const table = sheet.tables.getItem("SalesData");
table.convertToRange();
await context.sync();
```

## Reading Table Data
```javascript
const table = sheet.tables.getItem("SalesData");
const bodyRange = table.getDataBodyRange();
bodyRange.load("values");
await context.sync();
const data = bodyRange.values; // 2D array of all data rows
```

## Safety Rules
- Use `getItemOrNullObject("TableName")` when the table may not exist
- Check `table.isNullObject` after sync before operating
- Table names must be unique in the workbook
- Column names in structured references are case-sensitive
