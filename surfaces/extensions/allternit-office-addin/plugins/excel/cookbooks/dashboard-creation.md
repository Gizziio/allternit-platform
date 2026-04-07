# Cookbook: Build an Excel Dashboard

## Prerequisites
- Source data in a structured table (or create one with `excel:table`)
- A separate "Dashboard" sheet (the plugin creates it)

---

## Step 1: Prepare Source Data as a Table

**Command**: `excel:table` → "make this data a table named SalesData"

```javascript
// Creates a ListObject with TableStyleMedium2
// Headers auto-detected from row 1
// Table name: SalesData
```

Ensure columns have clean, consistent headers — they become structured reference names:
`[@Revenue]`, `[@Units]`, `[@Region]`, `[@Month]`

---

## Step 2: Create the Dashboard Sheet

**Command**: (runs automatically via `excel:model` pattern)

```javascript
await Excel.run(async (context) => {
  const wb = context.workbook;
  const dash = wb.worksheets.add("Dashboard");
  dash.position = 0; // first tab
  dash.tabColor = "#B08D6E"; // Allternit sand
  dash.activate();
  await context.sync();
});
```

---

## Step 3: KPI Summary Row

**Command**: `excel:formula` → "add KPI summary cards showing Total Revenue, Total Units, Avg Deal Size, Active Count"

Layout: Row 3–7, spanning columns A–L, with 4 KPI cards side by side.

```
| [Total Revenue]    | [Total Units]    | [Avg Deal Size]    | [Active Count]    |
| =SUM(SalesData[Revenue]) | =SUM(SalesData[Units]) | =AVERAGE(SalesData[Revenue]) | =COUNTIF(SalesData[Status],"Active") |
```

**Format**: 
```javascript
// KPI value cells
kpiRange.numberFormat = [["$#,##0"]];
kpiRange.format.font.size = 28;
kpiRange.format.font.bold = true;
kpiRange.format.font.color = "#2A1F16";

// KPI label cells
labelRange.format.font.size = 10;
labelRange.format.font.color = "#6B4F35";

// Card background
cardRange.format.fill.color = "#F5EDE3";
```

---

## Step 4: Revenue Trend Chart (Line)

**Command**: `excel:chart` → "create a line chart of monthly revenue from SalesData"

```javascript
// Data: Monthly aggregation using SUMIF formulas into a helper range
// Chart type: Excel.ChartType.lineMarkers
// Position: B10, width 400pt, height 250pt
// Series color: #B08D6E (Allternit sand)
// Title: "Revenue Trend"
```

Monthly aggregation helper (hidden rows):
```
=SUMIF(SalesData[Month],A_MonthRef,SalesData[Revenue])
```

---

## Step 5: Category Breakdown Chart (Column)

**Command**: `excel:chart` → "create a column chart comparing revenue by region"

```javascript
// Data: SUMIF by Region into helper range
// Chart type: Excel.ChartType.columnClustered
// Position: G10, width 380pt, height 250pt
// Series colors: Allternit palette
// Title: "Revenue by Region"
```

---

## Step 6: Status Donut Chart

**Command**: `excel:chart` → "create a donut chart showing active vs inactive deals"

```javascript
// Data: COUNTIF for each status value
// Chart type: Excel.ChartType.doughnut
// Position: B35, width 300pt, height 200pt
// No legend — use data labels instead
// Title: "Deal Status"
```

---

## Step 7: Add Data Bars to Summary Table

**Command**: `excel:format` → "add data bars to the revenue column"

```javascript
const dataBar = revenueRange.conditionalFormats.add(Excel.ConditionalFormatType.dataBar);
dataBar.dataBar.barFillType = Excel.ConditionalDataBarFillType.gradient;
dataBar.dataBar.positiveFormat.fillColor = "#B08D6E";
await context.sync();
```

---

## Step 8: Final Formatting Pass

**Command**: `excel:format` → "apply Allternit dashboard styling"

- Freeze row 1 (sheet title)
- Hide gridlines: `sheet.showGridlines = false`
- Hide row/column headers: `sheet.showHeadings = false`
- Set column widths for clean layout
- Apply consistent font: Calibri 10pt throughout

```javascript
sheet.showGridlines = false;
sheet.showHeadings = false;
sheet.freezePanes.freezeRows(2); // freeze title + KPI row
await context.sync();
```

---

## Final Dashboard Structure
```
Row 1:    [Title bar — "Sales Dashboard — Q1 2026"]
Row 3–7:  [KPI 1] [KPI 2] [KPI 3] [KPI 4]
Row 10:   [Revenue Trend Chart]    [Region Chart]
Row 35:   [Status Donut]           [Summary Table with data bars]
```
