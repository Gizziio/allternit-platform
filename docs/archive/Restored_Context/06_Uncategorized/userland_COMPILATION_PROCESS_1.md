# COMPILATION_PROCESS.md

## Allternit Declarative Workflow Compilation Process

This document describes the deterministic compilation process from YAML definitions to frozen kernel contracts.

## Overview

The compilation process transforms declarative YAML configurations into Allternit's frozen kernel objects. This process is deterministic, meaning the same input YAML will always produce identical kernel objects.

## Compilation Pipeline

### 1. YAML Parsing and Validation
- Input: YAML files (`workflows.yaml`, `personas.yaml`, `tasks.yaml`)
- Action: Parse YAML and validate against JSON schemas
- Output: Validated configuration objects
- Contract: All inputs must conform to frozen JSON schemas

### 2. Reference Resolution
- Input: Validated configuration objects with references
- Action: Resolve cross-references (personas, tasks, tools)
- Output: Fully resolved configuration objects
- Contract: All references must exist and be accessible within tenant scope

### 3. Kernel Object Compilation
- Input: Fully resolved configuration objects
- Action: Compile to frozen kernel contracts
- Output: Kernel objects (WorkflowDefinition, RunModel metadata, VerifyArtifact requirements, ContextBundle selectors)
- Contract: All outputs must conform to frozen kernel contracts

### 4. Policy Validation
- Input: Compiled kernel objects
- Action: Validate against policy engine requirements
- Output: Policy-validated kernel objects
- Contract: All objects must pass policy validation before registration

## Mapping from YAML to Kernel Contracts

### workflows.yaml → Kernel Contracts

| YAML Field | Kernel Contract | Mapping Description |
|------------|-----------------|---------------------|
| workflow.id | RunModel.run_id | Direct mapping |
| workflow.tenant_id | RunModel.tenant_id | Direct mapping |
| workflow.required_tiers | RunModel.allowed_skill_tiers | Direct mapping |
| workflow.success_criteria | RunModel.success_criteria | Direct mapping |
| workflow.failure_modes | RunModel.failure_modes | Direct mapping |
| workflow.phases_used | RunModel.phases_used | Direct mapping |
| workflow.nodes | Vec<WorkflowNode> | Each task maps to a WorkflowNode |
| workflow.edges | Vec<WorkflowEdge> | Each dependency maps to a WorkflowEdge |

### personas.yaml → Kernel Contracts

| YAML Field | Kernel Contract | Mapping Description |
|------------|-----------------|---------------------|
| persona.id | PersonaManifest.id | Direct mapping |
| persona.tenant_id | PersonaManifest.tenant_id | Direct mapping |
| persona.context_overlay | PersonaManifest.context_overlay | Direct mapping |
| persona.goals | PersonaManifest.goals | Direct mapping |
| persona.constraints.safety_tier | SkillManifest.risk_tier | Direct mapping |
| persona.constraints.required_permissions | SkillManifest.required_permissions | Direct mapping |

### tasks.yaml → Kernel Contracts

| YAML Field | Kernel Contract | Mapping Description |
|------------|-----------------|---------------------|
| task_template.input_schema | ToolABI.input_schema | Direct mapping |
| task_template.output_schema | ToolABI.output_schema | Direct mapping |
| task_template.verification_schema | VerifyArtifact requirements | Direct mapping |

## Determinism Guarantees

### 1. Input Stability
- Same YAML input always produces same kernel objects
- No environment-dependent behavior
- No random values or timestamps during compilation

### 2. Sorted Collections
- All collections (arrays, maps) are sorted deterministically
- No reliance on iteration order
- Consistent output regardless of input order

### 3. Explicit Hashing
- Where hashing is required, explicit deterministic algorithms are used
- SHA256 for content integrity
- Sorted inputs for consistent hash values

## Validation Points

### 1. Schema Validation
- All YAML must validate against JSON schemas
- No additional properties allowed
- Strict type checking enforced

### 2. Cross-Reference Validation
- All references must exist within tenant scope
- No cross-tenant access allowed
- Circular dependency detection

### 3. Kernel Contract Compliance
- All compiled objects must conform to frozen contracts
- No deviation from contract specifications
- Strict validation before registration

## Error Handling

### 1. Validation Errors
- Clear error messages with line numbers and field paths
- Multiple errors reported in single pass
- No partial compilation allowed

### 2. Policy Violations
- Policy validation occurs after compilation
- Clear indication of which policies were violated
- No registration of policy-violating objects

## Security Considerations

### 1. Tenant Isolation
- All references validated within tenant scope
- No cross-tenant access allowed
- Strict tenant_id enforcement

### 2. Resource Limits
- All resource limits validated during compilation
- No unlimited resources allowed
- Policy enforcement for resource allocation

### 3. Safety Tiers
- Safety tier requirements validated
- No escalation of safety tiers allowed
- Policy enforcement for tier access

## Performance Considerations

### 1. Compilation Speed
- Optimized for fast compilation
- No external dependencies during compilation
- Efficient validation algorithms

### 2. Memory Usage
- Limited memory footprint during compilation
- Streaming validation where possible
- No caching of intermediate results

## Testing Requirements

### 1. Determinism Tests
- Same input must always produce identical output
- Multiple runs of same input should be identical
- Hash comparison for binary equality

### 2. Validation Tests
- All invalid inputs must be rejected
- All valid inputs must be accepted
- Edge cases thoroughly tested

### 3. Integration Tests
- End-to-end compilation and execution
- Policy validation integration
- Tenant isolation verification