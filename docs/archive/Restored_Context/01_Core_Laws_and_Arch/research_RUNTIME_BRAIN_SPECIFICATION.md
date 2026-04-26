# A://TERNIT Runtime Brain Specification

## The Missing Piece

**Rig** = LLM client library  
**RMCP** = MCP transport protocol  
**Neither** = Runtime orchestration brain

The Runtime Brain is a **state machine** that manages:
- Session lifecycle deterministically
- Tool loop arbitration
- Streaming backpressure
- Retry/circuit breaker logic
- Multi-session supervision
- Cross-provider fallback

---

## 1. BrainRuntime Architecture

### 1.1 Correct Stack

```
┌─────────────────────────────────────────────────────────────────┐
│                     cmd/cli/ (TUI Client)                     │
└─────────────────────────────────────────────────────────────────┘
                              │ HTTP
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│           services/orchestration/kernel-service/              │
│                    [THIN HTTP ADAPTER ONLY]                     │
│  - POST /v1/sessions         → BrainRuntime::session_create()   │
│  - POST /v1/sessions/{id}    → BrainRuntime::session_invoke()   │
│  - GET  /v1/sessions/{id}    → BrainRuntime::session_events()   │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    domains/kernel/infrastructure/                      │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │                 allternit-runtime/ (BRAIN)                     │  │
│  │  ┌──────────────────────────────────────────────────┐   │  │
│  │  │           BrainRuntime (State Machine)           │   │  │
│  │  │  - SessionStateMachine (per session)             │   │  │
│  │  │  - ToolLoopArbiter                               │   │  │
│  │  │  - StreamingSupervisor                         │   │  │
│  │  │  - RetryPolicyEngine                             │   │  │
│  │  │  - CircuitBreaker                                │   │  │
│  │  └──────────────────────────────────────────────────┘   │  │
│  │                                                           │  │
│  │  ┌──────────────────────────────────────────────────┐   │  │
│  │  │        ProviderAdapter (normalized I/O)          │   │  │
│  │  │  - RigProvider (via rig-core)                    │   │  │
│  │  │  - McpProvider (via rmcp for ACP agents)         │   │  │
│  │  │  - FallbackChain                                 │   │  │
│  │  └──────────────────────────────────────────────────┘   │  │
│  └──────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

### 1.2 BrainRuntime is NOT

- ❌ Not an LLM client (that's Rig)
- ❌ Not a protocol handler (that's RMCP)
- ❌ Not a UI (that's CLI)
- ❌ Not an HTTP server (that's kernel-service)

### 1.3 BrainRuntime IS

- ✅ A deterministic state machine
- ✅ A lifecycle orchestrator
- ✅ A streaming flow controller
- ✅ A failure mode manager
- ✅ A policy enforcement point

---

## 2. State Machine Specification

### 2.1 Session States

```rust
pub enum SessionState {
    /// Session created but not yet initialized
    Idle,
    
    /// Initializing connection to provider/ACP
    Initializing {
        attempt: u32,
        started_at: Instant,
    },
    
    /// Ready for invocation
    Ready,
    
    /// Active invocation - waiting for model
    AwaitingModel {
        invocation_id: String,
        started_at: Instant,
    },
    
    /// Streaming text response
    StreamingText {
        invocation_id: String,
        tokens_so_far: u32,
        backpressure_pause: bool,
    },
    
    /// Model requested tool call
    AwaitingToolExecution {
        invocation_id: String,
        pending_calls: Vec<ToolCall>,
    },
    
    /// Executing tool(s)
    ExecutingTool {
        invocation_id: String,
        in_flight: Vec<InFlightToolCall>,
    },
    
    /// Streaming tool result to model
    StreamingToolResult {
        invocation_id: String,
    },
    
    /// Invocation completed successfully
    Completed {
        invocation_id: String,
        result: InvocationResult,
    },
    
    /// Invocation failed, may be retryable
    Failed {
        invocation_id: String,
        error: RuntimeError,
        retryable: bool,
    },
    
    /// Session terminated
    Terminated {
        reason: TerminationReason,
    },
}
```

### 2.2 State Transitions

```
Idle ─────────────────────────────────────────────────────────────
 │                                                                  │
 │ session_create()                                                  │
 ▼                                                                  │
Initializing ───────────────────────────────────────────────────► Terminated
 │ (timeout/max retries)                                           │
 │ (init success)                                                  │
 ▼                                                                 │
Ready ◄───────────────────────────────────────────────────────────┤
 │ (session_close())                                               │
 │ session_invoke()                                                │
 ▼                                                                 │
AwaitingModel ◄───────────────────────────────────────────────────┤
 │ (timeout)                                                       │
 │ (model response start)                                          │
 ▼                                                                 │
StreamingText ─────┬──────────────────────────────────────────────┤
 │ (content)       │ (tool_calls)                                  │
 │                 ▼                                               │
 │       AwaitingToolExecution                                     │
 │                 │                                               │
 │                 │ tool execution timeout                        │
 │                 ▼                                               │
 │       ExecutingTool                                             │
 │                 │                                               │
 │                 │ tool results                                  │
 │                 ▼                                               │
 │       StreamingToolResult ────────┐                             │
 │                 │                 │ (more tool calls)           │
 │                 │ (text continues)│                             │
 └─────────────────┴─────────────────┘                             │
                   │                                               │
                   ▼                                               │
           Completed/Failed ───────────────────────────────────────┘
```

### 2.3 Transition Guards

Every transition has explicit guards:

```rustnimpl SessionStateMachine {
    fn can_transition(&self, event: StateEvent) -> Result<(), StateError> {
        match (&self.state, event) {
            // Idle → Initializing: always allowed
            (SessionState::Idle, StateEvent::Initialize) => Ok(()),
            
            // Initializing → Ready: only if init success
            (SessionState::Initializing { .. }, StateEvent::InitSuccess) => Ok(()),
            
            // Initializing → Terminated: max retries exceeded
            (SessionState::Initializing { attempt, .. }, StateEvent::InitFailed { .. }) 
                if *attempt >= MAX_INIT_RETRIES => Ok(()),
            
            // Ready → AwaitingModel: always allowed
            (SessionState::Ready, StateEvent::Invoke { .. }) => Ok(()),
            
            // AwaitingModel → StreamingText: model started responding
            (SessionState::AwaitingModel { .. }, StateEvent::ModelStarted) => Ok(()),
            
            // AwaitingModel → Failed: timeout
            (SessionState::AwaitingModel { started_at, .. }, StateEvent::Timeout) 
                if started_at.elapsed() > MODEL_TIMEOUT => Ok(()),
            
            // StreamingText → AwaitingToolExecution: tool call requested
            (SessionState::StreamingText { .. }, StateEvent::ToolCallsRequested { .. }) => Ok(()),
            
            // StreamingText → Completed: natural end
            (SessionState::StreamingText { .. }, StateEvent::ModelDone) => Ok(()),
            
            // All other transitions: invalid
            (current, event) => Err(StateError::InvalidTransition {
                from: current.name(),
                event: event.name(),
            }),
        }
    }
}
```

---

## 3. Core Components

### 3.1 SessionStateMachine (Per Session)

```rustn/// One state machine per session
/// Owns the entire lifecycle deterministically
pub struct SessionStateMachine {
    session_id: String,
    state: SessionState,
    config: SessionConfig,
    
    /// Provider adapter (Rig, MCP, etc)
    provider: Arc<dyn ProviderAdapter>,
    
    /// Tool registry for this session
    tools: Arc<ToolRegistry>,
    
    /// Event output stream
    event_tx: mpsc::Sender<NormalizedEvent>,
    
    /// Supervisor handle
    supervisor: SupervisorHandle,
    
    /// Retry policy
    retry_policy: RetryPolicy,
    
    /// Circuit breaker
    circuit_breaker: CircuitBreaker,
}

impl SessionStateMachine {
    /// Main entry: process an invocation
    pub async fn invoke(&mut self, prompt: &str) -> Result<InvocationHandle, RuntimeError> {
        // Guard: can only invoke from Ready state
        self.require_state(SessionState::Ready)?;
        
        let invocation_id = generate_id();
        
        // Transition to AwaitingModel
        self.transition(StateEvent::Invoke { 
            invocation_id: invocation_id.clone(), 
            prompt: prompt.to_string() 
        }).await?;
        
        // Start the invocation loop
        let handle = self.spawn_invocation_loop(invocation_id.clone(), prompt.to_string());
        
        Ok(InvocationHandle { invocation_id, handle })
    }
    
    /// The core execution loop
    async fn invocation_loop(
        &mut self,
        invocation_id: String,
        prompt: String,
    ) -> Result<InvocationResult, RuntimeError> {
        // Phase 1: Send to model
        let mut stream = self.provider.stream_completion(&CompletionRequest {
            prompt: prompt.clone(),
            tools: self.tools.list_available(),
            ..Default::default()
        }).await?;
        
        // Phase 2: Process stream
        let mut buffer = String::new();
        let mut pending_tool_calls = Vec::new();
        
        while let Some(event) = stream.next().await {
            match event {
                ProviderEvent::ContentDelta { delta } => {
                    buffer.push_str(&delta);
                    
                    // Backpressure check
                    if self.should_backpressure() {
                        self.transition(StateEvent::BackpressurePause).await?;
                        self.wait_for_backpressure_release().await;
                        self.transition(StateEvent::BackpressureResume).await?;
                    }
                    
                    // Emit to client
                    self.emit(NormalizedEvent::ContentDelta { 
                        invocation_id: invocation_id.clone(),
                        delta 
                    }).await?;
                }
                
                ProviderEvent::ToolCallStart { call_id, name, args } => {
                    pending_tool_calls.push(ToolCall { call_id, name, args });
                }
                
                ProviderEvent::ToolCallComplete => {
                    // Transition to tool execution
                    self.transition(StateEvent::ToolCallsRequested {
                        calls: pending_tool_calls.clone(),
                    }).await?;
                    
                    // Execute tools
                    let results = self.execute_tools(pending_tool_calls).await?;
                    
                    // Send results back to model
                    for result in results {
                        self.provider.send_tool_result(&result).await?;
                    }
                    
                    pending_tool_calls.clear();
                }
                
                ProviderEvent::Done => break,
                
                ProviderEvent::Error { code, message } => {
                    return Err(RuntimeError::ProviderError { code, message });
                }
            }
        }
        
        Ok(InvocationResult {
            invocation_id,
            content: buffer,
        })
    }
    
    /// Execute tools with proper supervision
    async fn execute_tools(
        &mut self,
        calls: Vec<ToolCall>,
    ) -> Result<Vec<ToolResult>, RuntimeError> {
        let mut results = Vec::new();
        
        for call in calls {
            // Check circuit breaker
            if self.circuit_breaker.is_open(&call.name) {
                results.push(ToolResult {
                    call_id: call.call_id,
                    error: Some("Circuit breaker open".to_string()),
                    result: None,
                });
                continue;
            }
            
            // Execute with timeout and retry
            let result = self.execute_tool_with_retry(call).await?;
            results.push(result);
        }
        
        Ok(results)
    }
    
    async fn execute_tool_with_retry(
        &mut self,
        call: ToolCall,
    ) -> Result<ToolResult, RuntimeError> {
        let mut last_error = None;
        
        for attempt in 0..self.retry_policy.max_attempts {
            match self.tools.execute(&call.name, &call.args).await {
                Ok(result) => {
                    // Success: record in circuit breaker
                    self.circuit_breaker.record_success(&call.name);
                    return Ok(ToolResult {
                        call_id: call.call_id.clone(),
                        result: Some(result),
                        error: None,
                    });
                }
                Err(e) => {
                    last_error = Some(e.clone());
                    
                    // Check if retryable
                    if !e.is_retryable() || attempt >= self.retry_policy.max_attempts - 1 {
                        break;
                    }
                    
                    // Wait with exponential backoff
                    let delay = self.retry_policy.backoff(attempt);
                    tokio::time::sleep(delay).await;
                }
            }
        }
        
        // All retries exhausted
        self.circuit_breaker.record_failure(&call.name);
        
        Ok(ToolResult {
            call_id: call.call_id,
            result: None,
            error: Some(last_error.unwrap().to_string()),
        })
    }
}
```

### 3.2 BrainRuntime (Multi-Session Supervisor)

```rustn/// Manages multiple sessions
/// Handles cross-session concerns: resource limits, global circuit breakers, etc
pub struct BrainRuntime {
    /// Active sessions
    sessions: HashMap<String, SessionHandle>,
    
    /// Session factory
    session_factory: SessionFactory,
    
    /// Global limits
    max_concurrent_sessions: usize,
    max_total_tokens_per_minute: u32,
    
    /// Provider health
    provider_health: HashMap<String, ProviderHealth>,
    
    /// Global circuit breaker
    global_circuit_breaker: CircuitBreaker,
    
    /// Metrics
    metrics: RuntimeMetrics,
}

impl BrainRuntime {
    /// Create new session
    pub async fn session_create(
        &mut self,
        config: SessionConfig,
    ) -> Result<SessionHandle, RuntimeError> {
        // Check global limits
        if self.sessions.len() >= self.max_concurrent_sessions {
            return Err(RuntimeError::MaxSessionsExceeded);
        }
        
        // Check provider health
        let provider_id = &config.provider_id;
        if !self.is_provider_healthy(provider_id) {
            // Try fallback
            let fallback = self.find_fallback_provider(provider_id);
            if let Some(fallback_id) = fallback {
                tracing::warn!(
                    "Provider {} unhealthy, falling back to {}",
                    provider_id, fallback_id
                );
                // Update config with fallback
            } else {
                return Err(RuntimeError::ProviderUnhealthy {
                    provider: provider_id.clone(),
                });
            }
        }
        
        // Create session
        let session = self.session_factory.create(config).await?;
        let session_id = session.id.clone();
        
        // Spawn session supervision
        let handle = self.supervise_session(session);
        
        self.sessions.insert(session_id.clone(), handle.clone());
        
        Ok(handle)
    }
    
    /// Invoke on existing session
    pub async fn session_invoke(
        &self,
        session_id: &str,
        message: &str,
    ) -> Result<InvocationHandle, RuntimeError> {
        let session = self.sessions
            .get(session_id)
            .ok_or(RuntimeError::SessionNotFound)?;
        
        session.invoke(message).await
    }
    
    /// Get event stream for session
    pub async fn session_events(
        &self,
        session_id: &str,
    ) -> Result<BoxStream<NormalizedEvent>, RuntimeError> {
        let session = self.sessions
            .get(session_id)
            .ok_or(RuntimeError::SessionNotFound)?;
        
        session.subscribe_events().await
    }
    
    /// Supervise a session
    fn supervise_session(&self, mut session: SessionStateMachine) -> SessionHandle {
        let (cmd_tx, mut cmd_rx) = mpsc::channel(100);
        let (event_tx, event_rx) = mpsc::channel(1000);
        
        let handle = SessionHandle {
            id: session.session_id.clone(),
            cmd_tx: cmd_tx.clone(),
        };
        
        // Spawn supervision task
        tokio::spawn(async move {
            let mut health_checks = interval(Duration::from_secs(30));
            
            loop {
                tokio::select! {
                    // Handle commands
                    Some(cmd) = cmd_rx.recv() => {
                        match cmd {
                            SessionCommand::Invoke { prompt, respond_to } => {
                                let result = session.invoke(&prompt).await;
                                let _ = respond_to.send(result);
                            }
                            SessionCommand::Close => {
                                session.transition(StateEvent::Terminate).await.ok();
                                break;
                            }
                        }
                    }
                    
                    // Health check
                    _ = health_checks.tick() => {
                        if session.is_stalled() {
                            tracing::error!("Session {} stalled, terminating", session.session_id);
                            session.transition(StateEvent::Terminate).await.ok();
                            break;
                        }
                    }
                    
                    // Session completed naturally
                    else => {
                        if session.is_terminal() {
                            break;
                        }
                    }
                }
            }
            
            tracing::info!("Session {} supervisor exiting", session.session_id);
        });
        
        handle
    }
    
    /// Find healthy fallback provider
    fn find_fallback_provider(&self, primary: &str) -> Option<String> {
        // Priority order from config
        let fallbacks = ["openai", "anthropic", "gemini", "ollama"];
        
        for provider in fallbacks {
            if provider != primary && self.is_provider_healthy(provider) {
                return Some(provider.to_string());
            }
        }
        
        None
    }
}
```

### 3.3 Streaming Supervisor

```rustn/// Manages backpressure and flow control
pub struct StreamingSupervisor {
    /// Max tokens per second
    max_tps: u32,
    
    /// Current token rate
    token_bucket: TokenBucket,
    
    /// Client buffer status
    client_buffer_size: Arc<AtomicUsize>,
    
    /// Pause signal
    pause_tx: watch::Sender<bool>,
}

impl StreamingSupervisor {
    /// Check if we should apply backpressure
    fn should_backpressure(&self) -> bool {
        // Client buffer > 80% capacity
        let buffer_usage = self.client_buffer_size.load(Ordering::Relaxed);
        buffer_usage > (MAX_CLIENT_BUFFER * 8 / 10)
    }
    
    /// Wait for client to drain
    async fn wait_for_backpressure_release(&self) {
        let mut pause_rx = self.pause_tx.subscribe();
        
        loop {
            if !self.should_backpressure() {
                return;
            }
            
            tokio::select! {
                Ok(paused) = pause_rx.changed() => {
                    if !paused {
                        return;
                    }
                }
                _ = tokio::time::sleep(Duration::from_millis(100)) => {
                    // Check again
                }
            }
        }
    }
    
    /// Record tokens emitted
    fn record_tokens(&self, count: u32) {
        self.token_bucket.consume(count);
    }
}
```

---

## 4. Provider Adapter Integration

### 4.1 Rig as Provider

```rust
/// RigProvider wraps rig-core
pub struct RigProvider {
    client: Arc<dyn rig::client::Client>,
    model: String,
}

#[async_trait]
impl ProviderAdapter for RigProvider {
    async fn stream_completion(
        &self,
        request: CompletionRequest,
    ) -> Result<BoxStream<ProviderEvent>, ProviderError> {
        // Build Rig agent
        let agent = self.client
            .agent(&self.model)
            .preamble(&request.system_prompt)
            .tools(request.tools.iter().map(|t| t.into_rig_tool()))
            .build();
        
        // Get Rig stream
        let rig_stream = agent.stream_prompt(&request.prompt).await?;
        
        // Convert to normalized events
        Ok(rig_stream.map(|chunk| match chunk {
            rig::StreamingChoice::Message(text) => {
                ProviderEvent::ContentDelta { delta: text }
            }
            rig::StreamingChoice::ToolCall(name, args) => {
                ProviderEvent::ToolCallStart {
                    call_id: generate_id(),
                    name,
                    args: parse_json(&args),
                }
            }
        }).boxed())
    }
}
```

### 4.2 MCP/ACP as Provider

```rust
/// McpProvider wraps rmcp for ACP agents
pub struct McpProvider {
    mcp_client: Arc<RunningService<RoleClient, InitializeRequestParam>>,
    model: String,
}

#[async_trait]
impl ProviderAdapter for McpProvider {
    async fn stream_completion(
        &self,
        request: CompletionRequest,
    ) -> Result<BoxStream<ProviderEvent>, ProviderError> {
        // Use MCP sampling/createMessage
        let stream = self.mcp_client
            .create_message(CreateMessageRequest {
                messages: vec![SamplingMessage {
                    role: Role::User,
                    content: request.prompt,
                }],
                model_preferences: Some(ModelPreferences {
                    hints: vec![ModelHint { name: Some(self.model.clone()) }],
                    ..Default::default()
                }),
                tools: Some(request.tools.into_mcp_tools()),
            })
            .await?;
        
        // Convert MCP events to normalized
        Ok(convert_mcp_stream(stream).boxed())
    }
}
```

---

## 5. Implementation Phases

### Phase 1: Core State Machine (Week 1)
- `SessionState` enum with all states
- `transition()` with guard validation
- Basic Idle → Ready → AwaitingModel → Completed flow
- **Acceptance**: Unit tests for all valid/invalid transitions

### Phase 2: Tool Loop (Week 2)
- Tool execution integration
- Retry policy with exponential backoff
- Circuit breaker
- **Acceptance**: Tool roundtrip test

### Phase 3: Streaming (Week 3)
- Backpressure handling
- Token rate limiting
- Event normalization
- **Acceptance**: 10k token stream without overflow

### Phase 4: Multi-Session (Week 4)
- BrainRuntime multi-session support
- Provider health checks
- Fallback logic
- **Acceptance**: 100 concurrent sessions

### Phase 5: Production (Weeks 5-6)
- Metrics and observability
- Policy enforcement
- Resource limits
- **Acceptance**: Load test 24h

---

## 6. API Surface

### 6.1 BrainRuntime Trait (for kernel-service)

```rust
#[async_trait]
pub trait BrainRuntime: Send + Sync {
    /// Create new session
    async fn session_create(&self, config: SessionConfig) -> Result<SessionHandle, RuntimeError>;
    
    /// Invoke on session
    async fn session_invoke(
        &self, 
        session_id: &str, 
        message: &str
    ) -> Result<InvocationHandle, RuntimeError>;
    
    /// Subscribe to session events
    async fn session_events(
        &self, 
        session_id: &str
    ) -> Result<BoxStream<NormalizedEvent>, RuntimeError>;
    
    /// Close session
    async fn session_close(&self, session_id: &str) -> Result<(), RuntimeError>;
    
    /// Get runtime metrics
    fn metrics(&self) -> RuntimeMetrics;
}
```

### 6.2 Normalized Events

```rust
pub enum NormalizedEvent {
    /// Session lifecycle
    SessionStarted { session_id: String },
    SessionReady { session_id: String },
    SessionError { session_id: String, error: String },
    SessionEnded { session_id: String, reason: String },
    
    /// Invocation lifecycle
    InvocationStarted { invocation_id: String, prompt: String },
    InvocationCompleted { invocation_id: String, result: String },
    InvocationFailed { invocation_id: String, error: String },
    
    /// Content streaming
    ContentDelta { invocation_id: String, delta: String },
    
    /// Tool lifecycle
    ToolCallStart { invocation_id: String, call_id: String, name: String, args: Value },
    ToolCallExecuting { invocation_id: String, call_id: String },
    ToolCallCompleted { invocation_id: String, call_id: String, result: Value },
    ToolCallFailed { invocation_id: String, call_id: String, error: String },
    
    /// Metadata
    Usage { invocation_id: String, prompt_tokens: u32, completion_tokens: u32 },
    ModelInfo { invocation_id: String, model: String, provider: String },
}
```

---

## 7. Conclusion

This specification defines a **deterministic runtime brain** that:

1. **Owns session lifecycle** explicitly through state machine
2. **Manages tool loop** with retry, circuit breaker, and timeout
3. **Controls streaming** with backpressure and flow control
4. **Handles failures** with fallback and graceful degradation
5. **Wraps Rig/RMCP** as providers, not replacements

The BrainRuntime is the **orchestration layer** that was missing.
