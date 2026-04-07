# Cookbook: Create Data-Driven Slides

## Prerequisites
- Structured data available (from Excel, CSV, JSON, or typed directly)
- A PowerPoint presentation is open

---

## Step 1: Define the Data Structure

Provide data in one of these formats:

**Option A: Natural language**
```
"Create slides from this data:
Q1: $1.2M revenue, 450 customers, 94% retention
Q2: $1.5M revenue, 520 customers, 92% retention
Q3: $1.8M revenue, 610 customers, 95% retention"
```

**Option B: JSON**
```json
{
  "title": "Quarterly Performance",
  "slides": [
    { "quarter": "Q1", "revenue": 1200000, "customers": 450, "retention": 0.94 },
    { "quarter": "Q2", "revenue": 1500000, "customers": 520, "retention": 0.92 },
    { "quarter": "Q3", "revenue": 1800000, "customers": 610, "retention": 0.95 }
  ]
}
```

---

## Step 2: Generate Slide Outline from Data

**Command**: `ppt:outline` → "Create slides from this quarterly data: [data]"

The AI maps data to a slide structure:
```
Slide 1: Title — "Quarterly Performance Review"
Slide 2: Q1 Results — Revenue: $1.2M | Customers: 450 | Retention: 94%
Slide 3: Q2 Results — Revenue: $1.5M | Customers: 520 | Retention: 92%
Slide 4: Q3 Results — Revenue: $1.8M | Customers: 610 | Retention: 95%
Slide 5: Trends Summary — QoQ growth, key patterns
```

---

## Step 3: Build Slides

```javascript
// The plugin creates slides from the JSON outline
// Each data slide follows this layout:
//
// [TITLE]                    ← Calibri 32pt bold
// ──────────────────────
// Revenue: $1.2M             ← Metric 1 (Calibri 24pt, accent color)
// Customers: 450             ← Metric 2
// Retention: 94%             ← Metric 3
// ──────────────────────
// [Quarter label]            ← Caption, bottom-right

await PowerPoint.run(async (context) => {
  for (const item of dataSlides) {
    context.presentation.slides.add();
  }
  await context.sync();

  const slides = context.presentation.slides;
  slides.load("items");
  await context.sync();

  for (let i = 0; i < dataSlides.length; i++) {
    const slide = slides.items[i];
    const data = dataSlides[i];

    // Title box
    slide.shapes.addTextBox(data.title, {
      left: 60, top: 40, width: 840, height: 70,
    });

    // Metrics as formatted text block
    const metricsText = data.metrics
      .map(m => `${m.label}: ${m.formattedValue}`)
      .join("\n");
    slide.shapes.addTextBox(metricsText, {
      left: 60, top: 140, width: 840, height: 300,
    });

    // Quarter/period label
    slide.shapes.addTextBox(data.period, {
      left: 750, top: 480, width: 170, height: 30,
    });
  }
  await context.sync();
});
```

---

## Step 4: Apply Branding

**Command**: `ppt:design` → "apply Allternit branding"

For data slides, the plugin additionally:
- Sets metric values in accent color (`#B08D6E`)
- Sets metric labels in muted text color (`#9A8070`)
- Adds a thin divider line between title and metrics

---

## Step 5: Add Trend Summary Slide

**Command**: `ppt:slide` → "add a trend summary slide showing QoQ growth"

```
"Create a slide titled 'Trend Summary' with:
- Revenue growth: +25% QoQ average
- Customer growth: +16% QoQ average
- Retention: stable at 93.7% average
- Key insight: Revenue scaling faster than headcount"
```

---

## Step 6: Add Chart Reference Slide (Link to Excel)

If the data lives in Excel, add a slide with an instruction to embed the chart:

**Command**: `ppt:slide` → "add a slide with placeholder for an Excel chart"

```
Slide content:
Title: "Revenue Trend Chart"
Body: "[EMBED: Excel chart from Q_Revenue_Trend.xlsx → Chart 1]
To embed: In Excel, copy the chart → In PowerPoint, Paste Special → Microsoft Excel Chart Object"
```

*Note: Programmatic chart embedding between Office apps is not supported via the JS API — manual paste is required.*

---

## Data Formatting Helpers

```javascript
function formatValue(value: number, type: "currency" | "percent" | "integer" | "multiple"): string {
  switch (type) {
    case "currency":
      return value >= 1_000_000
        ? `$${(value / 1_000_000).toFixed(1)}M`
        : `$${(value / 1_000).toFixed(0)}K`;
    case "percent":
      return `${(value * 100).toFixed(1)}%`;
    case "integer":
      return value.toLocaleString();
    case "multiple":
      return `${value.toFixed(1)}x`;
    default:
      return String(value);
  }
}
```
