/**
 * Canvas Chart Renderer
 * 
 * Renders charts to HTML Canvas with animation support.
 */

import type { ChartConfig, DataSeries, ChartMetadata, DataPoint } from '../types';
import { palettes } from '../types';

export interface CanvasRenderer {
  /** Render chart to canvas */
  render(config: ChartConfig, series: DataSeries[]): HTMLCanvasElement;
  /** Render with animation */
  renderAnimated(config: ChartConfig, series: DataSeries[], duration?: number): Promise<HTMLCanvasElement>;
  /** Get chart metadata */
  getMetadata(type: string): ChartMetadata;
  /** Export to data URL */
  toDataURL(format?: 'png' | 'jpeg', quality?: number): string | null;
  /** Get canvas element */
  getCanvas(): HTMLCanvasElement | null;
}

export interface RenderContext {
  ctx: CanvasRenderingContext2D;
  width: number;
  height: number;
  chartWidth: number;
  chartHeight: number;
  margin: { top: number; right: number; bottom: number; left: number };
}

/**
 * Create Canvas chart renderer
 */
export function createCanvasRenderer(): CanvasRenderer {
  let currentCanvas: HTMLCanvasElement | null = null;
  let currentCtx: CanvasRenderingContext2D | null = null;
  const defaultWidth = 800;
  const defaultHeight = 400;
  const margin = { top: 60, right: 40, bottom: 60, left: 80 };

  /**
   * Create and setup canvas
   */
  function setupCanvas(width: number, height: number): RenderContext {
    if (typeof document === 'undefined') {
      // Node.js environment - create mock canvas
      currentCanvas = {
        width,
        height,
        getContext: () => ({
          fillStyle: '',
          strokeStyle: '',
          lineWidth: 1,
          font: '',
          textAlign: 'left' as CanvasTextAlign,
          textBaseline: 'alphabetic' as CanvasTextBaseline,
          fillRect: () => {},
          strokeRect: () => {},
          clearRect: () => {},
          beginPath: () => {},
          closePath: () => {},
          moveTo: () => {},
          lineTo: () => {},
          arc: () => {},
          fill: () => {},
          stroke: () => {},
          fillText: () => {},
          strokeText: () => {},
          save: () => {},
          restore: () => {},
          translate: () => {},
          scale: () => {},
          rotate: () => {},
          measureText: () => ({ width: 0 }),
        }),
        toDataURL: () => '',
      } as unknown as HTMLCanvasElement;
      currentCtx = currentCanvas.getContext('2d') as CanvasRenderingContext2D;
    } else {
      currentCanvas = document.createElement('canvas');
      currentCanvas.width = width;
      currentCanvas.height = height;
      currentCtx = currentCanvas.getContext('2d');
    }

    if (!currentCtx) {
      throw new Error('Failed to get canvas context');
    }

    return {
      ctx: currentCtx,
      width,
      height,
      chartWidth: width - margin.left - margin.right,
      chartHeight: height - margin.top - margin.bottom,
      margin,
    };
  }

  /**
   * Render chart to canvas
   */
  function render(config: ChartConfig, series: DataSeries[]): HTMLCanvasElement {
    const width = config.width || defaultWidth;
    const height = config.height || defaultHeight;
    const palette = palettes[config.theme || 'default'];

    const rc = setupCanvas(width, height);
    const { ctx } = rc;

    // Clear background
    ctx.fillStyle = palette.background[0];
    ctx.fillRect(0, 0, width, height);

    // Title
    if (config.title) {
      ctx.fillStyle = palette.text.primary;
      ctx.font = 'bold 18px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(config.title, width / 2, 30);
    }

    // Clip to chart area
    ctx.save();
    ctx.translate(margin.left, margin.top);

    // Render based on chart type
    switch (config.type) {
      case 'bar':
        renderBarChart(rc, series, palette, config);
        break;
      case 'line':
        renderLineChart(rc, series, palette, config);
        break;
      case 'pie':
      case 'donut':
        renderPieChart(rc, series, palette, config);
        break;
      case 'area':
        renderAreaChart(rc, series, palette, config);
        break;
      default:
        renderPlaceholder(rc, config.type, palette);
    }

    // Axes
    if (['bar', 'line', 'area'].includes(config.type)) {
      renderAxes(rc, series, config, palette);
    }

    ctx.restore();

    return currentCanvas!;
  }

  /**
   * Render with animation
   */
  function renderAnimated(
    config: ChartConfig,
    series: DataSeries[],
    duration: number = 1000
  ): Promise<HTMLCanvasElement> {
    return new Promise((resolve) => {
      const startTime = performance.now();
      const width = config.width || defaultWidth;
      const height = config.height || defaultHeight;
      const palette = palettes[config.theme || 'default'];

      function animate(currentTime: number) {
        const elapsed = currentTime - startTime;
        const progress = Math.min(elapsed / duration, 1);
        const eased = easeOutCubic(progress);

        // Render with animation progress
        const rc = setupCanvas(width, height);
        const { ctx } = rc;

        // Clear background
        ctx.fillStyle = palette.background[0];
        ctx.fillRect(0, 0, width, height);

        // Title
        if (config.title) {
          ctx.fillStyle = palette.text.primary;
          ctx.font = 'bold 18px sans-serif';
          ctx.textAlign = 'center';
          ctx.fillText(config.title, width / 2, 30);
        }

        ctx.save();
        ctx.translate(margin.left, margin.top);

        // Render with animation progress
        switch (config.type) {
          case 'bar':
            renderBarChartAnimated(rc, series, palette, config, eased);
            break;
          case 'line':
            renderLineChartAnimated(rc, series, palette, config, eased);
            break;
          case 'pie':
          case 'donut':
            renderPieChartAnimated(rc, series, palette, config, eased);
            break;
          case 'area':
            renderAreaChartAnimated(rc, series, palette, config, eased);
            break;
          default:
            renderPlaceholder(rc, config.type, palette);
        }

        // Axes
        if (['bar', 'line', 'area'].includes(config.type)) {
          renderAxes(rc, series, config, palette);
        }

        ctx.restore();

        if (progress < 1) {
          requestAnimationFrame(animate);
        } else {
          resolve(currentCanvas!);
        }
      }

      requestAnimationFrame(animate);
    });
  }

  /**
   * Easing function for smooth animations
   */
  function easeOutCubic(t: number): number {
    return 1 - Math.pow(1 - t, 3);
  }

  /**
   * Render bar chart
   */
  function renderBarChart(
    rc: RenderContext,
    series: DataSeries[],
    palette: typeof palettes['default'],
    config: ChartConfig
  ): void {
    if (series.length === 0) return;

    const { ctx, chartWidth, chartHeight } = rc;
    const allData = series.flatMap((s) => s.data);
    const maxValue = Math.max(...allData.map((d) => (d.y || d.value || 0) as number));
    const categories = [...new Set(allData.map((d) => d.x || d.name))];

    const barWidth = (chartWidth / categories.length) * 0.6 / series.length;
    const scaleY = chartHeight / (maxValue * 1.1);

    series.forEach((s, seriesIndex) => {
      const color = s.color || palette.primary[seriesIndex % palette.primary.length];
      ctx.fillStyle = color;

      s.data.forEach((point, pointIndex) => {
        const value = (point.y || point.value || 0) as number;
        const barHeight = value * scaleY;
        const x = (pointIndex + 0.2) * (chartWidth / categories.length) + seriesIndex * barWidth;
        const y = chartHeight - barHeight;

        ctx.fillRect(x, y, barWidth, barHeight);
      });
    });
  }

  /**
   * Render animated bar chart
   */
  function renderBarChartAnimated(
    rc: RenderContext,
    series: DataSeries[],
    palette: typeof palettes['default'],
    config: ChartConfig,
    progress: number
  ): void {
    if (series.length === 0) return;

    const { ctx, chartWidth, chartHeight } = rc;
    const allData = series.flatMap((s) => s.data);
    const maxValue = Math.max(...allData.map((d) => (d.y || d.value || 0) as number));
    const categories = [...new Set(allData.map((d) => d.x || d.name))];

    const barWidth = (chartWidth / categories.length) * 0.6 / series.length;
    const scaleY = chartHeight / (maxValue * 1.1);

    series.forEach((s, seriesIndex) => {
      const color = s.color || palette.primary[seriesIndex % palette.primary.length];
      ctx.fillStyle = color;

      s.data.forEach((point, pointIndex) => {
        const value = (point.y || point.value || 0) as number;
        const barHeight = value * scaleY * progress;
        const x = (pointIndex + 0.2) * (chartWidth / categories.length) + seriesIndex * barWidth;
        const y = chartHeight - barHeight;

        ctx.fillRect(x, y, barWidth, barHeight);
      });
    });
  }

  /**
   * Render line chart
   */
  function renderLineChart(
    rc: RenderContext,
    series: DataSeries[],
    palette: typeof palettes['default'],
    config: ChartConfig
  ): void {
    if (series.length === 0) return;

    const { ctx, chartWidth, chartHeight } = rc;
    const allData = series.flatMap((s) => s.data);
    const maxValue = Math.max(...allData.map((d) => (d.y || 0) as number));
    const scaleX = chartWidth / (allData.length - 1 || 1);
    const scaleY = chartHeight / (maxValue * 1.1);

    series.forEach((s, seriesIndex) => {
      const color = s.color || palette.primary[seriesIndex % palette.primary.length];
      ctx.strokeStyle = color;
      ctx.lineWidth = 2;

      ctx.beginPath();
      s.data.forEach((point, index) => {
        const x = index * scaleX;
        const y = chartHeight - ((point.y || 0) as number) * scaleY;
        if (index === 0) {
          ctx.moveTo(x, y);
        } else {
          ctx.lineTo(x, y);
        }
      });
      ctx.stroke();

      // Data points
      if (config.dataLabels) {
        ctx.fillStyle = color;
        s.data.forEach((point, index) => {
          const x = index * scaleX;
          const y = chartHeight - ((point.y || 0) as number) * scaleY;
          ctx.beginPath();
          ctx.arc(x, y, 4, 0, Math.PI * 2);
          ctx.fill();
        });
      }
    });
  }

  /**
   * Render animated line chart
   */
  function renderLineChartAnimated(
    rc: RenderContext,
    series: DataSeries[],
    palette: typeof palettes['default'],
    config: ChartConfig,
    progress: number
  ): void {
    if (series.length === 0) return;

    const { ctx, chartWidth, chartHeight } = rc;
    const allData = series.flatMap((s) => s.data);
    const maxValue = Math.max(...allData.map((d) => (d.y || 0) as number));
    const scaleX = chartWidth / (allData.length - 1 || 1);
    const scaleY = chartHeight / (maxValue * 1.1);

    series.forEach((s, seriesIndex) => {
      const color = s.color || palette.primary[seriesIndex % palette.primary.length];
      ctx.strokeStyle = color;
      ctx.lineWidth = 2;

      ctx.beginPath();
      s.data.forEach((point, index) => {
        const x = index * scaleX;
        const y = chartHeight - ((point.y || 0) as number) * scaleY;
        if (index === 0) {
          ctx.moveTo(x, y);
        } else if (index / (s.data.length - 1) <= progress) {
          ctx.lineTo(x, y);
        }
      });
      ctx.stroke();
    });
  }

  /**
   * Render pie/donut chart
   */
  function renderPieChart(
    rc: RenderContext,
    series: DataSeries[],
    palette: typeof palettes['default'],
    config: ChartConfig
  ): void {
    if (series.length === 0) return;

    const { ctx, chartWidth, chartHeight } = rc;
    const data = series[0].data;
    const total = data.reduce((sum, d) => sum + ((d.y || d.value || 0) as number), 0);

    const centerX = chartWidth / 2;
    const centerY = chartHeight / 2;
    const radius = Math.min(chartWidth, chartHeight) / 2 * 0.8;
    const innerRadius = config.type === 'donut' ? radius * 0.5 : 0;

    let currentAngle = -Math.PI / 2;

    data.forEach((point, index) => {
      const value = (point.y || point.value || 0) as number;
      const angle = (value / total) * 2 * Math.PI;
      const color = palette.primary[index % palette.primary.length];

      ctx.fillStyle = color;
      ctx.beginPath();

      if (innerRadius > 0) {
        // Donut
        ctx.arc(centerX, centerY, radius, currentAngle, currentAngle + angle);
        ctx.arc(centerX, centerY, innerRadius, currentAngle + angle, currentAngle, true);
      } else {
        // Pie
        ctx.moveTo(centerX, centerY);
        ctx.arc(centerX, centerY, radius, currentAngle, currentAngle + angle);
      }

      ctx.closePath();
      ctx.fill();

      currentAngle += angle;
    });
  }

  /**
   * Render animated pie/donut chart
   */
  function renderPieChartAnimated(
    rc: RenderContext,
    series: DataSeries[],
    palette: typeof palettes['default'],
    config: ChartConfig,
    progress: number
  ): void {
    if (series.length === 0) return;

    const { ctx, chartWidth, chartHeight } = rc;
    const data = series[0].data;
    const total = data.reduce((sum, d) => sum + ((d.y || d.value || 0) as number), 0);

    const centerX = chartWidth / 2;
    const centerY = chartHeight / 2;
    const radius = Math.min(chartWidth, chartHeight) / 2 * 0.8 * progress;
    const innerRadius = config.type === 'donut' ? radius * 0.5 : 0;

    let currentAngle = -Math.PI / 2;

    data.forEach((point, index) => {
      const value = (point.y || point.value || 0) as number;
      const angle = (value / total) * 2 * Math.PI;
      const color = palette.primary[index % palette.primary.length];

      ctx.fillStyle = color;
      ctx.beginPath();

      if (innerRadius > 0) {
        ctx.arc(centerX, centerY, radius, currentAngle, currentAngle + angle);
        ctx.arc(centerX, centerY, innerRadius, currentAngle + angle, currentAngle, true);
      } else {
        ctx.moveTo(centerX, centerY);
        ctx.arc(centerX, centerY, radius, currentAngle, currentAngle + angle);
      }

      ctx.closePath();
      ctx.fill();

      currentAngle += angle;
    });
  }

  /**
   * Render area chart
   */
  function renderAreaChart(
    rc: RenderContext,
    series: DataSeries[],
    palette: typeof palettes['default'],
    config: ChartConfig
  ): void {
    if (series.length === 0) return;

    const { ctx, chartWidth, chartHeight } = rc;
    const allData = series.flatMap((s) => s.data);
    const maxValue = Math.max(...allData.map((d) => (d.y || 0) as number));
    const scaleX = chartWidth / (allData.length - 1 || 1);
    const scaleY = chartHeight / (maxValue * 1.1);

    series.forEach((s, seriesIndex) => {
      const color = s.color || palette.primary[seriesIndex % palette.primary.length];

      ctx.fillStyle = color + '40'; // 25% opacity
      ctx.strokeStyle = color;
      ctx.lineWidth = 2;

      ctx.beginPath();
      s.data.forEach((point, index) => {
        const x = index * scaleX;
        const y = chartHeight - ((point.y || 0) as number) * scaleY;
        if (index === 0) {
          ctx.moveTo(x, y);
        } else {
          ctx.lineTo(x, y);
        }
      });
      ctx.lineTo(chartWidth, chartHeight);
      ctx.lineTo(0, chartHeight);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    });
  }

  /**
   * Render animated area chart
   */
  function renderAreaChartAnimated(
    rc: RenderContext,
    series: DataSeries[],
    palette: typeof palettes['default'],
    config: ChartConfig,
    progress: number
  ): void {
    if (series.length === 0) return;

    const { ctx, chartWidth, chartHeight } = rc;
    const allData = series.flatMap((s) => s.data);
    const maxValue = Math.max(...allData.map((d) => (d.y || 0) as number));
    const scaleX = chartWidth / (allData.length - 1 || 1);
    const scaleY = (chartHeight / (maxValue * 1.1)) * progress;

    series.forEach((s, seriesIndex) => {
      const color = s.color || palette.primary[seriesIndex % palette.primary.length];

      ctx.fillStyle = color + '40';
      ctx.strokeStyle = color;
      ctx.lineWidth = 2;

      ctx.beginPath();
      s.data.forEach((point, index) => {
        const x = index * scaleX;
        const y = chartHeight - ((point.y || 0) as number) * scaleY;
        if (index === 0) {
          ctx.moveTo(x, y);
        } else {
          ctx.lineTo(x, y);
        }
      });
      ctx.lineTo(chartWidth, chartHeight);
      ctx.lineTo(0, chartHeight);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    });
  }

  /**
   * Render placeholder for unsupported chart types
   */
  function renderPlaceholder(
    rc: RenderContext,
    type: string,
    palette: typeof palettes['default']
  ): void {
    const { ctx, chartWidth, chartHeight } = rc;

    ctx.fillStyle = '#e5e7eb';
    ctx.fillRect(chartWidth / 4, chartHeight / 3, chartWidth / 2, chartHeight / 3);

    ctx.fillStyle = '#6b7280';
    ctx.font = '14px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(`${type} chart`, chartWidth / 2, chartHeight / 2 + 5);
  }

  /**
   * Render axes
   */
  function renderAxes(
    rc: RenderContext,
    series: DataSeries[],
    config: ChartConfig,
    palette: typeof palettes['default']
  ): void {
    const { ctx, chartWidth, chartHeight } = rc;

    ctx.strokeStyle = palette.background[2];
    ctx.lineWidth = 1;
    ctx.fillStyle = palette.text.secondary;
    ctx.font = '12px sans-serif';
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';

    // Y-axis
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(0, chartHeight);
    ctx.stroke();

    // X-axis
    ctx.beginPath();
    ctx.moveTo(0, chartHeight);
    ctx.lineTo(chartWidth, chartHeight);
    ctx.stroke();

    // Y-axis labels
    const maxValue = Math.max(...series.flatMap((s) => s.data.map((d) => (d.y || 0) as number)));
    const steps = 5;

    for (let i = 0; i <= steps; i++) {
      const value = (maxValue / steps) * i;
      const y = chartHeight - (chartHeight / steps) * i;
      ctx.fillText(String(Math.round(value)), -10, y);

      // Grid line
      if (config.xAxis?.grid?.enabled !== false && i > 0) {
        ctx.save();
        ctx.strokeStyle = palette.background[2];
        ctx.setLineDash([4, 4]);
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(chartWidth, y);
        ctx.stroke();
        ctx.restore();
      }
    }

    // Axis titles
    if (config.yAxis?.title) {
      ctx.save();
      ctx.translate(-margin.left + 20, chartHeight / 2);
      ctx.rotate(-Math.PI / 2);
      ctx.textAlign = 'center';
      ctx.fillText(config.yAxis.title, 0, 0);
      ctx.restore();
    }

    if (config.xAxis?.title) {
      ctx.textAlign = 'center';
      ctx.fillText(config.xAxis.title, chartWidth / 2, chartHeight + 40);
    }
  }

  /**
   * Get chart metadata
   */
  function getMetadata(type: string): ChartMetadata {
    const metadata: Record<string, ChartMetadata> = {
      line: {
        type: 'line',
        name: 'Line Chart',
        description: 'Show trends over time or categories',
        axes: ['x', 'y'],
        dataStructure: 'Array of { x, y } points',
        useCases: ['Time series', 'Trends', 'Progress over time'],
      },
      bar: {
        type: 'bar',
        name: 'Bar Chart',
        description: 'Compare values across categories',
        axes: ['x', 'y'],
        dataStructure: 'Array of { x, y } points',
        useCases: ['Comparisons', 'Rankings', 'Category distribution'],
      },
      pie: {
        type: 'pie',
        name: 'Pie Chart',
        description: 'Show part-to-whole relationships',
        axes: [],
        dataStructure: 'Array of { name, value }',
        useCases: ['Composition', 'Percentage distribution'],
      },
      donut: {
        type: 'donut',
        name: 'Donut Chart',
        description: 'Show part-to-whole with center space',
        axes: [],
        dataStructure: 'Array of { name, value }',
        useCases: ['Composition', 'Percentage distribution'],
      },
      area: {
        type: 'area',
        name: 'Area Chart',
        description: 'Show cumulative totals over time',
        axes: ['x', 'y'],
        dataStructure: 'Array of { x, y } points',
        useCases: ['Volume over time', 'Cumulative data'],
      },
    };

    return metadata[type] || metadata.line;
  }

  /**
   * Export to data URL
   */
  function toDataURL(format: 'png' | 'jpeg' = 'png', quality: number = 0.92): string | null {
    if (!currentCanvas) return null;
    return currentCanvas.toDataURL(`image/${format}`, quality);
  }

  /**
   * Get canvas element
   */
  function getCanvas(): HTMLCanvasElement | null {
    return currentCanvas;
  }

  return {
    render,
    renderAnimated,
    getMetadata,
    toDataURL,
    getCanvas,
  };
}

/**
 * Global Canvas renderer instance
 */
export const globalCanvasRenderer = createCanvasRenderer();
