# Skill: Worksheet Management

## Trigger
Use this skill for navigating sheets, adding/renaming/deleting worksheets, or setting up live selection events.

## Navigate to a Sheet
```javascript
const sheet = context.workbook.worksheets.getItemOrNullObject("Revenue");
sheet.load("isNullObject");
await context.sync();
if (!sheet.isNullObject) {
  sheet.activate();
}
await context.sync();
```

## List All Sheets
```javascript
const sheets = context.workbook.worksheets;
sheets.load("items/name,items/position,items/visibility");
await context.sync();
const sheetNames = sheets.items
  .filter(s => s.visibility === Excel.SheetVisibility.visible)
  .map(s => s.name);
return { sheets: sheetNames };
```

## Add a New Sheet
```javascript
const newSheet = context.workbook.worksheets.add("Dashboard");
newSheet.position = 0; // first tab
newSheet.activate();
await context.sync();
```

## Rename a Sheet
```javascript
const sheet = context.workbook.worksheets.getItem("Sheet1");
sheet.name = "Revenue Model";
await context.sync();
```

## Copy a Sheet
```javascript
const sourceSheet = context.workbook.worksheets.getItem("Template");
sourceSheet.copy(Excel.WorksheetPositionType.end);
await context.sync();
```

## Delete a Sheet (with confirmation guard)
```javascript
// Only delete if it exists and is not the last sheet
const sheets = context.workbook.worksheets;
sheets.load("count");
await context.sync();
if (sheets.count > 1) {
  const sheet = sheets.getItemOrNullObject("OldSheet");
  sheet.load("isNullObject");
  await context.sync();
  if (!sheet.isNullObject) {
    sheet.delete();
    await context.sync();
  }
}
```

## Tab Color
```javascript
sheet.tabColor = "#B08D6E"; // Allternit sand accent
await context.sync();
```

## Live Selection Change Event (from menahishayan/MS-Office-AI)
Register a handler so the agent always has current context:
```javascript
let selectionHandler: OfficeExtension.EventHandlerResult<Excel.SelectionChangedEventArgs>;

async function registerSelectionChangeHandler(
  setSelectedRange: (address: string) => void
) {
  await Excel.run(async (context) => {
    const sheet = context.workbook.worksheets.getActiveWorksheet();
    selectionHandler = sheet.onSelectionChanged.add(async (event) => {
      setSelectedRange(event.address);
    });
    await context.sync();
  });
}

async function removeSelectionChangeHandler() {
  if (selectionHandler) {
    selectionHandler.remove();
    await Excel.run(async (context) => { await context.sync(); });
  }
}
```

## Freeze Panes
```javascript
sheet.freezePanes.freezeRows(1);    // freeze top row
sheet.freezePanes.freezeColumns(1); // freeze left column
sheet.freezePanes.freezeAt(sheet.getRange("B2")); // freeze at B2
sheet.freezePanes.unfreeze();       // unfreeze all
await context.sync();
```

## Protection
```javascript
sheet.protection.protect({
  allowInsertRows: false,
  allowDeleteRows: false,
  allowSort: true,
  allowFilter: true,
  allowAutoFilter: true
});
await context.sync();
```
