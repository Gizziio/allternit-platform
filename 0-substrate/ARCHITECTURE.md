# 0-substrate Architecture

## Overview

The 0-substrate layer serves as the foundational infrastructure for the A2R platform. This layer provides essential primitives, protocols, and type definitions that are consumed by all higher layers (1-kernel, 2-governance, 3-adapters, etc.). The substrate layer enforces strict architectural boundaries to maintain system integrity and prevent cross-layer contamination.

## Component Architecture

### Rust Crates

#### `a2r-substrate`
- **Location**: `0-substrate/a2r-substrate/`
- **Purpose**: Core runtime and helper utilities
- **Components**:
  - ProcessResult: Standardized process execution results
  - ToolRequest/ToolResponse: Standardized tool invocation patterns
  - PolicyContext: Security and policy evaluation contexts
- **Dependencies**: serde, serde_json
- **Exported Types**: ProcessResult, ToolRequest, ToolResponse, PolicyContext
- **Usage Flow**: 
  1. Higher layers import these types for standardized communication
  2. Used in kernel for process management
  3. Referenced in governance for policy contexts

#### `a2r-intent-graph-kernel`
- **Location**: `0-substrate/a2r-intent-graph-kernel/`
- **Purpose**: Persistent, queryable graph of intent nodes and edges
- **Components**:
  - Node: Represents intents, tasks, goals, decisions, plans, artifacts, memories
  - Edge: Represents relationships between nodes (DependsOn, Blocks, PartOf, etc.)
  - Event: Represents state mutations with provenance tracking
  - Storage layer: Persistent storage abstraction
  - Query layer: Graph traversal and querying capabilities
- **Dependencies**: serde, sqlx, tokio, axum, tracing, uuid, chrono
- **Exported Types**: Node, Edge, Event, SourceRef, NodeType, EdgeType, NodeStatus
- **Usage Flow**:
  1. Kernel layer creates nodes for tasks and processes
  2. Governance layer queries graph for policy decisions
  3. Adapters use graph for provenance tracking
  4. Services use graph for orchestration

#### `a2r-presentation-kernel`
- **Location**: `0-substrate/a2r-presentation-kernel/`
- **Purpose**: Presentation helpers for orchestrator UI
- **Components**:
  - IntentTokenizer: Parses and categorizes intent tokens
  - SituationResolver: Resolves contextual situations for UI presentation
  - CanvasProtocol: Communication and rendering protocol for canvas-based UIs
  - Layout strategies and interaction specifications
- **Dependencies**: serde, uuid, chrono, axum, tracing, tokio
- **Exported Types**: CanvasSpec, ViewSpec, LayoutStrategy, InteractionSpec
- **Usage Flow**:
  1. UI layer requests canvas rendering via CanvasProtocol
  2. CanvasProtocol applies layout strategies and interaction specs
  3. Generated HTML is sent to client for rendering
  4. User interactions are processed through the kernel

#### `a2r-agent-system-rails`
- **Location**: `0-substrate/a2r-agent-system-rails/`
- **Purpose**: Agent system infrastructure and utilities
- **Components**:
  - Agent lifecycle management
  - System integration utilities
  - Rail-based execution patterns
- **Dependencies**: Internal substrate components
- **Exported Types**: AgentState, RailSpecification, SystemContext
- **Usage Flow**:
  1. Kernel initializes agent rails for new agents
  2. Rails provide execution context and utilities
  3. Agents use rails for system integration
  4. Lifecycle events are propagated to governance

#### `a2r-embodiment`
- **Location**: `0-substrate/a2r-embodiment/`
- **Purpose**: Agent embodiment and presence systems
- **Components**:
  - Agent identity and presence management
  - Embodiment protocols and representations
- **Dependencies**: Internal substrate components
- **Exported Types**: EmbodimentSpec, PresenceState, IdentityToken
- **Usage Flow**:
  1. Agents request embodiment through embodiment system
  2. Embodiment provides identity and presence context
  3. UI renders agent presence based on embodiment
  4. Governance tracks agent activities via embodiment

#### `a2r-canvas-protocol`
- **Location**: `0-substrate/protocols/a2r-canvas-protocol/`
- **Purpose**: Canvas execution metadata and serialization protocols
- **Components**:
  - Canvas specification serialization
  - Execution metadata handling
  - Protocol versioning and validation
- **Dependencies**: serde, uuid, chrono
- **Exported Types**: CanvasSpec, CanvasUpdate, CanvasChange, CanvasState
- **Usage Flow**:
  1. UI requests canvas creation with CanvasSpec
  2. Protocol validates and stores canvas state
  3. Updates are applied through CanvasUpdate mechanism
  4. Clients receive state changes for rendering

### Type Definitions

#### `types/` Directory
- **Location**: `0-substrate/types/`
- **Purpose**: Shared TypeScript interfaces ensuring type safety
- **Components**:
  - `capsule-spec.ts`: Capsule specification types and interfaces
  - `a2ui-types.ts`: A2UI payload and component definitions
- **Exported Types**: CapsuleSpec, A2UIPayload, ComponentNode, IntentToken, EvidenceObject
- **Usage Flow**:
  1. Frontend imports types for type safety
  2. Backend generates corresponding Rust types
  3. API contracts validated against these types
  4. IDEs provide autocompletion based on these types

#### `types/a2ui_types/` Directory
- **Location**: `0-substrate/types/a2ui_types/`
- **Purpose**: A2UI-specific type definitions
- **Components**:
  - Component definitions (Container, Card, Text, Button, etc.)
  - Layout and styling properties
  - Event handling interfaces
- **Exported Types**: ComponentNode, A2UISurface, A2UIPayload
- **Usage Flow**:
  1. UI components implement these interfaces
  2. Canvas protocol uses these types for rendering
  3. Frontend validates UI specs against these types

### Configuration Systems

#### `configs/` Directory
- **Location**: `0-substrate/configs/`
- **Purpose**: Shared configuration schemas and defaults
- **Components**:
  - Default configuration values
  - Configuration schema definitions
  - Environment-specific overrides
- **Usage Flow**:
  1. Higher layers import default configurations
  2. Environment-specific values override defaults
  3. Configuration validation occurs at startup
  4. Runtime configuration changes are propagated

### Protocol Definitions

#### `protocols/` Directory
- **Location**: `0-substrate/protocols/`
- **Purpose**: Standardized communication patterns
- **Components**:
  - `a2r-canvas-protocol/`: Canvas communication protocols
  - Protocol versioning mechanisms
  - Message serialization formats
- **Usage Flow**:
  1. Services negotiate protocol versions
  2. Messages are serialized according to protocol
  3. Communication channels validate protocol compliance
  4. Protocol updates are handled gracefully

### Schema Definitions

#### `schemas/` Directory
- **Location**: `0-substrate/schemas/`
- **Purpose**: Shared data structure definitions and validation schemas
- **Components**:
  - JSON Schema definitions
  - Validation rules
  - Example data structures
- **Usage Flow**:
  1. Data structures are validated against schemas
  2. API requests validated before processing
  3. Database records validated on write
  4. Schema evolution handled with versioning

### SDK Components

#### `sdk/` Directory
- **Location**: `0-substrate/sdk/`
- **Purpose**: Client-side libraries for substrate interaction
- **Components**:
  - Client libraries for each substrate component
  - Authentication and authorization helpers
  - Connection pooling and retry logic
- **Usage Flow**:
  1. Client applications import SDK
  2. SDK handles substrate communication
  3. Errors and responses are normalized
  4. Telemetry and monitoring are included

### Utility Libraries

#### `utils/` Directory
- **Location**: `0-substrate/utils/`
- **Purpose**: Shared utility functions and algorithms
- **Components**:
  - Data transformation utilities
  - Cryptographic helpers
  - Time and date utilities
  - String and number manipulation
- **Usage Flow**:
  1. Higher layers import utilities as needed
  2. Utilities provide consistent behavior
  3. Common algorithms are centralized
  4. Performance optimizations are shared

### Template System

#### `_templates/` Directory
- **Location**: `0-substrate/_templates/`
- **Purpose**: Code generation templates for substrate components
- **Components**:
  - Component skeleton templates
  - Test template generators
  - Documentation templates
- **Usage Flow**:
  1. Developers use templates for new components
  2. Templates ensure consistency
  3. Code generation reduces boilerplate
  4. Standards are enforced through templates

### Contract Definitions

#### `contracts/` Directory
- **Location**: `0-substrate/contracts/`
- **Purpose**: Interface contracts between layers
- **Components**:
  - `layer-boundary-contracts.ts`: Cross-layer interface definitions
  - Contract validation utilities
  - Mock implementations for testing
- **Usage Flow**:
  1. Layers implement defined contracts
  2. Contract compliance is verified
  3. Breaking changes are detected early
  4. Integration testing uses contracts

### Stub Implementations

#### `stubs/` Directory
- **Location**: `0-substrate/stubs/`
- **Purpose**: Mock implementations for testing and development
- **Components**:
  - Mock implementations of substrate components
  - Test fixtures and data
  - Development environment helpers
- **Usage Flow**:
  1. Tests use stubs for isolation
  2. Development environments use stubs for faster iteration
  3. Integration tests validate against real implementations
  4. Stubs evolve with real implementations

## Data Flow Patterns

### Intent Processing Flow

```
┌─────────────┐    ┌─────────────────────────┐    ┌─────────────────────┐
│   User      │───▶│   UI Layer              │───▶│ Presentation Kernel │
│   Intent    │    │ (A2UI/A2R Shell)      │    │   - Tokenizer       │
└─────────────┘    └─────────────────────────┘    │   - Situation       │
                                                 │     Resolver        │
┌─────────────────────────┐                      └─────────────────────┘
│ 1. User expresses       │                                         │
│    intent through UI    │                                         │
└─────────────────────────┘                                         ▼
┌─────────────────────────┐    ┌─────────────────────┐    ┌─────────────────────┐
│ 2. Intent parsed by     │───▶│ 3. Situation        │───▶│ 4. Intent Graph     │
│    tokenizer           │    │    resolver         │    │    Kernel creates/  │
└─────────────────────────┘    └─────────────────────┘    │    updates nodes    │
                                                          └─────────────────────┘
┌─────────────────────────┐                                         │
│ 5. Kernel schedules     │                                         │
│    actions              │◀────────────────────────────────────────┘
└─────────────────────────┘
┌─────────────────────────┐    ┌─────────────────────┐
│ 6. Governance applies   │───▶│ 7. Adapters execute │
│    policies             │    │    tools            │
└─────────────────────────┘    └─────────────────────┘
                                        │
                                        ▼
                       ┌─────────────────────────┐
                       │ 8. Results update the   │
                       │    intent graph         │
                       └─────────────────────────┘
```

### Canvas Rendering Flow

```
┌─────────────┐    ┌─────────────────────────┐    ┌─────────────────────┐
│   UI        │───▶│ Presentation Kernel     │───▶│ Canvas Protocol     │
│   Request   │    │   - Layout Strategy    │    │   - Validation      │
└─────────────┘    │   - Interaction Spec   │    │   - Processing      │
                   └─────────────────────────┘    └─────────────────────┘
                          │                               │
                          ▼                               ▼
┌─────────────────────────┐                      ┌─────────────────────┐
│ 1. UI requests canvas   │                      │ 2. Protocol selects │
│    with specific spec   │                      │    layout strategy  │
└─────────────────────────┘                      └─────────────────────┘
┌─────────────────────────┐    ┌─────────────────────┐    ┌─────────────────────┐
│ 3. Protocol validates   │───▶│ 4. Registered       │───▶│ 5. Combined HTML    │
│    and processes spec   │    │    renderers        │    │    sent to client   │
└─────────────────────────┘    │    render views     │    └─────────────────────┘
                               └─────────────────────┘
                                      │
                                      ▼
                       ┌─────────────────────────┐
                       │ 6. Client renders       │
                       │    canvas & handles     │
                       │    interactions         │
                       └─────────────────────────┘
                              │
                              ▼
                   ┌─────────────────────────┐
                   │ 7. Interaction events   │
                   │    sent back to         │
                   │    protocol             │
                   └─────────────────────────┘
                              │
                              ▼
                   ┌─────────────────────────┐
                   │ 8. Canvas state updated │
                   │    and propagated       │
                   └─────────────────────────┘
```

### Policy Enforcement Flow

```
┌─────────────┐    ┌─────────────────────────┐    ┌─────────────────────┐
│ Agent/User  │───▶│ Substrate Layer         │───▶│ Governance Layer    │
│ Action      │    │   - Policy Context     │    │   - Policy Rules    │
│ Request     │    │   - Request Data       │    │   - Evaluation      │
└─────────────┘    └─────────────────────────┘    └─────────────────────┘
       │                     │                             │
       │                     ▼                             ▼
       │        ┌─────────────────────────┐    ┌─────────────────────┐
       │        │ 1. Request includes     │───▶│ 2. Evaluate against │
       │        │    policy context       │    │    policy rules     │
       │        └─────────────────────────┘    └─────────────────────┘
       │                                               │
       ▼                                               ▼
┌─────────────────────────┐                    ┌─────────────────────┐
│ 3. Action proceeds      │◀───────────────────│ 4. Decision recorded│
│    based on policy     │                    │    in receipt system│
│    decision           │                    └─────────────────────┘
└─────────────────────────┘                             │
       │                                                │
       ▼                                                ▼
┌─────────────────────────┐                    ┌─────────────────────┐
│ 5. Provenance recorded│                    │ 6. Audit trail      │
│    in intent graph    │                    │    maintained       │
└─────────────────────────┘                    └─────────────────────┘
```

### Layer Integration Flow

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Layer 4       │    │   Layer 3       │    │   Layer 2       │
│   Services      │    │   Adapters      │    │   Governance    │
└─────────────────┘    └─────────────────┘    └─────────────────┘
        │                       │                       │
        │               ┌───────┴───────┐               │
        │               │  Protocol &   │               │
        │               │ Type Exchange │               │
        │               └───────┬───────┘               │
        │                       │                       │
        └───────────────────────┼───────────────────────┘
                                │
                   ┌────────────▼────────────┐
                   │   0-Substrate Layer   │
                   │   (Foundation)        │
                   │ - Rust Crates         │
                   │ - Type Definitions    │
                   │ - Protocols           │
                   │ - Utilities           │
                   └───────────────────────┘
                                │
                   ┌────────────▼────────────┐
                   │   Layer 1-Kernel      │
                   │   (Execution Engine)  │
                   └───────────────────────┘
```

## Integration Points

### With Layer 1-Kernel
- Imports substrate types for process management
- Uses intent graph kernel for state tracking
- Leverages presentation kernel for UI rendering
- Access patterns: Direct imports of Rust types and functions

### With Layer 2-Governance
- Consumes policy contexts from substrate
- Uses intent graph for work item tracking
- Integrates with presentation kernel for governance UI
- Access patterns: Function calls and data queries

### With Layer 3-Adapters
- Utilizes substrate protocols for adapter communication
- Leverages canvas protocol for UI presentation
- Uses type definitions for consistent data exchange
- Access patterns: Protocol interfaces and type validation

### With Layer 4-Services
- Provides foundational types for service contracts
- Offers persistence mechanisms through intent graph
- Supplies configuration defaults
- Access patterns: Library imports and API calls

## Quality Assurance

### Testing Strategy
- Unit tests for all substrate components
- Integration tests validating layer boundaries
- Performance tests for critical paths
- Fuzz tests for input validation
- Contract tests ensuring interface compliance

### Monitoring & Observability
- Structured logging with correlation IDs
- Performance metrics for all operations
- Error rate tracking by component
- Resource utilization monitoring
- Dependency health checks

## Security Considerations

### Input Validation
- All external inputs are validated against schemas
- Sanitization occurs at layer boundaries
- Injection attacks are prevented through type safety

### Access Control
- Components operate with minimal required privileges
- Authentication and authorization at protocol level
- Audit trails for all significant operations

### Data Integrity
- Immutable data structures where possible
- Cryptographic hashing for provenance
- Consistency checks for graph integrity

## Performance Characteristics

### Latency Targets
- Substrate operations: <1ms for simple operations
- Graph queries: <10ms for common operations
- Canvas rendering: <50ms for typical canvases

### Throughput Targets
- Intent processing: 10,000 ops/sec
- Graph updates: 5,000 ops/sec
- Canvas rendering: 1,000 ops/sec

### Resource Usage
- Memory footprint: <100MB baseline
- CPU usage: <10% under normal load
- Disk usage: Efficient storage with compression
