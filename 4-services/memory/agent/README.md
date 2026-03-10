# A2rchitech Always-On Memory Agent

> **Persistent AI memory powered by local LLM (Ollama)** - Runs 24/7 as a lightweight background process, continuously processing, consolidating, and connecting information.

## Architecture

```
┌─────────────────────────────────────┐
│     Memory Orchestrator             │
│         (Root Agent)                │
└─────────────┬───────────────────────┘
              │
    ┌──────────────────┐
    │         │         │
    ▼         ▼         ▼
┌────────┐ ────────┐ ┌────────
│ Ingest │ │Consol- │ │ Query  │
│ Agent  │ │ idate  │ │ Agent  │
│        │ │ Agent  │ │        │
│Summarize│ │Find    │ │Search  │
│Extract  │ │patterns│ │memories│
│Tag      │ │Merge   │ │Synthesize│
│topics   │ │related │ │answers │
│        │ │memories│ │        │
└───────┘ └───┬────┘ └───────┘
    │         │         │
    └──────────────────┘
              │
              ▼
    ┌─────────────────┐
    │   SQLite DB     │
    │  (memory.db)    │
    └─────────────────┘
```

## Features

- **24/7 Background Operation** - Runs as a daemon, watching for new files
- **Local LLM Processing** - Uses Ollama with small, efficient models (no API costs)
- **Automatic Consolidation** - Periodically finds connections between memories
- **Natural Language Queries** - Ask questions and get synthesized answers
- **SQLite Persistence** - All memories stored locally in a lightweight database
- **File Watching** - Drop files in `./inbox` for automatic ingestion
- **macOS Auto-Start** - Optional launchd service for boot-time startup

## Quick Start

### Prerequisites

1. **Install Ollama** (if not already installed):
   ```bash
   brew install ollama
   ```

2. **Start Ollama**:
   ```bash
   ollama serve
   ```

3. **Pull required models**:
   ```bash
   # Qwen 3.5 models (more efficient than Llama 3.2)
   ollama pull qwen3.5:2b      # 2.7 GB - Fast ingestion/queries
   ollama pull qwen3.5:4b      # 3.4 GB - Better reasoning
   
   # Embeddings for vector search
   ollama pull mxbai-embed-large
   ```
   
   **Why Qwen 3.5?**
   - 256K context window (8x larger than Llama 3.2)
   - More efficient architecture
   - Better reasoning performance
   - Smaller disk footprint

### Installation

```bash
cd /Users/macbook/Desktop/a2rchitech-workspace/a2rchitech/4-services/memory/agent

# Install dependencies
pnpm install

# Build (optional, for production)
pnpm run build
```

### Run as Daemon

```bash
# Start the memory agent
pnpm run daemon start

# Check status
pnpm run daemon status

# View logs
pnpm run daemon logs

# Stop
pnpm run daemon stop
```

### Run Interactively

```bash
# Development mode
pnpm run dev

# Production mode
pnpm run start
```

### Install as macOS Launchd Service (Auto-Start)

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

## Usage

### Ingest Files

Drop files in the `./inbox` directory:

```bash
# Text files
echo "Important meeting notes: We decided to use microservices architecture" > inbox/meeting-notes.txt

# Code files
cp ~/projects/my-app/src/main.ts inbox/

# Markdown docs
cp ~/docs/architecture.md inbox/
```

The agent will automatically process files within 5-10 seconds.

### Ingest via API (Programmatic)

```typescript
import { MemoryOrchestrator } from './src/orchestrator.js';

const orchestrator = new MemoryOrchestrator();
await orchestrator.initialize();

// Ingest content directly
await orchestrator.ingest(
  "Today we learned about the new deployment strategy",
  "meeting-notes"
);
```

### Query Memories

```typescript
// Query the memory system
const result = await orchestrator.query("What did we decide about architecture?");

console.log(result.answer);
console.log(result.sources);
console.log(result.memories);
```

### Get Statistics

```typescript
const stats = orchestrator.getStats();
console.log(stats);
// {
//   memories: { total: 42, raw: 5, processed: 10, consolidated: 27, archived: 0 },
//   insights: 8,
//   connections: 15,
//   processedFiles: 42,
//   ollamaConnected: true
// }
```

### Manual Consolidation

```typescript
// Trigger consolidation immediately
const result = await orchestrator.consolidate();
console.log(result);
// { memoriesProcessed: 10, connectionsFound: 5, insightsGenerated: 2, ... }
```

## Configuration

Edit environment variables or pass config to the orchestrator:

```typescript
import { MemoryOrchestrator } from './src/orchestrator.js';

const orchestrator = new MemoryOrchestrator({
  watchDirectory: './inbox',
  databasePath: './memory.db',
  ollamaHost: 'localhost',
  ollamaPort: 11434,
  ingestModel: 'llama3.2:3b',
  consolidateModel: 'phi3:mini',
  queryModel: 'llama3.2:3b',
  consolidationIntervalMinutes: 30,
});
```

### Model Options

| Task | Default Model | Alternative |
|------|---------------|-------------|
| Ingest | `llama3.2:3b` | `phi3:mini` |
| Consolidate | `phi3:mini` | `llama3.2:3b` |
| Query | `llama3.2:3b` | `mistral:7b` |

## API Reference

### MemoryOrchestrator

| Method | Description |
|--------|-------------|
| `initialize()` | Initialize all components |
| `start()` | Start all agents |
| `stop()` | Stop all agents |
| `ingest(content, source?)` | Ingest content directly |
| `query(question)` | Query and get synthesized answer |
| `consolidate()` | Trigger manual consolidation |
| `search(query)` | Search memories (raw results) |
| `getRecent(limit)` | Get recent memories |
| `getInsights()` | Get all insights |
| `getStats()` | Get system statistics |
| `getHealthStatus()` | Get health status |
| `deleteMemory(id)` | Delete a memory |
| `clearAllMemories()` | Reset all memories |

### Daemon Commands

| Command | Description |
|---------|-------------|
| `pnpm daemon start` | Start background daemon |
| `pnpm daemon stop` | Stop daemon |
| `pnpm daemon status` | Check daemon status |
| `pnpm daemon restart` | Restart daemon |
| `pnpm daemon logs` | Show logs |

## File Structure

```
memory/
├── package.json
├── README.md
├── install-launchd.sh
├── com.a2rchitech.memory-agent.plist
├── src/
│   ├── orchestrator.ts       # Root agent
│   ├── ingest-agent.ts       # File ingestion
│   ├── consolidate-agent.ts  # Pattern finding
│   ├── query-agent.ts        # Search & synthesis
│   ├── models/
│   │   └── local-model.ts    # Ollama integration
│   ├── store/
│   │   └── sqlite-store.ts   # Database layer
│   └── types/
│       └── memory.types.ts   # TypeScript types
├── daemon/
│   └── memory-daemon.ts      # Daemon manager
├── inbox/                    # Drop files here
└── memory.db                 # Auto-created
```

## Logs

- **Daemon logs**: `/tmp/a2r-memory-agent.log`
- **Launchd stdout**: `~/Library/Logs/a2rchitech/memory-agent.out.log`
- **Launchd stderr**: `~/Library/Logs/a2rchitech/memory-agent.err.log`

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
ollama pull qwen3.5:2b
ollama pull qwen3.5:4b
ollama pull mxbai-embed-large
```

### Daemon Won't Start

```bash
# Check if already running
pnpm daemon status

# Kill stale process
kill $(cat /tmp/a2r-memory-agent.pid) 2>/dev/null || true

# Remove PID file
rm /tmp/a2r-memory-agent.pid

# Try starting again
pnpm daemon start
```

### Database Issues

```bash
# Reset database (WARNING: deletes all memories)
rm memory.db

# Restart agent
pnpm daemon restart
```

## Integration with a2rchitech

The memory agent is designed to integrate seamlessly with the a2rchitech platform:

1. **Agent Context**: Agents can query memory for historical context
2. **Session Continuity**: Memories persist across sessions
3. **Knowledge Base**: Build a searchable knowledge base from all ingested content

```typescript
// Example: Use in an a2r agent
import { MemoryOrchestrator } from '@a2rchitech/memory';

const memory = new MemoryOrchestrator();
await memory.initialize();

// Before starting a task, query relevant history
const context = await memory.query("What do we know about this project?");

// Use context in agent prompt
const prompt = `
Based on this context: ${context.answer}

Complete the following task...
`;
```

## License

MIT
