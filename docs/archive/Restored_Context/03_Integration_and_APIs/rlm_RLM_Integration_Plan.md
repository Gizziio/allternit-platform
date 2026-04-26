# Allternit Recursive Language Model (RLM) Integration Plan

## Executive Summary

This document outlines how to integrate Recursive Language Models (RLMs) as a framework enhancement to Allternit following the RLM paradigm from https://www.primeintellect.ai/blog/rlm. The architecture combines a Python REPL environment, helper sub-models for reasoning delegation, and a persistent memory layer for long-horizon agent tasks.

## 1. Understanding Recursive Language Models (RLMs)

### What Are RLMs?

RLMs (https://arxiv.org/abs/2512.24601) are a general inference strategy introduced by https://alexzhang13.github.io/blog/2025/rlm/ that treats long prompts as an external environment. Instead of processing massive context in one pass, the model:

1. Loads full input into a Python REPL as a string variable
2. Never sees the string directly in context
3. Uses code to slice, filter, and recursively call sub-LLMs on chunks
4. Aggregates results programmatically

### Key Performance Gains

| Metric                               | Improvement                      |
|--------------------------------------|----------------------------------|
| Document reasoning (BrowseComp-Plus) | +29% over baselines              |
| OOLONG-Pairs (complex aggregation)   | 58% F1 vs <0.1% base model       |
| Context scale                        | 10M+ tokens successfully handled |

## 2. Prime Intellect's RLMEnv Architecture

https://www.marktechpost.com/2026/01/02/recursive-language-models-rlms-from-mits-blueprint-to-prime-intellects-rlmenv-for-long-horizon-llm-agents/ provides the production-ready framework:

### Core Design Principles

```
┌─────────────────────────────────────────────────────────────┐
│                     ROOT RLM AGENT                          │
│  - Has ONLY Python REPL access                              │
│  - Controls context management                               │
│  - Delegates heavy tools to sub-LLMs                        │
│  - Writes final answer to environment variable              │
└─────────────────────┬───────────────────────────────────────┘
                      │ llm_batch()
          ┌───────────┼───────────┐
          ▼           ▼           ▼
    ┌──────────┐ ┌──────────┐ ┌──────────┐
    │ Sub-LLM  │ │ Sub-LLM  │ │ Sub-LLM  │
    │ + Tools  │ │ + Tools  │ │ + Tools  │
    │ (search) │ │ (files)  │ │ (web)    │
    └──────────┘ └─────────────────────────┘
```

### Key Components from https://github.com/PrimeIntellect-ai/verifiers

- Environments Hub: Modular environment registry (Python packages)
- prime-rl: https://github.com/PrimeIntellect-ai/prime-rl
- Verifiers: Rubrics, parsers, datasets, rollout configurations

## 3. REPL Environment & Helper Model Architecture

### Emergent Reasoning Behaviors in RLMs

From the research, these patterns naturally emerge:

1. Peek Step: Inspect first few thousand characters
2. Grep-style Filtering: Regex/keyword search to narrow scope
3. Chunk Partitioning: Split context and call recursive LMs per chunk
4. Programmatic Aggregation: Combine results in code
5. Answer Verification: Sub-calls to confirm reasoning

### Helper Model (Sub-LLM) Orchestration

Based on https://www.anthropic.com/engineering/multi-agent-research-system:

```python
# allternit helper model pattern
class HelperModelOrchestrator:
    def __init__(self):
        self.root_model = "opus"      # Context manager
        self.sub_models = "sonnet"    # Heavy lifting

    async def llm_batch(self, prompts: list[str], tools: list[Tool]):
        """Parallel sub-LLM invocation with tool access"""
        return await asyncio.gather(*[
            self.sub_model.invoke(p, tools=tools)
            for p in prompts
        ])
```

Key insight: https://www.anthropic.com/engineering/multi-agent-research-system when lead agent orchestrates specialized sub-agents.

## 4. Memory Layer & Database Architecture

### Three-Layer Memory System

Based on https://arxiv.org/abs/2504.19413 and https://aws.amazon.com/blogs/database/build-persistent-memory-for-agentic-ai-applications-with-mem0-open-source-amazon-elasticache-for-valkey-and-amazon-neptune-analytics/:

```
┌────────────────────────────────────────────────────────────┐
│                    Allternit MEMORY LAYER                 │
├────────────────────────────────────────────────────────────┤
│  LAYER 1: Working Memory (Redis/Valkey)                    │
│  - Active session context                                  │
│  - REPL state persistence                                  │
│  - Sub-LLM results cache                                   │
├────────────────────────────────────────────────────────────┤
│  LAYER 2: Episodic Memory (PostgreSQL + pgvector)          │
│  - Conversation history with embeddings                    │
│  - Tool call outcomes                                        │
│  - Temporal metadata                                         │
├────────────────────────────────────────────────────────────┤
│  LAYER 3: Knowledge Graph (Neptune/Neo4j)                  │
│  - Entity relationships                                    │
│  - Multi-hop reasoning paths                               │
│  - Cross-session associations                              │
└────────────────────────────────────────────────────────────┘
```

### Database Schema Sketch

```sql
-- Episodic Memory
CREATE TABLE agent_episodes (
    id UUID PRIMARY KEY,
    session_id UUID,
    timestamp TIMESTAMPTZ,
    role TEXT,
    content TEXT,
    embedding vector(1536),
    metadata JSONB
);

-- REPL State Persistence
CREATE TABLE repl_contexts (
    session_id UUID PRIMARY KEY,
    variables JSONB,        -- Python namespace state
    call_stack JSONB,       -- Recursive call tracking
    created_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ
);

-- Knowledge Extraction
CREATE TABLE extracted_facts (
    id UUID PRIMARY KEY,
    subject TEXT,
    predicate TEXT,
    object TEXT,
    confidence FLOAT,
    source_episode UUID REFERENCES agent_episodes(id)
);
```

## 5. Allternit Integration Plan

### Phase 1: Core REPL Environment

```rust
// allternit/core/repl_env.rs
use std::collections::HashMap;
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RLMContext {
    pub context: String,           // Full input as variable
    pub answer: Option<String>,    // Output variable
    pub variables: HashMap<String, String>,
}

pub struct RLMEnvironment {
    context: RLMContext,
    memory_layer: Arc<dyn MemoryLayer>,
}

impl RLMEnvironment {
    pub fn new(context: String, memory_layer: Arc<dyn MemoryLayer>) -> Self {
        Self {
            context: RLMContext {
                context,
                answer: None,
                variables: HashMap::new(),
            },
            memory_layer,
        }
    }

    pub async fn execute_code(&mut self, code: &str) -> Result<ExecutionResult, RLMError> {
        // Execute code in sandboxed environment
        // Save state to memory layer
        // Return results
        todo!()
    }

    pub async fn llm_batch(&self, prompts: Vec<String>, tools: Option<Vec<String>>) -> Result<Vec<String>, RLMError> {
        // Delegate to sub-LLMs with optional tool access
        // Sub-LLMs get tools; root RLM only has REPL
        todo!()
    }
}
```

### Phase 2: Helper Model Configuration

```rust
// allternit/models/orchestrator.rs
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HelperModelConfig {
    pub root_model: String,    // Context management (e.g., "claude-opus-4")
    pub sub_model: String,     // Tool execution (e.g., "claude-sonnet-4")
    pub max_parallel: usize,   // Default: 10
    pub recursion_depth: u32,  // Default: 5
}

pub struct ReasoningOrchestrator {
    config: HelperModelConfig,
    tool_registry: Arc<dyn ToolRegistry>,
}

impl ReasoningOrchestrator {
    pub async fn reason(&self, task: &str, context: &str) -> Result<String, RLMError> {
        let mut env = RLMEnvironment::new(context.to_string(), self.memory_layer.clone());

        // Root model decides how to process
        let plan = self.root_model.plan(task, &["llm_batch"]).await?;

        while env.context.answer.is_none() {
            let code = self.root_model.generate_code(&plan, &env.state()).await?;
            let result = env.execute_code(&code).await?;

            if !result.success {
                plan = self.root_model.handle_error(&result.error).await?;
            }
        }

        Ok(env.context.answer.unwrap_or_default())
    }
}
```

### Phase 3: Memory Integration

```rust
// allternit/memory/layer.rs
use std::sync::Arc;

#[async_trait]
pub trait MemoryLayer: Send + Sync {
    async fn save_repl_state(&self, session_id: &str, namespace: &HashMap<String, String>) -> Result<(), MemoryError>;
    async fn retrieve_relevant(&self, query: &str, k: usize) -> Result<Vec<MemoryEntry>, MemoryError>;
    async fn extract_and_store(&self, content: &str) -> Result<(), MemoryError>;
}

pub struct AllternitMemoryLayer {
    working_memory: Arc<dyn KeyValueStore>,
    episodic_memory: Arc<dyn VectorStore>,
    knowledge_graph: Arc<dyn GraphStore>,
}

impl MemoryLayer for AllternitMemoryLayer {
    async fn save_repl_state(&self, session_id: &str, namespace: &HashMap<String, String>) -> Result<(), MemoryError> {
        // Persist REPL state for session continuity
        let serialized = serde_json::to_string(namespace)?;
        self.working_memory.set(&format!("repl:{}", session_id), &serialized).await?;
        Ok(())
    }

    async fn retrieve_relevant(&self, query: &str, k: usize) -> Result<Vec<MemoryEntry>, MemoryError> {
        // Hybrid retrieval: vector + graph traversal
        let vector_results = self.episodic_memory.similarity_search(query, k).await?;
        let graph_results = self.knowledge_graph.traverse(query, 2).await?;
        Ok(self.merge_results(vector_results, graph_results))
    }

    async fn extract_and_store(&self, content: &str) -> Result<(), MemoryError> {
        // Automatic entity/fact extraction
        todo!()
    }
}
```

### Phase 4: Integration with Existing Architecture

The RLM implementation should be modular and integrate with the existing Allternit architecture:

- **As a Mode**: RLM should be an optional execution mode that can be switched on/off
- **Through Existing APIs**: RLM should work through the existing API endpoints
- **With Existing Tools**: RLM should leverage the existing tool registry and policy engine
- **With Existing Memory**: RLM should use the existing memory fabric

## 6. Key Implementation Decisions

| Decision           | Recommendation            | Rationale                        |
|--------------------|---------------------------|----------------------------------|
| Root model         | Claude Opus 4 / GPT-5     | Strong coding + reasoning        |
| Sub-models         | Claude Sonnet 4           | Cost-effective parallelism       |
| Working memory     | Redis/Valkey              | Sub-ms latency for REPL state    |
| Episodic memory    | PostgreSQL + pgvector     | Battle-tested, hybrid search     |
| Knowledge graph    | Neptune Analytics / Neo4j | Multi-hop relationship traversal |
| Training framework | prime-rl + verifiers      | Production-proven at scale       |

## 7. Phased Integration Plan

### Phase 1: REPL Environment
- Create sandboxed Python REPL environment
- Implement basic code execution with safety checks
- Add llm_batch function for sub-LLM delegation

### Phase 2: Helper Model Orchestration
- Implement root/sub-model coordination
- Add tool access for sub-models only
- Create context management logic

### Phase 3: Memory Integration
- Connect to existing memory fabric
- Implement state persistence
- Add retrieval-augmented generation

### Phase 4: API Integration
- Add RLM mode to existing API endpoints
- Create toggle for switching between standard and RLM modes
- Ensure backward compatibility

### Phase 5: Evaluation & Testing
- Test on long-context benchmarks
- Compare performance with standard execution
- Validate security and isolation

## 8. Modular Design Considerations

The RLM implementation should be:
- **Unix-like**: Single responsibility, composable components
- **Observable**: Clear metrics and logging for RLM operations
- **Decoupled**: Not tightly coupled with core Allternit architecture
- **Pluggable**: Can be enabled/disabled without affecting other systems
- **Secure**: Proper isolation and capability checks

## 9. Next Steps

1. Main beads issue created: allternit-rlm (updated with Unix-like architecture approach)
2. Sub-issues created for detailed implementation:
   - allternit-rlm.1: Core Mode Infrastructure
   - allternit-rlm.2: Unix Mode Executor
   - allternit-rlm.3: RLM Executor with Sub-LLM Orchestration
   - allternit-rlm.4: Hybrid Mode with Auto-Selection
   - allternit-rlm.5: Git-like Session Management
   - allternit-rlm.6: CLI Interface
3. Implement REPL environment with safety checks
4. Integrate with existing memory fabric
5. Add RLM mode to API layer
6. Test with long-context reasoning tasks

---
Sources:
- https://www.primeintellect.ai/blog/rlm
- https://alexzhang13.github.io/blog/2025/rlm/
- https://arxiv.org/abs/2512.24601
- https://www.marktechpost.com/2026/01/02/recursive-language-models-rlms-from-mits-blueprint-to-prime-intellects-rlmenv-for-long-horizon-llm-agents/
- https://www.primeintellect.ai/blog/environments
- https://github.com/PrimeIntellect-ai/prime-rl
- https://github.com/PrimeIntellect-ai/verifiers
- https://www.anthropic.com/engineering/multi-agent-research-system
- https://arxiv.org/abs/2504.19413
- https://aws.amazon.com/blogs/database/build-persistent-memory-for-agentic-ai-applications-with-mem0-open-source-amazon-elasticache-for-valkey-and-amazon-neptune-analytics/
- https://docs.primeintellect.ai/verifiers/training