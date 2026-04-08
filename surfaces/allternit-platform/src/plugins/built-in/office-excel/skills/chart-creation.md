# Skill: Chart Creation

## Trigger
Use this skill when creating, formatting, or modifying charts.

## Critical Rule: Always Use ChartType Enums
```javascript
// ✓ CORRECT
Excel.ChartType.lineClusteredColumn
Excel.ChartType.columnClustered
Excel.ChartType.pie
// ✗ WRONG — will throw InvalidArgument
"lineClusteredColumn"
"ColumnClustered"
```

## Chart Type Reference
| Visual | Enum |
|---|---|
| Bar (vertical) | `Excel.ChartType.columnClustered` |
| Bar (horizontal) | `Excel.ChartType.barClustered` |
| Line | `Excel.ChartType.line` |
| Line + markers | `Excel.ChartType.lineMarkers` |
| Area | `Excel.ChartType.area` |
| Pie | `Excel.ChartType.pie` |
| Donut | `Excel.ChartType.doughnut` |
| Scatter | `Excel.ChartType.xyscatter` |
| Scatter + lines | `Excel.ChartType.xyscatterSmooth` |
| Combo (bar+line) | `Excel.ChartType.columnClustered` + secondary axis |
| Waterfall | `Excel.ChartType.waterfall` |
| Funnel | `Excel.ChartType.funnel` |
| Treemap | `Excel.ChartType.treemap` |
| Histogram | `Excel.ChartType.histogram` |

## Full Chart Creation Pattern
```javascript
await Excel.run(async (context) => {
  const sheet = context.workbook.worksheets.getActiveWorksheet();
  const dataRange = sheet.getRange("A1:C7");

  const chart = sheet.charts.add(
    Excel.ChartType.columnClustered,
    dataRange,
    Excel.ChartSeriesBy.columns  // or .rows
  );

  // Position and size (in points)
  chart.left = 300;
  chart.top = 50;
  chart.width = 400;
  chart.height = 250;

  // Title
  chart.title.text = "Quarterly Revenue";
  chart.title.visible = true;

  // Legend
  chart.legend.position = Excel.ChartLegendPosition.bottom;
  chart.legend.visible = true;

  // Axes
  chart.axes.valueAxis.title.text = "Revenue ($mm)";
  chart.axes.valueAxis.title.visible = true;
  chart.axes.categoryAxis.title.text = "Quarter";
  chart.axes.categoryAxis.title.visible = true;

  // Remove chart border
  chart.format.border.color = "transparent";

  await context.sync();
  return { success: true, chartTitle: "Quarterly Revenue" };
});
```

## Formatting Chart Series
```javascript
chart.series.load("items");
await context.sync();
const series = chart.series.items[0];
series.format.fill.setSolidColor("#B08D6E"); // Allternit sand
series.format.border.color = "#9A7658";
await context.sync();
```

## Combo Chart (dual-axis)
```javascript
// After creating a column chart, change one series to line on secondary axis
const series2 = chart.series.items[1];
series2.chartType = Excel.ChartType.lineMarkers;
series2.axisGroup = Excel.ChartAxisGroup.secondary;
await context.sync();
```

## Safety Rules
- Load `sheet.charts` before accessing by name: `sheet.charts.load("items/name")`
- Position charts to avoid overlapping data — place at `sheet.getUsedRange().getOffsetRange(2, 0)` as a guide
- Always set `chart.title.visible = true` or the title won't appear
