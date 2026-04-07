# A2rchitech Memory Service

**Location**: `services/memory/`  
**Domain**: Layer 4 - Services (Memory & Persistence)

---

## Structure

```
services/memory/
├── agent/                      # TypeScript Always-On Memory Agent
│   ├── src/
│   │   ├── orchestrator.ts     # Root agent coordinator
│   │   ├── http-server.ts      # HTTP API (port 3201)
│   │   ├── ingest-agent.ts     # File ingestion
│   │   ├── consolidate-agent.ts # Pattern finding
│   │   ├── query-agent.ts      # Query synthesis
│   │   ├── pipelines/          # Data ingestion pipelines
│   │   ├── store/              # SQLite + Vector store
│   │   ├── models/             # Ollama integration
│   │   └── utils/              # Decay, Knowledge Graph, Event Bus
│   ├── daemon/                 # Background service manager
│   ├── package.json
│   └── README.md               # Agent-specific docs
│
├── src/                        # Rust Memory Service
│   ├── lib.rs                  # MemoryProvider trait
│   ├── memory_agent_adapter.rs # HTTP adapter to TypeScript agent
│   └── ...
├── observation/                # Memory observation module
├── state/                      # Memory state management
└── Cargo.toml                  # Rust dependencies
```

---

## Components

### 1. TypeScript Memory Agent (`agent/`)

**Always-on AI memory agent with local LLM (Ollama + Qwen 3.5)**

- **HTTP API**: Port 3201
- **Models**: Qwen 3.5:2b, Qwen 3.5:4b
- **Storage**: SQLite + Vector embeddings
- **Features**:
  - File watching & auto-ingestion
  - Intelligent consolidation
  - Natural language queries
  - Knowledge graph
  - Event bus

**Quick Start:**
```bash
cd services/memory/agent
pnpm install
pnpm run start:http
```

### 2. Rust Memory Service (`src/`)

**MemoryProvider trait implementation for Rust services**

- Implements `allternit-memory-provider` trait
- HTTP client to TypeScript agent
- Used by kernel-service, gateway, etc.

**Usage:**
```rust
use allternit_memory_provider::MemoryAgentAdapter;

let adapter = MemoryAgentAdapter::with_url("http://localhost:3201")?;
let result = adapter.query(&MemoryQuery { query: "Hello".to_string() }).await?;
```

---

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│              Memory Service (Layer 4)                    │
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

## API Endpoints

### TypeScript Agent (Port 3201)

```
GET  /health              - Health check
GET  /stats               - Statistics
GET  /metrics             - Prometheus metrics
POST /api/query           - Natural language query
POST /api/ingest          - Ingest content
GET  /api/search          - Search memories
GET  /api/vector/search   - Vector similarity search
POST /api/consolidate     - Trigger consolidation
```

### Rust Service (Library)

```rust
// MemoryProvider trait methods
async fn store(&self, key: &str, value: Value) -> Result<(), MemoryError>;
async fn query(&self, query: &MemoryQuery) -> Result<Vec<MemoryEntry>, MemoryError>;
async fn retrieve(&self, key: &str) -> Result<Option<Value>, MemoryError>;
```

---

## Integration Points

### With Kernel Service (Layer 4 → Layer 1)

```rust
// services/orchestration/kernel-service/src/orchestrator/service.rs
use allternit_memory_provider::MemoryAgentAdapter;

let memory = MemoryAgentAdapter::with_url("http://localhost:3201")?;

// Query before task execution
let context = memory.query(&MemoryQuery {
    query: "Previous DAG executions".to_string(),
    limit: Some(10),
    ..Default::default()
}).await?;
```

### With Gateway (Layer 4 → Layer 4)

```python
# services/gateway/src/main.py
@app.post("/api/v1/memory/query")
async def memory_query(request: MemoryQueryRequest):
    async with httpx.AsyncClient() as client:
        response = await client.post(
            f"{MEMORY_URL}/api/query",
            json={"question": request.question}
        )
        return response.json()
```

### With CLI (Layer 7 → Layer 4)

```bash
# cmd/cli/src/commands/memory.rs
a2r memory query "What tools were used recently?"
a2r memory stats
a2r memory consolidate
```

---

## Data Flow

```
Agent Workspace Files
    ↓
Receipts, WIH, Session States
    ↓
Ingestion Pipelines (agent/src/pipelines/)
    ↓
Memory Agent (LLM Processing with Qwen 3.5)
    ↓
SQLite Database + Vector Index
    ↓
HTTP API (Port 3201)
    ↓
Rust Services (via MemoryProvider trait)
    ↓
Kernel, Gateway, CLI, etc.
```

---

## Configuration

### Environment Variables

```bash
# Memory Agent
MEMORY_HTTP_PORT=3201
MEMORY_WATCH_DIRECTORY=./inbox
MEMORY_DATABASE_PATH=./memory.db
MEMORY_OLLAMA_HOST=<VPS_IP or localhost>
MEMORY_OLLAMA_PORT=11434
MEMORY_INGEST_MODEL=qwen3.5:2b
MEMORY_CONSOLIDATE_MODEL=qwen3.5:4b
```

### Ollama Setup

**Local:**
```bash
ollama pull qwen3.5:2b
ollama pull qwen3.5:4b
```

**VPS:**
```bash
# On VPS
curl -o setup.sh https://raw.githubusercontent.com/allternit/allternit/main/services/memory/agent/scripts/setup-ollama-vps.sh
sudo ./setup-ollama.sh

# On local machine
export OLLAMA_HOST=http://<VPS_IP>:11434
```

---

## Documentation

| Document | Location | Purpose |
|----------|----------|---------|
| Agent README | `agent/README.md` | User setup guide |
| Integration Guide | `agent/INTEGRATION_GUIDE.md` | Developer integration |
| Implementation Summary | `agent/IMPLEMENTATION_SUMMARY.md` | Feature list |
| VPS Setup | `agent/VPS_OLLAMA_SETUP.md` | Ollama on VPS |
| Qwen 3.5 Update | `agent/QWEN35_UPDATE.md` | Model info |

---

## Testing

```bash
# Start agent
cd services/memory/agent
pnpm run start:http

# Test health
curl http://localhost:3201/health

# Test query
curl -X POST http://localhost:3201/api/query \
  -H "Content-Type: application/json" \
  -d '{"question": "What do we know about DAG validation?"}'

# CLI test
a2r memory stats
```

---

## Related Services

- **Kernel Service** (`services/orchestration/kernel-service/`) - Task execution with memory context
- **Gateway** (`services/gateway/`) - External API access to memory
- **CLI** (`cmd/cli/`) - Command-line interface
- **Ollama** (External) - Local LLM runtime

---

**Layer**: 4 (Services)  
**Domain**: Memory & Persistence  
**Status**: Production Ready ✅
