# 4-Services Directory Structure

This document summarizes the current structure of the 4-services layer.

## Current Structure

### Memory Services
- `memory/` - Observation, state history, decay, and memory agents
  - `observation/` - Observation and monitoring systems
  - `state/` - State management and persistence
  - `src/` - Core memory service implementation

### Gateway Services
- `gateway/` - Public entry point and API gateway for the platform

### Orchestration Services
- `orchestration/` - Platform orchestration and coordination services
  - `kernel-service/` - Tool execution and brain session management
  - `platform-orchestration-service/` - Platform-wide orchestration
  - `router-service/` - Request routing and load balancing

### Registry Services
- `registry/` - Agent, skill, and tool definition management
  - `apps-registry/` - Application registry
  - `framework-registry/` - Framework registry
  - `functions-registry/` - Functions registry
  - `server-registry/` - Server registry

### ML/AI Services
- `ml-ai-services/` - ML and AI-powered services
  - `voice-service/` - Text-to-speech and voice cloning
  - `pattern-service/` - Pattern recognition and analysis
  - `prompt-pack-service/` - Prompt management and optimization

### Operator Services
- `a2r-operator/` - Browser automation, computer-use, desktop automation, and parallel execution

### Infrastructure Services
- `infrastructure/` - Infrastructure and platform support services

### Runtime Services
- `runtime/` - Runtime environment and execution services

### Support Systems
- `stubs/` - Mock implementations for testing and development

## Documentation

The functionality and purpose of each component is documented in:
- README.md - Overview of the 4-services layer
- ARCHITECTURE.md - Detailed architectural information
- POTENTIAL_IMPROVEMENTS.md - Planned enhancements

## Key Principles

The 4-services layer follows these key principles:
- Each service has a single, well-defined responsibility
- Services communicate through well-defined APIs
- Loose coupling between services
- Focus on networking, resilience, and observability
- Services emit ledger/receipt events and may back the Gate/Vault pipelines