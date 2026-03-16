/**
 * Metrics Collection and Reporting
 * 
 * Tracks performance, errors, and usage for monitoring.
 */

export interface MetricValue {
  value: number;
  timestamp: number;
  labels?: Record<string, string>;
}

export interface MetricSeries {
  name: string;
  type: 'counter' | 'gauge' | 'histogram' | 'summary';
  values: MetricValue[];
  labels: string[];
}

export interface HistogramBucket {
  upperBound: number;
  count: number;
}

export interface HistogramMetric {
  buckets: HistogramBucket[];
  sum: number;
  count: number;
}

export class MetricsCollector {
  private counters: Map<string, number> = new Map();
  private gauges: Map<string, number> = new Map();
  private histograms: Map<string, number[]> = new Map();
  private timestamps: Map<string, number> = new Map();
  private labels: Map<string, Record<string, string>> = new Map();

  /**
   * Increment a counter metric
   */
  increment(name: string, value: number = 1, labels?: Record<string, string>): void {
    const key = this.getKey(name, labels);
    const current = this.counters.get(key) || 0;
    this.counters.set(key, current + value);
    this.timestamps.set(key, Date.now());
    if (labels) this.labels.set(key, labels);
  }

  /**
   * Set a gauge metric
   */
  gauge(name: string, value: number, labels?: Record<string, string>): void {
    const key = this.getKey(name, labels);
    this.gauges.set(key, value);
    this.timestamps.set(key, Date.now());
    if (labels) this.labels.set(key, labels);
  }

  /**
   * Record a histogram observation
   */
  histogram(name: string, value: number, labels?: Record<string, string>): void {
    const key = this.getKey(name, labels);
    const values = this.histograms.get(key) || [];
    values.push(value);
    this.histograms.set(key, values);
    this.timestamps.set(key, Date.now());
    if (labels) this.labels.set(key, labels);
  }

  /**
   * Time a function execution
   */
  async time<T>(
    name: string,
    fn: () => Promise<T>,
    labels?: Record<string, string>
  ): Promise<T> {
    const start = Date.now();
    try {
      const result = await fn();
      this.histogram(name, Date.now() - start, { ...labels, status: 'success' });
      return result;
    } catch (error) {
      this.histogram(name, Date.now() - start, { ...labels, status: 'error' });
      throw error;
    }
  }

  /**
   * Get current counter value
   */
  getCounter(name: string, labels?: Record<string, string>): number {
    const key = this.getKey(name, labels);
    return this.counters.get(key) || 0;
  }

  /**
   * Get current gauge value
   */
  getGauge(name: string, labels?: Record<string, string>): number {
    const key = this.getKey(name, labels);
    return this.gauges.get(key) || 0;
  }

  /**
   * Get histogram statistics
   */
  getHistogram(name: string, labels?: Record<string, string>): HistogramMetric {
    const key = this.getKey(name, labels);
    const values = this.histograms.get(key) || [];
    
    if (values.length === 0) {
      return { buckets: [], sum: 0, count: 0 };
    }

    // Calculate percentiles
    const sorted = [...values].sort((a, b) => a - b);
    const sum = values.reduce((a, b) => a + b, 0);
    
    // Standard buckets in milliseconds
    const bucketBounds = [10, 50, 100, 250, 500, 1000, 2500, 5000, 10000];
    const buckets = bucketBounds.map(bound => ({
      upperBound: bound,
      count: sorted.filter(v => v <= bound).length
    }));

    return {
      buckets,
      sum,
      count: values.length
    };
  }

  /**
   * Get all metrics as Prometheus format
   */
  getPrometheusMetrics(): string {
    const lines: string[] = [];

    // Counters
    for (const [key, value] of this.counters) {
      const { name, labels } = this.parseKey(key);
      const labelStr = this.formatLabels(labels);
      lines.push(`# TYPE ${name} counter`);
      lines.push(`${name}${labelStr} ${value}`);
    }

    // Gauges
    for (const [key, value] of this.gauges) {
      const { name, labels } = this.parseKey(key);
      const labelStr = this.formatLabels(labels);
      lines.push(`# TYPE ${name} gauge`);
      lines.push(`${name}${labelStr} ${value}`);
    }

    // Histograms
    for (const [key, values] of this.histograms) {
      const { name, labels } = this.parseKey(key);
      const hist = this.getHistogram(name, labels);
      
      lines.push(`# TYPE ${name} histogram`);
      
      for (const bucket of hist.buckets) {
        const bucketLabels = { ...labels, le: String(bucket.upperBound) };
        lines.push(`${name}_bucket${this.formatLabels(bucketLabels)} ${bucket.count}`);
      }
      
      lines.push(`${name}_sum${this.formatLabels(labels)} ${hist.sum}`);
      lines.push(`${name}_count${this.formatLabels(labels)} ${hist.count}`);
    }

    return lines.join('\n');
  }

  /**
   * Reset all metrics
   */
  reset(): void {
    this.counters.clear();
    this.gauges.clear();
    this.histograms.clear();
    this.timestamps.clear();
    this.labels.clear();
  }

  private getKey(name: string, labels?: Record<string, string>): string {
    if (!labels || Object.keys(labels).length === 0) {
      return name;
    }
    const sortedLabels = Object.entries(labels)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${k}=${v}`)
      .join(',');
    return `${name}{${sortedLabels}}`;
  }

  private parseKey(key: string): { name: string; labels?: Record<string, string> } {
    const match = key.match(/^(.+?)\{(.+)\}$/);
    if (!match) return { name: key };

    const name = match[1];
    const labels: Record<string, string> = {};
    
    match[2].split(',').forEach(pair => {
      const [k, v] = pair.split('=');
      labels[k] = v;
    });

    return { name, labels };
  }

  private formatLabels(labels?: Record<string, string>): string {
    if (!labels || Object.keys(labels).length === 0) {
      return '';
    }
    const entries = Object.entries(labels)
      .map(([k, v]) => `${k}="${v}"`)
      .join(',');
    return `{${entries}}`;
  }
}

/**
 * Global metrics collector instance
 */
export const globalMetrics = new MetricsCollector();

/**
 * Metric decorators for easy instrumentation
 */
export function CountMetric(name: string, labels?: Record<string, string>) {
  return function (
    target: any,
    propertyKey: string,
    descriptor: PropertyDescriptor
  ) {
    const originalMethod = descriptor.value;
    
    descriptor.value = async function (...args: any[]) {
      globalMetrics.increment(name, 1, labels);
      return originalMethod.apply(this, args);
    };

    return descriptor;
  };
}

export function TimeMetric(name: string, labels?: Record<string, string>) {
  return function (
    target: any,
    propertyKey: string,
    descriptor: PropertyDescriptor
  ) {
    const originalMethod = descriptor.value;
    
    descriptor.value = async function (...args: any[]) {
      const start = Date.now();
      try {
        const result = await originalMethod.apply(this, args);
        globalMetrics.histogram(name, Date.now() - start, { ...labels, status: 'success' });
        return result;
      } catch (error) {
        globalMetrics.histogram(name, Date.now() - start, { ...labels, status: 'error' });
        throw error;
      }
    };

    return descriptor;
  };
}
