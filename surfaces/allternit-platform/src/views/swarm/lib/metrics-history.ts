/**
 * Metrics History Tracker
 * 
 * Tracks swarm metrics over time with localStorage persistence.
 * Automatically samples metrics every 30 seconds when active.
 * Maintains 7 days of historical data.
 */

import type { SwarmMetrics, MetricsDataPoint } from '../types';

const STORAGE_KEY = 'allternit_swarm_metrics_history';
const MAX_HISTORY_DAYS = 7;
const SAMPLE_INTERVAL_MS = 30000; // 30 seconds

interface StoredMetricsHistory {
  version: number;
  data: MetricsDataPoint[];
  lastSampledAt: string | null;
}

class MetricsHistoryTracker {
  private data: MetricsDataPoint[] = [];
  private intervalId: ReturnType<typeof setInterval> | null = null;
  private lastMetrics: SwarmMetrics | null = null;
  private listeners: Set<(data: MetricsDataPoint[]) => void> = new Set();

  constructor() {
    this.loadFromStorage();
  }

  /**
   * Start tracking metrics at regular intervals
   */
  start(): () => void {
    if (this.intervalId) return () => this.stop();

    // Sample immediately
    this.sampleIfNeeded();

    // Then sample every interval
    this.intervalId = setInterval(() => {
      this.sampleIfNeeded();
    }, SAMPLE_INTERVAL_MS);

    return () => this.stop();
  }

  /**
   * Stop tracking metrics
   */
  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  /**
   * Record a metrics sample manually
   */
  record(metrics: SwarmMetrics): void {
    this.lastMetrics = metrics;
    
    const dataPoint: MetricsDataPoint = {
      timestamp: new Date().toISOString(),
      activeAgents: metrics.activeAgents,
      totalTokens: metrics.totalTokens,
      totalCost: metrics.totalCost,
      throughput: metrics.throughput,
      avgLatency: metrics.avgLatency,
    };

    this.data.push(dataPoint);
    this.cleanupOldData();
    this.saveToStorage();
    this.notifyListeners();
  }

  /**
   * Get all historical data
   */
  getHistory(): MetricsDataPoint[] {
    return [...this.data];
  }

  /**
   * Get data for a specific time range
   */
  getRange(start: Date, end: Date): MetricsDataPoint[] {
    return this.data.filter(d => {
      const ts = new Date(d.timestamp).getTime();
      return ts >= start.getTime() && ts <= end.getTime();
    });
  }

  /**
   * Get aggregated data by time bucket (e.g., hourly, daily)
   */
  getAggregated(
    bucketSize: '5m' | '15m' | '1h' | '1d'
  ): Array<MetricsDataPoint & { bucketStart: string }> {
    const bucketMs = {
      '5m': 5 * 60 * 1000,
      '15m': 15 * 60 * 1000,
      '1h': 60 * 60 * 1000,
      '1d': 24 * 60 * 60 * 1000,
    }[bucketSize];

    const buckets = new Map<number, MetricsDataPoint[]>();

    this.data.forEach(point => {
      const ts = new Date(point.timestamp).getTime();
      const bucketStart = Math.floor(ts / bucketMs) * bucketMs;
      
      if (!buckets.has(bucketStart)) {
        buckets.set(bucketStart, []);
      }
      buckets.get(bucketStart)!.push(point);
    });

    return Array.from(buckets.entries())
      .sort((a, b) => a[0] - b[0])
      .map(([bucketStart, points]) => ({
        bucketStart: new Date(bucketStart).toISOString(),
        timestamp: new Date(bucketStart).toISOString(),
        activeAgents: Math.round(points.reduce((s, p) => s + p.activeAgents, 0) / points.length),
        totalTokens: points[points.length - 1]?.totalTokens || 0,
        totalCost: points[points.length - 1]?.totalCost || 0,
        throughput: points.reduce((s, p) => s + p.throughput, 0) / points.length,
        avgLatency: points.reduce((s, p) => s + p.avgLatency, 0) / points.length,
      }));
  }

  /**
   * Get statistics for a specific metric
   */
  getStats(metric: keyof Omit<MetricsDataPoint, 'timestamp'>): {
    min: number;
    max: number;
    avg: number;
    current: number;
  } {
    if (this.data.length === 0) {
      return { min: 0, max: 0, avg: 0, current: 0 };
    }

    const values = this.data.map(d => d[metric]);
    const current = values[values.length - 1];

    return {
      min: Math.min(...values),
      max: Math.max(...values),
      avg: values.reduce((a, b) => a + b, 0) / values.length,
      current,
    };
  }

  /**
   * Clear all historical data
   */
  clear(): void {
    this.data = [];
    this.saveToStorage();
    this.notifyListeners();
  }

  /**
   * Subscribe to data changes
   */
  subscribe(callback: (data: MetricsDataPoint[]) => void): () => void {
    this.listeners.add(callback);
    return () => this.listeners.delete(callback);
  }

  /**
   * Export data as JSON
   */
  exportToJSON(): string {
    return JSON.stringify({
      exportDate: new Date().toISOString(),
      data: this.data,
    }, null, 2);
  }

  /**
   * Export data as CSV
   */
  exportToCSV(): string {
    const headers = ['timestamp', 'activeAgents', 'totalTokens', 'totalCost', 'throughput', 'avgLatency'];
    const rows = this.data.map(d => [
      d.timestamp,
      d.activeAgents,
      d.totalTokens,
      d.totalCost,
      d.throughput.toFixed(2),
      d.avgLatency.toFixed(0),
    ]);
    
    return [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
  }

  private sampleIfNeeded(): void {
    if (!this.lastMetrics) return;
    
    const now = Date.now();
    const lastSample = this.data[this.data.length - 1];
    
    if (!lastSample || now - new Date(lastSample.timestamp).getTime() >= SAMPLE_INTERVAL_MS) {
      this.record(this.lastMetrics);
    }
  }

  private loadFromStorage(): void {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed: StoredMetricsHistory = JSON.parse(stored);
        this.data = parsed.data || [];
        this.cleanupOldData();
      }
    } catch {
      this.data = [];
    }
  }

  private saveToStorage(): void {
    try {
      const toStore: StoredMetricsHistory = {
        version: 1,
        data: this.data,
        lastSampledAt: this.data[this.data.length - 1]?.timestamp || null,
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(toStore));
    } catch {
      // Ignore storage errors
    }
  }

  private cleanupOldData(): void {
    const cutoff = Date.now() - MAX_HISTORY_DAYS * 24 * 60 * 60 * 1000;
    this.data = this.data.filter(d => new Date(d.timestamp).getTime() > cutoff);
  }

  private notifyListeners(): void {
    this.listeners.forEach(cb => cb([...this.data]));
  }
}

// Singleton instance
export const metricsHistory = new MetricsHistoryTracker();
