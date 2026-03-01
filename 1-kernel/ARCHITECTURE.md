# 1-kernel Architecture

## Overview

The 1-kernel layer serves as the execution engine for the A2R platform. This layer manages schedulers, runtimes, tooling gateways, and security contracts that drive actual agent work. It owns process management, tool adapters, and policy enforcement surfaces that feed the governance surfaces above.

## Component Architecture

### Kernel Core Systems

#### `a2r-kernel/`
- **Location**: `1-kernel/a2r-kernel/`
- **Purpose**: Core kernel functionality and runtime systems
- **Sub-components**:
  - `kernel-compat/`: Kernel compatibility layer for cross-platform support
  - `kernel-contracts/`: Interface contracts and API definitions
  - `runtime-execution-core/`: Core execution runtime logic
  - `runtime-local-executor/`: Local execution environment
  - `tools-gateway/`: Gateway for external tool integration
  - `wasm-runtime/`: WebAssembly runtime for sandboxed execution
- **Dependencies**: Layer 0-Substrate types and protocols
- **Exported Types**: ExecutionRequest, ExecutionResult, ToolInvocation, ResourceLimits
- **Usage Flow**:
  1. Kernel receives execution requests from higher layers
  2. Requests validated against substrate types
  3. Resources allocated based on request requirements
  4. Execution performed in appropriate runtime
  5. Results returned to requesting layer

#### `a2r-kernel/kernel-contracts/`
- **Location**: `1-kernel/a2r-kernel/kernel-contracts/`
- **Purpose**: Standardized contracts and interfaces for kernel operations
- **Components**:
  - ExecutionRequest/ExecutionResult: Standardized execution contracts
  - ToolInvocation: Standardized tool calling patterns
  - ResourceManagement: Resource allocation and tracking contracts
- **Dependencies**: Substrate types
- **Exported Types**: ExecutionRequest, ExecutionResult, ResourceLimits, ToolInvocation
- **Usage Flow**:
  1. Higher layers create ExecutionRequest using contract types
  2. Kernel validates request against contracts
  3. Execution performed according to contract specifications
  4. ExecutionResult returned following contract format

#### `a2r-kernel/runtime-execution-core/`
- **Location**: `1-kernel/a2r-kernel/runtime-execution-core/`
- **Purpose**: Core execution logic for agent runtimes
- **Components**:
  - Process lifecycle management
  - Resource allocation and monitoring
  - Execution context management
  - Error handling and recovery
- **Dependencies**: kernel-contracts, substrate types
- **Exported Types**: ExecutionContext, ProcessHandle, ExecutionMetrics
- **Usage Flow**:
  1. Execution requests received from API layer
  2. Execution context initialized
  3. Process launched with appropriate resources
  4. Execution monitored and metrics collected
  5. Results and metrics returned

#### `a2r-kernel/tools-gateway/`
- **Location**: `1-kernel/a2r-kernel/tools-gateway/`
- **Purpose**: Gateway for connecting to external tools and services
- **Components**:
  - Tool registration and discovery
  - API abstraction for different tool types
  - Security and access controls
  - Execution result standardization
- **Dependencies**: kernel-contracts, substrate types
- **Exported Types**: ToolRegistration, ToolInvocation, ToolResult
- **Usage Flow**:
  1. Tools registered with gateway
  2. Tool invocation requests received
  3. Security checks performed
  4. Tool executed with appropriate parameters
  5. Results standardized and returned

#### `a2r-kernel/wasm-runtime/`
- **Location**: `1-kernel/a2r-kernel/wasm-runtime/`
- **Purpose**: WebAssembly runtime for secure execution
- **Components**:
  - Sandboxed execution environment
  - Resource limitation mechanisms
  - Security isolation protocols
  - Cross-platform compatibility layer
- **Dependencies**: substrate types, kernel-contracts
- **Exported Types**: WasmInstance, WasmModule, ExecutionLimits
- **Usage Flow**:
  1. Wasm module loaded into sandbox
  2. Execution limits applied
  3. Module executed in isolated environment
  4. Results validated and returned
  5. Resources cleaned up

### Execution Systems

#### `execution/a2r-local-compute/`
- **Location**: `1-kernel/execution/a2r-local-compute/`
- **Purpose**: Local compute execution environment
- **Components**:
  - Local process execution
  - Resource management
  - Isolated execution environments
  - Performance monitoring
- **Dependencies**: kernel-contracts, substrate types
- **Exported Types**: ComputeResource, ProcessSpec, ExecutionStats
- **Usage Flow**:
  1. Compute request received
  2. Resources allocated for execution
  3. Process executed in isolated environment
  4. Performance metrics collected
  5. Results and metrics returned

#### `execution/a2r-ops/`
- **Location**: `1-kernel/execution/a2r-ops/`
- **Purpose**: Operations and maintenance utilities for execution systems
- **Components**:
  - System monitoring
  - Performance optimization
  - Resource cleanup
  - Execution diagnostics
- **Dependencies**: execution core components
- **Exported Types**: SystemMetrics, DiagnosticReport, OptimizationPlan
- **Usage Flow**:
  1. System metrics collected continuously
  2. Performance analyzed for optimization
  3. Resource cleanup performed as needed
  4. Diagnostic reports generated
  5. Optimization recommendations applied

### Control Plane Systems

#### `control-plane/a2r-agent-orchestration/`
- **Location**: `1-kernel/control-plane/a2r-agent-orchestration/`
- **Purpose**: Agent orchestration and coordination
- **Components**:
  - Agent lifecycle management
  - Task scheduling and distribution
  - Coordination protocols
  - State synchronization
- **Dependencies**: substrate types, kernel-contracts
- **Exported Types**: AgentState, TaskSchedule, CoordinationMessage
- **Usage Flow**:
  1. Agent registration initiated
  2. Lifecycle state managed
  3. Tasks scheduled and distributed
  4. Coordination messages exchanged
  5. State synchronized across agents

#### `control-plane/a2r-control/`
- **Location**: `1-kernel/control-plane/a2r-control/`
- **Purpose**: Control systems for kernel operations
- **Components**:
  - Execution control interfaces
  - Process management controls
  - Resource allocation controls
  - Security controls
- **Dependencies**: kernel core systems
- **Exported Types**: ControlCommand, ExecutionControl, ResourceControl
- **Usage Flow**:
  1. Control commands received
  2. Execution controls applied
  3. Process management executed
  4. Resource allocation adjusted
  5. Security measures enforced

#### `control-plane/a2r-orchestrator/`
- **Location**: `1-kernel/control-plane/a2r-orchestrator/`
- **Purpose**: Task and workflow orchestration
- **Components**:
  - Workflow execution
  - Task dependency management
  - Execution scheduling
  - Result aggregation
- **Dependencies**: control systems, execution systems
- **Exported Types**: WorkflowSpec, TaskDependency, ExecutionPlan
- **Usage Flow**:
  1. Workflow specification received
  2. Task dependencies analyzed
  3. Execution plan created
  4. Tasks scheduled and executed
  5. Results aggregated and returned

#### `control-plane/unified-registry/`
- **Location**: `1-kernel/control-plane/unified-registry/`
- **Purpose**: Unified registry for kernel components
- **Components**:
  - Component registration
  - Discovery mechanisms
  - Configuration management
  - Health monitoring
- **Dependencies**: All kernel subsystems
- **Exported Types**: ComponentRegistration, DiscoveryResult, HealthStatus
- **Usage Flow**:
  1. Components register with registry
  2. Discovery requests processed
  3. Configuration distributed
  4. Health status monitored
  5. Registry updated accordingly

### Capsule Systems

#### `capsule-system/a2r-capsule/`
- **Location**: `1-kernel/capsule-system/a2r-capsule/`
- **Purpose**: Core capsule functionality
- **Components**:
  - Capsule definition and structure
  - Metadata management
  - Lifecycle controls
  - State management
- **Dependencies**: substrate types
- **Exported Types**: CapsuleSpec, CapsuleState, CapsuleMetadata
- **Usage Flow**:
  1. Capsule specification defined
  2. Metadata attached and managed
  3. Lifecycle state controlled
  4. Capsule state managed
  5. Capsule executed in appropriate context

#### `capsule-system/a2r-capsule-compiler/`
- **Location**: `1-kernel/capsule-system/a2r-capsule-compiler/`
- **Purpose**: Capsule compilation system
- **Components**:
  - Capsule compilation pipeline
  - Code generation
  - Optimization passes
  - Validation systems
- **Dependencies**: capsule definitions, substrate types
- **Exported Types**: CompiledCapsule, CompilationResult, OptimizationPass
- **Usage Flow**:
  1. Capsule source received
  2. Compilation pipeline executed
  3. Code generation performed
  4. Optimizations applied
  5. Validation performed
  6. Compiled capsule returned

#### `capsule-system/a2r-capsule-runtime/`
- **Location**: `1-kernel/capsule-system/a2r-capsule-runtime/`
- **Purpose**: Capsule runtime environment
- **Components**:
  - Capsule execution environment
  - Isolation mechanisms
  - Resource management
  - Security controls
- **Dependencies**: capsule definitions, execution systems
- **Exported Types**: CapsuleInstance, RuntimeContext, ExecutionEnvironment
- **Usage Flow**:
  1. Capsule instance created
  2. Execution environment prepared
  3. Capsule executed in isolated context
  4. Resources managed during execution
  5. Security enforced throughout execution
  6. Results returned and resources cleaned up

### Communication Systems

#### `communication/a2r-gateway/`
- **Location**: `1-kernel/communication/a2r-gateway/`
- **Purpose**: Communication gateway for kernel services
- **Components**:
  - Message routing
  - Protocol translation
  - Security enforcement
  - Connection management
- **Dependencies**: substrate protocols, kernel systems
- **Exported Types**: MessageRoute, ProtocolAdapter, ConnectionHandle
- **Usage Flow**:
  1. Messages received at gateway
  2. Routing rules applied
  3. Protocol translation performed
  4. Security checks enforced
  5. Connections managed
  6. Messages forwarded to destination

#### `communication/a2r-transports/`
- **Location**: `1-kernel/communication/a2r-transports/`
- **Purpose**: Transport layer implementations
- **Components**:
  - Multiple transport protocols
  - Connection pooling
  - Message serialization
  - Error handling
- **Dependencies**: communication protocols
- **Exported Types**: TransportProtocol, ConnectionPool, SerializedMessage
- **Usage Flow**:
  1. Transport protocol selected
  2. Connection established
  3. Message serialized
  4. Message transmitted
  5. Errors handled appropriately
  6. Connection returned to pool

#### `communication/kernel-messaging/`
- **Location**: `1-kernel/communication/kernel-messaging/`
- **Purpose**: Kernel-specific messaging systems
- **Components**:
  - Internal kernel communication
  - Event broadcasting
  - Request-response patterns
  - Asynchronous messaging
- **Dependencies**: communication systems
- **Exported Types**: KernelMessage, EventBroadcast, AsyncResponse
- **Usage Flow**:
  1. Kernel messages created
  2. Events broadcast to interested parties
  3. Request-response patterns followed
  4. Asynchronous messaging handled
  5. Communication completed

### Agent Systems

#### `agent-systems/`
- **Location**: `1-kernel/agent-systems/`
- **Purpose**: Agent-specific kernel components
- **Components**:
  - Agent runtime environments
  - Agent lifecycle management
  - Agent-to-kernel interfaces
  - Agent resource management
- **Dependencies**: kernel core systems, substrate types
- **Exported Types**: AgentRuntime, AgentLifecycle, AgentInterface
- **Usage Flow**:
  1. Agent runtime initialized
  2. Lifecycle managed
  3. Interfaces established
  4. Resources allocated and managed
  5. Agent operations coordinated

### Infrastructure Components

#### `infrastructure/`
- **Location**: `1-kernel/infrastructure/`
- **Purpose**: Core infrastructure for kernel operations
- **Components**:
  - System utilities
  - Configuration management
  - Logging and monitoring
  - Error handling frameworks
- **Dependencies**: All kernel components
- **Exported Types**: SystemUtility, ConfigManager, Logger
- **Usage Flow**:
  1. System utilities initialized
  2. Configuration loaded and managed
  3. Logging performed
  4. Monitoring enabled
  5. Errors handled consistently

### Support Utilities

#### `support/`
- **Location**: `1-kernel/support/`
- **Purpose**: Supporting utilities and helpers
- **Components**:
  - Utility functions
  - Helper classes
  - Common algorithms
  - Testing utilities
- **Dependencies**: Various kernel components
- **Exported Types**: UtilityFunction, HelperClass, Algorithm
- **Usage Flow**:
  1. Utilities imported as needed
  2. Functions applied to problems
  3. Helpers instantiated and used
  4. Algorithms executed
  5. Testing performed

### Tool Integration

#### `tools/`
- **Location**: `1-kernel/tools/`
- **Purpose**: Tool integration and management systems
- **Components**:
  - Tool registration
  - Tool execution management
  - Tool result processing
  - Tool security controls
- **Dependencies**: tools-gateway, kernel-contracts
- **Exported Types**: ToolRegistration, ToolExecution, ToolResult
- **Usage Flow**:
  1. Tools registered with system
  2. Execution requests received
  3. Tools executed securely
  4. Results processed
  5. Security enforced throughout

### OpenCLAW Host

#### `rust/openclaw-host/`
- **Location**: `1-kernel/rust/openclaw-host/`
- **Purpose**: OpenCLAW host implementation
- **Components**:
  - OpenCLAW protocol implementation
  - Host-side operations
  - Device management
  - Performance optimization
- **Dependencies**: substrate protocols
- **Exported Types**: OpenClawSession, DeviceHandle, ProtocolMessage
- **Usage Flow**:
  1. OpenCLAW session established
  2. Devices managed
  3. Protocol messages exchanged
  4. Performance optimized
  5. Session closed cleanly

## Data Flow Patterns

### Execution Request Flow

```
┌─────────────┐    ┌─────────────────────────┐    ┌─────────────────────┐
│ Higher      │───▶│ 1-Kernel API Layer    │───▶│ Execution Core      │
│ Layer       │    │ (a2r-kernel/)         │    │ (runtime-execution- │
│ Request     │    │                       │    │ core/)              │
└─────────────┘    └─────────────────────────┘    └─────────────────────┘
       │                       │                             │
       │                       ▼                             ▼
       │        ┌─────────────────────────┐    ┌─────────────────────┐
       │        │ 1. Request validation │───▶│ 2. Context setup    │
       │        │    against contracts   │    │    and resource     │
       │        └─────────────────────────┘    │    allocation       │
       │                                       └─────────────────────┘
       ▼                                                │
┌─────────────────────────┐                             ▼
│ 3. Execution in        │                    ┌─────────────────────┐
│    appropriate         │◀───────────────────│ 4. Monitor and     │
│    runtime (local,     │                    │    collect metrics  │
│    WASM, etc.)        │                    └─────────────────────┘
└─────────────────────────┘                             │
       │                                                ▼
       ▼                                       ┌─────────────────────┐
┌─────────────────────────┐                    │ 5. Return results   │
│ 6. Validate and        │                    │    to requesting    │
│    standardize         │                    │    layer            │
│    results            │                    └─────────────────────┘
└─────────────────────────┘
       │
       ▼
┌─────────────────────────┐
│ 7. Clean up resources │
│    and finalize       │
└─────────────────────────┘
```

### Tool Invocation Flow

```
┌─────────────┐    ┌─────────────────────────┐    ┌─────────────────────┐
│ Agent/Tool  │───▶│ Tools Gateway         │───▶│ Security & Access   │
│ Request     │    │ (a2r-kernel/tools-   │    │ Control             │
└─────────────┘    │ gateway/)             │    └─────────────────────┘
       │           └─────────────────────────┘             │
       │                   │                              ▼
       │                   ▼                     ┌─────────────────────┐
       │        ┌─────────────────────────┐     │ 2. Security checks  │
       │        │ 1. Tool registration  │─────▶│    and validation   │
       │        │    lookup             │     └─────────────────────┘
       │        └─────────────────────────┘              │
       │                                                ▼
       ▼                                       ┌─────────────────────┐
┌─────────────────────────┐                    │ 3. Execute tool     │
│ 4. Standardize         │                    │    with parameters  │
│    and return         │◀────────────────────│    in secure env    │
│    results            │                     └─────────────────────┘
└─────────────────────────┘                              │
       │                                                 ▼
       ▼                                        ┌─────────────────────┐
┌─────────────────────────┐                     │ 5. Capture results  │
│ 6. Clean up tool      │                     │    and metadata     │
│    execution          │                     └─────────────────────┘
│    resources         │
└─────────────────────────┘
```

### Capsule Execution Flow

```
┌─────────────┐    ┌─────────────────────────┐    ┌─────────────────────┐
│ Capsule     │───▶│ Capsule Compiler      │───▶│ Capsule Runtime     │
│ Definition  │    │ (a2r-capsule-        │    │ (a2r-capsule-      │
└─────────────┘    │ compiler/)            │    │ runtime/)           │
       │           └─────────────────────────┘    └─────────────────────┘
       │                   │                             │
       │                   ▼                             ▼
       │        ┌─────────────────────────┐    ┌─────────────────────┐
       │        │ 1. Compile capsule    │───▶│ 2. Prepare isolated │
       │        │    code               │    │    execution env    │
       │        └─────────────────────────┘    └─────────────────────┘
       │                                                │
       ▼                                                ▼
┌─────────────────────────┐                    ┌─────────────────────┐
│ 5. Validate and       │                    │ 3. Execute capsule  │
│    return results     │◀───────────────────│    securely         │
└─────────────────────────┘                   └─────────────────────┘
       │                                                │
       ▼                                                ▼
┌─────────────────────────┐                    ┌─────────────────────┐
│ 6. Clean up capsule │                    │ 4. Manage resources │
│    execution         │                    │    and security     │
│    resources        │                    └─────────────────────┘
└─────────────────────────┘
```

## Integration Points

### With Layer 0-Substrate
- Imports substrate types for standardized communication
- Uses intent graph kernel for state tracking
- Leverages presentation kernel for UI rendering
- Access patterns: Direct imports of Rust types and functions

### With Layer 2-Governance
- Provides execution context for policy evaluation
- Reports execution results for governance tracking
- Enforces policy decisions during execution
- Access patterns: Function calls and data queries

### With Layer 3-Adapters
- Provides execution environment for adapter operations
- Uses adapter protocols for external integrations
- Coordinates with adapters for tool execution
- Access patterns: Protocol interfaces and type validation

## Quality Assurance

### Testing Strategy
- Unit tests for all kernel components
- Integration tests validating layer boundaries
- Performance tests for execution systems
- Security tests for isolation mechanisms
- Contract tests ensuring interface compliance

### Monitoring & Observability
- Structured logging with correlation IDs
- Performance metrics for all operations
- Resource utilization monitoring
- Error rate tracking by component
- Dependency health checks

## Security Considerations

### Execution Isolation
- All code executes in sandboxed environments
- Resource limits enforced per execution
- Network access controlled and monitored
- File system access restricted and audited

### Access Control
- Authentication and authorization at all interfaces
- Principle of least privilege enforced
- Audit trails for all significant operations
- Permission checks for all resource access

### Data Protection
- Encryption for sensitive data in transit
- Secure storage for execution artifacts
- Isolation between different executions
- Secure disposal of temporary data

## Performance Characteristics

### Latency Targets
- Local execution: <10ms for simple operations
- WASM execution: <50ms for module instantiation
- Tool invocation: <100ms for external calls
- Capsule execution: <200ms for startup

### Throughput Targets
- Concurrent executions: 1000+ simultaneous
- Tool invocations: 10,000 ops/sec
- Message processing: 50,000 messages/sec
- Resource allocation: 5,000 allocations/sec

### Resource Usage
- Memory footprint: <500MB baseline
- CPU usage: <30% under normal load
- Disk usage: Efficient with cleanup mechanisms
