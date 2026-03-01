# Reusable CrewAI Concepts and Kernel Contract Mappings

## 1. Categories Eligible for Reuse

### 1.1 YAML / Declarative Configuration Patterns
- **Location**: `/spec/userland/workflows.yaml`, `/spec/userland/personas.yaml`, `/spec/userland/tasks.yaml`
- **Kernel Contract**: EventEnvelope, RunModel
- **Determinism Preservation**: Configuration is parsed deterministically and compiled to frozen kernel contracts
- **Implementation**: YAML files compile to WorkflowDefinition objects that conform to kernel contracts

### 1.2 Human-Readable Task Descriptions
- **Location**: `/spec/userland/tasks.yaml` under `description` and `instructions` fields
- **Kernel Contract**: ToolABI (input/output schemas)
- **Determinism Preservation**: Descriptions are metadata; execution follows frozen contracts
- **Implementation**: Natural language descriptions map to structured input schemas

### 1.3 Role Metadata as Persona Overlays
- **Location**: `/spec/userland/personas.yaml` under `persona_overlays` 
- **Kernel Contract**: ProviderPersona from persona kernel
- **Determinism Preservation**: Personas are loaded deterministically at session start
- **Implementation**: Role metadata compiles to persona kernel specifications

### 1.4 Task → Expected_Output Schemas
- **Location**: `/spec/userland/tasks.yaml` with `expected_output_schema` field
- **Kernel Contract**: VerifyArtifact (verification structure)
- **Determinism Preservation**: Output schemas are validated deterministically
- **Implementation**: Expected outputs become verification artifact requirements

### 1.5 CLI Ergonomics Ideas
- **Location**: `/apps/cli/src/` commands and interfaces
- **Kernel Contract**: None directly (UI/UX layer)
- **Determinism Preservation**: CLI translates to deterministic kernel calls
- **Implementation**: Command-line interfaces to workflow execution

## 2. Detailed Mapping to Kernel Contracts

### 2.1 YAML Configuration → WorkflowDefinition
```
YAML Field → Kernel Contract Field
workflow_id → RunModel.run_id
tasks → Vec<WorkflowNode>
process → DAG topology in Graph<WorkflowNode, WorkflowEdge>
agents → Persona references in skill bindings
```

### 2.2 Task Definitions → ToolABI
```
YAML Field → Kernel Contract Field  
task.description → ToolDefinition.description
task.expected_output → ToolDefinition.output_schema
task.tools → ToolDefinition.id references
task.agent → SkillManifest.id binding
```

### 2.3 Persona Definitions → ProviderPersona
```
YAML Field → Kernel Contract Field
persona.role → PersonaManifest.role
persona.goal → PersonaManifest.goals
persona.backstory → PersonaManifest.context_overlay
persona.llm → ProviderConfig.provider_id
```

### 2.4 Verification Requirements → VerifyArtifact
```
YAML Field → Kernel Contract Field
task.expected_output → VerifyArtifact.results.details
task.output_filter → VerifyArtifact.results.issues
verification_criteria → VerifyArtifact.results.confidence
```

## 3. Determinism Preservation Mechanisms

### 3.1 Configuration Compilation
- YAML configurations are parsed deterministically
- All configurations must validate against frozen kernel contract schemas
- Compilation process is reproducible and auditable

### 3.2 Runtime Enforcement
- All execution follows frozen kernel contracts
- Policy engine enforces compliance with kernel contracts
- History ledger captures all configuration-to-execution mappings

### 3.3 Validation Layers
- Compile-time: YAML validates against schema
- Load-time: Configuration validates against kernel contracts
- Run-time: Execution validates against policy and contracts

## 4. Implementation Safety Measures

### 4.1 Schema Validation
- All YAML schemas must map 1:1 with kernel contract schemas
- No configuration field can bypass kernel contract validation
- Strict type checking between YAML and kernel contract types

### 4.2 Audit Trail
- All configuration changes logged to history ledger
- Configuration-to-execution mapping preserved
- Replay capability maintained for all configuration-driven executions

### 4.3 Policy Enforcement
- All configuration-driven actions must pass policy validation
- No configuration can bypass Tool Gateway for side effects
- Verify-gated completion enforced regardless of configuration source