# Command: word:table

## Trigger
"create a table", "add a table with X columns", "insert a comparison table", "make this list a table", "add a 3-column table"

## Steps

1. **Determine table structure from user intent**
   - Parse: row count, column count, headers, and data from user message
   - If user provides list data: convert to rows/columns
   - Default: 3 columns × 5 rows if no specifics given

2. **Get insertion point**
```javascript
await Word.run(async (context) => {
  const selection = context.document.getSelection();
  selection.load("text");
  await context.sync();
  return { hasSelection: !!selection.text.trim() };
});
```

3. **Create table** using table-operations skill:
```javascript
await Word.run(async (context) => {
  const body = context.document.body;

  // Convert user data to string[][]
  const tableData: string[][] = [
    headers,      // e.g. ["Feature", "Basic Plan", "Pro Plan"]
    ...dataRows,  // e.g. [["Storage", "5 GB", "100 GB"], ...]
  ];

  const table = body.insertTable(
    tableData.length,
    tableData[0].length,
    Word.InsertLocation.end,
    tableData
  );

  table.style = "Light List Accent 1";

  // Bold header row
  const headerRow = table.rows.getFirst();
  headerRow.font.bold = true;
  headerRow.shadingColor = "#F5EDE3"; // sand-100

  await context.sync();
  return { success: true, rows: tableData.length, cols: tableData[0].length };
});
```

4. **Handle "make this list a table"** — parse selected text:
```javascript
// Convert bullet list to table
// Input: "- Item A\n- Item B\n- Item C"
// Output: 3-row × 1-column table, or prompt for columns
const lines = selectedText.split("\n")
  .map(l => l.replace(/^[-•*]\s*/, "").trim())
  .filter(Boolean);
const tableData = lines.map(line => [line]);
```

## Table Style Recommendations
| Use case | Style |
|---|---|
| Clean data table | `"Light List"` |
| Comparison table | `"Light List Accent 1"` |
| Feature matrix | `"Medium Shading 1"` |
| Contract/legal | `"Table Grid"` |

## Output Format
- Confirm: "Created a [N×M] table with headers: [h1, h2, ...]"
- If converting from a list, show row count
- Offer: "Say 'add a row to the table' or 'make the last column a total column' to extend it"
