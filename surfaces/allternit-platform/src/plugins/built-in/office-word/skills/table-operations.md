# Skill: Table Operations (Word)

## Trigger
Use this skill when creating, reading, or modifying tables in a Word document.

## Create a Table
```javascript
await Word.run(async (context) => {
  const body = context.document.body;
  const table = body.insertTable(
    rowCount,     // number of rows including header
    columnCount,  // number of columns
    Word.InsertLocation.end,
    tableData     // 2D string array, or null for empty table
  );
  table.style = "Table Grid"; // or "Light List", "Medium Shading 1", etc.
  await context.sync();
  return { success: true };
});
```

## Populate Table from 2D Array
```javascript
await Word.run(async (context) => {
  const body = context.document.body;
  const table = body.insertTable(
    data.length,
    data[0].length,
    Word.InsertLocation.end,
    data  // string[][]
  );
  table.style = "Light List Accent 1";

  // Bold the header row
  const headerRow = table.rows.getFirst();
  headerRow.font.bold = true;
  headerRow.shadingColor = "#F5EDE3"; // sand-100

  await context.sync();
});
```

## Read Table Data
```javascript
await Word.run(async (context) => {
  const tables = context.document.body.tables;
  tables.load("items");
  await context.sync();

  if (tables.items.length === 0) return { tables: [] };

  const table = tables.items[tableIndex]; // 0 = first table
  table.load("rowCount,columnCount");
  await context.sync();

  const rows = table.rows;
  rows.load("items/cells");
  await context.sync();

  const tableData: string[][] = [];
  for (const row of rows.items) {
    row.cells.load("items/value");
    await context.sync();
    tableData.push(row.cells.items.map(c => c.value));
  }

  return { rowCount: table.rowCount, columnCount: table.columnCount, data: tableData };
});
```

## Add a Row to an Existing Table
```javascript
await Word.run(async (context) => {
  const tables = context.document.body.tables;
  tables.load("items");
  await context.sync();

  const table = tables.items[tableIndex];
  table.addRow(Word.InsertLocation.end, rowValues); // string[]
  await context.sync();
});
```

## Style a Table
```javascript
// Word table styles reference (common):
"Table Grid"              // basic borders
"Light List"              // light gray shading on header
"Light List Accent 1"     // blue accent header
"Medium Shading 1"        // medium gray
"Medium Grid 1"           // grid with medium lines
"Dark List"               // dark header row

// Apply:
table.style = "Light List";
table.styleFirstColumn = false;
table.styleBandedRows = true;
await context.sync();
```

## Set Column Widths
```javascript
await Word.run(async (context) => {
  const tables = context.document.body.tables;
  tables.load("items");
  await context.sync();

  const table = tables.items[tableIndex];
  table.load("columns");
  await context.sync();

  // Set width in points (72pt = 1 inch)
  const colWidths = [80, 150, 200, 120]; // example widths
  for (let i = 0; i < colWidths.length; i++) {
    const col = table.columns.getItem(i);
    col.load("cells");
    await context.sync();
    col.cells.items.forEach(cell => { cell.columnWidth = colWidths[i]; });
  }
  await context.sync();
});
```

## Safety Rules
- Table data passed to `insertTable` must be `string[][]` — convert all numbers/dates to strings first
- `tables.items` is 0-indexed; `tables.items[0]` is the first table in reading order
- Always load `items` on the tables collection before accessing by index
- Column width API requires loading cells — it's not a direct column property
- Word table styles are locale-sensitive in the UI but English in code
