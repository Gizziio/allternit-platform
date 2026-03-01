# A2rchitech Data Fabric Architecture

This document describes the unified data fabric architecture that serves as the single source of truth for all tenant capabilities and data management across the A2rchitech system.

## Overview

The Data Fabric provides a unified interface for managing all data types across multiple storage backends:
- Primary SQL database for structured data (agents, skills, tools)
- Key-value cache for fast access patterns
- Vector database for semantic search and similarity matching

## Architecture Layers

### L4 — Registry & Data Fabric (Unified Capabilities Registry)
**Goal:** Single source of truth for all tenant capabilities (agents, skills, tools) with unified access patterns.

**Repo:**
```
/packages/registry/
  /agents/                  # Agent/Persona definitions and metadata
  /skills/                  # Skill definitions and capabilities  
  /tools/                   # Standalone tool definitions
  /fabric/                  # Unified data fabric implementation
    /src/
      lib.rs                # Main DataFabric orchestrator
      agent_registry.rs     # Agent registration and management
      skill_registry.rs     # Skill registration and management  
      tool_registry.rs      # Tool registration and management
      sql_store.rs          # SQL-based storage implementation
      kv_store.rs           # Key-value cache implementation
      vector_store.rs       # Vector database implementation
    Cargo.toml
    README.md
```

## Core Components

### 1. DataFabric (Main Orchestrator)
The DataFabric is the primary interface that coordinates access across all storage types:

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

### 2. Agent Registry
Manages agent/persona definitions with tenant isolation:

- Stores agent configurations (name, description, cognitive parameters)
- Maintains tenant-specific agent catalogs
- Provides agent discovery and metadata access

### 3. Skill Registry  
Wraps existing skill registry functionality for unified access:

- Integrates with existing skill management system
- Provides consistent interface with other registries
- Maintains skill lifecycle and versioning

### 4. Tool Registry
Manages standalone tools and their capabilities:

- Tracks tool definitions and safety tiers
- Maintains tool metadata and access controls
- Supports tool discovery and validation

## Data Access Patterns

### Unified Query Interface
The DataFabric provides a single interface for all data access:

```rust
// Get tenant capabilities across all registries
let capabilities = fabric.get_tenant_capabilities("tenant-123").await?;

// Register new agent
let agent_id = fabric.register_agent(agent_def).await?;

// Semantic search across all data types
let results = fabric.semantic_search("query", 10).await?;
```

### Caching Strategy
- Automatic cache-aside pattern for frequently accessed data
- Cache invalidation on writes
- TTL-based expiration for consistency

### Tenant Isolation
- All data operations are tenant-scoped
- Physical and logical isolation enforced at storage layer
- Cross-tenant access prevented by design

## Storage Implementations

### SQL Store (Primary)
- Structured data with ACID properties
- Agent, skill, and tool definitions
- Relational queries and indexing

### KV Store (Cache)
- Fast access to frequently requested data
- Session state and temporary data
- Redis-compatible interface

### Vector Store (Semantic)
- Embeddings for semantic search
- Similarity matching across capabilities
- Integration with AI/ML pipelines

## Integration Points

### With Existing Systems
- **Policy Engine**: Enforces access controls on all operations
- **History Ledger**: Logs all registry operations for audit trail
- **Messaging System**: Publishes registry events for downstream consumers
- **Skills System**: Integrated skill registry functionality
- **Tools Gateway**: Unified tool discovery and access

### API Integration
The DataFabric integrates with the apps/api layer to provide:
- REST endpoints for registry operations
- WebSocket streams for real-time updates
- Bulk operations for capability management

## Benefits

1. **Single Source of Truth**: All capabilities accessible through unified interface
2. **Performance**: Optimized access patterns with intelligent caching
3. **Scalability**: Multiple storage backends for different access patterns
4. **Tenant Safety**: Built-in isolation and access controls
5. **Extensibility**: Easy to add new storage types while maintaining interface
6. **Semantic Search**: Cross-data-type search capabilities

## Future Extensions

- Pluggable storage backends (PostgreSQL, MongoDB, etc.)
- Distributed registry federation
- Advanced analytics and insights
- Machine learning model registry integration
- Blockchain-based capability verification