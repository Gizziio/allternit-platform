/**
 * SVG Chart Renderer
 * 
 * Renders charts to SVG format.
 */

import type { ChartConfig, DataSeries, DataPoint, ChartMetadata, ChartPalette } from '../types';
import { palettes } from '../types';

export interface SVGRenderer {
  /** Render chart to SVG string */
  render(config: ChartConfig, series: DataSeries[]): string;
  /** Get chart metadata */
  getMetadata(type: string): ChartMetadata;
}

/**
 * Create SVG chart renderer
 */
export function createSVGRenderer(): SVGRenderer {
  const defaultWidth = 800;
  const defaultHeight = 400;
  const margin = { top: 60, right: 40, bottom: 60, left: 80 };

  /**
   * Render chart to SVG
   */
  function render(config: ChartConfig, series: DataSeries[]): string {
    const width = config.width || defaultWidth;
    const height = config.height || defaultHeight;
    const palette = palettes[config.theme || 'default'];

    const chartWidth = width - margin.left - margin.right;
    const chartHeight = height - margin.top - margin.bottom;

    let svg = `<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">\n`;
    
    // Background
    svg += `  <rect width="${width}" height="${height}" fill="${palette.background[0]}" />\n`;
    
    // Title
    if (config.title) {
      svg += `  <text x="${width / 2}" y="30" text-anchor="middle" font-family="sans-serif" font-size="18" font-weight="bold" fill="${palette.text.primary}">${escapeHtml(config.title)}</text>\n`;
    }

    // Chart group
    svg += `  <g transform="translate(${margin.left}, ${margin.top})">\n`;

    // Render based on chart type
    switch (config.type) {
      case 'bar':
        svg += renderBarChart(chartWidth, chartHeight, series, palette, config);
        break;
      case 'line':
        svg += renderLineChart(chartWidth, chartHeight, series, palette, config);
        break;
      case 'pie':
      case 'donut':
        svg += renderPieChart(chartWidth, chartHeight, series, palette, config);
        break;
      case 'area':
        svg += renderAreaChart(chartWidth, chartHeight, series, palette, config);
        break;
      default:
        svg += renderPlaceholder(chartWidth, chartHeight, config.type);
    }

    // Axes
    if (['bar', 'line', 'area'].includes(config.type)) {
      svg += renderAxes(chartWidth, chartHeight, series, config, palette);
    }

    svg += `  </g>\n`;
    svg += `</svg>`;

    return svg;
  }

  /**
   * Render bar chart
   */
  function renderBarChart(
    width: number,
    height: number,
    series: DataSeries[],
    palette: ChartPalette,
    config: ChartConfig
  ): string {
    let svg = '';
    
    if (series.length === 0) return svg;

    const allData = series.flatMap(s => s.data);
    const maxValue = Math.max(...allData.map(d => (d.y || d.value || 0) as number));
    const categories = [...new Set(allData.map(d => d.x || d.name))];
    
    const barWidth = (width / categories.length) * 0.6 / series.length;
    const scaleY = height / (maxValue * 1.1);

    series.forEach((s, seriesIndex) => {
      const color = s.color || palette.primary[seriesIndex % palette.primary.length];
      
      s.data.forEach((point, pointIndex) => {
        const value = (point.y || point.value || 0) as number;
        const barHeight = value * scaleY;
        const x = (pointIndex + 0.2) * (width / categories.length) + seriesIndex * barWidth;
        const y = height - barHeight;

        svg += `    <rect x="${x}" y="${y}" width="${barWidth}" height="${barHeight}" fill="${color}" />\n`;
      });
    });

    return svg;
  }

  /**
   * Render line chart
   */
  function renderLineChart(
    width: number,
    height: number,
    series: DataSeries[],
    palette: ChartPalette,
    config: ChartConfig
  ): string {
    let svg = '';
    
    if (series.length === 0) return svg;

    const allData = series.flatMap(s => s.data);
    const maxValue = Math.max(...allData.map(d => (d.y || 0) as number));
    const scaleX = width / (allData.length - 1 || 1);
    const scaleY = height / (maxValue * 1.1);

    series.forEach((s, seriesIndex) => {
      const color = s.color || palette.primary[seriesIndex % palette.primary.length];
      
      // Generate path
      let path = '';
      s.data.forEach((point, index) => {
        const x = index * scaleX;
        const y = height - ((point.y || 0) as number) * scaleY;
        path += index === 0 ? `M ${x} ${y}` : ` L ${x} ${y}`;
      });

      svg += `    <path d="${path}" fill="none" stroke="${color}" stroke-width="2" />\n`;

      // Data points
      if (config.dataLabels) {
        s.data.forEach((point, index) => {
          const x = index * scaleX;
          const y = height - ((point.y || 0) as number) * scaleY;
          svg += `    <circle cx="${x}" cy="${y}" r="4" fill="${color}" />\n`;
        });
      }
    });

    return svg;
  }

  /**
   * Render pie/donut chart
   */
  function renderPieChart(
    width: number,
    height: number,
    series: DataSeries[],
    palette: ChartPalette,
    config: ChartConfig
  ): string {
    let svg = '';
    
    if (series.length === 0) return svg;

    const data = series[0].data;
    const total = data.reduce((sum, d) => sum + ((d.y || d.value || 0) as number), 0);
    
    const centerX = width / 2;
    const centerY = height / 2;
    const radius = Math.min(width, height) / 2 * 0.8;
    const innerRadius = config.type === 'donut' ? radius * 0.5 : 0;

    let currentAngle = -Math.PI / 2;

    data.forEach((point, index) => {
      const value = (point.y || point.value || 0) as number;
      const angle = (value / total) * 2 * Math.PI;
      const color = palette.primary[index % palette.primary.length];

      const x1 = centerX + Math.cos(currentAngle) * radius;
      const y1 = centerY + Math.sin(currentAngle) * radius;
      const x2 = centerX + Math.cos(currentAngle + angle) * radius;
      const y2 = centerY + Math.sin(currentAngle + angle) * radius;

      const largeArc = angle > Math.PI ? 1 : 0;

      if (innerRadius > 0) {
        // Donut
        const ix1 = centerX + Math.cos(currentAngle) * innerRadius;
        const iy1 = centerY + Math.sin(currentAngle) * innerRadius;
        const ix2 = centerX + Math.cos(currentAngle + angle) * innerRadius;
        const iy2 = centerY + Math.sin(currentAngle + angle) * innerRadius;

        svg += `    <path d="M ${x1} ${y1} A ${radius} ${radius} 0 ${largeArc} 1 ${x2} ${y2} L ${ix2} ${iy2} A ${innerRadius} ${innerRadius} 0 ${largeArc} 0 ${ix1} ${iy1} Z" fill="${color}" />\n`;
      } else {
        // Pie
        svg += `    <path d="M ${centerX} ${centerY} L ${x1} ${y1} A ${radius} ${radius} 0 ${largeArc} 1 ${x2} ${y2} Z" fill="${color}" />\n`;
      }

      currentAngle += angle;
    });

    return svg;
  }

  /**
   * Render area chart
   */
  function renderAreaChart(
    width: number,
    height: number,
    series: DataSeries[],
    palette: ChartPalette,
    config: ChartConfig
  ): string {
    let svg = '';
    
    if (series.length === 0) return svg;

    const allData = series.flatMap(s => s.data);
    const maxValue = Math.max(...allData.map(d => (d.y || 0) as number));
    const scaleX = width / (allData.length - 1 || 1);
    const scaleY = height / (maxValue * 1.1);

    series.forEach((s, seriesIndex) => {
      const color = s.color || palette.primary[seriesIndex % palette.primary.length];
      const fillColor = color + '40'; // 25% opacity
      
      // Generate area path
      let path = '';
      s.data.forEach((point, index) => {
        const x = index * scaleX;
        const y = height - ((point.y || 0) as number) * scaleY;
        path += index === 0 ? `M ${x} ${y}` : ` L ${x} ${y}`;
      });
      
      // Close the area
      path += ` L ${width} ${height} L 0 ${height} Z`;

      svg += `    <path d="${path}" fill="${fillColor}" stroke="${color}" stroke-width="2" />\n`;
    });

    return svg;
  }

  /**
   * Render placeholder for unsupported chart types
   */
  function renderPlaceholder(width: number, height: number, type: string): string {
    return `    <rect x="${width / 4}" y="${height / 3}" width="${width / 2}" height="${height / 3}" fill="#e5e7eb" rx="8" />\n    <text x="${width / 2}" y="${height / 2}" text-anchor="middle" font-family="sans-serif" font-size="14" fill="#6b7280">${type} chart</text>\n`;
  }

  /**
   * Render axes
   */
  function renderAxes(
    width: number,
    height: number,
    series: DataSeries[],
    config: ChartConfig,
    palette: ChartPalette
  ): string {
    let svg = '';

    // Y-axis
    svg += `    <line x1="0" y1="0" x2="0" y2="${height}" stroke="${palette.background[2]}" stroke-width="1" />\n`;
    
    // X-axis
    svg += `    <line x1="0" y1="${height}" x2="${width}" y2="${height}" stroke="${palette.background[2]}" stroke-width="1" />\n`;

    // Y-axis labels
    const yAxis = config.yAxis || {};
    const maxValue = Math.max(...series.flatMap(s => s.data.map(d => (d.y || 0) as number)));
    const steps = 5;
    
    for (let i = 0; i <= steps; i++) {
      const value = (maxValue / steps) * i;
      const y = height - (height / steps) * i;
      svg += `    <text x="-10" y="${y + 4}" text-anchor="end" font-family="sans-serif" font-size="12" fill="${palette.text.secondary}">${Math.round(value)}</text>\n`;
      
      // Grid line
      if (config.xAxis?.grid?.enabled !== false && i > 0) {
        svg += `    <line x1="0" y1="${y}" x2="${width}" y2="${y}" stroke="${palette.background[2]}" stroke-width="1" stroke-dasharray="4,4" />\n`;
      }
    }

    // Axis titles
    if (yAxis.title) {
      svg += `    <text x="${-margin.left + 20}" y="${height / 2}" transform="rotate(-90, ${-margin.left + 20}, ${height / 2})" text-anchor="middle" font-family="sans-serif" font-size="12" fill="${palette.text.secondary}">${escapeHtml(yAxis.title)}</text>\n`;
    }

    if (config.xAxis?.title) {
      svg += `    <text x="${width / 2}" y="${height + 40}" text-anchor="middle" font-family="sans-serif" font-size="12" fill="${palette.text.secondary}">${escapeHtml(config.xAxis.title)}</text>\n`;
    }

    return svg;
  }

  /**
   * Escape HTML special characters
   */
  function escapeHtml(text: string): string {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
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

  return {
    render,
    getMetadata,
  };
}

/**
 * Global SVG renderer instance
 */
export const globalSVGRenderer = createSVGRenderer();
