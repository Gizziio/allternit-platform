---
wih_version: 1
work_item_id: "T2.6"
title: "Implement Log Streaming (WebSocket)"
owner_role: "orchestrator"
assigned_roles:
  builder: "agent.builder"
  validator: "agent.validator"
inputs:
  sot: "/docs/research/txtx-axel-analysis.md"
  requirements:
    - "Implement WebSocket endpoint for log streaming"
    - "Stream pane output in real-time"
    - "Support multiple concurrent clients"
  context_packs:
    - "services/orchestration/workspace-service/"
    - "vendor/txtx-axel-app/Services/"  # Reference only
  artifacts_from_deps:
    - "T2.5"
scope:
  allowed_paths:
    - "services/orchestration/workspace-service/src/streaming.rs"
  allowed_tools:
    - "fs.read"
    - "fs.write"
    - "cargo.build"
    - "cargo.test"
  execution_permission:
    mode: "write_leased"
outputs:
  required_artifacts:
    - "services/orchestration/workspace-service/src/streaming.rs"
  required_reports:
    - "log_streaming_report.md"
acceptance:
  tests:
    - "cargo test -p workspace-service streaming"
    - "websocket_load_test"
  invariants:
    - "Low latency streaming"
    - "Handles 100+ concurrent connections"
  evidence:
    - "log_streaming_report.md"
blockers:
  fail_on:
    - "performance_regression"
stop_conditions:
  escalate_if:
    - "memory_leak"
  max_iterations: 5
---

# Implement Log Streaming (WebSocket)

## Objective
Stream tmux pane output via WebSocket.

## WebSocket Handler
```rust
pub struct LogStreamer {
    pane_subscriptions: Arc<RwLock<HashMap<String, broadcast::Sender<String>>>>,
}

impl LogStreamer {
    pub async fn subscribe(&self, pane_id: &str) -> Result<broadcast::Receiver<String>>;
    pub async fn publish(&self, pane_id: &str, line: String);
}
```

## Axum Route
```rust
async fn ws_handler(
    ws: WebSocketUpgrade,
    Path(pane_id): Path<String>,
    State(streamer): State<Arc<LogStreamer>>,
) -> Response {
    ws.on_upgrade(|socket| handle_socket(socket, pane_id, streamer))
}
```

## Features
- Real-time pane output streaming
- Multiple client support per pane
- Reconnection handling
- Backpressure management
