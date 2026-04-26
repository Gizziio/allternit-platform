# Allternit Data Fabric Specification

## Overview

The Data Fabric is a unified data management layer that provides a single interface for accessing and managing different types of data across multiple storage backends. It serves as the authoritative source for all tenant capabilities (agents, skills, tools) while providing optimized access patterns for different use cases.

## Goals

1. **Single Source of Truth**: Provide a unified interface for all tenant capabilities
2. **Performance**: Optimize access patterns with intelligent caching and indexing
3. **Scalability**: Support multiple storage backends for different access patterns
4. **Tenant Isolation**: Ensure strict separation between tenant data
5. **Semantic Search**: Enable cross-data-type semantic search capabilities
6. **Extensibility**: Allow for new storage types while maintaining consistent interface

## Architecture

### Core Components

#### 1. DataFabric (Orchestrator)
The main orchestrator that coordinates access across all storage types:

```rust
pub struct DataFabric {
    primary_db: Arc<dyn DataStore>,    // SQL for structured data
    kv_cache: Arc<dyn DataStore>,     // Redis/In-memory for fast access
    vector_db: Arc<dyn DataStore>,    // Vector DB for semantic search
    history_ledger: Arc<Mutex<HistoryLedger>>,
    messaging_system: Arc<MessagingSystem>,
    policy_engine: Arc<PolicyEngine>,
}
```

#### 2. DataStore Trait
Abstracts different storage types:

```rust
#[async_trait]
pub trait DataStore: Send + Sync {
    /// Get a value by key
    async fn get(&self, key: &str) -> Result<Option<serde_json::Value>, FabricError>;
    
    /// Set a value by key
    async fn set(&self, key: &str, value: serde_json::Value) -> Result<(), FabricError>;
    
    /// Delete a value by key
    async fn delete(&self, key: &str) -> Result<(), FabricError>;
    
    /// Search using semantic vectors
    async fn search_vectors(&self, query_embedding: Vec<f32>, top_k: usize) -> Result<Vec<SearchResult>, FabricError>;
    
    /// Store a vector with metadata
    async fn store_vector(&self, id: &str, embedding: Vec<f32>, metadata: serde_json::Value) -> Result<(), FabricError>;
    
    /// Remove a vector by ID
    async fn remove_vector(&self, id: &str) -> Result<(), FabricError>;
    
    /// Perform a complex query across all data sources
    async fn query(&self, query: DataQuery) -> Result<Vec<DataResult>, FabricError>;
}
```

#### 2a. Configuration (Optional Backends)

```rust
pub enum VectorBackend {
    Memory,
    Disabled,
}

pub struct FabricConfig {
    pub redis_url: Option<String>,
    pub vector_backend: VectorBackend,
}
```

#### 3. Storage Implementations

##### SQL Store
- Primary storage for structured data (agents, skills, tools)
- ACID transactions and relational queries
- Schema management and migrations

##### KV Store
- Fast access to frequently requested data
- Session state and temporary data
- Redis-compatible interface

##### Vector Store
- Embeddings for semantic search
- Similarity matching across capabilities
- Integration with AI/ML pipelines

### Registry Components

#### Agent Registry
Manages agent/persona definitions with tenant isolation:
- Stores agent configurations (name, description, cognitive parameters)
- Maintains tenant-specific agent catalogs
- Provides agent discovery and metadata access

#### Skill Registry
Wraps existing skill registry functionality for unified access:
- Integrates with existing skill management system
- Provides consistent interface with other registries
- Maintains skill lifecycle and versioning

#### Tool Registry
Manages standalone tools and their capabilities:
- Tracks tool definitions and safety tiers
- Maintains tool metadata and access controls
- Supports tool discovery and validation

## Data Models

### Agent Definition
```rust
pub struct AgentDefinition {
    pub id: String,
    pub name: String,
    pub description: String,
    pub version: String,
    pub system_prompt: String,
    pub model_config: ModelConfig,
    pub allowed_skills: Vec<String>,
    pub expertise_domains: Vec<String>,
    pub tenant_id: String,
    pub created_at: u64,
    pub updated_at: u64,
}
```

### Tenant Capabilities
```rust
pub struct TenantCapabilities {
    pub agents: Vec<AgentDefinition>,
    pub skills: Vec<Skill>,
    pub tools: Vec<ToolDefinition>,
}
```

## API Interface

### Core Operations

#### Registration
```rust
// Register an agent
let agent_id = fabric.register_agent(agent_def).await?;

// Register a skill
let skill_id = fabric.register_skill(skill_def).await?;

// Register a tool
let tool_id = fabric.register_tool(tool_def).await?;
```

#### Retrieval
```rust
// Get tenant capabilities
let capabilities = fabric.get_tenant_capabilities("tenant-123").await?;

// Get specific agent
let agent = fabric.get_agent("agent-id").await?;

// Semantic search across all data types
let results = fabric.semantic_search("query", 10).await?;
```

#### Caching
```rust
// Get with automatic cache fallback
let data = fabric.get_with_cache("key").await?;

// Set with automatic cache update
fabric.set_with_cache("key", value).await?;
```

## Integration Points

### With Policy Engine
- All operations subject to tenant-based access controls
- Safety tier enforcement for tools and skills
- Identity-based authorization

### With History Ledger
- All registry operations logged for audit trail
- Immutable event log for compliance
- Replay capability for debugging

### With Messaging System
- Real-time notifications for registry changes
- Event-driven updates to dependent systems
- Audit logging for compliance

## Security & Compliance

### Tenant Isolation
- All data operations are tenant-scoped
- Physical and logical isolation enforced at storage layer
- Cross-tenant access prevented by design

### Access Controls
- Integration with policy engine for fine-grained permissions
- Role-based access to registry operations
- Audit trails for all access attempts

### Data Encryption
- At-rest encryption for sensitive data
- In-transit encryption for all communications
- Key management integration

## Performance Characteristics

### Latency Targets
- Cache hits: < 1ms
- SQL queries: < 10ms
- Vector searches: < 50ms
- Cross-store operations: < 100ms

### Throughput Targets
- 10,000+ operations per second
- Sub-millisecond p99 latencies for cached data
- Efficient batching for bulk operations

### Scalability
- Horizontal scaling via sharding strategies
- Connection pooling for database efficiency
- Asynchronous processing for background tasks

## Future Extensions

### Storage Backends
- PostgreSQL for production deployments
- MongoDB for document-based storage
- Cassandra for distributed storage
- Cloud storage (S3, GCS) for large artifacts

### Advanced Features
- Federated registry across multiple clusters
- Machine learning model registry
- Blockchain-based capability verification
- Advanced analytics and insights
- Predictive caching algorithms
