/**
 * A2R Data Visualization
 * 
 * Charts, graphs, and dashboards for A2R platform.
 * 
 * @example
 * ```typescript
 * import { createSVGRenderer, createDashboard } from '@allternit/viz';
 * 
 * const renderer = createSVGRenderer();
 * 
 * const svg = renderer.render({
 *   type: 'bar',
 *   title: 'Sales by Month',
 *   width: 800,
 *   height: 400,
 * }, [
 *   {
 *     id: 'sales',
 *     name: 'Sales',
 *     data: [
 *       { x: 'Jan', y: 100 },
 *       { x: 'Feb', y: 150 },
 *       { x: 'Mar', y: 200 },
 *     ],
 *   },
 * ]);
 * ```
 */

// Types
export type {
  ChartType,
  ChartConfig,
  AxisConfig,
  LegendConfig,
  TooltipConfig,
  DataSeries,
  DataPoint,
  DashboardConfig,
  WidgetConfig,
  GridPosition,
  MetricConfig,
  TableConfig,
  TableColumn,
  DataSource,
  DataTransform,
  ChartMetadata,
  ChartPalette,
  ExportOptions,
  VizEvent,
} from './types';

export { palettes } from './types';

// Charts
export {
  createSVGRenderer,
  globalSVGRenderer,
  type SVGRenderer,
} from './charts/svg-renderer';

// Version
export const VERSION = '0.1.0';
