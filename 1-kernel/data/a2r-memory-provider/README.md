# A2rchitech Memory Provider

A unified memory abstraction layer that provides a seamless interface to multiple memory implementations following Unix-like modularity principles.

## Architecture Overview

This crate implements a modular memory plane that maintains separate memory implementations (simple and advanced) while providing a unified interface. The architecture follows Unix philosophy:

- **Modularity**: Each memory implementation has a single, focused purpose
- **Composability**: Components can be combined and orchestrated
- **Transparency**: Clear interfaces and observable routing decisions

## Components

### MemoryProvider Trait
A common interface that all memory implementations must satisfy:

- `store()` / `retrieve()` - Basic key-value operations
- `query()` - Advanced querying capabilities  
- `delete()` - Removal operations
- `capabilities()` - Metadata about backend capabilities
- `ping()` - Health checks

### MemoryRouter
Intelligent coordinator that routes requests based on:
- Data size requirements
- Persistence needs
- Performance characteristics
- Custom routing rules
- Fallback mechanisms

### MemoryPlane
Unified interface that presents a single API to consumers while internally coordinating between implementations.

### MemoryPlaneBuilder
Fluent builder for configuring memory planes with routing rules and providers.

## Usage

```rust
use a2rchitech_memory_provider::{
    plane::{MemoryPlane, MemoryPlaneBuilder}, 
    MemoryProvider, 
    BackendType, 
    MemoryRoutingRule, 
    RoutingCondition
};

// Create a memory plane with routing configuration
let memory_plane = MemoryPlaneBuilder::new()
    .default_backend(BackendType::SimpleInMemory)
    .add_routing_rule(MemoryRoutingRule {
        condition: RoutingCondition::SizeThreshold { max_size_bytes: 1024 },
        target_backend: BackendType::SimpleInMemory,
        priority: 10,
    })
    .add_routing_rule(MemoryRoutingRule {
        condition: RoutingCondition::PersistenceRequired { required: true },
        target_backend: BackendType::Sqlite,
        priority: 20,
    })
    .fallback_enabled(true)
    .fallback_backends(vec![BackendType::SimpleInMemory])
    .build()?;

// Use the unified interface
memory_plane.store("key", serde_json::json!("value")).await?;
let value = memory_plane.retrieve("key").await?;
```

## Benefits

- **Robustness**: Multiple implementations provide redundancy
- **Flexibility**: Route to appropriate backend based on requirements
- **Scalability**: Independent scaling of different components
- **Maintainability**: Clear separation of concerns
- **Extensibility**: Easy to add new memory backends

## Design Philosophy

This implementation embraces Unix-like modularity:
- Each component has a single, well-defined responsibility
- Components are composable through clean interfaces
- The system is transparent and observable
- Consumers interact with a unified interface while benefiting from specialized implementations underneath