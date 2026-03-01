/**
 * Data Processor Tests
 */

import { describe, it, expect } from 'vitest';
import {
  normalizeDataPoints,
  normalizeSeries,
  aggregateByCategory,
  sortDataPoints,
  filterByRange,
  calculateStats,
  processTimeSeries,
  movingAverage,
  detectOutliers,
  normalizeValues,
  calculatePercentChange,
} from './data-processor';
import type { DataPoint, DataSeries } from '../types';

describe('Data Processor', () => {
  describe('normalizeDataPoints', () => {
    it('should normalize data points with y property', () => {
      const data: DataPoint[] = [
        { x: 'A', y: 100 },
        { x: 'B', y: 200 },
      ];

      const result = normalizeDataPoints(data);

      expect(result[0].y).toBe(100);
      expect(result[1].y).toBe(200);
    });

    it('should normalize data points with value property to y', () => {
      const data: DataPoint[] = [
        { name: 'A', value: 100 },
        { name: 'B', value: 200 },
      ];

      const result = normalizeDataPoints(data);

      expect(result[0].y).toBe(100);
      expect(result[1].y).toBe(200);
    });

    it('should normalize name to x when x is missing', () => {
      const data: DataPoint[] = [
        { name: 'Category A', value: 100 },
        { name: 'Category B', value: 200 },
      ];

      const result = normalizeDataPoints(data);

      expect(result[0].x).toBe('Category A');
      expect(result[1].x).toBe('Category B');
    });

    it('should use defaults for missing values', () => {
      const data: DataPoint[] = [{}];

      const result = normalizeDataPoints(data);

      expect(result[0].x).toBe('');
      expect(result[0].y).toBe(0);
    });

    it('should preserve additional properties', () => {
      const data: DataPoint[] = [
        { x: 'A', y: 100, customProp: 'test' },
      ];

      const result = normalizeDataPoints(data);

      expect(result[0].customProp).toBe('test');
    });
  });

  describe('normalizeSeries', () => {
    it('should normalize all series data points', () => {
      const series: DataSeries[] = [
        {
          id: 's1',
          name: 'Series 1',
          data: [
            { name: 'A', value: 100 },
            { name: 'B', value: 200 },
          ],
        },
      ];

      const result = normalizeSeries(series);

      expect(result[0].data[0].y).toBe(100);
      expect(result[0].data[0].x).toBe('A');
    });

    it('should handle multiple series', () => {
      const series: DataSeries[] = [
        {
          id: 's1',
          name: 'Series 1',
          data: [{ name: 'A', value: 100 }],
        },
        {
          id: 's2',
          name: 'Series 2',
          data: [{ name: 'A', value: 200 }],
        },
      ];

      const result = normalizeSeries(series);

      expect(result).toHaveLength(2);
      expect(result[1].data[0].y).toBe(200);
    });

    it('should preserve series metadata', () => {
      const series: DataSeries[] = [
        {
          id: 's1',
          name: 'Series 1',
          color: '#ff0000',
          data: [{ x: 'A', y: 100 }],
        },
      ];

      const result = normalizeSeries(series);

      expect(result[0].color).toBe('#ff0000');
      expect(result[0].id).toBe('s1');
    });
  });

  describe('aggregateByCategory', () => {
    it('should sum values by default', () => {
      const data: DataPoint[] = [
        { x: 'A', y: 100 },
        { x: 'A', y: 50 },
        { x: 'B', y: 200 },
      ];

      const result = aggregateByCategory(data);

      expect(result.get('A')).toBe(150);
      expect(result.get('B')).toBe(200);
    });

    it('should calculate average when specified', () => {
      const data: DataPoint[] = [
        { x: 'A', y: 100 },
        { x: 'A', y: 200 },
        { x: 'B', y: 300 },
      ];

      const result = aggregateByCategory(data, 'avg');

      expect(result.get('A')).toBe(150);
      expect(result.get('B')).toBe(300);
    });

    it('should find minimum when specified', () => {
      const data: DataPoint[] = [
        { x: 'A', y: 100 },
        { x: 'A', y: 50 },
        { x: 'A', y: 200 },
      ];

      const result = aggregateByCategory(data, 'min');

      expect(result.get('A')).toBe(50);
    });

    it('should find maximum when specified', () => {
      const data: DataPoint[] = [
        { x: 'A', y: 100 },
        { x: 'A', y: 200 },
        { x: 'A', y: 50 },
      ];

      const result = aggregateByCategory(data, 'max');

      expect(result.get('A')).toBe(200);
    });

    it('should count values when specified', () => {
      const data: DataPoint[] = [
        { x: 'A', y: 100 },
        { x: 'A', y: 200 },
        { x: 'B', y: 300 },
      ];

      const result = aggregateByCategory(data, 'count');

      expect(result.get('A')).toBe(2);
      expect(result.get('B')).toBe(1);
    });

    it('should handle name property for categories', () => {
      const data: DataPoint[] = [
        { name: 'Category A', value: 100 },
        { name: 'Category A', value: 200 },
      ];

      const result = aggregateByCategory(data);

      expect(result.get('Category A')).toBe(300);
    });
  });

  describe('sortDataPoints', () => {
    it('should sort by value descending by default', () => {
      const data: DataPoint[] = [
        { x: 'A', y: 100 },
        { x: 'B', y: 300 },
        { x: 'C', y: 200 },
      ];

      const result = sortDataPoints(data);

      expect(result[0].x).toBe('B');
      expect(result[1].x).toBe('C');
      expect(result[2].x).toBe('A');
    });

    it('should sort by value ascending when specified', () => {
      const data: DataPoint[] = [
        { x: 'A', y: 300 },
        { x: 'B', y: 100 },
        { x: 'C', y: 200 },
      ];

      const result = sortDataPoints(data, 'value', 'asc');

      expect(result[0].x).toBe('B');
      expect(result[1].x).toBe('C');
      expect(result[2].x).toBe('A');
    });

    it('should sort by category alphabetically', () => {
      const data: DataPoint[] = [
        { x: 'Z', y: 100 },
        { x: 'A', y: 200 },
        { x: 'M', y: 300 },
      ];

      const result = sortDataPoints(data, 'category', 'asc');

      expect(result[0].x).toBe('A');
      expect(result[1].x).toBe('M');
      expect(result[2].x).toBe('Z');
    });

    it('should sort by category in reverse', () => {
      const data: DataPoint[] = [
        { x: 'A', y: 100 },
        { x: 'Z', y: 200 },
      ];

      const result = sortDataPoints(data, 'category', 'desc');

      expect(result[0].x).toBe('Z');
      expect(result[1].x).toBe('A');
    });

    it('should not mutate original array', () => {
      const data: DataPoint[] = [
        { x: 'B', y: 200 },
        { x: 'A', y: 100 },
      ];

      sortDataPoints(data);

      expect(data[0].x).toBe('B');
      expect(data[1].x).toBe('A');
    });
  });

  describe('filterByRange', () => {
    it('should filter by minimum value', () => {
      const data: DataPoint[] = [
        { x: 'A', y: 50 },
        { x: 'B', y: 100 },
        { x: 'C', y: 150 },
      ];

      const result = filterByRange(data, 100);

      expect(result).toHaveLength(2);
      expect(result[0].x).toBe('B');
      expect(result[1].x).toBe('C');
    });

    it('should filter by maximum value', () => {
      const data: DataPoint[] = [
        { x: 'A', y: 50 },
        { x: 'B', y: 100 },
        { x: 'C', y: 150 },
      ];

      const result = filterByRange(data, undefined, 100);

      expect(result).toHaveLength(2);
      expect(result[0].x).toBe('A');
      expect(result[1].x).toBe('B');
    });

    it('should filter by both min and max', () => {
      const data: DataPoint[] = [
        { x: 'A', y: 50 },
        { x: 'B', y: 100 },
        { x: 'C', y: 150 },
        { x: 'D', y: 200 },
      ];

      const result = filterByRange(data, 75, 175);

      expect(result).toHaveLength(2);
      expect(result[0].x).toBe('B');
      expect(result[1].x).toBe('C');
    });

    it('should return all data when no range specified', () => {
      const data: DataPoint[] = [
        { x: 'A', y: 50 },
        { x: 'B', y: 100 },
      ];

      const result = filterByRange(data);

      expect(result).toHaveLength(2);
    });
  });

  describe('calculateStats', () => {
    it('should calculate basic statistics', () => {
      const data: DataPoint[] = [
        { x: 'A', y: 10 },
        { x: 'B', y: 20 },
        { x: 'C', y: 30 },
      ];

      const result = calculateStats(data);

      expect(result.min).toBe(10);
      expect(result.max).toBe(30);
      expect(result.sum).toBe(60);
      expect(result.avg).toBe(20);
      expect(result.count).toBe(3);
    });

    it('should handle single data point', () => {
      const data: DataPoint[] = [{ x: 'A', y: 100 }];

      const result = calculateStats(data);

      expect(result.min).toBe(100);
      expect(result.max).toBe(100);
      expect(result.sum).toBe(100);
      expect(result.avg).toBe(100);
      expect(result.count).toBe(1);
    });

    it('should return zeros for empty array', () => {
      const result = calculateStats([]);

      expect(result.min).toBe(0);
      expect(result.max).toBe(0);
      expect(result.sum).toBe(0);
      expect(result.avg).toBe(0);
      expect(result.count).toBe(0);
    });

    it('should handle negative values', () => {
      const data: DataPoint[] = [
        { x: 'A', y: -10 },
        { x: 'B', y: 0 },
        { x: 'C', y: 10 },
      ];

      const result = calculateStats(data);

      expect(result.min).toBe(-10);
      expect(result.max).toBe(10);
      expect(result.sum).toBe(0);
      expect(result.avg).toBe(0);
    });
  });

  describe('processTimeSeries', () => {
    it('should sort time series data by date', () => {
      const data: DataPoint[] = [
        { x: '2024-03-01', y: 100 },
        { x: '2024-01-01', y: 50 },
        { x: '2024-02-01', y: 75 },
      ];

      const result = processTimeSeries(data);

      expect(result[0].x).toBe('2024-01-01');
      expect(result[1].x).toBe('2024-02-01');
      expect(result[2].x).toBe('2024-03-01');
    });

    it('should return original data when fillGaps is false', () => {
      const data: DataPoint[] = [
        { x: '2024-01-01', y: 100 },
        { x: '2024-01-03', y: 200 },
      ];

      const result = processTimeSeries(data, { fillGaps: false });

      expect(result).toHaveLength(2);
    });

    it('should fill gaps when fillGaps is true', () => {
      const data: DataPoint[] = [
        { x: '2024-01-01', y: 100 },
        { x: '2024-01-03', y: 200 },
      ];

      const result = processTimeSeries(data, { fillGaps: true, interval: 'day' });

      expect(result.length).toBeGreaterThan(2);
      expect(result[0].x).toBe('2024-01-01');
      expect(result[result.length - 1].x).toBe('2024-01-03');
    });

    it('should aggregate by day', () => {
      const data: DataPoint[] = [
        { x: '2024-01-01T10:00:00', y: 100 },
        { x: '2024-01-01T14:00:00', y: 200 },
        { x: '2024-01-02T10:00:00', y: 150 },
      ];

      const result = processTimeSeries(data, {
        interval: 'day',
        fillGaps: true,
        aggregation: 'sum',
      });

      const day1 = result.find((p) => p.x === '2024-01-01');
      expect(day1?.y).toBe(300);
    });

    it('should aggregate by month', () => {
      const data: DataPoint[] = [
        { x: '2024-01-15', y: 100 },
        { x: '2024-01-20', y: 200 },
        { x: '2024-02-10', y: 150 },
      ];

      const result = processTimeSeries(data, {
        interval: 'month',
        fillGaps: true,
        aggregation: 'sum',
      });

      const jan = result.find((p) => p.x === '2024-01');
      const feb = result.find((p) => p.x === '2024-02');
      expect(jan?.y).toBe(300);
      expect(feb?.y).toBe(150);
    });

    it('should use last value aggregation', () => {
      const data: DataPoint[] = [
        { x: '2024-01-01T10:00:00', y: 100 },
        { x: '2024-01-01T14:00:00', y: 200 },
      ];

      const result = processTimeSeries(data, {
        interval: 'day',
        fillGaps: true,
        aggregation: 'last',
      });

      expect(result[0].y).toBe(200);
    });

    it('should handle empty data', () => {
      const result = processTimeSeries([]);

      expect(result).toEqual([]);
    });
  });

  describe('movingAverage', () => {
    it('should calculate moving average', () => {
      const data: DataPoint[] = [
        { x: '1', y: 10 },
        { x: '2', y: 20 },
        { x: '3', y: 30 },
        { x: '4', y: 40 },
        { x: '5', y: 50 },
      ];

      const result = movingAverage(data, 3);

      expect(result[0].y).toBe(10); // Not enough data
      expect(result[1].y).toBe(20); // Not enough data
      expect(result[2].y).toBe(20); // (10+20+30)/3
      expect(result[3].y).toBe(30); // (20+30+40)/3
      expect(result[4].y).toBe(40); // (30+40+50)/3
    });

    it('should return original data when window size is 1', () => {
      const data: DataPoint[] = [
        { x: '1', y: 10 },
        { x: '2', y: 20 },
      ];

      const result = movingAverage(data, 1);

      expect(result[0].y).toBe(10);
      expect(result[1].y).toBe(20);
    });

    it('should return original data when window larger than data', () => {
      const data: DataPoint[] = [
        { x: '1', y: 10 },
        { x: '2', y: 20 },
      ];

      const result = movingAverage(data, 5);

      expect(result[0].y).toBe(10);
      expect(result[1].y).toBe(20);
    });

    it('should preserve x values', () => {
      const data: DataPoint[] = [
        { x: 'Jan', y: 10 },
        { x: 'Feb', y: 20 },
        { x: 'Mar', y: 30 },
      ];

      const result = movingAverage(data, 2);

      expect(result[2].x).toBe('Mar');
    });
  });

  describe('detectOutliers', () => {
    it('should detect outliers using IQR method', () => {
      const data: DataPoint[] = [
        { x: '1', y: 10 },
        { x: '2', y: 12 },
        { x: '3', y: 11 },
        { x: '4', y: 13 },
        { x: '5', y: 100 }, // Outlier
      ];

      const { inliers, outliers } = detectOutliers(data);

      expect(inliers).toHaveLength(4);
      expect(outliers).toHaveLength(1);
      expect(outliers[0].y).toBe(100);
    });

    it('should handle data without outliers', () => {
      const data: DataPoint[] = [
        { x: '1', y: 10 },
        { x: '2', y: 12 },
        { x: '3', y: 11 },
      ];

      const { inliers, outliers } = detectOutliers(data);

      expect(inliers).toHaveLength(3);
      expect(outliers).toHaveLength(0);
    });

    it('should use custom threshold', () => {
      const data: DataPoint[] = [
        { x: '1', y: 10 },
        { x: '2', y: 20 },
        { x: '3', y: 30 },
        { x: '4', y: 40 },
        { x: '5', y: 100 },
      ];

      // More strict threshold
      const { outliers: strictOutliers } = detectOutliers(data, 1.0);
      // Less strict threshold
      const { outliers: looseOutliers } = detectOutliers(data, 3.0);

      expect(strictOutliers.length).toBeGreaterThanOrEqual(looseOutliers.length);
    });

    it('should handle low outliers', () => {
      const data: DataPoint[] = [
        { x: '1', y: 1 }, // Outlier
        { x: '2', y: 50 },
        { x: '3', y: 52 },
        { x: '4', y: 51 },
        { x: '5', y: 53 },
      ];

      const { outliers } = detectOutliers(data);

      expect(outliers.length).toBeGreaterThanOrEqual(1);
      expect(outliers[0].y).toBe(1);
    });
  });

  describe('normalizeValues', () => {
    it('should normalize values to 0-1 range', () => {
      const data: DataPoint[] = [
        { x: '1', y: 0 },
        { x: '2', y: 50 },
        { x: '3', y: 100 },
      ];

      const result = normalizeValues(data);

      expect(result[0].y).toBe(0);
      expect(result[1].y).toBe(0.5);
      expect(result[2].y).toBe(1);
    });

    it('should use custom min and max', () => {
      const data: DataPoint[] = [
        { x: '1', y: 25 },
        { x: '2', y: 50 },
        { x: '3', y: 75 },
      ];

      const result = normalizeValues(data, 0, 100);

      expect(result[0].y).toBe(0.25);
      expect(result[1].y).toBe(0.5);
      expect(result[2].y).toBe(0.75);
    });

    it('should handle all same values', () => {
      const data: DataPoint[] = [
        { x: '1', y: 50 },
        { x: '2', y: 50 },
      ];

      const result = normalizeValues(data);

      expect(result[0].y).toBe(0);
      expect(result[1].y).toBe(0);
    });

    it('should handle negative values', () => {
      const data: DataPoint[] = [
        { x: '1', y: -50 },
        { x: '2', y: 0 },
        { x: '3', y: 50 },
      ];

      const result = normalizeValues(data);

      expect(result[0].y).toBe(0);
      expect(result[1].y).toBe(0.5);
      expect(result[2].y).toBe(1);
    });
  });

  describe('calculatePercentChange', () => {
    it('should calculate percent change', () => {
      const data: DataPoint[] = [
        { x: '1', y: 100 },
        { x: '2', y: 150 },
        { x: '3', y: 200 },
      ];

      const result = calculatePercentChange(data);

      expect(result[0].y).toBe(0); // First point has no change
      expect(result[1].y).toBe(50); // (150-100)/100 * 100
      expect(result[2].y).toBe(33.33333333333333); // (200-150)/150 * 100
    });

    it('should handle decrease', () => {
      const data: DataPoint[] = [
        { x: '1', y: 100 },
        { x: '2', y: 50 },
      ];

      const result = calculatePercentChange(data);

      expect(result[1].y).toBe(-50); // (50-100)/100 * 100
    });

    it('should handle single data point', () => {
      const data: DataPoint[] = [{ x: '1', y: 100 }];

      const result = calculatePercentChange(data);

      expect(result).toHaveLength(1);
      expect(result[0].y).toBe(0);
    });

    it('should handle zero previous value', () => {
      const data: DataPoint[] = [
        { x: '1', y: 0 },
        { x: '2', y: 100 },
      ];

      const result = calculatePercentChange(data);

      expect(result[1].y).toBe(0); // Division by zero returns 0
    });

    it('should preserve original x values', () => {
      const data: DataPoint[] = [
        { x: 'Jan', y: 100 },
        { x: 'Feb', y: 150 },
      ];

      const result = calculatePercentChange(data);

      expect(result[0].x).toBe('Jan');
      expect(result[1].x).toBe('Feb');
    });
  });
});
