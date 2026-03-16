# 4-services Architecture

## Overview

The 4-services layer serves as the platform services layer for the A2R platform. This layer contains long-running daemons including gateways, memory services, platform orchestration, observation systems, and other background tasks. These services implement APIs consumed by UIs and the kernel, providing the backbone for the entire platform's functionality. Every service emits ledger/receipt events and may back the Gate/Vault pipelines referenced in `a2r-agent-system-rails`. Services are focused on networking, resilience, and observability.

## Component Architecture

### Memory Services

#### `memory/`
- **Location**: `4-services/memory/`
- **Purpose**: Observation, state history, decay, and memory agents
- **Sub-components**:
  - `observation/`: Observation and monitoring systems
  - `state/`: State management and persistence
  - `src/`: Core memory service implementation
- **Dependencies**: Substrate types, governance policies
- **Exported Types**: MemoryState, Observation, EntityState
- **Usage Flow**:
  1. Memory requests received from higher layers
  2. State retrieved from persistence layer
  3. Observations tracked and recorded
  4. Memory decay policies applied
  5. Results returned to requesting component

#### `memory/observation/`
- **Location**: `4-services/memory/observation/`
- **Purpose**: Observation and monitoring systems
- **Components**:
  - Event observation and tracking
  - State change monitoring
  - Activity logging
  - Performance metrics collection
- **Dependencies**: Core memory services
- **Exported Types**: ObservationEvent, ActivityLog, MetricRecord
- **Usage Flow**:
  1. Events observed from system activities
  2. Observations processed and categorized
  3. Activity logs created
  4. Metrics collected and aggregated
  5. Reports generated for monitoring

#### `memory/state/`
- **Location**: `4-services/memory/state/`
- **Purpose**: State management and persistence
- **Components**:
  - Persistent state storage
  - State serialization/deserialization
  - State versioning and migration
  - State validation and integrity checks
- **Dependencies**: Core memory services
- **Exported Types**: StateSnapshot, StateVersion, PersistenceLayer
- **Usage Flow**:
  1. State requests received
  2. State serialized for storage
  3. Persistence operations performed
  4. State retrieved and deserialized
  5. State validated and returned

### Gateway Services

#### `gateway/`
- **Location**: `4-services/gateway/`
- **Purpose**: Public entry point and API gateway for the platform
- **Components**:
  - SSL/TLS termination
  - JWT/API Key authentication
  - Rate limiting (120 requests/minute default)
  - Request routing
  - CORS handling
  - Audit logging
- **Dependencies**: All other services
- **Exported Types**: GatewayRequest, GatewayResponse, AuthToken
- **Usage Flow**:
  1. External requests received at gateway
  2. Authentication and authorization performed
  3. Rate limiting applied
  4. Requests routed to appropriate services
  5. Responses returned to clients
  6. Audit logs created for all transactions

### Orchestration Services

#### `orchestration/`
- **Location**: `4-services/orchestration/`
- **Purpose**: Platform orchestration and coordination services
- **Sub-components**:
  - `kernel-service/`: Tool execution and brain session management
  - `platform-orchestration-service/`: Platform-wide orchestration
  - `router-service/`: Request routing and load balancing
- **Dependencies**: Kernel, registry, memory services
- **Exported Types**: OrchestrationPlan, ServiceCoordination, SessionContext
- **Usage Flow**:
  1. Orchestration requests received
  2. Plans created and validated
  3. Services coordinated
  4. Sessions managed
  5. Results aggregated and returned

#### `orchestration/kernel-service/`
- **Location**: `4-services/orchestration/kernel-service/`
- **Purpose**: Tool execution and brain session management
- **Components**:
  - Brain session lifecycle management
  - Tool execution orchestration
  - Agent runtime management
  - Session compression and forking
- **Dependencies**: Memory, registry, policy services
- **Exported Types**: BrainSession, ToolExecution, AgentRuntime
- **Usage Flow**:
  1. Brain session requests received
  2. Session initialized and managed
  3. Tool execution orchestrated
  4. Agent runtime managed
  5. Sessions compressed or forked as needed

#### `orchestration/platform-orchestration-service/`
- **Location**: `4-services/orchestration/platform-orchestration-service/`
- **Purpose**: Platform-wide orchestration
- **Components**:
  - Cross-service coordination
  - Platform-wide workflow management
  - Resource allocation and scheduling
  - Service health monitoring
- **Dependencies**: All platform services
- **Exported Types**: PlatformWorkflow, ResourceAllocation, ServiceHealth
- **Usage Flow**:
  1. Platform-wide requests received
  2. Cross-service coordination initiated
  3. Workflows managed across services
  4. Resources allocated and scheduled
  5. Service health monitored continuously

#### `orchestration/router-service/`
- **Location**: `4-services/orchestration/router-service/`
- **Purpose**: Request routing and load balancing
- **Components**:
  - Intelligent request routing
  - Load balancing across services
  - Traffic management
  - Failover and redundancy
- **Dependencies**: All platform services
- **Exported Types**: Route, LoadBalancer, TrafficRule
- **Usage Flow**:
  1. Requests received at router
  2. Routing rules applied
  3. Load balancing performed
  4. Requests forwarded to appropriate services
  5. Failover handled if needed

### Registry Services

#### `registry/`
- **Location**: `4-services/registry/`
- **Purpose**: Agent, skill, and tool definition management
- **Sub-components**:
  - `apps-registry/`: Application registry
  - `framework-registry/`: Framework registry
  - `functions-registry/`: Functions registry
  - `server-registry/`: Server registry
- **Dependencies**: Substrate types, governance policies
- **Exported Types**: Registration, Discovery, CatalogEntry
- **Usage Flow**:
  1. Registration requests received
  2. Entities registered in appropriate registries
  3. Discovery requests processed
  4. Catalogs maintained and updated
  5. Registrations returned to requesting components

#### `registry/apps-registry/`
- **Location**: `4-services/registry/apps-registry/`
- **Purpose**: Application registry
- **Components**:
  - Application registration and discovery
  - Application metadata management
  - Version management
  - Capability registration
- **Dependencies**: Core registry services
- **Exported Types**: AppRegistration, AppMetadata, AppVersion
- **Usage Flow**:
  1. Application registration requests received
  2. Metadata stored and indexed
  3. Versions tracked and managed
  4. Capabilities registered
  5. Discovery requests fulfilled

#### `registry/framework-registry/`
- **Location**: `4-services/registry/framework-registry/`
- **Purpose**: Framework registry
- **Components**:
  - Framework registration and discovery
  - Framework compatibility management
  - Framework versioning
  - Framework capability tracking
- **Dependencies**: Core registry services
- **Exported Types**: FrameworkRegistration, FrameworkSpec, FrameworkVersion
- **Usage Flow**:
  1. Framework registration requests received
  2. Compatibility verified
  3. Versions managed
  4. Capabilities tracked
  5. Discovery requests processed

#### `registry/functions-registry/`
- **Location**: `4-services/registry/functions-registry/`
- **Purpose**: Functions registry
- **Components**:
  - Function registration and discovery
  - Function schema management
  - Function execution metadata
  - Function capability tracking
- **Dependencies**: Core registry services
- **Exported Types**: FunctionRegistration, FunctionSchema, FunctionMetadata
- **Usage Flow**:
  1. Function registration requests received
  2. Schemas validated and stored
  3. Execution metadata recorded
  4. Capabilities tracked
  5. Discovery requests fulfilled

#### `registry/server-registry/`
- **Location**: `4-services/registry/server-registry/`
- **Purpose**: Server registry
- **Components**:
  - Server registration and discovery
  - Server capability management
  - Server health tracking
  - Server load balancing
- **Dependencies**: Core registry services
- **Exported Types**: ServerRegistration, ServerCapability, ServerHealth
- **Usage Flow**:
  1. Server registration requests received
  2. Capabilities registered
  3. Health monitored continuously
  4. Load balancing information updated
  5. Discovery requests processed

### ML/AI Services

#### `ml-ai-services/`
- **Location**: `4-services/ml-ai-services/`
- **Purpose**: ML and AI-powered services
- **Sub-components**:
  - `voice-service/`: Text-to-speech and voice cloning
  - `pattern-service/`: Pattern recognition and analysis
  - `prompt-pack-service/`: Prompt management and optimization
- **Dependencies**: Substrate types, external AI models
- **Exported Types**: AIService, ModelResponse, RecognitionResult
- **Usage Flow**:
  1. AI service requests received
  2. Appropriate AI model selected
  3. Request processed by AI model
  4. Results formatted and returned
  5. Performance metrics collected

#### `ml-ai-services/voice-service/`
- **Location**: `4-services/ml-ai-services/voice-service/`
- **Purpose**: Text-to-speech and voice cloning
- **Components**:
  - Text-to-speech generation
  - Voice cloning capabilities
  - Audio processing
  - Paralinguistic tag support
- **Dependencies**: Audio processing libraries
- **Exported Types**: TTSRequest, TTSResponse, VoiceModel
- **Usage Flow**:
  1. TTS requests received
  2. Text processed for speech synthesis
  3. Voice models applied
  4. Audio generated and processed
  5. Audio returned to requesting component

#### `ml-ai-services/pattern-service/`
- **Location**: `4-services/ml-ai-services/pattern-service/`
- **Purpose**: Pattern recognition and analysis
- **Components**:
  - Pattern recognition algorithms
  - Data analysis capabilities
  - Anomaly detection
  - Trend identification
- **Dependencies**: ML libraries and models
- **Exported Types**: Pattern, AnalysisResult, AnomalyDetection
- **Usage Flow**:
  1. Pattern analysis requests received
  2. Data analyzed for patterns
  3. Anomalies detected
  4. Trends identified
  5. Results returned to requesting component

#### `ml-ai-services/prompt-pack-service/`
- **Location**: `4-services/ml-ai-services/prompt-pack-service/`
- **Purpose**: Prompt management and optimization
- **Components**:
  - Prompt template management
  - Prompt optimization
  - Prompt versioning
  - Prompt performance tracking
- **Dependencies**: ML libraries and models
- **Exported Types**: PromptTemplate, PromptOptimization, PromptPerformance
- **Usage Flow**:
  1. Prompt requests received
  2. Appropriate templates selected
  3. Prompts optimized for performance
  4. Versions managed
  5. Performance tracked and reported

### Operator Services

#### `a2r-operator/`
- **Location**: `4-services/a2r-operator/`
- **Purpose**: Browser automation, computer-use, desktop automation, and parallel execution
- **Components**:
  - Browser automation capabilities
  - Computer-use with vision-based control
  - Desktop automation
  - Parallel execution of tasks
- **Dependencies**: Browser engines, vision models
- **Exported Types**: OperatorTask, AutomationResult, ParallelRun
- **Usage Flow**:
  1. Operator task requests received
  2. Appropriate automation mode selected
  3. Tasks executed in selected mode
  4. Results collected and processed
  5. Results returned to requesting component

### Infrastructure Services

#### `infrastructure/`
- **Location**: `4-services/infrastructure/`
- **Purpose**: Infrastructure and platform support services
- **Components**:
  - Platform monitoring
  - Infrastructure management
  - Deployment and scaling
  - Health checks and maintenance
- **Dependencies**: Platform services
- **Exported Types**: InfrastructureService, PlatformHealth, DeploymentPlan
- **Usage Flow**:
  1. Infrastructure requests received
  2. Monitoring performed
  3. Deployments managed
  4. Scaling operations executed
  5. Health checks performed

### Runtime Services

#### `runtime/`
- **Location**: `4-services/runtime/`
- **Purpose**: Runtime environment and execution services
- **Components**:
  - Runtime environment management
  - Execution context provision
  - Resource allocation
  - Runtime lifecycle management
- **Dependencies**: Kernel services
- **Exported Types**: RuntimeEnvironment, ExecutionContext, ResourceAllocation
- **Usage Flow**:
  1. Runtime requests received
  2. Environment prepared and configured
  3. Execution context established
  4. Resources allocated
  5. Runtime lifecycle managed

### Support Systems

#### `stubs/`
- **Location**: `4-services/stubs/`
- **Purpose**: Mock implementations for testing and development
- **Components**:
  - Mock service implementations
  - Test service configurations
  - Development environment helpers
  - Integration test fixtures
- **Dependencies**: None (for testing)
- **Exported Types**: MockService, TestService, DevStub
- **Usage Flow**:
  1. Test environment initialized
  2. Mock services loaded
  3. Test scenarios executed
  4. Results validated
  5. Real services tested against mocks

## Data Flow Patterns

### Service Request Flow

```
┌─────────────┐    ┌─────────────────────────┐    ┌─────────────────────┐
│ External    │───▶│ Gateway Service       │───▶│ Target Service      │
│ Request     │    │ (4-services/gateway/) │    │ (memory, registry,  │
└─────────────┘    └─────────────────────────┘    │  orchestration, etc.)│
       │                       │                   └─────────────────────┘
       │                       ▼
       │        ┌─────────────────────────┐
       │        │ 1. Request received   │
       │        │    at gateway         │
       │        └─────────────────────────┘
       │                       │
       │                       ▼
       │        ┌─────────────────────────┐
       │        │ 2. Authentication &   │
       │        │    authorization      │
       │        └─────────────────────────┘
       │                       │
       │                       ▼
       │        ┌─────────────────────────┐
       │        │ 3. Rate limiting      │
       │        │    applied            │
       │        └─────────────────────────┘
       │                       │
       ▼                       ▼
┌─────────────────────────┐─────────────────────┐
│ 4. Request routed    │                     │
│    to target service │────────────────────▶│ 5. Service processes
└─────────────────────────┘                   │    request
       │                                      └─────────────────────┘
       ▼                                               │
┌─────────────────────────┐                            ▼
│ 6. Response received │                     ┌─────────────────────┐
│    from target       │◀────────────────────│ 6. Request         │
│    service          │                     │    processed       │
└─────────────────────────┘                   └─────────────────────┘
       │
       ▼
┌─────────────────────────┐
│ 7. Response returned │
│    to external client │
└─────────────────────────┘
```

### Memory Service Flow

```
┌─────────────┐    ┌─────────────────────────┐    ┌─────────────────────┐
│ Component   │───▶│ Memory Service        │───▶│ State Persistence   │
│ Request     │    │ (4-services/memory/)  │    │ (database, cache)   │
└─────────────┘    └─────────────────────────┘    └─────────────────────┘
       │                       │                             │
       │                       ▼                             ▼
       │        ┌─────────────────────────┐    ┌─────────────────────┐
       │        │ 1. Memory request     │───▶│ 2. State stored/   │
       │        │    received           │    │    retrieved        │
       │        └─────────────────────────┘    └─────────────────────┘
       │                                               │
       ▼                                               ▼
┌─────────────────────────┐                    ┌─────────────────────┐
│ 3. Observations     │                    │ 4. Memory decay   │
│    tracked          │                    │    policies applied │
└─────────────────────────┘                    └─────────────────────┘
       │                                               │
       ▼                                               ▼
┌─────────────────────────┐                    ┌─────────────────────┐
│ 5. Memory state    │                    │ 6. Processed       │
│    processed        │                    │    results returned │
└─────────────────────────┘                    └─────────────────────┘
       │
       ▼
┌─────────────────────────┐
│ 7. Response to      │
│    requesting comp.   │
└─────────────────────────┘
```

### Orchestration Flow

```
┌─────────────┐    ┌─────────────────────────┐    ┌─────────────────────┐
│ Orchestration│───▶│ Platform Orchestrator │───▶│ Service Coordination│
│ Request     │    │ (platform-orchestration│    │ (multiple services) │
└─────────────┘    │ -service/)            │    └─────────────────────┘
       │           └─────────────────────────┘             │
       │                       │                           │
       │                       ▼                           ▼
       │        ┌─────────────────────────┐    ┌─────────────────────┐
       │        │ 1. Orchestration plan │───▶│ 2. Cross-service   │
       │        │    created            │    │    coordination     │
       │        └─────────────────────────┘    └─────────────────────┘
       │                                               │
       ▼                                               ▼
┌─────────────────────────┐                    ┌─────────────────────┐
│ 3. Resource         │                    │ 4. Workflow       │
│    allocation        │                    │    management       │
└─────────────────────────┘                    └─────────────────────┘
       │                                               │
       ▼                                               ▼
┌─────────────────────────┐                    ┌─────────────────────┐
│ 5. Health monitoring│                    │ 6. Results        │
│    performed         │                    │    aggregated       │
└─────────────────────────┘                    └─────────────────────┘
       │
       ▼
┌─────────────────────────┐
│ 7. Orchestration    │
│    results returned   │
└─────────────────────────┘
```

## Integration Points

### With Layer 0-Substrate
- Imports substrate types for standardized communication
- Uses substrate protocols for inter-service communication
- Leverages substrate security models
- Access patterns: Direct imports of Rust/TS types and functions

### With Layer 1-Kernel
- Provides execution environment for kernel operations
- Receives execution requests from kernel
- Reports execution results to kernel
- Access patterns: Function calls and data exchange

### With Layer 2-Governance
- Provides audit logs for governance tracking
- Enforces governance policies for service operations
- Reports service activities for governance
- Access patterns: Policy interfaces and audit protocols

### With Layer 3-Adapters
- Provides services that adapters connect to
- Receives external requests through adapters
- Responds to adapter-mediated requests
- Access patterns: Adapter interfaces and protocols

## Quality Assurance

### Testing Strategy
- Unit tests for all service components
- Integration tests for service-to-service communication
- Performance tests for service scalability
- Chaos engineering for resilience testing
- Security testing for service vulnerabilities
- Contract tests ensuring interface compliance

### Monitoring & Observability
- Structured logging with correlation IDs
- Performance metrics for all services
- Error rate tracking by service
- Resource utilization monitoring
- Service health and availability metrics
- Distributed tracing for cross-service operations

## Security Considerations

### Service Security
- Authentication and authorization for all service endpoints
- TLS encryption for service-to-service communication
- API key management and rotation
- Rate limiting to prevent abuse
- Input validation for all service requests

### Data Protection
- Encryption for sensitive data in transit
- Secure storage for service configurations
- Data sanitization for service inputs
- Secure disposal of temporary data

### Access Control
- Principle of least privilege for service access
- Role-based access control for service operations
- Audit trails for all service activities
- Permission checks for all service operations

## Performance Characteristics

### Latency Targets
- Gateway processing: <10ms for authenticated requests
- Memory service operations: <50ms for state retrieval
- Registry lookups: <20ms for cached entries
- Orchestration operations: <100ms for simple workflows

### Throughput Targets
- Concurrent connections: 10,000+ simultaneous
- Gateway requests: 5,000 ops/sec
- Memory operations: 10,000 ops/sec
- Registry operations: 2,000 ops/sec

### Resource Usage
- Memory footprint: <500MB per service (average)
- CPU usage: <25% under normal load
- Network usage: Optimized with connection pooling