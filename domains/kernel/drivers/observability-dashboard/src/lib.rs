//! Allternit Observability Dashboard
//!
//! Provides trace visualization, telemetry, and real-time monitoring
//! for the Allternit platform.

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::net::SocketAddr;
use tracing::{info, warn};

/// Trace identifier
pub type TraceId = String;
pub type SpanId = String;

/// Execution trace
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ExecutionTrace {
    pub trace_id: TraceId,
    pub root_span_id: SpanId,
    pub spans: Vec<TraceSpan>,
    pub start_time: DateTime<Utc>,
    pub end_time: Option<DateTime<Utc>>,
    pub status: TraceStatus,
    pub metadata: HashMap<String, String>,
}

/// Trace span
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TraceSpan {
    pub span_id: SpanId,
    pub parent_id: Option<SpanId>,
    pub name: String,
    pub start_time: DateTime<Utc>,
    pub end_time: Option<DateTime<Utc>>,
    pub duration_ms: Option<u64>,
    pub attributes: HashMap<String, serde_json::Value>,
    pub events: Vec<SpanEvent>,
    pub status: SpanStatus,
}

/// Span event
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SpanEvent {
    pub timestamp: DateTime<Utc>,
    pub name: String,
    pub attributes: HashMap<String, serde_json::Value>,
}

/// Trace status
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub enum TraceStatus {
    Ok,
    Error(String),
    InProgress,
}

/// Span status
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub enum SpanStatus {
    Ok,
    Error(String),
}

/// Telemetry metrics
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TelemetryMetrics {
    pub timestamp: DateTime<Utc>,
    /// Tool call metrics
    pub tool_calls: ToolCallMetrics,
    /// Cost metrics
    pub cost: CostMetrics,
    /// Latency metrics
    pub latency: LatencyMetrics,
    /// Cache metrics
    pub cache: CacheMetrics,
    /// Failure metrics
    pub failures: FailureMetrics,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct ToolCallMetrics {
    pub total_calls: u64,
    pub calls_per_minute: f64,
    pub calls_by_tool: HashMap<String, u64>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct CostMetrics {
    pub total_cost_usd: f64,
    pub cost_per_wih: f64,
    pub cost_by_model: HashMap<String, f64>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct LatencyMetrics {
    pub avg_latency_ms: f64,
    pub p50_latency_ms: f64,
    pub p95_latency_ms: f64,
    pub p99_latency_ms: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct CacheMetrics {
    pub hit_rate: f64,
    pub hits: u64,
    pub misses: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct FailureMetrics {
    pub total_failures: u64,
    pub failure_rate: f64,
    pub failures_by_type: HashMap<String, u64>,
}

/// Trace collector
pub struct TraceCollector {
    traces: HashMap<TraceId, ExecutionTrace>,
    active_spans: HashMap<SpanId, TraceSpan>,
}

impl TraceCollector {
    /// Create a new trace collector
    pub fn new() -> Self {
        Self {
            traces: HashMap::new(),
            active_spans: HashMap::new(),
        }
    }

    /// Start a new trace
    pub fn start_trace(&mut self, trace_id: impl Into<String>, name: impl Into<String>) -> TraceId {
        let trace_id = trace_id.into();
        let span_id = format!("span_{}", uuid::Uuid::new_v4().simple());
        let now = Utc::now();

        let root_span = TraceSpan {
            span_id: span_id.clone(),
            parent_id: None,
            name: name.into(),
            start_time: now,
            end_time: None,
            duration_ms: None,
            attributes: HashMap::new(),
            events: Vec::new(),
            status: SpanStatus::Ok,
        };

        let trace = ExecutionTrace {
            trace_id: trace_id.clone(),
            root_span_id: span_id.clone(),
            spans: vec![root_span.clone()],
            start_time: now,
            end_time: None,
            status: TraceStatus::InProgress,
            metadata: HashMap::new(),
        };

        self.traces.insert(trace_id.clone(), trace);
        self.active_spans.insert(span_id, root_span);

        trace_id
    }

    /// Start a child span
    pub fn start_span(
        &mut self,
        trace_id: &str,
        parent_id: &str,
        name: impl Into<String>,
    ) -> Option<SpanId> {
        let trace = self.traces.get_mut(trace_id)?;
        let span_id = format!("span_{}", uuid::Uuid::new_v4().simple());

        let span = TraceSpan {
            span_id: span_id.clone(),
            parent_id: Some(parent_id.to_string()),
            name: name.into(),
            start_time: Utc::now(),
            end_time: None,
            duration_ms: None,
            attributes: HashMap::new(),
            events: Vec::new(),
            status: SpanStatus::Ok,
        };

        trace.spans.push(span.clone());
        self.active_spans.insert(span_id.clone(), span);

        Some(span_id)
    }

    /// End a span
    pub fn end_span(&mut self, trace_id: &str, span_id: &str) {
        let now = Utc::now();

        if let Some(span) = self.active_spans.remove(span_id) {
            let duration = now.signed_duration_since(span.start_time);
            
            if let Some(trace) = self.traces.get_mut(trace_id) {
                if let Some(s) = trace.spans.iter_mut().find(|s| s.span_id == span_id) {
                    s.end_time = Some(now);
                    s.duration_ms = Some(duration.num_milliseconds() as u64);
                }
            }
        }
    }

    /// End a trace
    pub fn end_trace(&mut self, trace_id: &str, status: TraceStatus) {
        if let Some(trace) = self.traces.get_mut(trace_id) {
            trace.end_time = Some(Utc::now());
            trace.status = status;
        }
    }

    /// Get trace by ID
    pub fn get_trace(&self, trace_id: &str) -> Option<&ExecutionTrace> {
        self.traces.get(trace_id)
    }

    /// Get trace visualization data
    pub fn get_trace_visualization(&self, trace_id: &str) -> Option<TraceVisualization> {
        let trace = self.traces.get(trace_id)?;

        let nodes: Vec<TraceNode> = trace
            .spans
            .iter()
            .map(|span| TraceNode {
                id: span.span_id.clone(),
                label: span.name.clone(),
                parent_id: span.parent_id.clone(),
                start_time: span.start_time,
                duration_ms: span.duration_ms.unwrap_or(0),
                status: span.status.clone(),
            })
            .collect();

        let edges: Vec<TraceEdge> = trace
            .spans
            .iter()
            .filter_map(|span| {
                span.parent_id.as_ref().map(|parent| TraceEdge {
                    from: parent.clone(),
                    to: span.span_id.clone(),
                })
            })
            .collect();

        Some(TraceVisualization {
            trace_id: trace_id.to_string(),
            nodes,
            edges,
            total_duration_ms: trace
                .end_time
                .map(|end| end.signed_duration_since(trace.start_time).num_milliseconds() as u64)
                .unwrap_or(0),
        })
    }

    /// Get all traces
    pub fn get_all_traces(&self) -> Vec<&ExecutionTrace> {
        self.traces.values().collect()
    }

    /// Calculate metrics
    pub fn calculate_metrics(&self) -> TelemetryMetrics {
        let mut tool_calls = ToolCallMetrics::default();
        let mut latency = LatencyMetrics::default();
        let mut failures = FailureMetrics::default();

        let mut latencies: Vec<u64> = Vec::new();

        for trace in self.traces.values() {
            for span in &trace.spans {
                // Count tool calls
                if span.name.starts_with("tool.") {
                    tool_calls.total_calls += 1;
                    *tool_calls.calls_by_tool.entry(span.name.clone()).or_insert(0) += 1;
                }

                // Collect latencies
                if let Some(duration) = span.duration_ms {
                    latencies.push(duration);
                }

                // Count failures
                if let SpanStatus::Error(ref reason) = span.status {
                    failures.total_failures += 1;
                    *failures.failures_by_type.entry(reason.clone()).or_insert(0) += 1;
                }
            }
        }

        // Calculate latency percentiles
        if !latencies.is_empty() {
            latencies.sort();
            latency.avg_latency_ms = latencies.iter().sum::<u64>() as f64 / latencies.len() as f64;
            latency.p50_latency_ms = latencies[latencies.len() / 2] as f64;
            latency.p95_latency_ms = latencies[(latencies.len() as f64 * 0.95) as usize] as f64;
            latency.p99_latency_ms = latencies[(latencies.len() as f64 * 0.99) as usize] as f64;
        }

        let total_calls = tool_calls.total_calls;
        failures.failure_rate = if total_calls > 0 {
            (failures.total_failures as f64 / total_calls as f64) * 100.0
        } else {
            0.0
        };

        TelemetryMetrics {
            timestamp: Utc::now(),
            tool_calls,
            cost: CostMetrics::default(), // Would integrate with cost tracking
            latency,
            cache: CacheMetrics::default(), // Would integrate with cache
            failures,
        }
    }
}

impl Default for TraceCollector {
    fn default() -> Self {
        Self::new()
    }
}

/// Trace visualization data
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TraceVisualization {
    pub trace_id: String,
    pub nodes: Vec<TraceNode>,
    pub edges: Vec<TraceEdge>,
    pub total_duration_ms: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TraceNode {
    pub id: String,
    pub label: String,
    pub parent_id: Option<String>,
    pub start_time: DateTime<Utc>,
    pub duration_ms: u64,
    pub status: SpanStatus,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TraceEdge {
    pub from: String,
    pub to: String,
}

/// Dashboard server
pub struct DashboardServer {
    collector: TraceCollector,
    port: u16,
}

impl DashboardServer {
    /// Create a new dashboard server
    pub fn new(collector: TraceCollector, port: u16) -> Self {
        Self { collector, port }
    }

    /// Start the dashboard server
    pub async fn start(&self) -> anyhow::Result<()> {
        info!("Starting observability dashboard on port {}", self.port);
        // Would start axum server here
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_trace_collection() {
        let mut collector = TraceCollector::new();
        
        let trace_id = collector.start_trace("trace-1", "root");
        let root_span_id = collector.traces.get(&trace_id).unwrap().root_span_id.clone();
        let span_id = collector.start_span(&trace_id, &root_span_id, "child")
            .unwrap();
        
        collector.end_span(&trace_id, &span_id);
        collector.end_trace(&trace_id, TraceStatus::Ok);
        
        let trace = collector.get_trace(&trace_id).unwrap();
        assert_eq!(trace.spans.len(), 2);
        assert_eq!(trace.status, TraceStatus::Ok);
    }

    #[test]
    fn test_trace_visualization() {
        let mut collector = TraceCollector::new();
        
        let trace_id = collector.start_trace("trace-2", "root");
        let root_span_id = collector.traces.get(&trace_id).unwrap().root_span_id.clone();
        let child_id = collector.start_span(&trace_id, &root_span_id, "child")
            .unwrap();
        
        collector.end_span(&trace_id, &child_id);
        collector.end_trace(&trace_id, TraceStatus::Ok);
        
        let viz = collector.get_trace_visualization(&trace_id).unwrap();
        assert_eq!(viz.nodes.len(), 2);
        assert_eq!(viz.edges.len(), 1);
    }

    #[test]
    fn test_metrics_calculation() {
        let mut collector = TraceCollector::new();
        
        // Create some traces
        for i in 0..5 {
            let trace_id = collector.start_trace(format!("trace-{}", i), "root");
            let root_span_id = collector.traces.get(&trace_id).unwrap().root_span_id.clone();
            let span_id = collector.start_span(&trace_id, &root_span_id, "tool.test")
                .unwrap();
            
            // Simulate some work
            std::thread::sleep(std::time::Duration::from_millis(10));
            
            collector.end_span(&trace_id, &span_id);
            collector.end_trace(&trace_id, TraceStatus::Ok);
        }
        
        let metrics = collector.calculate_metrics();
        assert!(metrics.tool_calls.total_calls > 0);
        assert!(metrics.latency.avg_latency_ms > 0.0);
    }
}
