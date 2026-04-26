# Allternitchitech Memory Agent - Integration Guide

## Overview

The **Memory Agent** is now a core platform service that provides persistent, queryable memory for all allternit services. It uses local LLM (Ollama) for intelligent processing, consolidation, and synthesis.

```
┌─────────────────────────────────────────────────────────┐
│              Memory Service Architecture                 │
├─────────────────────────────────────────────────────────┤
│                                                          │
│  ┌────────────────┐      ┌────────────────┐            │
│  │  Rust Services │◄────►│ TypeScript     │            │
│  │  (HTTP Client) │ HTTP │ Agent (Daemon) │            │
│  └────────────────┘      └────────────────┘            │
│         │                      │                        │
│    Port 3201            SQLite + Ollama                │
│                                                          │
└─────────────────────────────────────────────────────────┘
```

---

## Quick Start

### 1. Start Ollama (Required)

```bash
# Start Ollama server
ollama serve

# Pull required models (one-time)
ollama pull llama3.2:3b
ollama pull phi3:mini
```

### 2. Start Memory Agent HTTP Server

```bash
cd /Users/macbook/Desktop/allternit-workspace/allternit/memory

# Install dependencies (if not done)
pnpm install

# Start HTTP API server on port 3201
pnpm run start:http
```

### 3. Verify It's Working

```bash
# Health check
curl http://localhost:3201/health

# Get stats
curl http://localhost:3201/stats
```

---

## API Reference

### Base URL
```
http://localhost:3201
```

### Health & Status

#### GET /health
```bash
curl http://localhost:3201/health
```

Response:
```json
{
  "status": "healthy",
  "memory": {
    "ollamaConnected": true,
    "databaseConnected": true,
    "watcherActive": true,
    "memoryCount": 42,
    "insightCount": 8
  },
  "timestamp": "2026-03-08T01:00:00.000Z"
}
```

#### GET /stats
```bash
curl http://localhost:3201/stats
```

Response:
```json
{
  "memories": {
    "total": 42,
    "raw": 5,
    "processed": 10,
    "consolidated": 27,
    "archived": 0
  },
  "insights": 8,
  "connections": 15,
  "processedFiles": 42,
  "ollamaConnected": true
}
```

### Memory Operations

#### POST /api/query - Query with Natural Language
```bash
curl -X POST http://localhost:3201/api/query \
  -H "Content-Type: application/json" \
  -d '{"question": "What tools were used in the last DAG execution?"}'
```

Response:
```json
{
  "query": "What tools were used in the last DAG execution?",
  "answer": "Based on the receipts, the following tools were used: write_file, run_shell_command, and read_file...",
  "memories": [...],
  "insights": [...],
  "sources": ["receipt:R001", "receipt:R002"],
  "confidence": 0.85,
  "execution_time_ms": 1250
}
```

#### POST /api/ingest - Ingest Content
```bash
curl -X POST http://localhost:3201/api/ingest \
  -H "Content-Type: application/json" \
  -d '{
    "content": "Meeting notes: We decided to use microservices architecture",
    "source": "meeting-2026-03-08",
    "tenant_id": "tenant-123",
    "session_id": "session-456"
  }'
```

Response:
```json
{
  "success": true,
  "memory_id": "uuid-here",
  "source": "meeting-2026-03-08:tenant-123:session-456",
  "timestamp": "2026-03-08T01:00:00.000Z"
}
```

#### GET /api/search - Search Memories
```bash
curl "http://localhost:3201/api/search?q=DAG+validation&limit=10"
```

#### GET /api/recent - Recent Memories
```bash
curl "http://localhost:3201/api/recent?limit=20"
```

#### GET /api/insights - Get Insights
```bash
curl http://localhost:3201/api/insights
```

#### POST /api/consolidate - Trigger Consolidation
```bash
curl -X POST http://localhost:3201/api/consolidate
```

#### DELETE /api/memory/:id - Delete Memory
```bash
curl -X DELETE http://localhost:3201/api/memory/<memory-id>
```

#### POST /api/clear - Clear All Memories (Dangerous!)
```bash
curl -X POST http://localhost:3201/api/clear \
  -H "X-Confirm-Dangerous: true"
```

#### POST /api/ingest/bulk - Bulk Ingest
```bash
curl -X POST http://localhost:3201/api/ingest/bulk \
  -H "Content-Type: application/json" \
  -d '{
    "items": [
      {"content": "First item", "source": "source1"},
      {"content": "Second item", "source": "source2"}
    ]
  }'
```

---

## Data Ingestion Pipelines

### Ingest All Receipts

```bash
cd /Users/macbook/Desktop/allternit-workspace/allternit/memory

# Set workspace root (if different from default)
export ALLTERNIT_WORKSPACE_ROOT=/path/to/allternit-workspace

# Run receipt ingestion
pnpm run ingest:receipts
```

This will:
- Scan `allternit-workspace/receipts/` for all receipt JSON files
- Extract tool calls, inputs, outputs, and status
- Store in memory with source `receipt:<receipt_id>`
- Enable queries like "Show all tool executions for task T0001"

### Ingest All WIH Patterns

```bash
pnpm run ingest:wih
```

This will:
- Scan `allternit-workspace/wih/` for all WIH files
- Extract task patterns, tool allowlists, write scopes
- Store with source `wih:<task_id>`
- Enable queries like "Find similar tasks to this one"

### Ingest All Session States

```bash
pnpm run ingest:sessions
```

This will:
- Scan `allternit-workspace/run_state/` for all session states
- Extract node states, resume points, artifacts
- Store with source `session:<run_id>`
- Enable queries like "Resume my session from yesterday"

### Ingest Everything

```bash
pnpm run ingest:all
```

---

## Integration Examples

### Rust Service Integration

Add to your `Cargo.toml`:

```toml
[dependencies]
reqwest = { version = "0.11", features = ["json"] }
serde = { version = "1.0", features = ["derive"] }
serde_json = "1.0"
tokio = { version = "1.0", features = ["full"] }
```

Create a memory client:

```rust
use reqwest::Client;
use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize)]
struct QueryRequest {
    question: String,
}

#[derive(Debug, Deserialize)]
struct QueryResponse {
    answer: String,
    memories: Vec<MemoryEntry>,
    confidence: f32,
}

#[derive(Debug, Deserialize)]
struct MemoryEntry {
    id: String,
    content: String,
    summary: String,
    source: String,
}

pub struct MemoryClient {
    client: Client,
    base_url: String,
}

impl MemoryClient {
    pub fn new(base_url: impl Into<String>) -> Self {
        Self {
            client: Client::new(),
            base_url: base_url.into(),
        }
    }

    pub async fn query(&self, question: &str) -> Result<QueryResponse, reqwest::Error> {
        let url = format!("{}/api/query", self.base_url);
        
        let response = self.client
            .post(&url)
            .json(&QueryRequest {
                question: question.to_string(),
            })
            .send()
            .await?
            .json::<QueryResponse>()
            .await?;

        Ok(response)
    }

    pub async fn ingest(&self, content: &str, source: &str) -> Result<(), reqwest::Error> {
        let url = format!("{}/api/ingest", self.base_url);
        
        self.client
            .post(&url)
            .json(&serde_json::json!({
                "content": content,
                "source": source,
            }))
            .send()
            .await?;

        Ok(())
    }
}

// Usage in your service
#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    let memory = MemoryClient::new("http://localhost:3201");

    // Query before task execution
    let context = memory.query("Previous executions for DAG validation").await?;
    println!("Context: {}", context.answer);

    // Store execution result
    memory.ingest("Task completed successfully", "execution:task-123").await?;

    Ok(())
}
```

### Python Service Integration (Gateway)

Add to your `services/gateway/src/main.py`:

```python
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
import httpx

app = FastAPI()

MEMORY_API_URL = "http://localhost:3201"

class MemoryQueryRequest(BaseModel):
    question: str
    max_results: int = 10

class MemoryIngestRequest(BaseModel):
    content: str
    source: str | None = None

@app.post("/api/v1/memory/query")
async def memory_query(request: MemoryQueryRequest):
    """Query the memory agent for historical context"""
    async with httpx.AsyncClient() as client:
        response = await client.post(
            f"{MEMORY_API_URL}/api/query",
            json={"question": request.question, "max_results": request.max_results}
        )
        if response.status_code != 200:
            raise HTTPException(status_code=response.status_code, detail="Memory query failed")
        return response.json()

@app.post("/api/v1/memory/ingest")
async def memory_ingest(request: MemoryIngestRequest):
    """Ingest content into memory"""
    async with httpx.AsyncClient() as client:
        response = await client.post(
            f"{MEMORY_API_URL}/api/ingest",
            json={"content": request.content, "source": request.source}
        )
        if response.status_code != 201 and response.status_code != 200:
            raise HTTPException(status_code=response.status_code, detail="Memory ingest failed")
        return response.json()

@app.get("/api/v1/memory/stats")
async def memory_stats():
    """Get memory statistics"""
    async with httpx.AsyncClient() as client:
        response = await client.get(f"{MEMORY_API_URL}/stats")
        return response.json()
```

### CLI Integration (Rust)

Add to `cmd/cli/src/commands/`:

```rust
// src/commands/memory.rs
use clap::{Parser, Subcommand};
use reqwest::Client;
use serde::{Deserialize, Serialize};

#[derive(Parser)]
pub struct MemoryCommand {
    #[clap(subcommand)]
    action: MemoryAction,
}

#[derive(Subcommand)]
pub enum MemoryAction {
    /// Query the memory agent
    Query { 
        question: String,
        #[clap(short, long, default_value = "10")]
        limit: usize,
    },
    /// Show recent memories
    Recent { 
        #[clap(short, long, default_value = "10")]
        limit: usize,
    },
    /// Show insights
    Insights,
    /// Trigger consolidation
    Consolidate,
    /// Show statistics
    Stats,
    /// Ingest content
    Ingest {
        content: String,
        #[clap(short, long)]
        source: Option<String>,
    },
}

#[derive(Serialize)]
struct QueryRequest {
    question: String,
    max_results: usize,
}

#[derive(Deserialize)]
struct QueryResponse {
    answer: String,
    confidence: f32,
    execution_time_ms: u32,
}

pub async fn execute(cmd: MemoryCommand) -> Result<(), anyhow::Error> {
    let client = Client::new();
    let base_url = "http://127.0.0.1:3201/api";

    match cmd.action {
        MemoryAction::Query { question, limit } => {
            let response = client
                .post(format!("{}/query", base_url))
                .json(&QueryRequest {
                    question,
                    max_results: limit,
                })
                .send()
                .await?
                .json::<QueryResponse>()
                .await?;
            
            println!("Answer: {}", response.answer);
            println!("Confidence: {:.2}", response.confidence);
            println!("Time: {}ms", response.execution_time_ms);
        }
        MemoryAction::Stats => {
            let response = client
                .get(format!("{}/stats", base_url))
                .send()
                .await?
                .json::<serde_json::Value>()
                .await?;
            
            println!("{}", serde_json::to_string_pretty(&response)?);
        }
        MemoryAction::Recent { limit } => {
            let response = client
                .get(format!("{}/recent?limit={}", base_url, limit))
                .send()
                .await?
                .json::<serde_json::Value>()
                .await?;
            
            println!("{}", serde_json::to_string_pretty(&response)?);
        }
        MemoryAction::Insights => {
            let response = client
                .get(format!("{}/insights", base_url))
                .send()
                .await?
                .json::<serde_json::Value>()
                .await?;
            
            println!("{}", serde_json::to_string_pretty(&response)?);
        }
        MemoryAction::Consolidate => {
            let response = client
                .post(format!("{}/consolidate", base_url))
                .send()
                .await?
                .json::<serde_json::Value>()
                .await?;
            
            println!("Consolidation result: {}", serde_json::to_string_pretty(&response)?);
        }
        MemoryAction::Ingest { content, source } => {
            let mut payload = serde_json::json!({
                "content": content,
            });
            
            if let Some(s) = source {
                payload["source"] = serde_json::json!(s);
            }
            
            let response = client
                .post(format!("{}/ingest", base_url))
                .json(&payload)
                .send()
                .await?
                .json::<serde_json::Value>()
                .await?;
            
            println!("Ingest result: {}", serde_json::to_string_pretty(&response)?);
        }
    }

    Ok(())
}
```

---

## Use Cases

### 1. Agent Context Enhancement

Before executing a task, query memory for relevant history:

```rust
// In kernel-service orchestrator
let context = memory.query(&format!(
    "Previous executions for task type: {}",
    task.task_type
)).await?;

// Include context in agent prompt
let enhanced_prompt = format!(
    "{}\n\nRelevant History:\n{}",
    task.prompt, context.answer
);
```

### 2. Session Recovery

Find and resume interrupted sessions:

```rust
let active_sessions = memory.query(
    "Find active or paused sessions that can be resumed"
).await?;

for session in active_sessions.memories {
    println!("Resumable: {} -> {:?}", 
        session.source, 
        session.recovery_hints.next_steps
    );
}
```

### 3. Tool Usage Analysis

Analyze tool execution patterns:

```rust
let tool_stats = memory.query(
    "Show all tool executions and their success rates"
).await?;
```

### 4. Task Pattern Learning

Find similar task configurations:

```rust
let similar_tasks = memory.query(&format!(
    "Find tasks similar to: {}",
    new_task.description
)).await?;

// Use similar task patterns for configuration
```

---

## Daemon Mode (24/7 Operation)

### Start as Background Daemon

```bash
cd /Users/macbook/Desktop/allternit-workspace/allternit/memory

# Start daemon
pnpm run daemon start

# Check status
pnpm run daemon status

# View logs
pnpm run daemon logs

# Stop daemon
pnpm run daemon stop
```

### Install as macOS Auto-Start Service

```bash
# Make script executable
chmod +x install-launchd.sh

# Install the service
./install-launchd.sh install

# Check status
./install-launchd.sh status

# Uninstall
./install-launchd.sh uninstall
```

---

## Configuration

### Environment Variables

```bash
# Memory Agent Configuration
MEMORY_HTTP_PORT=3201              # HTTP API port
MEMORY_WATCH_DIRECTORY=./inbox     # Directory to watch
MEMORY_DATABASE_PATH=./memory.db   # SQLite database location
MEMORY_OLLAMA_HOST=localhost       # Ollama host
MEMORY_OLLAMA_PORT=11434           # Ollama port
MEMORY_INGEST_MODEL=llama3.2:3b    # Model for ingestion
MEMORY_CONSOLIDATE_MODEL=phi3:mini # Model for consolidation
MEMORY_QUERY_MODEL=llama3.2:3b     # Model for queries
MEMORY_CONSOLIDATION_INTERVAL_MINUTES=30
```

### Copy and Edit .env

```bash
cd /Users/macbook/Desktop/allternit-workspace/allternit/memory
cp .env.example .env
# Edit .env with your settings
```

---

## Troubleshooting

### Ollama Not Running

```bash
# Start Ollama
ollama serve

# Or as background service (macOS)
brew services start ollama
```

### Models Not Found

```bash
# Pull required models
ollama pull llama3.2:3b
ollama pull phi3:mini
```

### Memory Agent Won't Start

```bash
# Check if port 3201 is in use
lsof -i :3201

# Kill existing process if needed
kill -9 <PID>

# Try starting again
pnpm run start:http
```

### Check Logs

```bash
# Daemon logs
pnpm run daemon logs

# Or view log file directly
tail -f /tmp/allternit-memory-agent.log
```

---

## Architecture

### Components

1. **TypeScript Memory Agent** (`memory/src/`)
   - Orchestrator: Root agent coordinating sub-agents
   - Ingest Agent: File watching and LLM processing
   - Consolidate Agent: Pattern finding and merging
   - Query Agent: Search and synthesis
   - SQLite Store: Persistent storage
   - Local Model: Ollama integration

2. **Rust HTTP Adapter** (`services/memory/src/memory_agent_adapter.rs`)
   - Implements `MemoryProvider` trait
   - HTTP client for TypeScript agent
   - Retry logic and error handling

3. **Data Pipelines** (`memory/src/pipelines/`)
   - Receipt Ingester: Index agent execution receipts
   - WIH Indexer: Index task patterns
   - Session Tracker: Index run states

### Data Flow

```
Files (Receipts, WIH, States)
         ↓
Ingestion Pipelines
         ↓
Memory Agent (LLM Processing)
         ↓
SQLite Database
         ↓
HTTP API (Port 3201)
         ↓
Rust Services (Kernel, Gateway, CLI)
```

---

## Next Steps

### P2 Features (Coming Soon)

- **Gateway Memory API** - External API routes
- **CLI Commands** - `allternit memory query/inspect/stats`
- **Vector Search** - Embeddings for semantic search

### P3 Features (Future)

- **Memory Decay** - Automatic archival of old memories
- **Knowledge Graph** - Entity/relationship extraction
- **Event Bus** - Cross-service event streaming

---

## Support

For issues or questions:
- Check logs: `pnpm run daemon logs`
- Health check: `curl http://localhost:3201/health`
- Review README.md for detailed documentation
