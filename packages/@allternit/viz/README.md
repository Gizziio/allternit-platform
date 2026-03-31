# @allternit/viz

A2R Data Visualization - Charts, graphs, and dashboards.

## Overview

The Visualization package provides chart rendering, dashboard components, and data transformation utilities for the A2R platform. It supports multiple output formats including SVG, Canvas, and React components.

## Features

- **Chart Types**: Line, Bar, Column, Area, Pie, Donut, Scatter, Heatmap
- **SVG Rendering**: Server-side chart generation
- **Theming**: Light and dark themes with customizable palettes
- **Dashboards**: Grid-based dashboard layouts
- **Data Transforms**: Filter, map, aggregate, sort data pipelines

## Installation

```bash
pnpm add @allternit/viz
```

## Quick Start

```typescript
import { createSVGRenderer } from '@allternit/viz';

const renderer = createSVGRenderer();

const svg = renderer.render({
  type: 'bar',
  title: 'Monthly Sales',
  width: 800,
  height: 400,
  xAxis: { title: 'Month' },
  yAxis: { title: 'Sales ($)' },
}, [
  {
    id: 'sales-2024',
    name: 'Sales 2024',
    data: [
      { x: 'Jan', y: 10000 },
      { x: 'Feb', y: 15000 },
      { x: 'Mar', y: 20000 },
    ],
  },
]);

// Save or serve SVG
console.log(svg);
```

## Chart Types

### Line Chart
```typescript
const svg = renderer.render({
  type: 'line',
  title: 'Revenue Trend',
}, [
  {
    id: 'revenue',
    name: 'Revenue',
    data: [
      { x: 'Q1', y: 100000 },
      { x: 'Q2', y: 150000 },
      { x: 'Q3', y: 180000 },
    ],
  },
]);
```

### Bar Chart
```typescript
const svg = renderer.render({
  type: 'bar',
  title: 'Sales by Region',
}, [
  {
    id: 'sales',
    name: 'Sales',
    data: [
      { x: 'North', y: 50000 },
      { x: 'South', y: 45000 },
      { x: 'East', y: 60000 },
      { x: 'West', y: 55000 },
    ],
  },
]);
```

### Pie Chart
```typescript
const svg = renderer.render({
  type: 'pie',
  title: 'Market Share',
}, [
  {
    id: 'share',
    name: 'Share',
    data: [
      { name: 'Product A', value: 30 },
      { name: 'Product B', value: 25 },
      { name: 'Product C', value: 45 },
    ],
  },
]);
```

## Configuration

### Chart Config
```typescript
interface ChartConfig {
  type: ChartType;
  title?: string;
  subtitle?: string;
  width?: number;
  height?: number;
  xAxis?: AxisConfig;
  yAxis?: AxisConfig;
  legend?: LegendConfig;
  tooltip?: TooltipConfig;
  colors?: string[];
  theme?: 'light' | 'dark';
  animation?: boolean;
  dataLabels?: boolean;
}
```

### Axis Config
```typescript
interface AxisConfig {
  title?: string;
  type?: 'category' | 'number' | 'datetime';
  min?: number;
  max?: number;
  categories?: string[];
}
```

## Themes

```typescript
import { palettes } from '@allternit/viz';

// Use predefined palette
const svg = renderer.render({
  type: 'line',
  theme: 'dark',
}, series);

// Custom palette
const customPalette = {
  primary: ['#ff0000', '#00ff00', '#0000ff'],
  secondary: ['#ffcccc', '#ccffcc', '#ccccff'],
  semantic: {
    success: '#00ff00',
    warning: '#ffff00',
    error: '#ff0000',
    info: '#0000ff',
  },
  background: ['#ffffff', '#f0f0f0'],
  text: {
    primary: '#000000',
    secondary: '#666666',
    muted: '#999999',
  },
};
```

## API Reference

### SVG Renderer

```typescript
interface SVGRenderer {
  render(config: ChartConfig, series: DataSeries[]): string;
  getMetadata(type: ChartType): ChartMetadata;
}
```

### Data Series

```typescript
interface DataSeries {
  id: string;
  name: string;
  type?: ChartType;
  data: DataPoint[];
  color?: string;
}

interface DataPoint {
  x?: string | number | Date;
  y?: number;
  name?: string;
  value?: number;
}
```

## Supported Chart Types

| Type | Description | Data Structure |
|------|-------------|----------------|
| `line` | Line chart | `{ x, y }[]` |
| `bar` | Bar chart | `{ x, y }[]` |
| `column` | Column chart | `{ x, y }[]` |
| `area` | Area chart | `{ x, y }[]` |
| `pie` | Pie chart | `{ name, value }[]` |
| `donut` | Donut chart | `{ name, value }[]` |
| `scatter` | Scatter plot | `{ x, y }[]` |
| `heatmap` | Heatmap | `{ x, y, value }[]` |

## License

MIT
