/**
 * Observability Module
 * 
 * Metrics, logging, and health checks for the Memory Agent
 */

import { EventEmitter } from 'events';

export interface Metrics {
  // Ingestion metrics
  ingestionCount: number;
  ingestionErrors: number;
  ingestionLatencyMs: number[];
  
  // Query metrics
  queryCount: number;
  queryErrors: number;
  queryLatencyMs: number[];
  queryCacheHits: number;
  queryCacheMisses: number;
  
  // Consolidation metrics
  consolidationCount: number;
  consolidationErrors: number;
  consolidationDurationMs: number[];
  memoriesProcessed: number;
  connectionsFound: number;
  insightsGenerated: number;
  
  // Storage metrics
  memoryCount: number;
  insightCount: number;
  connectionCount: number;
  storageSizeBytes: number;
  
  // LLM metrics
  llmCallsCount: number;
  llmErrors: number;
  llmLatencyMs: number[];
  tokensUsed: number;
  
  // System metrics
  uptimeMs: number;
  memoryUsageBytes: number;
  cpuUsagePercent: number;
}

export interface HealthCheck {
  status: 'healthy' | 'degraded' | 'unhealthy';
  checks: {
    ollama: boolean;
    database: boolean;
    fileWatcher: boolean;
    httpServer: boolean;
  };
  version: string;
  uptime: string;
}

/**
 * Observability Manager
 */
export class ObservabilityManager extends EventEmitter {
  private metrics: Metrics = {
    ingestionCount: 0,
    ingestionErrors: 0,
    ingestionLatencyMs: [],
    queryCount: 0,
    queryErrors: 0,
    queryLatencyMs: [],
    queryCacheHits: 0,
    queryCacheMisses: 0,
    consolidationCount: 0,
    consolidationErrors: 0,
    consolidationDurationMs: [],
    memoriesProcessed: 0,
    connectionsFound: 0,
    insightsGenerated: 0,
    memoryCount: 0,
    insightCount: 0,
    connectionCount: 0,
    storageSizeBytes: 0,
    llmCallsCount: 0,
    llmErrors: 0,
    llmLatencyMs: [],
    tokensUsed: 0,
    uptimeMs: 0,
    memoryUsageBytes: 0,
    cpuUsagePercent: 0,
  };

  private startTime: number = Date.now();
  private metricsHistory: Metrics[] = [];
  private readonly MAX_HISTORY = 60; // Keep 60 data points

  constructor() {
    super();
    
    // Update uptime every minute
    setInterval(() => {
      this.metrics.uptimeMs = Date.now() - this.startTime;
      this.updateSystemMetrics();
    }, 60000);
  }

  /**
   * Record ingestion
   */
  recordIngestion(latencyMs: number, success: boolean): void {
    this.metrics.ingestionCount++;
    if (!success) this.metrics.ingestionErrors++;
    this.metrics.ingestionLatencyMs.push(latencyMs);
    this.trimLatencyArray(this.metrics.ingestionLatencyMs);
    
    this.emit('metrics', { type: 'ingestion', success, latencyMs });
  }

  /**
   * Record query
   */
  recordQuery(latencyMs: number, success: boolean, cacheHit: boolean): void {
    this.metrics.queryCount++;
    if (!success) this.metrics.queryErrors++;
    this.metrics.queryLatencyMs.push(latencyMs);
    this.trimLatencyArray(this.metrics.queryLatencyMs);
    
    if (cacheHit) {
      this.metrics.queryCacheHits++;
    } else {
      this.metrics.queryCacheMisses++;
    }
    
    this.emit('metrics', { type: 'query', success, latencyMs, cacheHit });
  }

  /**
   * Record consolidation
   */
  recordConsolidation(
    durationMs: number,
    memoriesProcessed: number,
    connectionsFound: number,
    insightsGenerated: number,
    success: boolean
  ): void {
    this.metrics.consolidationCount++;
    if (!success) this.metrics.consolidationErrors++;
    this.metrics.consolidationDurationMs.push(durationMs);
    this.trimLatencyArray(this.metrics.consolidationDurationMs);
    this.metrics.memoriesProcessed += memoriesProcessed;
    this.metrics.connectionsFound += connectionsFound;
    this.metrics.insightsGenerated += insightsGenerated;
    
    this.emit('metrics', {
      type: 'consolidation',
      success,
      durationMs,
      memoriesProcessed,
      connectionsFound,
      insightsGenerated,
    });
  }

  /**
   * Record LLM call
   */
  recordLLMCall(latencyMs: number, tokensUsed: number, success: boolean): void {
    this.metrics.llmCallsCount++;
    if (!success) this.metrics.llmErrors++;
    this.metrics.llmLatencyMs.push(latencyMs);
    this.trimLatencyArray(this.metrics.llmLatencyMs);
    this.metrics.tokensUsed += tokensUsed;
    
    this.emit('metrics', { type: 'llm', success, latencyMs, tokensUsed });
  }

  /**
   * Update storage metrics
   */
  updateStorageMetrics(memoryCount: number, insightCount: number, connectionCount: number, storageSizeBytes: number): void {
    this.metrics.memoryCount = memoryCount;
    this.metrics.insightCount = insightCount;
    this.metrics.connectionCount = connectionCount;
    this.metrics.storageSizeBytes = storageSizeBytes;
  }

  /**
   * Get current metrics
   */
  getMetrics(): Metrics {
    return { ...this.metrics };
  }

  /**
   * Get latency percentiles
   */
  getLatencyPercentiles(latencies: number[]): { p50: number; p95: number; p99: number; avg: number } {
    if (latencies.length === 0) {
      return { p50: 0, p95: 0, p99: 0, avg: 0 };
    }

    const sorted = [...latencies].sort((a, b) => a - b);
    const len = sorted.length;

    return {
      p50: sorted[Math.floor(len * 0.5)],
      p95: sorted[Math.floor(len * 0.95)],
      p99: sorted[Math.floor(len * 0.99)],
      avg: sorted.reduce((a, b) => a + b, 0) / len,
    };
  }

  /**
   * Get health check
   */
  getHealthCheck(checks: {
    ollama: boolean;
    database: boolean;
    fileWatcher: boolean;
    httpServer: boolean;
  }): HealthCheck {
    const allHealthy = Object.values(checks).every(v => v);
    const someHealthy = Object.values(checks).some(v => v);

    let status: HealthCheck['status'] = 'healthy';
    if (!allHealthy) {
      status = someHealthy ? 'degraded' : 'unhealthy';
    }

    const uptimeSeconds = Math.floor((Date.now() - this.startTime) / 1000);
    const uptimeString = this.formatUptime(uptimeSeconds);

    return {
      status,
      checks,
      version: '1.0.0',
      uptime: uptimeString,
    };
  }

  /**
   * Export metrics as Prometheus format
   */
  toPrometheusFormat(): string {
    const lines: string[] = [];
    
    // Ingestion metrics
    lines.push(`# HELP memory_ingestion_total Total number of ingestions`);
    lines.push(`# TYPE memory_ingestion_total counter`);
    lines.push(`memory_ingestion_total ${this.metrics.ingestionCount}`);
    
    lines.push(`# HELP memory_ingestion_errors_total Total number of ingestion errors`);
    lines.push(`# TYPE memory_ingestion_errors_total counter`);
    lines.push(`memory_ingestion_errors_total ${this.metrics.ingestionErrors}`);
    
    // Query metrics
    lines.push(`# HELP memory_query_total Total number of queries`);
    lines.push(`# TYPE memory_query_total counter`);
    lines.push(`memory_query_total ${this.metrics.queryCount}`);
    
    lines.push(`# HELP memory_query_errors_total Total number of query errors`);
    lines.push(`# TYPE memory_query_errors_total counter`);
    lines.push(`memory_query_errors_total ${this.metrics.queryErrors}`);
    
    // Storage metrics
    lines.push(`# HELP memory_stored_total Total memories stored`);
    lines.push(`# TYPE memory_stored_total gauge`);
    lines.push(`memory_stored_total ${this.metrics.memoryCount}`);
    
    lines.push(`# HELP memory_insights_total Total insights generated`);
    lines.push(`# TYPE memory_insights_total gauge`);
    lines.push(`memory_insights_total ${this.metrics.insightCount}`);
    
    // LLM metrics
    lines.push(`# HELP memory_llm_calls_total Total LLM calls`);
    lines.push(`# TYPE memory_llm_calls_total counter`);
    lines.push(`memory_llm_calls_total ${this.metrics.llmCallsCount}`);
    
    lines.push(`# HELP memory_llm_tokens_total Total tokens used`);
    lines.push(`# TYPE memory_llm_tokens_total counter`);
    lines.push(`memory_llm_tokens_total ${this.metrics.tokensUsed}`);
    
    return lines.join('\n');
  }

  /**
   * Record metrics snapshot
   */
  recordSnapshot(): void {
    this.metricsHistory.push({ ...this.metrics });
    if (this.metricsHistory.length > this.MAX_HISTORY) {
      this.metricsHistory.shift();
    }
  }

  /**
   * Get metrics history
   */
  getHistory(): Metrics[] {
    return [...this.metricsHistory];
  }

  private trimLatencyArray(arr: number[]): void {
    if (arr.length > 1000) {
      arr.splice(0, arr.length - 1000);
    }
  }

  private updateSystemMetrics(): void {
    // This would use process.usage() in Node.js
    // For now, just update memory usage
    if (typeof process !== 'undefined' && process.memoryUsage) {
      this.metrics.memoryUsageBytes = process.memoryUsage().heapUsed;
    }
  }

  private formatUptime(seconds: number): string {
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    
    return `${days}d ${hours}h ${minutes}m ${secs}s`;
  }
}

// Singleton instance
export const observability = new ObservabilityManager();
