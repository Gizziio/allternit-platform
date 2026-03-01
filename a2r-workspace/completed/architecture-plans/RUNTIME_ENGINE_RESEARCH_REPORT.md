# A://RCHITECH Runtime Engine Research Report

## Executive Summary

The current ACP kernel implementation has a critical bug where ACP process stdin/stdout pipes are not available after spawning child processes. This report analyzes 5 production-ready runtime engines that can replace the broken implementation.

**Recommendation**: Adopt **Rig** as the primary runtime engine with **RMCP** as the ACP/MCP protocol layer. This combination provides:
- Proven tool-calling and streaming support
- 20+ LLM providers under a unified interface
- Official Rust MCP SDK with ACP compatibility
- Active maintenance and production usage

---

## 1. Candidate List + Decision Matrix

### 1.1 Candidates Overview

| Candidate | Language | License | Stars | Maintenance | ACP Support |
|-----------|----------|---------|-------|-------------|-------------|
| **Rig** | Rust | MIT | ~1.5k | Active (daily commits) | Via RMCP wrapper |
| **Swiftide** | Rust | MIT | ~1.2k | Active | Agent framework only |
| **langchain-rust** | Rust | MIT | ~1.8k | Moderate | Via rmcp-agent extension |
| **RMCP (official)** | Rust | MIT | ~500 | Very Active | Native MCP/ACP support |
| **Zed Agent Runtime** | Rust | GPL/Apache | N/A | Internal only | Native (Zed-specific) |

### 1.2 Detailed Analysis

#### 1.2.1 Rig (0xPlaygrounds/rig)

**Repository**: https://github.com/0xPlaygrounds/rig  
**Documentation**: https://docs.rig.rs  
**Crates.io**: https://crates.io/crates/rig-core

**Features**:
- ✅ Streaming completions with `futures::Stream`
- ✅ Tool calling with `Tool` trait
- ✅ Multi-turn conversations via `Agent`
- ✅ 20+ providers: OpenAI, Anthropic, Gemini, Ollama, etc.
- ✅ Vector stores: Qdrant, MongoDB, LanceDB, etc.
- ✅ WASM compatibility for core library
- ✅ Full async/await with Tokio

**Code Example (Tool Calling)**:
```rust
// From: rig/rig-core/examples/agent_with_tools.rs
use rig::prelude::*;
use rig::{completion::{Prompt, ToolDefinition}, tool::Tool};

#[derive(Deserialize, Serialize)]
struct Adder;
impl Tool for Adder {
    const NAME: &'static str = "add";
    type Args = OperationArgs;
    type Output = i32;

    async fn definition(&self, _prompt: String) -> ToolDefinition {
        ToolDefinition {
            name: "add".to_string(),
            description: "Add x and y together".to_string(),
            parameters: json!({ /* schema */ }),
        }
    }

    async fn call(&self, args: Self::Args) -> Result<Self::Output, Self::Error> {
        Ok(args.x + args.y)
    }
}

// Build agent with tools
let calculator_agent = openai_client
    .agent(providers::openai::GPT_4O)
    .preamble("You are a calculator...")
    .tool(Adder)
    .tool(Subtract)
    .build();
```

**Production Users**: 
- St Jude (genomics chatbot)
- Coral Protocol (Rust SDK)
- VT Code (terminal coding agent)
- Dria (decentralized AI network)
- Nethermind (NINE framework)

**ACP Integration Path**: Use RMCP crate as transport layer; Rig handles LLM interactions.

---

#### 1.2.2 Swiftide (bosun-ai/swiftide)

**Repository**: https://github.com/bosun-ai/swiftide  
**Documentation**: https://swiftide.rs

**Features**:
- ✅ Fast streaming indexing pipelines
- ✅ Experimental agent framework with tool support
- ✅ Query pipelines with RAG
- ✅ Integrations: OpenAI, Anthropic, Gemini, Ollama
- ✅ Tree-sitter integration for code
- ⚠️ Agent framework is "experimental" per docs

**Code Example (Agent)**:
```rust
// From: swiftide/examples/agents/main.rs
#[swiftide::tool(
    description = "Searches code",
    param(name = "code_query", description = "The code query")
)]
async fn search_code(
    context: &dyn AgentContext,
    code_query: &str,
) -> Result<ToolOutput, ToolError> {
    let command_output = context
        .executor()
        .exec_cmd(&Command::shell(format!("rg '{}'", code_query)))
        .await?;
    Ok(command_output.into())
}

agents::Agent::builder()
    .llm(&openai)
    .tools(vec![search_code()])
    .build()?
    .query("In what file can I find...?")
    .await?;
```

**Production Users**: 
- bosun.ai (autonomous code improvement platform)

**Verdict**: Good for RAG/indexing use cases; agent framework not mature enough for our needs.

---

#### 1.2.3 langchain-rust (Abraxas-365/langchain-rust)

**Repository**: https://github.com/Abraxas-365/langchain-rust  
**Crates.io**: `langchain-rust`

**Features**:
- ✅ LLM chains (conversational, sequential, Q&A)
- ✅ Agents with tool calling
- ✅ Vector stores: Qdrant, Postgres, OpenSearch
- ✅ Document loaders: PDF, HTML, CSV, Git
- ⚠️ Complex abstraction layers (similar to Python LangChain issues)
- ⚠️ Tool calling less ergonomic than Rig

**Code Example**:
```rust
use langchain_rust::chain::{Chain, LLMChainBuilder};
use langchain_rust::llm::openai::{OpenAI, OpenAIModel};

let open_ai = OpenAI::default()
    .with_model(OpenAIModel::Gpt4oMini.to_string());

let chain = LLMChainBuilder::new()
    .prompt(prompt)
    .llm(open_ai)
    .build()?;
```

**Community Feedback**: 
- Hacker News criticism: "death by abstraction", "impossible nightmare" [^1]
- Similar issues to Python LangChain - too many layers

**Verdict**: Not recommended due to abstraction complexity.

---

#### 1.2.4 RMCP - Official Rust MCP SDK (modelcontextprotocol/rust-sdk)

**Repository**: https://github.com/modelcontextprotocol/rust-sdk  
**Crates.io**: `rmcp` (v0.8.0)

**Features**:
- ✅ **Official** Rust MCP implementation
- ✅ All MCP features: tools, prompts, resources, sampling
- ✅ Multiple transports: stdio, SSE, streamable HTTP, TCP
- ✅ Client and server support
- ✅ Type-safe with serde
- ✅ Progress tracking, cancellation, pings
- ✅ Easy tool registration with macros

**Code Example (Server)**:
```rust
// From: rust-sdk/crates/rmcp/examples/counter_server.rs
#[derive(Clone)]
struct Counter {
    counter: Arc<Mutex<i32>>,
    tool_router: ToolRouter<Counter>,
}

#[tool_router]
impl Counter {
    pub fn new() -> Self { /* ... */ }

    #[tool(description = "Increment counter by 1")]
    async fn increment(&self) -> Result<CallToolResult, McpError> {
        let mut count = self.counter.lock().unwrap();
        *count += 1;
        Ok(CallToolResult::success(vec![Content::text(
            format!("{}", count)
        )]))
    }
}

#[tool_handler]
impl ServerHandler for Counter {
    fn get_info(&self) -> ServerInfo {
        ServerInfo {
            protocol_version: ProtocolVersion::default(),
            capabilities: ServerCapabilities::builder().enable_tools().build(),
            server_info: Implementation::default(),
            instructions: Some("Counter server".to_string()),
        }
    }
}
```

**Code Example (Client)**:
```rust
// From: rust-sdk README
use rmcp::{ServiceExt, transport::TokioChildProcess};
use tokio::process::Command;

let client = ().serve(TokioChildProcess::new(Command::new("npx").configure(|cmd| {
    cmd.arg("-y").arg("@modelcontextprotocol/server-everything");
}))?).await?;

// List and call tools
let tools = client.list_all_tools().await?;
let result = client.call_tool("sum", json!({"a": 1, "b": 2})).await?;
```

**ACP Compatibility**: ACP is based on MCP; RMCP can be wrapped for ACP-specific message formats.

---

#### 1.2.5 Zed Agent Runtime

**Status**: Internal to Zed editor, not available as standalone library.  
**Reference**: https://github.com/zed-industries/zed/tree/main/crates/assistant

**Analysis**:
- Zed has native ACP support but it's embedded in their UI framework
- No standalone runtime crate available
- Would require extracting and forking significant code
- Not a viable option for external use

**Verdict**: Exclude from consideration - not available as reusable component.

---

### 1.3 Decision Matrix Scoring

| Criteria (Weight) | Rig | Swiftide | langchain-rust | RMCP |
|-------------------|-----|----------|----------------|------|
| **Tool Calling** (20%) | 5/5 | 3/5 | 4/5 | 5/5 |
| **Streaming** (15%) | 5/5 | 4/5 | 3/5 | 4/5 |
| **Multi-turn/Sessions** (15%) | 4/5 | 3/5 | 4/5 | 3/5 |
| **Provider Abstraction** (15%) | 5/5 | 4/5 | 4/5 | 2/5 |
| **ACP/MCP Compatibility** (15%) | 4/5 | 2/5 | 3/5 | 5/5 |
| **Maintenance/Activity** (10%) | 5/5 | 4/5 | 3/5 | 5/5 |
| **Production Readiness** (10%) | 5/5 | 3/5 | 3/5 | 4/5 |
| **Weighted Total** | **4.6** | **3.2** | **3.5** | **4.1** |

**Winner**: Rig + RMCP combination (Rig for LLM interactions, RMCP for ACP protocol handling)

---

## 2. Detailed Mapping into A://RCHITECH Repo

### 2.1 Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                     7-apps/cli/ (TUI Client)                     │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────────┐  │
│  │ UI (ratatui)│  │ KernelClient│  │ Session Manager         │  │
│  └──────┬──────┘  └──────┬──────┘  └─────────────────────────┘  │
│         └─────────────────┘                                     │
└─────────────────────────────────────────────────────────────────┘
                              │ HTTP/ACP
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│           4-services/orchestration/kernel-service/              │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  THIN HTTP LAYER ONLY - Axum handlers, auth, routing     │  │
│  │  - POST /v1/sessions                                     │  │
│  │  - POST /v1/sessions/{id}/invoke                         │  │
│  │  - GET  /v1/sessions/{id}/events (SSE)                   │  │
│  └──────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    1-kernel/infrastructure/                      │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │ a2r-runtime/ (NEW - Rig-based BrainRuntime trait impl)   │  │
│  │ - RigAgentBrain: Rig-based agent with tool calling       │  │
│  │ - Streaming support via rig::streaming                   │  │
│  │ - Tool execution with roundtrip handling                 │  │
│  └──────────────────────────────────────────────────────────┘  │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │ a2r-acp-driver/ (REFACTORED - RMCP-based)                │  │
│  │ - AcpDriver trait wrapper around rmcp::Service           │  │
│  │ - Session lifecycle management                           │  │
│  │ - Protocol translation (ACP ↔ MCP)                       │  │
│  └──────────────────────────────────────────────────────────┘  │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │ a2r-providers/ (NEW - Provider adapter registry)         │  │
│  │ - ProviderAdapter trait for normalization                │  │
│  │ - RigProviderAdapter: Rig → normalized events            │  │
│  │ - McpToolAdapter: MCP tools → BrainTool format           │  │
│  └──────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

### 2.2 File-Level Mapping

#### 2.2.1 NEW: 1-kernel/infrastructure/a2r-runtime/

**Purpose**: Core runtime engine using Rig for LLM interactions

**Files to Create**:

```
1-kernel/infrastructure/a2r-runtime/
├── Cargo.toml                    # Depends on rig-core, rmcp, a2r-acp-driver
├── src/
│   ├── lib.rs                    # Public exports
│   ├── brain/
│   │   ├── mod.rs                # BrainRuntime trait definition
│   │   ├── rig_brain.rs          # RigAgentBrain implementation
│   │   └── session.rs            # Session state management
│   ├── streaming/
│   │   ├── mod.rs                # Streaming event types
│   │   └── rig_adapter.rs        # Rig stream → normalized events
│   └── tools/
│       ├── mod.rs                # Tool execution framework
│       ├── executor.rs           # Tool call roundtrip logic
│       └── registry.rs           # Tool registry
```

**Key Implementation** (`rig_brain.rs`):
```rust
use rig::agent::Agent;
use rig::completion::Prompt;
use rig::tool::Tool;
use rmcp::service::RunningService;

pub struct RigAgentBrain {
    agent: Agent,
    mcp_client: Option<Arc<RunningService<RoleClient, InitializeRequestParam>>>,
    session_id: String,
}

#[async_trait]
impl BrainRuntime for RigAgentBrain {
    async fn invoke(&self, prompt: &str) -> Result<BrainOutput> {
        // Use Rig's streaming prompt
        let stream = self.agent.stream_prompt(prompt).await?;
        // Convert to normalized events
        Ok(BrainOutput::Streaming(stream))
    }
    
    async fn invoke_with_tools(&self, prompt: &str, tools: &[ToolDef]) -> Result<BrainOutput> {
        // Dynamic tool attachment for this invocation
        let agent = self.agent.clone().with_tools(tools);
        let stream = agent.stream_prompt(prompt).await?;
        Ok(BrainOutput::Streaming(stream))
    }
}
```

#### 2.2.2 REFACTORED: 1-kernel/infrastructure/a2r-acp-driver/

**Purpose**: ACP protocol handling using RMCP as the underlying transport

**Files to Modify/Create**:

```
1-kernel/infrastructure/a2r-acp-driver/
├── Cargo.toml                    # Add rmcp dependency
├── src/
│   ├── lib.rs                    # Keep public API unchanged
│   ├── driver.rs                 # Refactor to use rmcp::Service
│   ├── session.rs                # Wrap rmcp session types
│   └── protocol/
│       ├── mod.rs                # ACP/MCP message translation
│       ├── acp_to_mcp.rs         # ACP request → MCP call_tool
│       └── mcp_to_acp.rs         # MCP result → ACP response
```

**Key Change** (`driver.rs`):
```rust
// OLD: Custom ACP implementation with broken pipe handling
// pub struct AcpDriver { /* custom stdin/stdout handling */ }

// NEW: Delegate to rmcp
pub struct AcpDriver {
    mcp_service: RunningService<RoleClient, InitializeRequestParam>,
    config: AcpConfig,
}

impl AcpDriver {
    pub async fn spawn(command: &str, args: &[&str]) -> Result<Self> {
        // Use rmcp's TokioChildProcess transport
        let transport = TokioChildProcess::new(
            Command::new(command).args(args)
        )?;
        
        let client_info = ClientInfo { /* ... */ };
        let service = client_info.serve(transport).await?;
        
        Ok(Self {
            mcp_service: service,
            config: AcpConfig::default(),
        })
    }
    
    pub async fn call_tool(&self, name: &str, args: Value) -> Result<CallToolResult> {
        // Delegate to rmcp
        self.mcp_service.call_tool(name, args).await
    }
}
```

#### 2.2.3 NEW: 1-kernel/infrastructure/a2r-providers/

**Purpose**: Provider abstraction layer to normalize across different LLM backends

**Files to Create**:

```
1-kernel/infrastructure/a2r-providers/
├── Cargo.toml
├── src/
│   ├── lib.rs
│   ├── adapter.rs                # ProviderAdapter trait
│   ├── registry.rs               # Provider registry (openai, anthropic, etc.)
│   ├── models.rs                 # Normalized model IDs and capabilities
│   ├── events.rs                 # Normalized event types (delta, tool_call, etc.)
│   └── impls/
│       ├── mod.rs
│       ├── rig_adapter.rs        # Rig → normalized events
│       └── mcp_adapter.rs        # MCP sampling → normalized events
```

**Key Trait** (`adapter.rs`):
```rustn#[async_trait]
pub trait ProviderAdapter: Send + Sync {
    /// Get provider capabilities
    fn capabilities(&self) -> ProviderCapabilities;
    
    /// Stream completion with normalized events
    async fn stream_completion(
        &self,
        request: CompletionRequest,
    ) -> Result<BoxStream<NormalizedEvent>>;
    
    /// Execute tool call through provider
    async fn execute_tool(
        &self,
        tool_call: ToolCall,
    ) -> Result<ToolResult>;
    
    /// Get available models from provider
    async fn list_models(&self) -> Result<Vec<ModelInfo>>;
}

/// Normalized events that all providers emit
pub enum NormalizedEvent {
    Delta { content: String },
    ToolCall { id: String, name: String, args: Value },
    ToolResult { id: String, result: Value },
    Error { code: String, message: String },
    Done,
}
```

#### 2.2.4 THIN LAYER: 4-services/orchestration/kernel-service/

**Purpose**: HTTP service with minimal business logic - delegates everything to kernel

**Files** (mostly unchanged, slimmed down):

```
4-services/orchestration/kernel-service/
├── src/
│   ├── main.rs                   # Axum server setup
│   ├── handlers/
│   │   ├── sessions.rs           # POST /v1/sessions - spawn via a2r-acp-driver
│   │   ├── invoke.rs             # POST /v1/sessions/{id}/invoke
│   │   └── events.rs             # GET /v1/sessions/{id}/events (SSE)
│   └── state.rs                  # AppState with BrainRuntime handle
```

**Key Principle**: kernel-service should be <500 lines. All heavy lifting in 1-kernel/.

#### 2.2.5 UI ONLY: 7-apps/cli/

**Purpose**: TUI client - no business logic, pure presentation

**Files** (unchanged structure):

```
7-apps/cli/
├── src/
│   ├── main.rs
│   ├── client.rs                 # HTTP client to kernel-service
│   ├── tui.rs                    # TUI app (ratatui)
│   └── tui_components/           # UI components
```

### 2.3 Boundary Contracts

#### 2.3.1 Kernel-Service ↔ A2R-Runtime

```rustn// Contract: BrainRuntime trait is the ONLY interface
#[async_trait]
pub trait BrainRuntime: Send + Sync {
    async fn initialize(&mut self) -> Result<InitializeResponse>;
    async fn session_new(&self, config: SessionConfig) -> Result<BrainSession>;
    async fn session_invoke(&self, id: &str, message: &str) -> Result<InvocationHandle>;
    async fn session_events(&self, id: &str) -> Result<BoxStream<NormalizedEvent>>;
    async fn session_close(&self, id: &str) -> Result<()>;
}

// All events normalized to this format
pub enum NormalizedEvent {
    // Text streaming
    ContentDelta { index: usize, delta: String },
    
    // Tool execution
    ToolCallStart { call_id: String, tool_name: String, args: Value },
    ToolCallComplete { call_id: String, result: Value },
    ToolCallError { call_id: String, error: String },
    
    // Lifecycle
    SessionStarted { session_id: String },
    SessionError { code: String, message: String },
    SessionEnded { reason: String },
    
    // Provider-specific (normalized)
    Usage { prompt_tokens: u32, completion_tokens: u32 },
}
```

#### 2.3.2 A2R-Runtime ↔ A2R-ACP-Driver

```rust
// Contract: MCP/ACP protocol
pub trait AcpDriver: Send + Sync {
    /// Initialize ACP session (returns InitializeResponse per ACP spec)
    async fn initialize(&mut self) -> Result<InitializeResponse>;
    
    /// Call a tool via MCP
    async fn call_tool(&self, name: &str, args: Value) -> Result<CallToolResult>;
    
    /// List available tools
    async fn list_tools(&self) -> Result<Vec<Tool>>;
    
    /// Get prompts (ACP feature)
    async fn list_prompts(&self) -> Result<Vec<Prompt>>;
    
    /// Access resources (ACP feature)
    async fn read_resource(&self, uri: &str) -> Result<Resource>;
}
```

#### 2.3.3 Provider Adapter Contract

```rust
// Contract: ProviderAdapter normalizes all provider differences
pub struct ProviderCapabilities {
    pub streaming: bool,
    pub tool_calling: bool,
    pub vision: bool,
    pub max_context_tokens: u32,
    pub supported_models: Vec<String>,
}

// Model IDs are normalized to provider:model format
// - openai:gpt-4o
// - anthropic:claude-3-5-sonnet
// - gemini:gemini-2.0-flash
// - ollama:llama3.3
```

---

## 3. Provider-Format Reality Check

### 3.1 Provider Differences

| Aspect | OpenAI | Anthropic | Gemini | Ollama |
|--------|--------|-----------|--------|--------|
| **Model ID Format** | `gpt-4o`, `gpt-4o-mini` | `claude-3-5-sonnet-20241022` | `gemini-2.0-flash` | `llama3.3`, `qwen2.5` |
| **Streaming Format** | SSE with `data: {...}` | SSE with `data: {...}` | SSE with `data: {...}` | NDJSON stream |
| **Tool Calling** | `tools` array + `tool_calls` in response | `tools` array + `stop_reason: tool_use` | `tools` in `generationConfig` | Via OpenAI-compatible API |
| **Auth Method** | Bearer token | Bearer token | API key in header | No auth (local) |
| **Rate Limit Headers** | `x-ratelimit-*` | `anthropic-ratelimit-*` | `x-goog-*` | None |
| **Base URL** | `api.openai.com` | `api.anthropic.com` | `generativelanguage.googleapis.com` | `localhost:11434` |

### 3.2 Normalization Strategy

**The Abstraction**: `ProviderAdapter` trait with `RigProviderAdapter` implementation

```rust
// Rig handles most normalization internally
pub struct RigProviderAdapter {
    client: Arc<dyn rig::client::Client>,
    provider_id: String,
}

impl ProviderAdapter for RigProviderAdapter {
    async fn stream_completion(
        &self,
        request: CompletionRequest,
    ) -> Result<BoxStream<NormalizedEvent>> {
        // Rig normalizes provider-specific quirks
        let agent = self.client.agent(&request.model)
            .preamble(&request.system_prompt)
            .tools(request.tools)
            .build();
            
        let rig_stream = agent.stream_prompt(&request.prompt).await?;
        
        // Convert Rig events to NormalizedEvent
        Ok(rig_stream.map(|chunk| match chunk {
            rig::completion::StreamingChoice::Message(text) => 
                NormalizedEvent::ContentDelta { index: 0, delta: text },
            rig::completion::StreamingChoice::ToolCall(name, args) =>
                NormalizedEvent::ToolCallStart { 
                    call_id: generate_id(),
                    tool_name: name,
                    args: args.parse().unwrap_or_default(),
                },
        }).boxed())
    }
}
```

### 3.3 Strict Contract Enforcement

**Rule**: Vendor-specific types must NOT leak past adapter boundary.

```rust
// ❌ WRONG: OpenAI-specific types in kernel-service
async fn handler(Json(body): Json<openai::ChatCompletionRequest>) { }

// ✅ CORRECT: Normalized types only
async fn handler(Json(body): Json<CompletionRequest>) { }
```

**File Locations**:
- Vendor-specific code: `1-kernel/infrastructure/a2r-providers/src/impls/`
- Normalized types: `1-kernel/infrastructure/a2r-providers/src/events.rs`
- Adapter trait: `1-kernel/infrastructure/a2r-providers/src/adapter.rs`

---

## 4. Pivot Recommendation

### 4.1 Selected Candidates

**Primary**: **Rig** + **RMCP**  
**Backup**: Swiftide (if Rig proves insufficient for RAG use cases)

### 4.2 Fastest Path to Working (2-7 Days)

**Day 1-2**: Vendor RMCP, create a2r-acp-driver wrapper
```bash
# Add rmcp to workspace Cargo.toml
# Create 1-kernel/infrastructure/a2r-acp-driver/src/driver.rs
# Implement AcpDriver trait delegating to rmcp::Service
```

**Day 3-4**: Integrate Rig as a2r-runtime
```bash
# Create 1-kernel/infrastructure/a2r-runtime/
# Implement RigAgentBrain
# Connect to AcpDriver for tool execution
```

**Day 5-6**: Update kernel-service to use new runtime
```bash
# Refactor 4-services/orchestration/kernel-service/src/brain_runtime.rs
# Replace custom implementation with RigAgentBrain
```

**Day 7**: End-to-end testing
```bash
# Test: opencode-acp profile with Rig runtime
# Test: Tool roundtrip (file_edit, shell, etc.)
# Test: Streaming responses
```

### 4.3 Production Hardening (2-6 Weeks)

**Week 1-2**: Comprehensive provider support
- Add all 10+ providers Rig supports
- Implement provider fallback/chaining
- Add rate limiting and retry logic

**Week 3-4**: Session management
- Persistent session storage
- Session recovery on kernel restart
- Multi-session concurrency

**Week 5-6**: Observability and metrics
- Structured logging with tracing
- OpenTelemetry integration
- Performance metrics collection

### 4.4 Risk List + Mitigations

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Rig breaking changes | Medium | Medium | Pin exact version; vendor if needed |
| ACP spec drift from MCP | Low | High | AcpDriver layer handles translation |
| Tool call serialization issues | Medium | High | Rig's Tool trait + serde_json validation |
| Provider API changes | High | Low | ProviderAdapter layer isolates changes |
| Performance with large contexts | Medium | Medium | Streaming + backpressure in Rig |
| RMCP transport issues | Low | High | RMCP is official SDK; community support |

---

## 5. Proof Artifacts

### 5.1 Repository Links

| Project | Repo | Stars | License |
|---------|------|-------|---------|
| Rig | https://github.com/0xPlaygrounds/rig | ~1.5k | MIT |
| Swiftide | https://github.com/bosun-ai/swiftide | ~1.2k | MIT |
| langchain-rust | https://github.com/Abraxas-365/langchain-rust | ~1.8k | MIT |
| RMCP (official) | https://github.com/modelcontextprotocol/rust-sdk | ~500 | MIT |
| ACP spec | https://github.com/zed-industries/acp | N/A | Apache-2.0 |

### 5.2 Key Citations

[^1]: Hacker News discussion on LangChain issues: https://news.ycombinator.com/item?id=40739982
- "LangChain is _the_ definition of death by abstraction"
- "I ended up doing what I needed with about 80 lines of code"

[^2]: Rig documentation: https://docs.rig.rs
- "Build scalable, modular, and ergonomic LLM-powered applications"

[^3]: RMCP README: https://github.com/modelcontextprotocol/rust-sdk/blob/main/crates/rmcp/README.md
- "An official Rust Model Context Protocol SDK implementation"

[^4]: Swiftide agents documentation: https://swiftide.rs
- "Experimental agent framework" (status as of Jan 2025)

[^5]: Zed ACP documentation: https://zed.dev/acp
- "Agent Client Protocol (ACP) is an open standard"

### 5.3 Mapping Diff Outline

```
# Files to CREATE
1-kernel/infrastructure/a2r-runtime/
├── Cargo.toml                    [NEW]
├── src/
│   ├── lib.rs                    [NEW]
│   ├── brain/mod.rs              [NEW]
│   ├── brain/rig_brain.rs        [NEW]
│   ├── streaming/mod.rs          [NEW]
│   └── tools/mod.rs              [NEW]

1-kernel/infrastructure/a2r-providers/
├── Cargo.toml                    [NEW]
├── src/
│   ├── lib.rs                    [NEW]
│   ├── adapter.rs                [NEW]
│   ├── events.rs                 [NEW]
│   └── impls/rig_adapter.rs      [NEW]

# Files to MODIFY
1-kernel/infrastructure/a2r-acp-driver/
├── Cargo.toml                    [MODIFY - add rmcp dep]
└── src/
    ├── driver.rs                 [MODIFY - use rmcp]
    └── session.rs                [MODIFY - wrap rmcp types]

4-services/orchestration/kernel-service/
└── src/
    └── brain_runtime.rs          [MODIFY - use a2r-runtime]

# Files to DELETE (old broken implementation)
1-kernel/infrastructure/a2r-acp-driver/
└── src/
    └── old_driver.rs             [DELETE]
```

### 5.4 Minimal Acceptance Test Plan

#### Test 1: Session Creation
```bash
curl -X POST http://localhost:3004/v1/sessions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer sk-a2r-dev-token-local" \
  -d '{
    "config": {
      "id": "opencode-acp",
      "command": "npx",
      "args": ["-y", "@anthropic-ai/claude-code"]
    },
    "source": "cli"
  }'
```
**Expected**: `201 Created` with session ID

#### Test 2: Tool Roundtrip
```bash
curl -X POST http://localhost:3004/v1/sessions/{id}/invoke \
  -H "Content-Type: application/json" \
  -d '{"message": "List files in current directory using ls"}'
```
**Expected**: Streaming response with `ToolCallStart` followed by `ToolCallComplete` with file list

#### Test 3: Streaming Events
```bash
curl -N http://localhost:3004/v1/sessions/{id}/events \
  -H "Accept: text/event-stream"
```
**Expected**: SSE stream with `event: delta`, `event: tool_call`, `event: done`

#### Test 4: Unit Test (Rust)
```rust
#[tokio::test]
async fn test_rig_brain_tool_roundtrip() {
    let brain = RigAgentBrain::new(openai_client(), vec![ls_tool()])
        .build()
        .await
        .unwrap();
    
    let mut stream = brain.invoke("List files").await.unwrap();
    
    let mut saw_tool_call = false;
    while let Some(event) = stream.next().await {
        if matches!(event, NormalizedEvent::ToolCallStart { .. }) {
            saw_tool_call = true;
        }
    }
    
    assert!(saw_tool_call, "Should have seen tool call event");
}
```

---

## 6. Conclusion

The **Rig + RMCP** combination provides a production-ready foundation to replace the broken ACP kernel implementation:

1. **Rig** handles LLM interactions with proven tool calling and streaming
2. **RMCP** provides official, maintained ACP/MCP protocol support
3. The layered architecture keeps kernel-service thin and focused on HTTP
4. Provider abstraction isolates vendor-specific code to a2r-providers/

**Next Step**: Begin Day 1-2 of the "Fastest Path" - vendor RMCP and create the a2r-acp-driver wrapper.

---

*Report generated: 2026-02-16*  
*Researcher: A://RCHITECH Architect Agent*
