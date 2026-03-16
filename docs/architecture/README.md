# 4-services: Platform Services Layer

The `4-services` layer serves as the platform services layer for the A2R platform. This layer contains long-running daemons including gateways, memory services, platform orchestration, observation systems, and other background tasks. These services implement APIs consumed by UIs and the kernel, providing the backbone for the entire platform's functionality.

## Purpose & Mission

The 4-services layer is designed to provide:

- **Long-Running Daemons**: Persistent services that support platform operations
- **API Implementation**: APIs consumed by UIs, kernel, and other services
- **Platform Orchestration**: Coordination and management of platform components
- **Observation & Memory**: State management, history tracking, and memory systems
- **AI Services**: ML and AI-powered services for advanced capabilities
- **Gateway Services**: Entry points and communication interfaces

## Core Components

### Memory Services

#### `memory/`
- **Purpose**: Observation, state history, decay, and memory agents
- **Location**: `4-services/memory/`
- **Key Sub-components**:
  - `observation/`: Observation and monitoring systems
  - `state/`: State management and persistence
  - `src/`: Core memory service implementation
- **Key Features**:
  - Working memory storage
  - Episodic memory (conversation history)
  - Knowledge memory (facts, entities)
  - Context aggregation and slicing
  - Memory decay and retention policies
- **Dependencies**: Substrate types, governance policies
- **Exported Types**: MemoryState, Observation, EntityState

#### `memory/observation/`
- **Purpose**: Observation and monitoring systems
- **Key Features**:
  - Event observation and tracking
  - State change monitoring
  - Activity logging
  - Performance metrics collection
- **Dependencies**: Core memory services
- **Exported Types**: ObservationEvent, ActivityLog, MetricRecord

#### `memory/state/`
- **Purpose**: State management and persistence
- **Key Features**:
  - Persistent state storage
  - State serialization/deserialization
  - State versioning and migration
  - State validation and integrity checks
- **Dependencies**: Core memory services
- **Exported Types**: StateSnapshot, StateVersion, PersistenceLayer

### Gateway Services

#### `gateway/`
- **Purpose**: Public entry point and API gateway for the platform
- **Location**: `4-services/gateway/`
- **Key Features**:
  - SSL/TLS termination
  - JWT/API Key authentication
  - Rate limiting (120 requests/minute default)
  - Request routing
  - CORS handling
  - Audit logging
- **Dependencies**: All other services
- **Exported Types**: GatewayRequest, GatewayResponse, AuthToken

### Orchestration Services

#### `orchestration/`
- **Purpose**: Platform orchestration and coordination services
- **Location**: `4-services/orchestration/`
- **Key Sub-components**:
  - `kernel-service/`: Tool execution and brain session management
  - `platform-orchestration-service/`: Platform-wide orchestration
  - `router-service/`: Request routing and load balancing
- **Key Features**:
  - Service coordination
  - Request routing and load balancing
  - Platform-wide orchestration
  - Session management
- **Dependencies**: Kernel, registry, memory services
- **Exported Types**: OrchestrationPlan, ServiceCoordination, SessionContext

#### `orchestration/kernel-service/`
- **Purpose**: Tool execution and brain session management
- **Key Features**:
  - Brain session lifecycle management
  - Tool execution orchestration
  - Agent runtime management
  - Session compression and forking
- **Dependencies**: Memory, registry, policy services
- **Exported Types**: BrainSession, ToolExecution, AgentRuntime

#### `orchestration/platform-orchestration-service/`
- **Purpose**: Platform-wide orchestration
- **Key Features**:
  - Cross-service coordination
  - Platform-wide workflow management
  - Resource allocation and scheduling
  - Service health monitoring
- **Dependencies**: All platform services
- **Exported Types**: PlatformWorkflow, ResourceAllocation, ServiceHealth

#### `orchestration/router-service/`
- **Purpose**: Request routing and load balancing
- **Key Features**:
  - Intelligent request routing
  - Load balancing across services
  - Traffic management
  - Failover and redundancy
- **Dependencies**: All platform services
- **Exported Types**: Route, LoadBalancer, TrafficRule

### Registry Services

#### `registry/`
- **Purpose**: Agent, skill, and tool definition management
- **Location**: `4-services/registry/`
- **Key Sub-components**:
  - `apps-registry/`: Application registry
  - `framework-registry/`: Framework registry
  - `functions-registry/`: Functions registry
  - `server-registry/`: Server registry
- **Key Features**:
  - Agent registration and discovery
  - Skill catalog management
  - Tool definitions and schemas
  - Framework registry
- **Dependencies**: Substrate types, governance policies
- **Exported Types**: Registration, Discovery, CatalogEntry

#### `registry/apps-registry/`
- **Purpose**: Application registry
- **Key Features**:
  - Application registration and discovery
  - Application metadata management
  - Version management
  - Capability registration
- **Dependencies**: Core registry services
- **Exported Types**: AppRegistration, AppMetadata, AppVersion

#### `registry/framework-registry/`
- **Purpose**: Framework registry
- **Key Features**:
  - Framework registration and discovery
  - Framework compatibility management
  - Framework versioning
  - Framework capability tracking
- **Dependencies**: Core registry services
- **Exported Types**: FrameworkRegistration, FrameworkSpec, FrameworkVersion

#### `registry/functions-registry/`
- **Purpose**: Functions registry
- **Key Features**:
  - Function registration and discovery
  - Function schema management
  - Function execution metadata
  - Function capability tracking
- **Dependencies**: Core registry services
- **Exported Types**: FunctionRegistration, FunctionSchema, FunctionMetadata

#### `registry/server-registry/`
- **Purpose**: Server registry
- **Key Features**:
  - Server registration and discovery
  - Server capability management
  - Server health tracking
  - Server load balancing
- **Dependencies**: Core registry services
- **Exported Types**: ServerRegistration, ServerCapability, ServerHealth

### ML/AI Services

#### `ml-ai-services/`
- **Purpose**: ML and AI-powered services
- **Location**: `4-services/ml-ai-services/`
- **Key Sub-components**:
  - `voice-service/`: Text-to-speech and voice cloning
  - `pattern-service/`: Pattern recognition and analysis
  - `prompt-pack-service/`: Prompt management and optimization
- **Key Features**:
  - AI-powered capabilities
  - Machine learning model serving
  - Pattern recognition
  - Voice synthesis and cloning
- **Dependencies**: Substrate types, external AI models
- **Exported Types**: AIService, ModelResponse, RecognitionResult

#### `ml-ai-services/voice-service/`
- **Purpose**: Text-to-speech and voice cloning
- **Key Features**:
  - Text-to-speech generation
  - Voice cloning capabilities
  - Audio processing
  - Paralinguistic tag support
- **Dependencies**: Audio processing libraries
- **Exported Types**: TTSRequest, TTSResponse, VoiceModel

#### `ml-ai-services/pattern-service/`
- **Purpose**: Pattern recognition and analysis
- **Key Features**:
  - Pattern recognition algorithms
  - Data analysis capabilities
  - Anomaly detection
  - Trend identification
- **Dependencies**: ML libraries and models
- **Exported Types**: Pattern, AnalysisResult, AnomalyDetection

#### `ml-ai-services/prompt-pack-service/`
- **Purpose**: Prompt management and optimization
- **Key Features**:
  - Prompt template management
  - Prompt optimization
  - Prompt versioning
  - Prompt performance tracking
- **Dependencies**: ML libraries and models
- **Exported Types**: PromptTemplate, PromptOptimization, PromptPerformance

### Operator Services

#### `a2r-operator/`
- **Purpose**: Browser automation, computer-use, desktop automation, and parallel execution
- **Location**: `4-services/a2r-operator/`
- **Key Features**:
  - Browser automation capabilities
  - Computer-use with vision-based control
  - Desktop automation
  - Parallel execution of tasks
- **Dependencies**: Browser engines, vision models
- **Exported Types**: OperatorTask, AutomationResult, ParallelRun

### Infrastructure Services

#### `infrastructure/`
- **Purpose**: Infrastructure and platform support services
- **Location**: `4-services/infrastructure/`
- **Key Features**:
  - Platform monitoring
  - Infrastructure management
  - Deployment and scaling
  - Health checks and maintenance
- **Dependencies**: Platform services
- **Exported Types**: InfrastructureService, PlatformHealth, DeploymentPlan

### Runtime Services

#### `runtime/`
- **Purpose**: Runtime environment and execution services
- **Location**: `4-services/runtime/`
- **Key Features**:
  - Runtime environment management
  - Execution context provision
  - Resource allocation
  - Runtime lifecycle management
- **Dependencies**: Kernel services
- **Exported Types**: RuntimeEnvironment, ExecutionContext, ResourceAllocation

### Support Systems

#### `stubs/`
- **Purpose**: Mock implementations for testing and development
- **Location**: `4-services/stubs/`
- **Key Features**:
  - Mock service implementations
  - Test service configurations
  - Development environment helpers
  - Integration test fixtures
- **Dependencies**: None (for testing)
- **Exported Types**: MockService, TestService, DevStub

## Architectural Principles

### Service-Oriented Architecture
- Each service has a single, well-defined responsibility
- Services communicate through well-defined APIs
- Loose coupling between services
- High cohesion within services

### Resilience & Reliability
- Services are designed to be fault-tolerant
- Graceful degradation when dependencies fail
- Circuit breaker patterns for external dependencies
- Retry mechanisms with exponential backoff

### Scalability
- Services designed for horizontal scaling
- Stateless where possible
- Efficient resource utilization
- Load balancing capabilities

### Observability
- Comprehensive logging and monitoring
- Performance metrics collection
- Health check endpoints
- Distributed tracing capabilities

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

### Monitoring & Observability
- Structured logging with correlation IDs
- Performance metrics for all services
- Error rate tracking by service
- Resource utilization monitoring
- Service health and availability metrics

## Development Guidelines

### Adding New Services
1. Ensure the service has a single, well-defined responsibility
2. Follow existing service patterns and interfaces
3. Implement proper error handling and recovery
4. Include comprehensive unit tests
5. Document the service's API and functionality

### Maintaining Existing Services
1. Preserve backward compatibility for public APIs
2. Follow security best practices
3. Update documentation when making changes
4. Ensure all tests pass before merging
5. Monitor service performance and reliability

## Versioning & Release Strategy

The 4-services follows semantic versioning (semver):
- Major versions: Breaking changes to public APIs
- Minor versions: New services or features maintaining backward compatibility
- Patch versions: Bug fixes and security patches

## Future Evolution

Planned enhancements for the services layer include:
- Enhanced microservices architecture with improved scalability
- Advanced AI/ML service capabilities
- Improved service mesh for better communication
- Enhanced observability and monitoring
- Automated service deployment and scaling