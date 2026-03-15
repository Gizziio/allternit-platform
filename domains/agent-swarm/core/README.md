# Meta-Swarm System

A multi-agent orchestration platform with 4 swarm modes for parallel task execution, auto-architecture discovery, and knowledge compounding.

## Quick Start

### CLI Usage

```bash
# Submit a task with auto-detected mode
a2r swarm "Implement a REST API for user management"

# Force specific mode
a2r swarm "Refactor codebase" --mode=closed_loop

# Watch progress in real-time
a2r swarm "Build feature X" --watch

# Set budget limit
a2r swarm "Large refactoring" --budget=10.00 --agents=10

# Check active sessions
a2r swarm status

# Open dashboard
a2r swarm dashboard

# Query knowledge base
a2r swarm knowledge "authentication patterns"
```

### Natural Language Triggers

Just say the magic words and the swarm activates:

```
"Do this with swarm of agents"          → Auto-detects optimal mode
"Use swarm to implement feature X"      → Routes to best mode
"Deploy swarm for testing"              → Parallel execution
"@swarm fix this bug"                   → Command-style trigger
"Auto-architect this system"            → Forces SwarmAgentic
"Closed-loop production deployment"     → Forces ClosedLoop
```

### JavaScript/TypeScript API

```typescript
import { useMetaSwarm, detectSwarmTrigger } from '@a2r/platform/swarm';

// In your component
function MyComponent() {
  const { submitTask, isConnected, activeTasks } = useMetaSwarm({
    autoConnect: true,
    onProgress: (update) => console.log(`${update.progress * 100}%`),
    onTaskComplete: (taskId, result) => console.log('Done!', result),
  });

  const handleSubmit = async (text: string) => {
    // Auto-detect if swarm should be used
    const trigger = detectSwarmTrigger(text);
    
    if (trigger.isSwarmTrigger) {
      await submitTask(trigger.task, { 
        mode: trigger.suggestedMode,
        budget: 5.00 
      });
    } else {
      // Regular single-agent execution
    }
  };
}
```

## Swarm Modes

### 1. SwarmAgentic (Auto-Architect)

**Use for:** Novel problems, architecture discovery, finding optimal agent teams

**How it works:**
- PSO (Particle Swarm Optimization) engine evolves candidate agent architectures
- Each "particle" represents a potential team structure
- Iterative evolution with failure analysis
- Exports best architecture to DAK packs

```bash
a2r swarm "Design optimal agent architecture for web scraping" --mode=swarm_agentic
```

### 2. Claude Swarm

**Use for:** Fast parallel execution, I/O bound tasks, independent subtasks

**How it works:**
- Subtask Splitter breaks task into parallel chunks
- 4 parallel Claude agents execute simultaneously
- Shared context via Context Reservoir
- Result Merger combines outputs

```bash
a2r swarm "Generate 50 test cases" --mode=claude_swarm
```

### 3. ClosedLoop (Production)

**Use for:** Production code, complex refactoring, knowledge compounding

**How it works:**
- **Brainstorm:** 2-3 approaches with pros/cons
- **Plan:** Work items with dependencies (WIH integration)
- **Work:** 29 parallel agents with file locking
- **Review:** P1/P2/P3 triage (blocks on P1)
- **Compound:** Extract patterns to knowledge base

```bash
a2r swarm "Refactor production API" --mode=closed_loop --agents=29
```

### 4. Hybrid

**Use for:** Complex multi-phase tasks requiring different modes

**How it works:**
- Sequences multiple swarm modes
- Phase transitions with state handoff
- Adaptive based on intermediate results

```bash
a2r swarm "Build complete system" --mode=hybrid
```

## Dashboard

The MetaSwarmDashboard provides real-time monitoring:

- **Agent Status Panel:** See all 29 agents working in parallel
- **Progress Panel:** Visual DAG/wave execution flow
- **Cost Tracker:** Budget enforcement and projections
- **File Conflict Panel:** Real-time lock status
- **Knowledge Panel:** Discovered patterns with effectiveness scores

Access via:
```bash
a2r shell --view=swarm
# or
open http://localhost:5173/#/swarm
```

## Integration Examples

### In AskUserQuestion

```tsx
import { SwarmAwareAskUserQuestion } from '@a2r/platform/swarm';

<SwarmAwareAskUserQuestion
  id="implementation"
  question="What would you like to implement?"
  type="text"
  onSubmit={handleSubmit}
  onSwarmTrigger={(task, mode, confidence) => {
    console.log(`Swarm triggered with ${confidence} confidence`);
    metaSwarm.submitTask(task, { mode });
  }}
/>
```

### In Chat Mode

```typescript
// Automatically detect swarm intent in chat messages
const handleChatMessage = async (text: string) => {
  const trigger = detectSwarmTrigger(text);
  
  if (trigger.isSwarmTrigger && trigger.confidence > 0.7) {
    // Show swarm confirmation UI
    showSwarmSuggestion({
      task: trigger.task,
      mode: trigger.suggestedMode,
      confidence: trigger.confidence,
    });
  }
};
```

### In ADE/Code Mode

```typescript
import { useMetaSwarm } from '@a2r/platform/swarm';

function CodeModeAgent() {
  const { submitTask, dashboardState } = useMetaSwarm();
  
  const handleCodeRequest = async (description: string) => {
    // Check if swarm is appropriate
    if (description.includes('refactor') || description.includes('multiple files')) {
      const handle = await submitTask(description, {
        mode: 'closed_loop',
        budget: 10.00,
      });
      
      // Monitor progress
      return handle.taskId;
    }
  };
}
```

## Configuration

```typescript
interface SwarmConfig {
  max_parallel_agents: number;      // Default: 29 (ClosedLoop), 4 (ClaudeSwarm)
  default_task_budget: number;      // USD limit per task
  enable_knowledge_compound: bool;  // Auto-extract patterns
  enable_auto_routing: bool;        // Task analysis for mode selection
}
```

## Knowledge Base

The system compounds knowledge from every solved problem:

```rust
// Pattern structure
struct Pattern {
    root_cause: String,
    fix: String,
    prevention: String,
    effectiveness: EffectivenessMetrics,
}
```

Query patterns:
```bash
a2r swarm knowledge "authentication errors"
a2r swarm knowledge "optimization patterns" --domain=database
```

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    MetaSwarmController                       │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐  │
│  │ Task Router │→ │ ModeSelector│→ │ SwarmModeExecutor   │  │
│  └─────────────┘  └─────────────┘  └─────────────────────┘  │
│          ↓              ↓                    ↓               │
│  ┌────────────────────────────────────────────────────────┐ │
│  │              Knowledge Store (Patterns)                 │ │
│  └────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│                    Swarm Modes                               │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐       │
│  │SwarmAgent│ │ClaudeSwrm│ │ClosedLoop│ │  Hybrid  │       │
│  │ic (PSO)  │ │(Parallel)│ │(5-Step)  │ │(Sequence)│       │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘       │
└─────────────────────────────────────────────────────────────┘
```

## API Endpoints

```
POST   /api/v1/swarm/tasks              # Submit task
GET    /api/v1/swarm/tasks/:id/status   # Get status
POST   /api/v1/swarm/tasks/:id/cancel   # Cancel task
GET    /api/v1/swarm/tasks/:id/result   # Get result
GET    /api/v1/swarm/dashboard          # Dashboard state
GET    /api/v1/swarm/knowledge          # Query patterns
WS     /api/v1/swarm/events             # Real-time events
```

## Testing

```bash
# Run all tests
cargo test -p a2r-meta-swarm

# Run integration tests
cargo test -p a2r-meta-swarm --test integration_test

# Run with coverage
cargo tarpaulin -p a2r-meta-swarm
```

## License

MIT - See LICENSE for details
