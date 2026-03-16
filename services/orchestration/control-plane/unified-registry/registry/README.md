# A2rchitech Unified Registry & Data Fabric

The Unified Registry provides a single source of truth for all tenant capabilities (agents, skills, tools) with a unified data fabric that optimizes access patterns across multiple storage backends.

## Overview

The Data Fabric combines three storage types to provide optimal performance for different access patterns:

1. **Primary SQL Storage**: For structured data with ACID properties (agents, skills, tools)
2. **KV Cache**: For fast access to frequently requested data (Redis-compatible)
3. **Vector Database**: For semantic search and similarity matching across capabilities

## Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Agent Reg     │    │   Skill Reg     │    │   Tool Reg      │
│                 │    │                 │    │                 │
│  • Agent Defs   │    │  • Skill Defs   │    │  • Tool Defs    │
│  • Personas     │    │  • Workflows    │    │  • ABIs         │
│  • Configs      │    │  • Tools        │    │  • Safety Tiers │
└─────────────────┘    └─────────────────┘    └─────────────────┘
           │                      │                      │
           └──────────────────────┼──────────────────────┘
                                  ▼
                    ┌─────────────────────────┐
                    │    Unified DataFabric   │
                    │                       │
                    │  ┌─────────────────┐  │
                    │  │   SQL Store     │  │ ← Structured Data
                    │  └─────────────────┘  │
                    │  ┌─────────────────┐  │
                    │  │    KV Store     │  │ ← Fast Access Cache
                    │  └─────────────────┘  │
                    │  ┌─────────────────┐  │
                    │  │  Vector Store   │  │ ← Semantic Search
                    │  └─────────────────┘  │
                    └─────────────────────────┘
                                  │
                    ┌─────────────────────────┐
                    │   Tenant Capabilities │
                    │  • Cross-data queries │
                    │  • Semantic search    │
                    │  • Caching strategy   │
                    │  • Tenant isolation   │
                    └─────────────────────────┘
```

## Features

### Unified Interface
Single interface for all capability management:
- Register agents, skills, and tools through one API
- Consistent data models across all registries
- Shared authentication and authorization

### Intelligent Caching
Automatic cache-aside pattern with smart invalidation:
- Primary DB → Cache on read
- Write-through to maintain consistency
- TTL-based expiration for freshness

### Semantic Search
Cross-data-type semantic search capabilities:
- Vector embeddings for agents, skills, and tools
- Similarity matching across capability types
- Natural language queries

### Tenant Isolation
Strict separation between tenant data:
- All operations are tenant-scoped
- Physical and logical isolation
- Cross-tenant access prevention

## Usage

### Basic Operations

```rust
use a2rchitech_registry::{UnifiedRegistry, AgentDefinition, DataQuery};

// Initialize the registry
let registry = UnifiedRegistry::new(
    Arc::new(skill_registry),
    Arc::new(agent_registry),
    Arc::new(tool_registry),
)?;

// Register an agent
let agent_id = registry.register_agent(agent_def).await?;

// Get tenant capabilities
let capabilities = registry.get_tenant_capabilities("tenant-123").await?;

// Semantic search across all data types
let results = registry.semantic_search("query", 10).await?;
```

### Cross-Data Queries

```rust
// Find related capabilities across agents, skills, and tools
let query = DataQuery {
    search_text: Some("data analysis".to_string()),
    filters: HashMap::from([
        ("tenant_id".to_string(), "tenant-123".into()),
        ("safety_tier".to_string(), "T0".into()),
    ]),
    embedding: Some(generate_embedding("data analysis")),
    limit: Some(20),
    offset: None,
};

let results = registry.query(query).await?;
```

## Integration

### With Policy Engine
All operations are subject to tenant-based access controls and safety tier enforcement.

### With History Ledger
All registry operations are logged for audit trails and compliance.

### With Messaging System
Real-time notifications for registry changes enable event-driven architectures.

## Performance

- **Cache Hits**: < 1ms
- **SQL Queries**: < 10ms  
- **Vector Searches**: < 50ms
- **Cross-Store Operations**: < 100ms

## Storage Backends

The Data Fabric supports pluggable storage backends:

- **Primary**: SQLite (development) / PostgreSQL (production)
- **Cache**: Redis-compatible (in-memory) with configurable connection pooling, TTL, and memory limits
- **Vector**: Pinecone, Chroma, Qdrant, or local memory implementation

### Configuration Options

The system supports configurable backends through the `FabricConfig` struct:

```rust
pub struct FabricConfig {
    pub redis_config: Option<RedisConfig>,
    pub vector_config: Option<VectorConfig>,
    pub cache_invalidation_patterns: Vec<String>,
}

pub struct RedisConfig {
    pub url: String,
    pub connection_pool_size: Option<u32>,
    pub ttl_seconds: Option<u64>,
    pub max_memory: Option<String>,
}

pub enum VectorBackend {
    Memory,
    Disabled,
    Pinecone { api_key: String, environment: String },
    Chroma { url: String },
    Qdrant { url: String },
}

pub struct VectorConfig {
    pub backend: VectorBackend,
    pub dimension: Option<u32>,
    pub distance_metric: Option<String>, // "cosine", "euclidean", "dot"
    pub collection_name: Option<String>,
}
```

### Cache Invalidation

The system implements automatic cache invalidation:

- **Pattern-based invalidation**: Predefined patterns for tenant, agent, skill, and tool data
- **Automatic invalidation**: When data is updated, related cache entries are invalidated
- **Tenant-specific invalidation**: Invalidate all cache entries for a specific tenant

## Security

- Tenant-based data isolation
- Fine-grained access controls via policy engine
- Encrypted storage for sensitive data
- Audit logging for all operations

## Future Extensions

- Federated registry across multiple clusters
- Machine learning model registry
- Blockchain-based capability verification
- Advanced analytics and insights