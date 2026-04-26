# Minimal Implementation Plan for Declarative Workflow Authoring

## Overview
This plan outlines a 3-step implementation approach for the declarative workflow authoring layer that maps to Allternit's frozen kernel contracts while preserving all AG2 guarantees.

## Step 1: Spec Additions Only (No Code)

### Files to Create/Edit
- `/spec/userland/workflows.yaml.schema.json` - JSON Schema for workflow definitions
- `/spec/userland/personas.yaml.schema.json` - JSON Schema for persona definitions  
- `/spec/userland/tasks.yaml.schema.json` - JSON Schema for task templates
- `/spec/userland/expected_output.schema.json` - Schema for verification artifacts
- `/spec/userland/COMPILATION_PROCESS.md` - Documentation of the compilation process

### Contracts Involved
- **EventEnvelope**: For validation events during compilation
- **RunModel**: For workflow execution contracts
- **ToolABI**: For task-to-tool mapping contracts
- **VerifyArtifact**: For output verification contracts
- **ContextBundle**: For context compilation contracts

### Determinism Impact
- **Impact**: None - schemas are static definitions
- **Verification**: Schemas will be validated against frozen kernel contracts

## Step 2: Compiler/Loader Utilities

### Files to Create/Edit
- `/packages/workflows/src/compiler.rs` - YAML to kernel object compiler
- `/packages/workflows/src/validator.rs` - Configuration validator against kernel contracts
- `/packages/workflows/src/loader.rs` - Configuration loader and registry
- `/packages/workflows/src/yaml_adapter.rs` - YAML parsing and mapping utilities
- `/packages/workflows/tests/compiler_tests.rs` - Compiler validation tests

### Contracts Involved
- **RunModel**: Compiler outputs WorkflowDefinition that maps to RunModel
- **ToolABI**: Task definitions map to ToolABI contracts
- **PolicyDecision**: Validation checks policy compliance
- **ContextBundle**: Context compilation follows deterministic hashing
- **VerifyArtifact**: Output schemas map to verification requirements

### Determinism Impact
- **Impact**: None - compilation is deterministic and reproducible
- **Verification**: Same input YAML always produces same kernel objects

## Step 3: CLI Affordances

### Files to Create/Edit
- `/apps/cli/src/commands/workflow.rs` - Workflow management commands
- `/apps/cli/src/commands/persona.rs` - Persona management commands
- `/apps/cli/src/commands/validate.rs` - Configuration validation commands
- `/apps/cli/src/commands/run.rs` - Workflow execution commands
- `/apps/cli/src/templates/` - Starter templates for users
- `/apps/cli/tests/` - CLI integration tests

### Contracts Involved
- **EventEnvelope**: CLI commands generate audit events
- **RunModel**: Workflow execution follows state machine
- **ToolABI**: Tool execution follows ABI contracts
- **PolicyDecision**: All actions require policy approval
- **VerifyArtifact**: Execution requires verification artifacts

### Determinism Impact
- **Impact**: None - CLI translates to deterministic kernel calls
- **Verification**: CLI commands map to deterministic kernel operations

## Implementation Sequence

### Phase 1: Spec Definition (Week 1)
1. Define all YAML schemas in `/spec/userland/`
2. Document compilation process
3. Validate schemas against kernel contracts
4. Create example configurations

### Phase 2: Compiler Development (Week 2-3)
1. Implement YAML parser and validator
2. Create compiler from YAML to kernel objects
3. Add policy validation during compilation
4. Write comprehensive tests
5. Ensure deterministic compilation

### Phase 3: CLI Integration (Week 4)
1. Add workflow management commands
2. Integrate with compiler utilities
3. Add validation and execution commands
4. Create starter templates
5. Test end-to-end workflow

## Risk Mitigation

### Kernel Contract Compliance
- All YAML schemas validated against frozen kernel contracts
- Compiler includes strict validation against kernel contracts
- Tests verify mapping from YAML to kernel objects

### Determinism Preservation
- Compiler produces deterministic output for same input
- No hidden state or dynamic behavior
- Complete audit trail maintained

### Security and Governance
- All configurations validated through policy engine
- Multi-tenant isolation preserved
- Verify-gated completion enforced

## Success Criteria

### Functional
- [ ] YAML configurations compile to valid kernel objects
- [ ] All kernel contracts properly mapped and enforced
- [ ] Deterministic compilation and execution
- [ ] Policy validation during compilation and execution
- [ ] Multi-tenant isolation preserved

### Non-Functional
- [ ] Compilation performance acceptable for large workflows
- [ ] Error messages clear and actionable
- [ ] Audit trail maintained for all operations
- [ ] Backwards compatibility with existing kernel contracts

## Rollback Plan
If implementation fails to meet requirements:
- Remove all new code and configuration files
- Revert to direct kernel contract usage
- Maintain existing functionality unchanged