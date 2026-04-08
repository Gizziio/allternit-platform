/**
 * A2R Data Visualization Types
 */

/**
 * Chart Types
 */
export type ChartType =
  | 'line'
  | 'bar'
  | 'column'
  | 'area'
  | 'pie'
  | 'donut'
  | 'scatter'
  | 'bubble'
  | 'radar'
  | 'heatmap'
  | 'treemap'
  | 'sankey'
  | 'gauge'
  | 'candlestick';

/**
 * Chart Configuration
 */
export interface ChartConfig {
  /** Chart type */
  type: ChartType;
  /** Chart title */
  title?: string;
  /** Chart subtitle */
  subtitle?: string;
  /** Width in pixels */
  width?: number;
  /** Height in pixels */
  height?: number;
  /** X-axis configuration */
  xAxis?: AxisConfig;
  /** Y-axis configuration */
  yAxis?: AxisConfig;
  /** Legend configuration */
  legend?: LegendConfig;
  /** Tooltip configuration */
  tooltip?: TooltipConfig;
  /** Chart colors */
  colors?: string[];
  /** Theme */
  theme?: 'light' | 'dark';
  /** Enable animations */
  animation?: boolean;
  /** Enable stacking (for bar/area) */
  stacking?: boolean;
  /** Show data labels */
  dataLabels?: boolean;
  /** Chart-specific options */
  options?: Record<string, unknown>;
}

/**
 * Axis Configuration
 */
export interface AxisConfig {
  /** Axis title */
  title?: string;
  /** Axis type */
  type?: 'category' | 'number' | 'datetime' | 'logarithmic';
  /** Minimum value */
  min?: number;
  /** Maximum value */
  max?: number;
  /** Tick interval */
  tickInterval?: number;
  /** Label format */
  labelFormat?: string;
  /** Categories (for category axis) */
  categories?: string[];
  /** Grid lines */
  grid?: GridConfig;
  /** Opposite side */
  opposite?: boolean;
  /** Reversed */
  reversed?: boolean;
}

/**
 * Grid Configuration
 */
export interface GridConfig {
  /** Show grid */
  enabled?: boolean;
  /** Grid color */
  color?: string;
  /** Dash style */
  dashStyle?: string;
}

/**
 * Legend Configuration
 */
export interface LegendConfig {
  /** Show legend */
  enabled?: boolean;
  /** Legend position */
  position?: 'top' | 'bottom' | 'left' | 'right';
  /** Legend alignment */
  align?: 'left' | 'center' | 'right';
}

/**
 * Tooltip Configuration
 */
export interface TooltipConfig {
  /** Show tooltip */
  enabled?: boolean;
  /** Shared tooltip */
  shared?: boolean;
  /** Follow cursor */
  followCursor?: boolean;
  /** Formatter function */
  formatter?: string;
}

/**
 * Data Series
 */
export interface DataSeries {
  /** Series ID */
  id: string;
  /** Series name */
  name: string;
  /** Series type (can override chart type) */
  type?: ChartType;
  /** Series data */
  data: DataPoint[];
  /** Series color */
  color?: string;
  /** Y-axis index (for multi-axis) */
  yAxis?: number;
  /** Series options */
  options?: Record<string, unknown>;
}

/**
 * Data Point
 */
export interface DataPoint {
  /** X value */
  x?: string | number | Date;
  /** Y value */
  y?: number;
  /** Category name (for pie/donut) */
  name?: string;
  /** Value (for pie/donut) */
  value?: number;
  /** Additional properties */
  [key: string]: unknown;
}

/**
 * Dashboard Configuration
 */
export interface DashboardConfig {
  /** Dashboard ID */
  id: string;
  /** Dashboard title */
  title: string;
  /** Layout grid columns */
  columns?: number;
  /** Widgets */
  widgets: WidgetConfig[];
  /** Refresh interval (seconds) */
  refreshInterval?: number;
  /** Theme */
  theme?: 'light' | 'dark';
}

/**
 * Widget Configuration
 */
export interface WidgetConfig {
  /** Widget ID */
  id: string;
  /** Widget type */
  type: 'chart' | 'metric' | 'table' | 'text' | 'image';
  /** Widget title */
  title?: string;
  /** Grid position */
  position: GridPosition;
  /** Widget data source */
  dataSource?: DataSource;
  /** Widget-specific config */
  config?: ChartConfig | MetricConfig | TableConfig;
}

/**
 * Grid Position
 */
export interface GridPosition {
  /** Column start (1-based) */
  x: number;
  /** Row start (1-based) */
  y: number;
  /** Width in columns */
  w: number;
  /** Height in rows */
  h: number;
}

/**
 * Metric Configuration
 */
export interface MetricConfig {
  /** Metric value format */
  format?: 'number' | 'currency' | 'percentage' | 'duration';
  /** Decimal places */
  decimals?: number;
  /** Prefix */
  prefix?: string;
  /** Suffix */
  suffix?: string;
  /** Comparison to previous period */
  comparison?: boolean;
  /** Trend indicator */
  trend?: 'up' | 'down' | 'neutral';
  /** Color by trend */
  colorByTrend?: boolean;
}

/**
 * Table Configuration
 */
export interface TableConfig {
  /** Columns */
  columns: TableColumn[];
  /** Enable pagination */
  pagination?: boolean;
  /** Page size */
  pageSize?: number;
  /** Enable sorting */
  sortable?: boolean;
  /** Enable filtering */
  filterable?: boolean;
  /** Enable search */
  searchable?: boolean;
}

/**
 * Table Column
 */
export interface TableColumn {
  /** Column ID */
  id: string;
  /** Column header */
  header: string;
  /** Column type */
  type?: 'text' | 'number' | 'date' | 'currency' | 'percentage' | 'badge';
  /** Column width */
  width?: number | string;
  /** Align */
  align?: 'left' | 'center' | 'right';
  /** Format string */
  format?: string;
  /** Sortable */
  sortable?: boolean;
}

/**
 * Data Source
 */
export interface DataSource {
  /** Source type */
  type: 'static' | 'api' | 'websocket' | 'query';
  /** Source configuration */
  config: Record<string, unknown>;
  /** Data transform pipeline */
  transforms?: DataTransform[];
  /** Polling interval (seconds) */
  pollingInterval?: number;
}

/**
 * Data Transform
 */
export interface DataTransform {
  /** Transform type */
  type: 'filter' | 'map' | 'reduce' | 'aggregate' | 'sort' | 'limit';
  /** Transform configuration */
  config: Record<string, unknown>;
}

/**
 * Chart Renderer
 */
export interface ChartRenderer {
  /** Render chart to SVG */
  renderSVG(config: ChartConfig, series: DataSeries[]): string;
  /** Render chart to Canvas */
  renderCanvas(config: ChartConfig, series: DataSeries[]): HTMLCanvasElement;
  /** Get chart metadata */
  getMetadata(type: ChartType): ChartMetadata;
}

/**
 * Chart Metadata
 */
export interface ChartMetadata {
  /** Chart type */
  type: ChartType;
  /** Display name */
  name: string;
  /** Description */
  description: string;
  /** Supported axes */
  axes: ('x' | 'y' | 'z')[];
  /** Required data structure */
  dataStructure: string;
  /** Use cases */
  useCases: string[];
}

/**
 * Export Options
 */
export interface ExportOptions {
  /** Export format */
  format: 'png' | 'svg' | 'pdf' | 'csv' | 'json';
  /** Export filename */
  filename?: string;
  /** Export dimensions */
  width?: number;
  height?: number;
  /** Background color */
  backgroundColor?: string;
}

/**
 * Visualization Event
 */
export interface VizEvent {
  /** Event type */
  type: 'click' | 'hover' | 'select' | 'zoom' | 'pan';
  /** Target element */
  target: string;
  /** Event data */
  data: Record<string, unknown>;
  /** Timestamp */
  timestamp: number;
}

/**
 * Chart Palette
 */
export interface ChartPalette {
  /** Primary colors */
  primary: string[];
  /** Secondary colors */
  secondary: string[];
  /** Semantic colors */
  semantic: {
    success: string;
    warning: string;
    error: string;
    info: string;
  };
  /** Background colors */
  background: string[];
  /** Text colors */
  text: {
    primary: string;
    secondary: string;
    muted: string;
  };
}

/** Predefined palettes */
export const palettes: Record<string, ChartPalette> = {
  default: {
    primary: ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'],
    secondary: ['#60a5fa', '#34d399', '#fbbf24', '#f87171', '#a78bfa', '#f472b6'],
    semantic: {
      success: '#10b981',
      warning: '#f59e0b',
      error: '#ef4444',
      info: '#3b82f6',
    },
    background: ['#ffffff', '#f3f4f6', '#e5e7eb', '#d1d5db'],
    text: {
      primary: '#111827',
      secondary: '#4b5563',
      muted: '#9ca3af',
    },
  },
  dark: {
    primary: ['#60a5fa', '#34d399', '#fbbf24', '#f87171', '#a78bfa', '#f472b6'],
    secondary: ['#93c5fd', '#6ee7b7', '#fcd34d', '#fca5a5', '#c4b5fd', '#fbcfe8'],
    semantic: {
      success: '#34d399',
      warning: '#fbbf24',
      error: '#f87171',
      info: '#60a5fa',
    },
    background: ['#1f2937', '#111827', '#374151', '#4b5563'],
    text: {
      primary: '#f9fafb',
      secondary: '#d1d5db',
      muted: '#9ca3af',
    },
  },
};
