/**
 * Monitoring Module
 * 
 * Production hardening utilities: circuit breakers, retry logic, and metrics.
 */

export { CircuitBreaker, CircuitBreakerError, createCircuitBreaker } from './circuit-breaker';
export type { CircuitState, CircuitBreakerConfig, CircuitBreakerMetrics } from './circuit-breaker';

export { RetryExecutor, withRetry, RetryPresets, WithRetry } from './retry';
export type { RetryConfig, RetryResult } from './retry';

export { MetricsCollector, globalMetrics, CountMetric, TimeMetric } from './metrics';
export type { MetricValue, MetricSeries, HistogramBucket, HistogramMetric } from './metrics';
