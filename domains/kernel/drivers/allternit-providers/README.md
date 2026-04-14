# A2rchitech Providers Package

The Providers package implements the provider routing and persona kernel system for A2rchitech.

## Overview

The Providers package serves as the intelligent routing layer that:
- Routes tasks to appropriate AI providers based on capabilities and constraints
- Manages persona injection for consistent agent behavior
- Enforces budget and safety constraints
- Maintains provider health and performance metrics

## Architecture

### Provider Router
The central component that:
- Maintains registry of available providers
- Evaluates provider capabilities against task requirements
- Routes requests to optimal providers
- Tracks provider performance and costs

### Persona Kernel
The persona management system that:
- Defines base personas and role-specific overlays
- Injects persona context into provider calls
- Maintains persona versioning and consistency
- Records persona versions in history ledger

### Storage Layer
Durable storage for:
- Provider configurations and capabilities
- Persona definitions and overlays
- Provider performance statistics
- Routing preferences and constraints

## Key Features

### Intelligent Routing
- Capability-based provider selection
- Budget and cost optimization
- Latency-aware routing
- Failover and redundancy

### Persona Management
- Base persona + overlay architecture
- Deterministic persona injection
- Version-controlled personas
- Role-specific behavior modifiers

### Safety and Governance
- Provider status monitoring
- Budget enforcement
- Safety tier compliance
- Audit trail maintenance

## Integration Points

- **History Ledger**: All provider calls and persona usage logged
- **Policy Engine**: Access control and authorization
- **Context Router**: Context bundle integration
- **Memory Fabric**: Persona persistence and retrieval
- **Messaging System**: Event publishing for audit trail

## Usage

```rust
use a2rchitech_providers::{ProviderRouter, ProviderConfig, Persona, ProviderType};

// Initialize the provider router
let provider_router = ProviderRouter::new_with_storage(
    history_ledger,
    messaging_system,
    policy_engine,
    context_router,
    memory_fabric,
    session_manager,
    sqlite_pool
).await?;

// Register a provider
let config = ProviderConfig {
    provider_id: "openai-gpt4".to_string(),
    provider_type: ProviderType::OpenAI,
    endpoint: "https://api.openai.com/v1/chat/completions".to_string(),
    api_key: Some("your-api-key".to_string()),
    // ... other configuration
};

provider_router.register_provider(config).await?;

// Register a persona
let persona = Persona {
    persona_id: "planner-persona".to_string(),
    name: "Planner Persona".to_string(),
    // ... persona configuration
};

provider_router.register_persona(persona).await?;

// Route a request
let request = ProviderRequest {
    // ... request configuration
};

let response = provider_router.route_request(request).await?;
```

## Data Models

### Provider Configuration
- Provider identification and type
- Endpoint and authentication
- Capabilities and constraints
- Budget and routing preferences
- Health and status information

### Persona Definition
- Base persona identity
- Role-specific overlays
- Behavior modifiers
- Safety and formatting settings
- Version and activation state

### Routing Request
- Task intent and requirements
- Context bundle
- Budget constraints
- Persona specification
- Trace information

## Storage Schema

The package uses SQLite for durable storage with the following tables:
- `providers`: Provider configurations and capabilities
- `personas`: Persona definitions and overlays  
- `provider_stats`: Performance and usage metrics

## Testing

The package includes comprehensive tests covering:
- Provider registration and management
- Persona creation and injection
- Routing logic and failover
- Storage durability
- Policy enforcement