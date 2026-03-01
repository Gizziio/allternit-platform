/**
 * Data Processor Utility
 * 
 * Provides data transformation and normalization functions for charts.
 */

import type { DataPoint, DataSeries } from '../types';

/**
 * Normalize data points to standard format
 */
export function normalizeDataPoints(data: DataPoint[]): DataPoint[] {
  return data.map((point) => ({
    ...point,
    y: point.y ?? point.value ?? 0,
    x: point.x ?? point.name ?? '',
  }));
}

/**
 * Normalize data series
 */
export function normalizeSeries(series: DataSeries[]): DataSeries[] {
  return series.map((s) => ({
    ...s,
    data: normalizeDataPoints(s.data),
  }));
}

/**
 * Aggregate data by categories
 */
export function aggregateByCategory(
  data: DataPoint[],
  aggregator: 'sum' | 'avg' | 'min' | 'max' | 'count' = 'sum'
): Map<string, number> {
  const groups = new Map<string, number[]>();

  // Group values by category
  for (const point of data) {
    const key = String(point.x ?? point.name ?? 'unknown');
    const value = Number(point.y ?? point.value ?? 0);

    if (!groups.has(key)) {
      groups.set(key, []);
    }
    groups.get(key)!.push(value);
  }

  // Apply aggregation
  const result = new Map<string, number>();
  for (const [key, values] of groups) {
    switch (aggregator) {
      case 'sum':
        result.set(key, values.reduce((a, b) => a + b, 0));
        break;
      case 'avg':
        result.set(key, values.reduce((a, b) => a + b, 0) / values.length);
        break;
      case 'min':
        result.set(key, Math.min(...values));
        break;
      case 'max':
        result.set(key, Math.max(...values));
        break;
      case 'count':
        result.set(key, values.length);
        break;
    }
  }

  return result;
}

/**
 * Sort data points by value or category
 */
export function sortDataPoints(
  data: DataPoint[],
  by: 'value' | 'category' = 'value',
  order: 'asc' | 'desc' = 'desc'
): DataPoint[] {
  const sorted = [...data];

  sorted.sort((a, b) => {
    let comparison = 0;

    if (by === 'value') {
      const aVal = Number(a.y ?? a.value ?? 0);
      const bVal = Number(b.y ?? b.value ?? 0);
      comparison = aVal - bVal;
    } else {
      const aCat = String(a.x ?? a.name ?? '');
      const bCat = String(b.x ?? b.name ?? '');
      comparison = aCat.localeCompare(bCat);
    }

    return order === 'asc' ? comparison : -comparison;
  });

  return sorted;
}

/**
 * Filter data points by value range
 */
export function filterByRange(
  data: DataPoint[],
  min?: number,
  max?: number
): DataPoint[] {
  return data.filter((point) => {
    const value = Number(point.y ?? point.value ?? 0);
    if (min !== undefined && value < min) return false;
    if (max !== undefined && value > max) return false;
    return true;
  });
}

/**
 * Calculate statistics for data points
 */
export function calculateStats(data: DataPoint[]): {
  min: number;
  max: number;
  sum: number;
  avg: number;
  count: number;
} {
  const values = data.map((p) => Number(p.y ?? p.value ?? 0));

  if (values.length === 0) {
    return { min: 0, max: 0, sum: 0, avg: 0, count: 0 };
  }

  const min = Math.min(...values);
  const max = Math.max(...values);
  const sum = values.reduce((a, b) => a + b, 0);
  const avg = sum / values.length;

  return { min, max, sum, avg, count: values.length };
}

/**
 * Process time series data
 */
export function processTimeSeries(
  data: DataPoint[],
  options: {
    interval?: 'hour' | 'day' | 'week' | 'month' | 'year';
    fillGaps?: boolean;
    aggregation?: 'sum' | 'avg' | 'last';
  } = {}
): DataPoint[] {
  const { interval = 'day', fillGaps = false, aggregation = 'sum' } = options;

  // Sort by date
  const sorted = [...data].sort((a, b) => {
    const aDate = new Date(a.x as string | number | Date).getTime();
    const bDate = new Date(b.x as string | number | Date).getTime();
    return aDate - bDate;
  });

  if (!fillGaps) {
    return sorted;
  }

  // Group by interval
  const grouped = new Map<string, number[]>();

  for (const point of sorted) {
    const date = new Date(point.x as string | number | Date);
    const key = formatDateToInterval(date, interval);
    const value = Number(point.y ?? point.value ?? 0);

    if (!grouped.has(key)) {
      grouped.set(key, []);
    }
    grouped.get(key)!.push(value);
  }

  // Apply aggregation and fill gaps
  const result: DataPoint[] = [];
  if (sorted.length === 0) return result;

  const startDate = new Date(sorted[0].x as string | number | Date);
  const endDate = new Date(sorted[sorted.length - 1].x as string | number | Date);

  // Normalize dates to the start of their interval for proper gap filling
  let currentDate = normalizeToIntervalStart(startDate, interval);
  const normalizedEndDate = normalizeToIntervalStart(endDate, interval);

  while (currentDate <= normalizedEndDate) {
    const key = formatDateToInterval(currentDate, interval);
    const values = grouped.get(key) ?? [];

    let value: number;
    if (values.length === 0) {
      value = 0;
    } else {
      switch (aggregation) {
        case 'sum':
          value = values.reduce((a, b) => a + b, 0);
          break;
        case 'avg':
          value = values.reduce((a, b) => a + b, 0) / values.length;
          break;
        case 'last':
          value = values[values.length - 1];
          break;
      }
    }

    result.push({ x: key, y: value });

    // Advance to next interval
    currentDate = addInterval(currentDate, interval);
  }

  return result;
}

/**
 * Calculate moving average
 */
export function movingAverage(
  data: DataPoint[],
  windowSize: number
): DataPoint[] {
  if (windowSize <= 1 || data.length < windowSize) {
    return data;
  }

  const result: DataPoint[] = [];

  for (let i = 0; i < data.length; i++) {
    if (i < windowSize - 1) {
      result.push(data[i]);
      continue;
    }

    let sum = 0;
    for (let j = 0; j < windowSize; j++) {
      sum += Number(data[i - j].y ?? data[i - j].value ?? 0);
    }

    result.push({
      ...data[i],
      y: sum / windowSize,
    });
  }

  return result;
}

/**
 * Detect outliers using IQR method
 */
export function detectOutliers(
  data: DataPoint[],
  threshold: number = 1.5
): { inliers: DataPoint[]; outliers: DataPoint[] } {
  const values = data.map((p) => Number(p.y ?? p.value ?? 0));
  const sorted = [...values].sort((a, b) => a - b);

  const q1Index = Math.floor(sorted.length * 0.25);
  const q3Index = Math.floor(sorted.length * 0.75);
  const q1 = sorted[q1Index];
  const q3 = sorted[q3Index];
  const iqr = q3 - q1;

  const lowerBound = q1 - threshold * iqr;
  const upperBound = q3 + threshold * iqr;

  const inliers: DataPoint[] = [];
  const outliers: DataPoint[] = [];

  for (const point of data) {
    const value = Number(point.y ?? point.value ?? 0);
    if (value >= lowerBound && value <= upperBound) {
      inliers.push(point);
    } else {
      outliers.push(point);
    }
  }

  return { inliers, outliers };
}

/**
 * Normalize values to 0-1 range
 */
export function normalizeValues(
  data: DataPoint[],
  min?: number,
  max?: number
): DataPoint[] {
  const values = data.map((p) => Number(p.y ?? p.value ?? 0));
  const dataMin = min ?? Math.min(...values);
  const dataMax = max ?? Math.max(...values);
  const range = dataMax - dataMin;

  if (range === 0) {
    return data.map((p) => ({ ...p, y: 0 }));
  }

  return data.map((p) => ({
    ...p,
    y: (Number(p.y ?? p.value ?? 0) - dataMin) / range,
  }));
}

/**
 * Calculate percent change between consecutive points
 */
export function calculatePercentChange(data: DataPoint[]): DataPoint[] {
  if (data.length === 0) return data;
  if (data.length === 1) {
    return [{ ...data[0], y: 0 }];
  }

  const result: DataPoint[] = [];

  for (let i = 0; i < data.length; i++) {
    if (i === 0) {
      result.push({ ...data[i], y: 0 });
      continue;
    }

    const current = Number(data[i].y ?? data[i].value ?? 0);
    const previous = Number(data[i - 1].y ?? data[i - 1].value ?? 0);

    const change = previous !== 0 ? ((current - previous) / previous) * 100 : 0;

    result.push({ ...data[i], y: change });
  }

  return result;
}

// Helper functions

function formatDateToInterval(
  date: Date,
  interval: 'hour' | 'day' | 'week' | 'month' | 'year'
): string {
  // Use UTC methods to avoid timezone issues
  switch (interval) {
    case 'hour':
      return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}-${String(date.getUTCDate()).padStart(2, '0')} ${String(date.getUTCHours()).padStart(2, '0')}:00`;
    case 'day':
      return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}-${String(date.getUTCDate()).padStart(2, '0')}`;
    case 'week': {
      const weekStart = new Date(date);
      weekStart.setUTCDate(date.getUTCDate() - date.getUTCDay());
      return `${weekStart.getUTCFullYear()}-${String(weekStart.getUTCMonth() + 1).padStart(2, '0')}-${String(weekStart.getUTCDate()).padStart(2, '0')}`;
    }
    case 'month':
      return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
    case 'year':
      return String(date.getUTCFullYear());
    default:
      return date.toISOString();
  }
}

function addInterval(
  date: Date,
  interval: 'hour' | 'day' | 'week' | 'month' | 'year'
): Date {
  const result = new Date(date);
  switch (interval) {
    case 'hour':
      result.setUTCHours(result.getUTCHours() + 1);
      break;
    case 'day':
      result.setUTCDate(result.getUTCDate() + 1);
      break;
    case 'week':
      result.setUTCDate(result.getUTCDate() + 7);
      break;
    case 'month':
      result.setUTCMonth(result.getUTCMonth() + 1);
      break;
    case 'year':
      result.setUTCFullYear(result.getUTCFullYear() + 1);
      break;
  }
  return result;
}

function normalizeToIntervalStart(
  date: Date,
  interval: 'hour' | 'day' | 'week' | 'month' | 'year'
): Date {
  const result = new Date(date);
  switch (interval) {
    case 'hour':
      result.setUTCMinutes(0, 0, 0);
      break;
    case 'day':
      result.setUTCHours(0, 0, 0, 0);
      break;
    case 'week': {
      const dayOfWeek = result.getUTCDay();
      result.setUTCDate(result.getUTCDate() - dayOfWeek);
      result.setUTCHours(0, 0, 0, 0);
      break;
    }
    case 'month':
      result.setUTCDate(1);
      result.setUTCHours(0, 0, 0, 0);
      break;
    case 'year':
      result.setUTCMonth(0, 1);
      result.setUTCHours(0, 0, 0, 0);
      break;
  }
  return result;
}
