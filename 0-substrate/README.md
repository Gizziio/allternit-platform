# 0-substrate: Foundation Layer

The `0-substrate` layer serves as the foundational infrastructure for the entire A2R (A2rchitech) platform. This layer contains low-level, shared primitives and protocols that form the bedrock upon which all higher layers are built.

## Purpose & Mission

The 0-substrate layer is designed to provide:

- **Shared Foundations**: Low-level Rust crates modeling DAGs, intent graphs, canvases, embeddings, and other primitives
- **Cross-Layer Interoperability**: Standardized interfaces and protocols that ensure consistent communication between layers
- **Architectural Integrity**: Strict dependency boundaries preventing higher-layer concerns from polluting the foundation
- **Enterprise Reliability**: Production-grade implementations of core data structures and algorithms

## Core Components

### Rust Crates

#### `a2r-substrate`
- **Purpose**: Core runtime and helper utilities
- **Location**: `0-substrate/a2r-substrate/`
- **Key Features**:
  - ProcessResult: Standardized process execution results with stdout/stderr/exit codes
  - ToolRequest/ToolResponse: Standardized tool invocation and response patterns
  - PolicyContext: Security and policy evaluation contexts
- **Dependencies**: Minimal external dependencies (serde, serde_json)

#### `a2r-intent-graph-kernel`
- **Purpose**: Persistent, queryable graph of intent nodes and edges
- **Location**: `0-substrate/a2r-intent-graph-kernel/`
- **Key Features**:
  - Single Reality: No forking, one node per real-world entity
  - Append-Only Provenance: All changes cite source objects
  - Policy-Gated Mutation: AI proposes; policy commits
  - No Silent State: Every state change is citeable
  - Node types: Intent, Task, Goal, Decision, Plan, Artifact, Memory
  - Edge types: DependsOn, Blocks, PartOf, Implements, ContextFor
- **Dependencies**: serde, sqlx, tokio, axum, tracing, uuid, chrono

#### `a2r-presentation-kernel`
- **Purpose**: Presentation helpers for orchestrator UI
- **Location**: `0-substrate/a2r-presentation-kernel/`
- **Key Features**:
  - IntentTokenizer: Parses and categorizes intent tokens
  - SituationResolver: Resolves contextual situations for UI presentation
  - CanvasProtocol: Communication and rendering protocol for canvas-based UIs
  - Layout strategies and interaction specifications
- **Dependencies**: serde, uuid, chrono, axum, tracing, tokio

#### `a2r-agent-system-rails`
- **Purpose**: Agent system infrastructure and utilities
- **Location**: `0-substrate/a2r-agent-system-rails/`
- **Key Features**:
  - Agent lifecycle management
  - System integration utilities
  - Rail-based execution patterns

#### `a2r-embodiment`
- **Purpose**: Agent embodiment and presence systems
- **Location**: `0-substrate/a2r-embodiment/`
- **Key Features**:
  - Agent identity and presence management
  - Embodiment protocols and representations

#### `a2r-canvas-protocol`
- **Purpose**: Canvas execution metadata and serialization protocols
- **Location**: `0-substrate/protocols/a2r-canvas-protocol/`
- **Key Features**:
  - Canvas specification serialization
  - Execution metadata handling
  - Protocol versioning and validation

### Type Definitions

#### TypeScript Contracts
- **Location**: `0-substrate/types/`
- **Key Files**:
  - `capsule-spec.ts`: Capsule specification types and interfaces
  - `a2ui-types.ts`: A2UI payload and component definitions
- **Purpose**: Shared TypeScript interfaces ensuring type safety across the platform

### Configuration Systems

#### Config Management
- **Location**: `0-substrate/configs/`
- **Purpose**: Shared configuration schemas and defaults for the substrate layer

### Protocol Definitions

#### Communication Protocols
- **Location**: `0-substrate/protocols/`
- **Purpose**: Standardized communication patterns between substrate components

### Schema Definitions

#### Data Schemas
- **Location**: `0-substrate/schemas/`
- **Purpose**: Shared data structure definitions and validation schemas

### SDK Components

#### Substrate SDK
- **Location**: `0-substrate/sdk/`
- **Purpose**: Client-side libraries for interacting with substrate components

### Utility Libraries

#### Helper Functions
- **Location**: `0-substrate/utils/`
- **Purpose**: Shared utility functions and algorithms used across substrate components

## Architectural Principles

### Dependency Management
- **Strict Unidirectional Dependencies**: Higher layers may import from lower layers, but never vice versa
- **Minimal External Dependencies**: Each crate maintains minimal external dependencies to reduce complexity
- **Interface Stability**: Public interfaces maintain backward compatibility across minor versions

### Performance Characteristics
- **Low Latency**: Optimized for high-performance operations
- **Memory Efficiency**: Careful memory management to minimize overhead
- **Concurrency Support**: Built with async/await patterns for concurrent operations

### Security Model
- **Principle of Least Privilege**: Components operate with minimal required permissions
- **Input Validation**: All external inputs are validated before processing
- **Immutable Data Structures**: Where possible, immutable data structures are used to prevent corruption

## Integration Points

### With Layer 1-Kernel
- Imports substrate types for process management and execution
- Uses intent graph kernel for state tracking
- Leverages presentation kernel for UI rendering

### With Layer 2-Governance
- Consumes policy contexts from substrate
- Uses intent graph for work item tracking
- Integrates with presentation kernel for governance UI

### With Layer 3-Adapters
- Utilizes substrate protocols for adapter communication
- Leverages canvas protocol for UI presentation
- Uses type definitions for consistent data exchange

## Quality Assurance

### Testing Strategy
- Unit tests for all core functions
- Integration tests for component interactions
- Performance benchmarks for critical paths
- Fuzz testing for input validation

### Monitoring & Observability
- Structured logging with correlation IDs
- Performance metrics collection
- Error rate monitoring
- Resource utilization tracking

## Development Guidelines

### Adding New Components
1. Ensure the component fits within the substrate's foundational role
2. Follow existing architectural patterns
3. Maintain strict dependency boundaries
4. Include comprehensive unit tests
5. Document public interfaces thoroughly

### Maintaining Existing Components
1. Preserve backward compatibility for public interfaces
2. Follow semantic versioning principles
3. Update documentation when making changes
4. Ensure all tests pass before merging

## Versioning & Release Strategy

The 0-substrate follows semantic versioning (semver):
- Major versions: Breaking changes to public interfaces
- Minor versions: New features maintaining backward compatibility
- Patch versions: Bug fixes and performance improvements

## Future Evolution

Planned enhancements for the substrate layer include:
- Enhanced type safety with additional compile-time guarantees
- Improved performance through algorithmic optimizations
- Additional protocol support for emerging use cases
- Expanded SDK coverage for client-side integration
