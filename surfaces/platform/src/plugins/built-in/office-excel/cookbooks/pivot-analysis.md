# Cookbook: Pivot-Style Analysis (Without PivotTables)

## Why Not Use PivotTables?

The Excel JavaScript API does not support creating or modifying PivotTables programmatically (read-only access only, as of Excel JS 1.12). This cookbook uses the SUMIF/COUNTIF/AVERAGEIF approach — which produces the same analytical output, is fully API-accessible, and is more transparent for formula auditing.

---

## Prerequisites
- Source data as a structured table (see `excel:table`)
- At least one categorical column (Region, Status, Category, etc.)
- At least one numeric column to aggregate (Revenue, Units, etc.)

---

## Step 1: Identify Unique Categories

**Command**: `excel:formula` → "list unique values in the Region column"

```javascript
// Excel 365 dynamic array approach:
const uniqueFormula = "=SORT(UNIQUE(SalesData[Region]))";

// Write to a helper range (e.g., Analysis!A2)
analysisSheet.getRange("A2").formulas = [[uniqueFormula]];
await context.sync();
```

For older Excel (non-dynamic arrays), collect unique values in JS:
```javascript
const values = tableBodyRange.values;
const colIdx = headerRow.indexOf("Region");
const unique = [...new Set(values.map(row => row[colIdx]).filter(Boolean))].sort();
```

---

## Step 2: Build Summary Table with SUMIF

**Command**: `excel:formula` → "sum Revenue by Region"

Layout on Analysis sheet:
```
A             B              C               D
Region        Total Revenue  Unit Count      Avg Deal Size
North         =SUMIF(...)    =COUNTIF(...)   =AVERAGEIF(...)
South         ...
East          ...
West          ...
```

Formulas (absolute reference to source table):
```
B2: =SUMIF(SalesData[Region],A2,SalesData[Revenue])
C2: =COUNTIF(SalesData[Region],A2)
D2: =IFERROR(AVERAGEIF(SalesData[Region],A2,SalesData[Revenue]),0)
```

**Command**: `excel:table` → "make this summary a table named RegionSummary"

---

## Step 3: Multi-Dimension Cross-Tab (SUMIFS)

For a cross-tab (Region × Quarter):

```
         Q1          Q2          Q3          Q4
North    =SUMIFS(SalesData[Revenue],SalesData[Region],A2,SalesData[Quarter],"Q1")
South    ...
```

Formula pattern:
```
=SUMIFS(
  SalesData[Revenue],        // sum range
  SalesData[Region], $A2,    // condition 1: row dimension
  SalesData[Quarter], B$1    // condition 2: column dimension — $ on row ref
)
```

The mixed references (`$A2` and `B$1`) allow the formula to extend in both directions.

---

## Step 4: Ranking with RANK

**Command**: `excel:formula` → "rank regions by total revenue"

```
E2: =RANK(B2,$B$2:$B$10,0)   // 0 = descending (highest revenue = rank 1)
```

Sort the summary table by rank column:
```javascript
table.sort.apply([{ key: 4, ascending: true }]); // sort by rank col
await context.sync();
```

---

## Step 5: Add Data Bars and Color Scale

**Command**: `excel:format` → "add a color scale to the Revenue column"

```javascript
const cfRange = sheet.getRange("B2:B10");
const colorScale = cfRange.conditionalFormats.add(Excel.ConditionalFormatType.colorScale);
colorScale.colorScale.criteria = {
  minimum: { formula: null, type: Excel.ConditionalFormatColorCriterionType.lowestValue,  color: "#FDF8F3" },
  midpoint: { formula: "50", type: Excel.ConditionalFormatColorCriterionType.percentile,  color: "#D4BFA8" },
  maximum: { formula: null, type: Excel.ConditionalFormatColorCriterionType.highestValue, color: "#B08D6E" },
};
await context.sync();
```

---

## Step 6: Pivot Chart

**Command**: `excel:chart` → "create a column chart from the RegionSummary table"

```javascript
// Data source: RegionSummary table range
// Chart type: Excel.ChartType.columnClustered
// Category axis: Region column
// Value axis: Total Revenue
// Secondary series: Unit Count on secondary axis (combo chart)
```

---

## Step 7: Slicers (Filter Buttons)

The Excel JS API supports slicers on tables (Excel 365):

```javascript
await Excel.run(async (context) => {
  const sheet = context.workbook.worksheets.getItem("Analysis");
  const slicer = sheet.slicers.add(
    context.workbook.tables.getItem("SalesData"),
    "Region"   // column name
  );
  slicer.top = 10;
  slicer.left = 500;
  slicer.width = 150;
  slicer.height = 200;
  await context.sync();
});
```

---

## Limitations vs. Native PivotTables
| Feature | This approach | PivotTable |
|---|---|---|
| Create via API | ✓ | ✗ |
| Dynamic refresh | Manual (formulas auto-update) | Refresh button |
| Drill-down | ✗ | ✓ |
| Grouping by date | Manual (MONTH/YEAR formulas) | Built-in |
| Multiple aggregations | ✓ (SUMIF + COUNTIF + AVERAGEIF) | ✓ |
| Formula auditable | ✓ | ✗ |
