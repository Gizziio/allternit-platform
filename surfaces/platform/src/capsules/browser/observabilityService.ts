/**
 * Observability Service
 * 
 * Implements LAW-ENF-006: Observability Legibility Contract
 * 
 * Required Surfaces:
 * 1. Structured logs (queryable via LogQL-like interface)
 * 2. Metrics (queryable via PromQL-like interface)
 * 3. Traces (span per major action)
 * 4. UI state (DOM snapshot, screenshot capability)
 * 5. Performance stats (response time, error rate)
 * 
 * Aligned with:
 * - SYSTEM_LAW.md LAW-ENF-006
 * - LAW-ENF-007 (Canonical Event Schema)
 */

import { v4 as uuidv4 } from 'uuid';

// ============================================================================
// Types - Aligned with LAW-ENF-007
// ============================================================================

export type Severity = 'debug' | 'info' | 'warn' | 'error' | 'critical';

export interface LogEvent {
  event_id: string;
  timestamp: string;
  correlation_id: string;
  session_id: string;
  event_type: string;
  severity: Severity;
  source: string;
  message: string;
  payload?: Record<string, unknown>;
  context: {
    prefix_hash?: string;
    toolset_hash?: string;
    workspace_hash?: string;
  };
}

export interface MetricPoint {
  timestamp: string;
  value: number;
  labels?: Record<string, string>;
}

export interface Metric {
  name: string;
  type: 'counter' | 'gauge' | 'histogram';
  points: MetricPoint[];
  unit?: string;
  description?: string;
}

export interface TraceSpan {
  trace_id: string;
  span_id: string;
  parent_span_id?: string;
  name: string;
  start_time: string;
  end_time?: string;
  status: 'ok' | 'error';
  attributes?: Record<string, string>;
  events?: Array<{
    timestamp: string;
    name: string;
    attributes?: Record<string, string>;
  }>;
}

export interface UIStateSnapshot {
  timestamp: string;
  url: string;
  title: string;
  domHash: string;
  viewport: {
    width: number;
    height: number;
    devicePixelRatio?: number;
  };
  screenshot?: string;  // Base64 encoded
}

export interface PerformanceStats {
  responseTime: {
    p50: number;
    p95: number;
    p99: number;
  };
  errorRate: number;
  throughput: number;
  period: {
    start: string;
    end: string;
  };
}

// ============================================================================
// Observability Store Interface
// ============================================================================

export interface ObservabilityStore {
  // Logs
  appendLog(log: Omit<LogEvent, 'event_id' | 'timestamp'>): Promise<LogEvent>;
  queryLogs(params: LogQueryParams): Promise<LogQueryResult>;

  // Metrics
  recordMetric(name: string, value: number, labels?: Record<string, string>): Promise<void>;
  getMetrics(name: string, period: { start: string; end: string }): Promise<Metric>;

  // Traces
  startSpan(params: {
    name: string;
    trace_id?: string;
    parent_span_id?: string;
    attributes?: Record<string, string>;
  }): Promise<TraceSpan>;
  endSpan(span_id: string, status?: 'ok' | 'error', attributes?: Record<string, string>): Promise<void>;
  getTrace(trace_id: string): Promise<TraceSpan[]>;

  // UI State
  captureUIState(state: Omit<UIStateSnapshot, 'timestamp'>): Promise<UIStateSnapshot>;
  getUIStateHistory(session_id: string, limit?: number): Promise<UIStateSnapshot[]>;

  // Performance
  recordResponseTime(duration_ms: number): Promise<void>;
  recordError(): Promise<void>;
  getPerformanceStats(period: { start: string; end: string }): Promise<PerformanceStats>;
  
  // Prometheus export
  getPrometheusMetrics(): Promise<string>;
}

// ============================================================================
// Query Parameters
// ============================================================================

export interface LogQueryParams {
  session_id?: string;
  correlation_id?: string;
  event_type?: string;
  severity?: Severity;
  source?: string;
  time_range?: {
    start: string;
    end: string;
  };
  page?: number;
  pageSize?: number;
}

export interface LogQueryResult {
  logs: LogEvent[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
}

// ============================================================================
// In-Memory Store (for development)
// ============================================================================

export class InMemoryObservabilityStore implements ObservabilityStore {
  private logs: LogEvent[] = [];
  private metrics: Map<string, MetricPoint[]> = new Map();
  private traces: Map<string, TraceSpan[]> = new Map();
  private uiStates: Map<string, UIStateSnapshot[]> = new Map();
  private responseTimes: number[] = [];
  private errorCount: number = 0;

  async appendLog(log: Omit<LogEvent, 'event_id' | 'timestamp'>): Promise<LogEvent> {
    const event: LogEvent = {
      ...log,
      event_id: 'log_' + uuidv4(),
      timestamp: new Date().toISOString(),
    };
    this.logs.push(event);
    return event;
  }

  async queryLogs(params: LogQueryParams): Promise<LogQueryResult> {
    let filtered = [...this.logs];

    if (params.session_id) {
      filtered = filtered.filter(l => l.session_id === params.session_id);
    }
    if (params.correlation_id) {
      filtered = filtered.filter(l => l.correlation_id === params.correlation_id);
    }
    if (params.event_type) {
      filtered = filtered.filter(l => l.event_type === params.event_type);
    }
    if (params.severity) {
      filtered = filtered.filter(l => l.severity === params.severity);
    }
    if (params.source) {
      filtered = filtered.filter(l => l.source === params.source);
    }
    if (params.time_range) {
      filtered = filtered.filter(l =>
        l.timestamp >= params.time_range!.start &&
        l.timestamp <= params.time_range!.end
      );
    }

    const page = params.page || 1;
    const pageSize = params.pageSize || 100;
    const start = (page - 1) * pageSize;
    const end = start + pageSize;

    return {
      logs: filtered.slice(start, end),
      total: filtered.length,
      page,
      pageSize,
      hasMore: end < filtered.length,
    };
  }

  async recordMetric(name: string, value: number, labels?: Record<string, string>): Promise<void> {
    const points = this.metrics.get(name) || [];
    points.push({
      timestamp: new Date().toISOString(),
      value,
      labels,
    });
    this.metrics.set(name, points);
  }

  async getMetrics(name: string, period: { start: string; end: string }): Promise<Metric> {
    const points = this.metrics.get(name) || [];
    const filtered = points.filter(p =>
      p.timestamp >= period.start && p.timestamp <= period.end
    );

    return {
      name,
      type: 'gauge',
      points: filtered,
    };
  }

  async startSpan(params: {
    name: string;
    trace_id?: string;
    parent_span_id?: string;
    attributes?: Record<string, string>;
  }): Promise<TraceSpan> {
    const trace_id = params.trace_id || 'trace_' + uuidv4();
    const span_id = 'span_' + uuidv4();

    const span: TraceSpan = {
      trace_id,
      span_id,
      parent_span_id: params.parent_span_id,
      name: params.name,
      start_time: new Date().toISOString(),
      status: 'ok',
      attributes: params.attributes,
      events: [],
    };

    const spans = this.traces.get(trace_id) || [];
    spans.push(span);
    this.traces.set(trace_id, spans);

    return span;
  }

  async endSpan(
    span_id: string,
    status: 'ok' | 'error' = 'ok',
    attributes?: Record<string, string>
  ): Promise<void> {
    for (const [trace_id, spans] of this.traces.entries()) {
      const spanIndex = spans.findIndex(s => s.span_id === span_id);
      if (spanIndex !== -1) {
        spans[spanIndex] = {
          ...spans[spanIndex],
          end_time: new Date().toISOString(),
          status,
          attributes: attributes
            ? { ...spans[spanIndex].attributes, ...attributes }
            : spans[spanIndex].attributes,
        };
        this.traces.set(trace_id, spans);
        return;
      }
    }
  }

  async getTrace(trace_id: string): Promise<TraceSpan[]> {
    return this.traces.get(trace_id) || [];
  }

  async captureUIState(state: Omit<UIStateSnapshot, 'timestamp'>): Promise<UIStateSnapshot> {
    const snapshot: UIStateSnapshot = {
      ...state,
      timestamp: new Date().toISOString(),
    };

    const sessionStates = this.uiStates.get(state.url) || [];
    sessionStates.push(snapshot);
    this.uiStates.set(state.url, sessionStates);

    return snapshot;
  }

  async getUIStateHistory(url: string, limit: number = 10): Promise<UIStateSnapshot[]> {
    const states = this.uiStates.get(url) || [];
    return states.slice(-limit);
  }

  async recordResponseTime(duration_ms: number): Promise<void> {
    this.responseTimes.push(duration_ms);
    // Keep only last 1000 measurements
    if (this.responseTimes.length > 1000) {
      this.responseTimes.shift();
    }
  }

  async recordError(): Promise<void> {
    this.errorCount++;
  }

  async getPerformanceStats(period: { start: string; end: string }): Promise<PerformanceStats> {
    const sorted = [...this.responseTimes].sort((a, b) => a - b);
    const len = sorted.length;

    const percentile = (p: number) => {
      if (len === 0) return 0;
      const idx = Math.ceil(len * p) - 1;
      return sorted[Math.max(0, idx)];
    };

    return {
      responseTime: {
        p50: percentile(0.5),
        p95: percentile(0.95),
        p99: percentile(0.99),
      },
      errorRate: len > 0 ? this.errorCount / len : 0,
      throughput: len / ((new Date(period.end).getTime() - new Date(period.start).getTime()) / 1000),
      period,
    };
  }

  /**
   * Export metrics in Prometheus format
   */
  async getPrometheusMetrics(): Promise<string> {
    const lines: string[] = [];
    const timestamp = Date.now();

    // Add response time metrics
    if (this.responseTimes.length > 0) {
      const sorted = [...this.responseTimes].sort((a, b) => a - b);
      lines.push('# HELP a2r_response_time_ms Response time in milliseconds');
      lines.push('# TYPE a2r_response_time_ms histogram');
      lines.push(`a2r_response_time_ms_count ${sorted.length}`);
      lines.push(`a2r_response_time_ms_sum ${sorted.reduce((a, b) => a + b, 0)}`);
      
      // Add bucket counts for standard percentiles
      const buckets = [10, 50, 100, 250, 500, 1000, 2500, 5000, 10000];
      for (const bucket of buckets) {
        const count = sorted.filter(v => v <= bucket).length;
        lines.push(`a2r_response_time_ms_bucket{le="${bucket}"} ${count}`);
      }
      lines.push(`a2r_response_time_ms_bucket{le="+Inf"} ${sorted.length}`);
    }

    // Add error count
    lines.push('# HELP a2r_errors_total Total number of errors');
    lines.push('# TYPE a2r_errors_total counter');
    lines.push(`a2r_errors_total ${this.errorCount}`);

    // Add log counts by severity
    const severityCounts = new Map<string, number>();
    for (const log of this.logs) {
      severityCounts.set(log.severity, (severityCounts.get(log.severity) || 0) + 1);
    }
    lines.push('# HELP a2r_logs_total Total number of log events');
    lines.push('# TYPE a2r_logs_total counter');
    for (const [severity, count] of severityCounts) {
      lines.push(`a2r_logs_total{severity="${severity}"} ${count}`);
    }

    // Add custom metrics
    for (const [name, points] of this.metrics.entries()) {
      const sanitizedName = name.replace(/[^a-zA-Z0-9_]/g, '_');
      lines.push(`# HELP a2r_${sanitizedName} Metric ${name}`);
      lines.push(`# TYPE a2r_${sanitizedName} gauge`);
      const latest = points[points.length - 1];
      if (latest) {
        const labels = latest.labels ? 
          Object.entries(latest.labels).map(([k, v]) => `${k}="${v}"`).join(',') : '';
        const labelStr = labels ? `{${labels}}` : '';
        lines.push(`a2r_${sanitizedName}${labelStr} ${latest.value}`);
      }
    }

    return lines.join('\n');
  }
}

// ============================================================================
// Prometheus Integration Store
// ============================================================================

export class PrometheusObservabilityStore extends InMemoryObservabilityStore {
  private prometheusUrl?: string;
  private pushGatewayUrl?: string;
  private jobName: string;
  private instance: string;

  constructor(config: {
    prometheusUrl?: string;
    pushGatewayUrl?: string;
    jobName?: string;
    instance?: string;
  } = {}) {
    super();
    this.prometheusUrl = config.prometheusUrl || process.env.PROMETHEUS_URL;
    this.pushGatewayUrl = config.pushGatewayUrl || process.env.PROMETHEUS_PUSHGATEWAY_URL;
    this.jobName = config.jobName || 'a2r-platform';
    this.instance = config.instance || 'localhost';
  }

  async recordMetric(name: string, value: number, labels?: Record<string, string>): Promise<void> {
    await super.recordMetric(name, value, labels);
    
    // Push to Prometheus PushGateway if configured
    if (this.pushGatewayUrl) {
      try {
        await this.pushToGateway(name, value, labels);
      } catch (error) {
        console.warn('Failed to push metric to Prometheus:', error);
      }
    }
  }

  private async pushToGateway(name: string, value: number, labels?: Record<string, string>): Promise<void> {
    if (!this.pushGatewayUrl) return;

    const sanitizedName = name.replace(/[^a-zA-Z0-9_]/g, '_');
    const allLabels = {
      job: this.jobName,
      instance: this.instance,
      ...labels,
    };
    const labelStr = Object.entries(allLabels)
      .map(([k, v]) => `${k}="${v}"`)
      .join(',');

    const metricData = `# TYPE a2r_${sanitizedName} gauge
a2r_${sanitizedName}{${labelStr}} ${value}
`;

    const url = `${this.pushGatewayUrl}/metrics/job/${this.jobName}/instance/${this.instance}`;
    
    try {
      await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain' },
        body: metricData,
      });
    } catch (error) {
      // Silently fail - metrics should not break the application
      console.debug('Prometheus push failed:', error);
    }
  }

  /**
   * Query metrics from Prometheus
   */
  async queryPrometheus(query: string): Promise<unknown> {
    if (!this.prometheusUrl) {
      throw new Error('Prometheus URL not configured');
    }

    const url = new URL('/api/v1/query', this.prometheusUrl);
    url.searchParams.set('query', query);

    const response = await fetch(url.toString());
    if (!response.ok) {
      throw new Error(`Prometheus query failed: ${response.statusText}`);
    }

    return response.json();
  }
}

// ============================================================================
// Observability Service
// ============================================================================

export class ObservabilityService {
  private store: ObservabilityStore;
  private defaultSessionId: string;
  private defaultCorrelationId: string;

  constructor(store: ObservabilityStore, sessionId?: string, correlationId?: string) {
    this.store = store;
    this.defaultSessionId = sessionId || 'session_' + uuidv4();
    this.defaultCorrelationId = correlationId || 'corr_' + uuidv4();
  }

  /**
   * Log structured event (LAW-ENF-007 compliant)
   */
  async log(params: {
    event_type: string;
    severity: Severity;
    source: string;
    message: string;
    payload?: Record<string, unknown>;
    context?: {
      prefix_hash?: string;
      toolset_hash?: string;
      workspace_hash?: string;
    };
    session_id?: string;
    correlation_id?: string;
  }): Promise<LogEvent> {
    return this.store.appendLog({
      ...params,
      context: params.context || {},
      session_id: params.session_id || this.defaultSessionId,
      correlation_id: params.correlation_id || this.defaultCorrelationId,
    });
  }

  /**
   * Start trace span
   */
  async startSpan(name: string, attributes?: Record<string, string>): Promise<string> {
    const span = await this.store.startSpan({
      name,
      attributes,
    });
    return span.span_id;
  }

  /**
   * End trace span
   */
  async endSpan(spanId: string, status: 'ok' | 'error' = 'ok'): Promise<void> {
    await this.store.endSpan(spanId, status);
  }

  /**
   * Record metric
   */
  async metric(name: string, value: number, labels?: Record<string, string>): Promise<void> {
    await this.store.recordMetric(name, value, labels);
  }

  /**
   * Capture UI state
   */
  async captureUIState(state: {
    url: string;
    title: string;
    domHash: string;
    viewport: { width: number; height: number; devicePixelRatio?: number };
    screenshot?: string;
  }): Promise<void> {
    await this.store.captureUIState(state);
  }

  /**
   * Record performance
   */
  async recordPerformance(duration_ms: number, isError: boolean = false): Promise<void> {
    await this.store.recordResponseTime(duration_ms);
    if (isError) {
      await this.store.recordError();
    }
  }

  /**
   * Get performance stats
   */
  async getPerformanceStats(period?: { start: string; end: string }): Promise<PerformanceStats> {
    const now = new Date().toISOString();
    const hourAgo = new Date(Date.now() - 3600000).toISOString();
    return this.store.getPerformanceStats(period || { start: hourAgo, end: now });
  }

  /**
   * Get Prometheus-formatted metrics for scraping
   */
  async getPrometheusMetrics(): Promise<string> {
    return this.store.getPrometheusMetrics();
  }
}

// ============================================================================
// Singleton Instance
// ============================================================================

let _observabilityStore: ObservabilityStore | null = null;
let _observabilityService: ObservabilityService | null = null;

export function getObservabilityStore(): ObservabilityStore {
  if (!_observabilityStore) {
    // Use Prometheus integration if configured, otherwise in-memory
    if (process.env.PROMETHEUS_PUSHGATEWAY_URL) {
      _observabilityStore = new PrometheusObservabilityStore();
    } else {
      _observabilityStore = new InMemoryObservabilityStore();
    }
  }
  return _observabilityStore;
}

export function getObservabilityService(sessionId?: string, correlationId?: string): ObservabilityService {
  if (!_observabilityService) {
    _observabilityService = new ObservabilityService(
      getObservabilityStore(),
      sessionId,
      correlationId
    );
  }
  return _observabilityService;
}

// ============================================================================
// API Route Handler for Prometheus Scraping
// ============================================================================

/**
 * Handler for /api/metrics endpoint
 * Returns metrics in Prometheus format
 */
export async function metricsHandler(): Promise<Response> {
  const store = getObservabilityStore();
  const metrics = await store.getPrometheusMetrics();
  
  return new Response(metrics, {
    headers: {
      'Content-Type': 'text/plain; version=0.0.4',
    },
  });
}
