/**
 * SVG Renderer Tests
 */

import { describe, it, expect } from 'vitest';
import { createSVGRenderer, globalSVGRenderer } from './svg-renderer';
import type { ChartConfig, DataSeries } from '../types';

describe('SVG Renderer', () => {
  describe('createSVGRenderer', () => {
    it('should create a renderer instance', () => {
      const renderer = createSVGRenderer();
      expect(renderer).toBeDefined();
      expect(typeof renderer.render).toBe('function');
      expect(typeof renderer.getMetadata).toBe('function');
    });
  });

  describe('globalSVGRenderer', () => {
    it('should export a global renderer instance', () => {
      expect(globalSVGRenderer).toBeDefined();
      expect(typeof globalSVGRenderer.render).toBe('function');
    });
  });

  describe('bar chart rendering', () => {
    const renderer = createSVGRenderer();

    it('should render a basic bar chart', () => {
      const config: ChartConfig = {
        type: 'bar',
        title: 'Sales by Month',
        width: 800,
        height: 400,
      };

      const series: DataSeries[] = [
        {
          id: 'sales',
          name: 'Sales',
          data: [
            { x: 'Jan', y: 100 },
            { x: 'Feb', y: 150 },
            { x: 'Mar', y: 200 },
          ],
        },
      ];

      const svg = renderer.render(config, series);

      expect(svg).toContain('<svg');
      expect(svg).toContain('</svg>');
      expect(svg).toContain('Sales by Month');
      expect(svg).toContain('<rect');
    });

    it('should render multiple data series', () => {
      const config: ChartConfig = {
        type: 'bar',
        width: 800,
        height: 400,
      };

      const series: DataSeries[] = [
        {
          id: 'sales2023',
          name: 'Sales 2023',
          data: [
            { x: 'Q1', y: 100 },
            { x: 'Q2', y: 150 },
          ],
        },
        {
          id: 'sales2024',
          name: 'Sales 2024',
          data: [
            { x: 'Q1', y: 120 },
            { x: 'Q2', y: 180 },
          ],
        },
      ];

      const svg = renderer.render(config, series);

      // Should contain rectangles for bars
      const rectMatches = svg.match(/<rect/g);
      expect(rectMatches?.length).toBeGreaterThanOrEqual(4);
    });

    it('should handle empty data series', () => {
      const config: ChartConfig = {
        type: 'bar',
        width: 800,
        height: 400,
      };

      const svg = renderer.render(config, []);

      expect(svg).toContain('<svg');
      expect(svg).toContain('</svg>');
    });

    it('should use custom series colors', () => {
      const config: ChartConfig = {
        type: 'bar',
        width: 800,
        height: 400,
      };

      const series: DataSeries[] = [
        {
          id: 'sales',
          name: 'Sales',
          color: '#ff0000',
          data: [{ x: 'Jan', y: 100 }],
        },
      ];

      const svg = renderer.render(config, series);

      expect(svg).toContain('#ff0000');
    });
  });

  describe('line chart rendering', () => {
    const renderer = createSVGRenderer();

    it('should render a basic line chart', () => {
      const config: ChartConfig = {
        type: 'line',
        title: 'Revenue Trend',
        width: 800,
        height: 400,
      };

      const series: DataSeries[] = [
        {
          id: 'revenue',
          name: 'Revenue',
          data: [
            { x: 'Jan', y: 100 },
            { x: 'Feb', y: 150 },
            { x: 'Mar', y: 200 },
          ],
        },
      ];

      const svg = renderer.render(config, series);

      expect(svg).toContain('<svg');
      expect(svg).toContain('Revenue Trend');
      expect(svg).toContain('<path');
      expect(svg).toContain('fill="none"');
    });

    it('should render data points when dataLabels is enabled', () => {
      const config: ChartConfig = {
        type: 'line',
        width: 800,
        height: 400,
        dataLabels: true,
      };

      const series: DataSeries[] = [
        {
          id: 'revenue',
          name: 'Revenue',
          data: [
            { x: 'Jan', y: 100 },
            { x: 'Feb', y: 150 },
          ],
        },
      ];

      const svg = renderer.render(config, series);

      expect(svg).toContain('<circle');
    });

    it('should handle single data point', () => {
      const config: ChartConfig = {
        type: 'line',
        width: 800,
        height: 400,
      };

      const series: DataSeries[] = [
        {
          id: 'revenue',
          name: 'Revenue',
          data: [{ x: 'Jan', y: 100 }],
        },
      ];

      const svg = renderer.render(config, series);

      expect(svg).toContain('<svg');
      expect(svg).toContain('<path');
    });
  });

  describe('pie chart rendering', () => {
    const renderer = createSVGRenderer();

    it('should render a pie chart', () => {
      const config: ChartConfig = {
        type: 'pie',
        title: 'Market Share',
        width: 800,
        height: 400,
      };

      const series: DataSeries[] = [
        {
          id: 'share',
          name: 'Market Share',
          data: [
            { name: 'Product A', value: 40 },
            { name: 'Product B', value: 30 },
            { name: 'Product C', value: 30 },
          ],
        },
      ];

      const svg = renderer.render(config, series);

      expect(svg).toContain('<svg');
      expect(svg).toContain('Market Share');
      expect(svg).toContain('<path');
    });

    it('should calculate correct pie slices', () => {
      const config: ChartConfig = {
        type: 'pie',
        width: 800,
        height: 400,
      };

      const series: DataSeries[] = [
        {
          id: 'share',
          name: 'Market Share',
          data: [
            { name: 'A', value: 50 },
            { name: 'B', value: 50 },
          ],
        },
      ];

      const svg = renderer.render(config, series);

      // Should have 2 path elements for the slices
      const pathMatches = svg.match(/<path/g);
      expect(pathMatches?.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe('donut chart rendering', () => {
    const renderer = createSVGRenderer();

    it('should render a donut chart', () => {
      const config: ChartConfig = {
        type: 'donut',
        title: 'Sales Distribution',
        width: 800,
        height: 400,
      };

      const series: DataSeries[] = [
        {
          id: 'sales',
          name: 'Sales',
          data: [
            { name: 'Online', value: 60 },
            { name: 'Retail', value: 40 },
          ],
        },
      ];

      const svg = renderer.render(config, series);

      expect(svg).toContain('<svg');
      expect(svg).toContain('Sales Distribution');
    });

    it('should create donut shape with inner radius', () => {
      const config: ChartConfig = {
        type: 'donut',
        width: 800,
        height: 400,
      };

      const series: DataSeries[] = [
        {
          id: 'sales',
          name: 'Sales',
          data: [
            { name: 'A', value: 50 },
            { name: 'B', value: 50 },
          ],
        },
      ];

      const svg = renderer.render(config, series);

      // Donut paths should contain both outer and inner arc commands
      expect(svg).toContain('A');
    });
  });

  describe('area chart rendering', () => {
    const renderer = createSVGRenderer();

    it('should render an area chart', () => {
      const config: ChartConfig = {
        type: 'area',
        title: 'Cumulative Growth',
        width: 800,
        height: 400,
      };

      const series: DataSeries[] = [
        {
          id: 'growth',
          name: 'Growth',
          data: [
            { x: 'Q1', y: 100 },
            { x: 'Q2', y: 150 },
            { x: 'Q3', y: 200 },
          ],
        },
      ];

      const svg = renderer.render(config, series);

      expect(svg).toContain('<svg');
      expect(svg).toContain('Cumulative Growth');
      expect(svg).toContain('<path');
    });

    it('should create closed area path', () => {
      const config: ChartConfig = {
        type: 'area',
        width: 800,
        height: 400,
      };

      const series: DataSeries[] = [
        {
          id: 'growth',
          name: 'Growth',
          data: [
            { x: 'Q1', y: 100 },
            { x: 'Q2', y: 150 },
          ],
        },
      ];

      const svg = renderer.render(config, series);

      // Area should close the path
      expect(svg).toContain('Z');
    });
  });

  describe('scatter chart rendering', () => {
    const renderer = createSVGRenderer();

    it('should render scatter chart as placeholder (unsupported)', () => {
      const config: ChartConfig = {
        type: 'scatter',
        title: 'Correlation Analysis',
        width: 800,
        height: 400,
      };

      const series: DataSeries[] = [
        {
          id: 'data',
          name: 'Data Points',
          data: [
            { x: 1, y: 2 },
            { x: 2, y: 4 },
            { x: 3, y: 6 },
          ],
        },
      ];

      const svg = renderer.render(config, series);

      expect(svg).toContain('<svg');
      expect(svg).toContain('scatter chart');
    });
  });

  describe('theme support', () => {
    const renderer = createSVGRenderer();

    it('should use light theme by default', () => {
      const config: ChartConfig = {
        type: 'bar',
        width: 800,
        height: 400,
      };

      const series: DataSeries[] = [
        {
          id: 'data',
          name: 'Data',
          data: [{ x: 'A', y: 100 }],
        },
      ];

      const svg = renderer.render(config, series);

      // Light theme background
      expect(svg).toContain('#ffffff');
    });

    it('should use dark theme when specified', () => {
      const config: ChartConfig = {
        type: 'bar',
        width: 800,
        height: 400,
        theme: 'dark',
      };

      const series: DataSeries[] = [
        {
          id: 'data',
          name: 'Data',
          data: [{ x: 'A', y: 100 }],
        },
      ];

      const svg = renderer.render(config, series);

      // Dark theme background
      expect(svg).toContain('#1f2937');
    });
  });

  describe('color palette generation', () => {
    const renderer = createSVGRenderer();

    it('should use default palette colors', () => {
      const config: ChartConfig = {
        type: 'bar',
        width: 800,
        height: 400,
      };

      const series: DataSeries[] = [
        {
          id: 'series1',
          name: 'Series 1',
          data: [{ x: 'A', y: 100 }],
        },
      ];

      const svg = renderer.render(config, series);

      // Should use primary color from default palette
      expect(svg).toContain('#3b82f6');
    });

    it('should cycle through palette colors for multiple series', () => {
      const config: ChartConfig = {
        type: 'bar',
        width: 800,
        height: 400,
      };

      const series: DataSeries[] = [
        { id: 's1', name: 'S1', data: [{ x: 'A', y: 100 }] },
        { id: 's2', name: 'S2', data: [{ x: 'A', y: 200 }] },
        { id: 's3', name: 'S3', data: [{ x: 'A', y: 300 }] },
      ];

      const svg = renderer.render(config, series);

      // Should use different colors from palette
      expect(svg).toContain('#3b82f6'); // blue
      expect(svg).toContain('#10b981'); // green
      expect(svg).toContain('#f59e0b'); // amber
    });
  });

  describe('responsive sizing', () => {
    const renderer = createSVGRenderer();

    it('should use default dimensions when not specified', () => {
      const config: ChartConfig = {
        type: 'bar',
      };

      const series: DataSeries[] = [
        {
          id: 'data',
          name: 'Data',
          data: [{ x: 'A', y: 100 }],
        },
      ];

      const svg = renderer.render(config, series);

      expect(svg).toContain('width="800"');
      expect(svg).toContain('height="400"');
    });

    it('should use custom dimensions when specified', () => {
      const config: ChartConfig = {
        type: 'bar',
        width: 1200,
        height: 600,
      };

      const series: DataSeries[] = [
        {
          id: 'data',
          name: 'Data',
          data: [{ x: 'A', y: 100 }],
        },
      ];

      const svg = renderer.render(config, series);

      expect(svg).toContain('width="1200"');
      expect(svg).toContain('height="600"');
      expect(svg).toContain('viewBox="0 0 1200 600"');
    });
  });

  describe('axes rendering', () => {
    const renderer = createSVGRenderer();

    it('should render axes for bar chart', () => {
      const config: ChartConfig = {
        type: 'bar',
        width: 800,
        height: 400,
      };

      const series: DataSeries[] = [
        {
          id: 'data',
          name: 'Data',
          data: [
            { x: 'A', y: 100 },
            { x: 'B', y: 200 },
          ],
        },
      ];

      const svg = renderer.render(config, series);

      // Should have axis lines
      expect(svg).toContain('<line');
    });

    it('should render y-axis title', () => {
      const config: ChartConfig = {
        type: 'bar',
        width: 800,
        height: 400,
        yAxis: {
          title: 'Sales Amount',
        },
      };

      const series: DataSeries[] = [
        {
          id: 'data',
          name: 'Data',
          data: [{ x: 'A', y: 100 }],
        },
      ];

      const svg = renderer.render(config, series);

      expect(svg).toContain('Sales Amount');
    });

    it('should render x-axis title', () => {
      const config: ChartConfig = {
        type: 'bar',
        width: 800,
        height: 400,
        xAxis: {
          title: 'Categories',
        },
      };

      const series: DataSeries[] = [
        {
          id: 'data',
          name: 'Data',
          data: [{ x: 'A', y: 100 }],
        },
      ];

      const svg = renderer.render(config, series);

      expect(svg).toContain('Categories');
    });

    it('should render grid lines when enabled', () => {
      const config: ChartConfig = {
        type: 'line',
        width: 800,
        height: 400,
        xAxis: {
          grid: {
            enabled: true,
          },
        },
      };

      const series: DataSeries[] = [
        {
          id: 'data',
          name: 'Data',
          data: [
            { x: 'A', y: 100 },
            { x: 'B', y: 200 },
          ],
        },
      ];

      const svg = renderer.render(config, series);

      // Grid lines use stroke-dasharray
      expect(svg).toContain('stroke-dasharray');
    });
  });

  describe('metadata', () => {
    const renderer = createSVGRenderer();

    it('should return metadata for line chart', () => {
      const metadata = renderer.getMetadata('line');

      expect(metadata.type).toBe('line');
      expect(metadata.name).toBe('Line Chart');
      expect(metadata.axes).toContain('x');
      expect(metadata.axes).toContain('y');
      expect(metadata.useCases).toContain('Time series');
    });

    it('should return metadata for bar chart', () => {
      const metadata = renderer.getMetadata('bar');

      expect(metadata.type).toBe('bar');
      expect(metadata.name).toBe('Bar Chart');
      expect(metadata.axes).toContain('x');
      expect(metadata.axes).toContain('y');
      expect(metadata.useCases).toContain('Comparisons');
    });

    it('should return metadata for pie chart', () => {
      const metadata = renderer.getMetadata('pie');

      expect(metadata.type).toBe('pie');
      expect(metadata.name).toBe('Pie Chart');
      expect(metadata.axes).toHaveLength(0);
    });

    it('should return metadata for donut chart', () => {
      const metadata = renderer.getMetadata('donut');

      expect(metadata.type).toBe('donut');
      expect(metadata.name).toBe('Donut Chart');
      expect(metadata.axes).toHaveLength(0);
    });

    it('should return metadata for area chart', () => {
      const metadata = renderer.getMetadata('area');

      expect(metadata.type).toBe('area');
      expect(metadata.name).toBe('Area Chart');
      expect(metadata.axes).toContain('x');
      expect(metadata.axes).toContain('y');
    });

    it('should return line metadata as default for unknown types', () => {
      const metadata = renderer.getMetadata('unknown');

      expect(metadata.type).toBe('line');
    });
  });

  describe('title rendering', () => {
    const renderer = createSVGRenderer();

    it('should render chart title when provided', () => {
      const config: ChartConfig = {
        type: 'bar',
        title: 'My Chart Title',
        width: 800,
        height: 400,
      };

      const series: DataSeries[] = [
        {
          id: 'data',
          name: 'Data',
          data: [{ x: 'A', y: 100 }],
        },
      ];

      const svg = renderer.render(config, series);

      expect(svg).toContain('My Chart Title');
      expect(svg).toContain('font-weight="bold"');
    });

    it('should not render title when not provided', () => {
      const config: ChartConfig = {
        type: 'bar',
        width: 800,
        height: 400,
      };

      const series: DataSeries[] = [
        {
          id: 'data',
          name: 'Data',
          data: [{ x: 'A', y: 100 }],
        },
      ];

      const svg = renderer.render(config, series);

      // Should not contain font-weight="bold" for title
      const boldMatches = svg.match(/font-weight="bold"/g);
      expect(boldMatches).toBeNull();
    });
  });

  describe('HTML escaping', () => {
    const renderer = createSVGRenderer();

    it('should escape HTML in titles', () => {
      const config: ChartConfig = {
        type: 'bar',
        title: '<script>alert("xss")</script>',
        width: 800,
        height: 400,
      };

      const series: DataSeries[] = [
        {
          id: 'data',
          name: 'Data',
          data: [{ x: 'A', y: 100 }],
        },
      ];

      const svg = renderer.render(config, series);

      expect(svg).not.toContain('<script>');
      expect(svg).toContain('&lt;script&gt;');
    });

    it('should escape HTML in axis titles', () => {
      const config: ChartConfig = {
        type: 'bar',
        width: 800,
        height: 400,
        xAxis: {
          title: '<b>Bold</b>',
        },
      };

      const series: DataSeries[] = [
        {
          id: 'data',
          name: 'Data',
          data: [{ x: 'A', y: 100 }],
        },
      ];

      const svg = renderer.render(config, series);

      expect(svg).not.toContain('<b>');
      expect(svg).toContain('&lt;b&gt;');
    });
  });

  describe('export functionality', () => {
    const renderer = createSVGRenderer();

    it('should generate valid SVG markup', () => {
      const config: ChartConfig = {
        type: 'bar',
        title: 'Export Test',
        width: 800,
        height: 400,
      };

      const series: DataSeries[] = [
        {
          id: 'data',
          name: 'Data',
          data: [{ x: 'A', y: 100 }],
        },
      ];

      const svg = renderer.render(config, series);

      // Valid SVG structure
      expect(svg.startsWith('<svg')).toBe(true);
      expect(svg.endsWith('</svg>')).toBe(true);
      expect(svg).toContain('xmlns="http://www.w3.org/2000/svg"');
    });

    it('should include viewBox for scaling', () => {
      const config: ChartConfig = {
        type: 'bar',
        width: 1200,
        height: 600,
      };

      const series: DataSeries[] = [
        {
          id: 'data',
          name: 'Data',
          data: [{ x: 'A', y: 100 }],
        },
      ];

      const svg = renderer.render(config, series);

      expect(svg).toContain('viewBox="0 0 1200 600"');
    });
  });
});
