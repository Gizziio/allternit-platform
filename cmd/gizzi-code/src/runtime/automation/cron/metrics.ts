/**
 * Prometheus Metrics for Cron Service
 * 
 * Exposes metrics in Prometheus format for monitoring and alerting.
 */

import { createLogger } from "./utils/logger";
import type { CronDatabase } from "./database";
import type { CronJob, CronRun } from "./types";

const log = createLogger("cron-metrics");

interface MetricValue {
  name: string;
  help: string;
  type: "counter" | "gauge" | "histogram";
  labels?: Record<string, string>;
  value: number;
  timestamp?: number;
}

interface HistogramBucket {
  le: number;
  count: number;
}

class Histogram {
  private buckets: number[];
  private counts: Map<number, number> = new Map();
  private sum = 0;
  private count = 0;

  constructor(buckets: number[] = [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10]) {
    this.buckets = [...buckets, Infinity].sort((a, b) => a - b);
    this.buckets.forEach((b) => this.counts.set(b, 0));
  }

  observe(value: number): void {
    this.sum += value;
    this.count++;
    
    for (const bucket of this.buckets) {
      if (value <= bucket) {
        this.counts.set(bucket, (this.counts.get(bucket) ?? 0) + 1);
      }
    }
  }

  getBuckets(): HistogramBucket[] {
    return this.buckets.map((le) => ({
      le: le === Infinity ? Infinity : le,
      count: this.counts.get(le) ?? 0,
    }));
  }

  getSum(): number {
    return this.sum;
  }

  getCount(): number {
    return this.count;
  }
}

export class CronMetrics {
  private db: CronDatabase;
  private jobExecutionDuration: Histogram;
  private jobExecutionsTotal = 0;
  private jobExecutionsFailed = 0;
  private activeJobs = 0;
  private jobRetriesTotal = 0;
  private lastScrapeTime = 0;

  constructor(db: CronDatabase) {
    this.db = db;
    this.jobExecutionDuration = new Histogram([1, 5, 10, 30, 60, 120, 300, 600]); // seconds
  }

  /**
   * Record a job execution
   */
  recordJobExecution(job: CronJob, run: CronRun): void {
    this.jobExecutionsTotal++;
    
    if (run.durationMs) {
      this.jobExecutionDuration.observe(run.durationMs / 1000); // Convert to seconds
    }

    if (run.status === "failed") {
      this.jobExecutionsFailed++;
    }

    if (run.attempt > 1) {
      this.jobRetriesTotal += run.attempt - 1;
    }
  }

  /**
   * Update active job count
   */
  setActiveJobs(count: number): void {
    this.activeJobs = count;
  }

  /**
   * Generate Prometheus metrics output
   */
  async scrape(): Promise<string> {
    this.lastScrapeTime = Date.now();
    
    const metrics: string[] = [];
    const stats = this.db.getStats();

    // Job counters
    metrics.push(this.formatCounter(
      "cron_job_executions_total",
      "Total number of job executions",
      this.jobExecutionsTotal
    ));

    metrics.push(this.formatCounter(
      "cron_job_executions_failed_total",
      "Total number of failed job executions",
      this.jobExecutionsFailed
    ));

    metrics.push(this.formatCounter(
      "cron_job_retries_total",
      "Total number of job retries",
      this.jobRetriesTotal
    ));

    // Job gauges
    metrics.push(this.formatGauge(
      "cron_jobs_total",
      "Total number of jobs",
      stats.jobs.total
    ));

    metrics.push(this.formatGauge(
      "cron_jobs_active",
      "Number of active jobs",
      stats.jobs.active
    ));

    metrics.push(this.formatGauge(
      "cron_jobs_paused",
      "Number of paused jobs",
      stats.jobs.paused
    ));

    metrics.push(this.formatGauge(
      "cron_jobs_running",
      "Number of currently running jobs",
      this.activeJobs
    ));

    metrics.push(this.formatGauge(
      "cron_runs_pending",
      "Number of pending runs",
      stats.runs.pending
    ));

    metrics.push(this.formatGauge(
      "cron_runs_last_24h",
      "Number of runs in last 24 hours",
      stats.runs.last24h
    ));

    // Job execution duration histogram
    metrics.push(...this.formatHistogram(
      "cron_job_execution_duration_seconds",
      "Job execution duration in seconds",
      this.jobExecutionDuration
    ));

    // Database size
    const dbSize = this.db.getDatabaseSize();
    metrics.push(this.formatGauge(
      "cron_database_size_bytes",
      "Size of the cron database in bytes",
      dbSize
    ));

    // Up metric
    metrics.push(this.formatGauge(
      "cron_up",
      "Whether the cron service is up (1 = up, 0 = down)",
      1
    ));

    // Scrape duration
    metrics.push(this.formatGauge(
      "cron_last_scrape_timestamp",
      "Unix timestamp of last metrics scrape",
      Math.floor(this.lastScrapeTime / 1000)
    ));

    return metrics.join("\n") + "\n";
  }

  private formatCounter(name: string, help: string, value: number, labels?: Record<string, string>): string {
    const labelStr = labels ? this.formatLabels(labels) : "";
    return `# HELP ${name} ${help}\n# TYPE ${name} counter\n${name}${labelStr} ${value}`;
  }

  private formatGauge(name: string, help: string, value: number, labels?: Record<string, string>): string {
    const labelStr = labels ? this.formatLabels(labels) : "";
    return `# HELP ${name} ${help}\n# TYPE ${name} gauge\n${name}${labelStr} ${value}`;
  }

  private formatHistogram(name: string, help: string, histogram: Histogram): string[] {
    const lines: string[] = [];
    
    lines.push(`# HELP ${name} ${help}`);
    lines.push(`# TYPE ${name} histogram`);
    
    // Buckets
    for (const bucket of histogram.getBuckets()) {
      const le = bucket.le === Infinity ? "+Inf" : bucket.le;
      lines.push(`${name}_bucket{le="${le}"} ${bucket.count}`);
    }
    
    // Sum
    lines.push(`${name}_sum ${histogram.getSum()}`);
    
    // Count
    lines.push(`${name}_count ${histogram.getCount()}`);
    
    return lines;
  }

  private formatLabels(labels: Record<string, string>): string {
    const pairs = Object.entries(labels).map(([k, v]) => `${k}="${v}"`);
    return `{${pairs.join(",")}}`;
  }

  /**
   * Get metrics as JSON (for API responses)
   */
  async toJSON(): Promise<Record<string, unknown>> {
    const stats = this.db.getStats();
    
    return {
      jobs: {
        total: stats.jobs.total,
        active: stats.jobs.active,
        paused: stats.jobs.paused,
        running: this.activeJobs,
      },
      runs: {
        pending: stats.runs.pending,
        last24h: stats.runs.last24h,
        totalExecuted: this.jobExecutionsTotal,
        totalFailed: this.jobExecutionsFailed,
        totalRetries: this.jobRetriesTotal,
      },
      execution: {
        duration: {
          buckets: this.jobExecutionDuration.getBuckets(),
          sum: this.jobExecutionDuration.getSum(),
          count: this.jobExecutionDuration.getCount(),
        },
      },
      database: {
        sizeBytes: this.db.getDatabaseSize(),
      },
      timestamp: new Date().toISOString(),
    };
  }
}

/**
 * Create a metrics endpoint handler for the HTTP daemon
 */
export function createMetricsEndpoint(metrics: CronMetrics) {
  return async () => {
    try {
      const output = await metrics.scrape();
      return new Response(output, {
        headers: {
          "Content-Type": "text/plain; version=0.0.4",
        },
      });
    } catch (error) {
      log.error("Failed to scrape metrics", { error });
      return new Response("# Error generating metrics\n", { status: 500 });
    }
  };
}
