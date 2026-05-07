# Command: excel:table

Create a new Excel table from a range, or modify an existing table (add columns, sort, filter).

## Triggers

- "make this a table"
- "convert to table"
- "add a column to this table"
- "sort by X"
- "filter to show only Y"
- "create a table from this data"
- "remove duplicates from table"

## Steps

1. **Detect if a table already exists** — check if the selected range or used range overlaps with an existing table using `sheet.tables`.
2. **Create or modify**:
   - If no table exists: create one with `sheet.tables.add()` using the detected range with headers.
   - If a table exists: modify it based on the user's request (add column, sort, filter).
3. **Apply style** — use `TableStyleMedium2` as the default style for new tables.
4. **Return table name** — respond with the assigned table name for future reference.

## Office.js Code Pattern — Create Table

```typescript
await Excel.run(async (context) => {
  const sheet = context.workbook.worksheets.getActiveWorksheet();

  // Check for existing tables in the used range
  const usedRange = sheet.getUsedRange();
  usedRange.load("address");
  sheet.tables.load("items");
  await context.sync();

  const existingTables = sheet.tables.items;
  if (existingTables.length > 0) {
    // Table already exists — return its name
    return { action: "exists", tableName: existingTables[0].name };
  }

  // Create a new table
  const table = sheet.tables.add(usedRange.address, /* hasHeaders */ true);
  table.name = "DataTable";
  table.style = "TableStyleMedium2";

  await context.sync();

  return { action: "created", tableName: table.name };
});
```

## Office.js Code Pattern — Add a Calculated Column

```typescript
await Excel.run(async (context) => {
  const sheet = context.workbook.worksheets.getActiveWorksheet();
  const table = sheet.tables.getItemAt(0);

  // Add a new column at the end
  const newColumn = table.columns.add(
    -1, // -1 = append at end
    null,
    "Margin %" // header name
  );

  // Set the formula for the entire column body
  const bodyRange = newColumn.getDataBodyRange();
  bodyRange.formulas = bodyRange.getResizedRange(0, 0).values.map(() => [
    "=[@Revenue]-[@Expenses]",
  ]);

  await context.sync();

  return { columnName: newColumn.name };
});
```

## Office.js Code Pattern — Sort Table

```typescript
await Excel.run(async (context) => {
  const sheet = context.workbook.worksheets.getActiveWorksheet();
  const table = sheet.tables.getItemAt(0);
  table.columns.load("items");
  await context.sync();

  // Find the column index by name
  const columnName = "Revenue"; // from user request
  const colIndex = table.columns.items.findIndex((c) => c.name === columnName);

  if (colIndex === -1) {
    throw new Error(`Column "${columnName}" not found in table.`);
  }

  table.sort.apply([
    {
      key: colIndex,
      ascending: false, // descending — largest first
    },
  ]);

  await context.sync();
});
```

## Office.js Code Pattern — Apply AutoFilter

```typescript
await Excel.run(async (context) => {
  const sheet = context.workbook.worksheets.getActiveWorksheet();
  const table = sheet.tables.getItemAt(0);
  table.columns.load("items");
  await context.sync();

  // Filter to show only rows where "Region" === "North"
  const regionColIndex = table.columns.items.findIndex((c) => c.name === "Region");
  const autoFilter = table.autoFilter;

  autoFilter.apply(table.getRange(), regionColIndex, {
    criterion1: "North",
    filterOn: Excel.FilterOn.values,
  });

  await context.sync();
});
```

## Notes

- Default style is `TableStyleMedium2`. For financial/dark themes, use `TableStyleDark1` or `TableStyleMedium9`.
- When creating a table, always pass `hasHeaders: true` unless the first row is confirmed to be data (no headers).
- Table names must be unique within the workbook and cannot contain spaces — use CamelCase or underscores (e.g., `SalesData`, `Revenue_2025`).
- Sort operations are permanent (they reorder the underlying data). Warn the user before sorting if the data has no unique ID column, as the original order cannot be recovered.
- AutoFilter clears existing filters on the table before applying new ones.
