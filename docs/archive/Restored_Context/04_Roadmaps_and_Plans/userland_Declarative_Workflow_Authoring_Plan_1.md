# Native Allternit Declarative Workflow Authoring Layer

## 1. Overview

The declarative workflow authoring layer provides a user-friendly interface for defining workflows that compile to Allternit's frozen kernel contracts. This layer sits in `/spec/userland/` and maps directly to kernel concepts while preserving all AG2 guarantees.

## 2. Core Components

### 2.1 workflows.yaml → Workflow DAG Compilation

**Location**: `/spec/userland/workflows.yaml`

**Schema**:
```yaml
version: "1.0"
workflow:
  id: "research-project-alpha"  # Maps to RunModel.run_id
  name: "Research Project Alpha"
  description: "A comprehensive research workflow"
  version: "1.0.0"
  tenant_id: "tenant-123"  # Required for multi-tenant isolation
  
  # Maps to RunModel.allowed_skill_tiers
  required_tiers:
    - "T0"
    - "T1"
    - "T2"
  
  # Success criteria maps to RunModel.success_criteria
  success_criteria: "All research phases completed with verification artifacts"
  failure_modes:
    - "Any phase fails verification"
    - "Budget exceeded"
  
  # Maps to WorkflowDefinition.phases_used
  phases:
    - "Observe"
    - "Think"
    - "Plan"
    - "Build"
    - "Execute"
    - "Verify"
    - "Learn"
  
  # Maps to WorkflowDefinition.nodes
  tasks:
    - id: "research-initial-query"
      name: "Initial Research Query"
      phase: "Observe"
      persona: "researcher"  # Maps to skill_id via persona kernel
      description: "Query research databases for initial information"
      instructions: |
        Conduct initial research on the topic using available databases.
        Focus on peer-reviewed sources and recent publications.
      inputs:
        - "research_topic"
        - "date_range"
      outputs:
        - "initial_findings"
        - "source_list"
      tools:
        - "database_search"
        - "academic_api"
      constraints:
        time_budget: 300  # seconds
        resource_limits:
          cpu: "200m"
          memory: "256Mi"
        allowed_tools:
          - "database_search"
          - "academic_api"
        required_permissions:
          - "perm_t1_read"
      expected_output_schema:  # Becomes VerifyArtifact requirement
        type: "object"
        properties:
          initial_findings:
            type: "array"
            items:
              type: "string"
          source_list:
            type: "array"
            items:
              type: "string"
        required:
          - "initial_findings"
          - "source_list"
          
    - id: "analyze-findings"
      name: "Analyze Research Findings"
      phase: "Think"
      persona: "analyst"
      description: "Analyze collected research findings"
      instructions: |
        Analyze the initial findings for patterns, contradictions, and gaps.
        Create a structured analysis report.
      inputs:
        - "initial_findings"
        - "source_list"
      outputs:
        - "analysis_report"
        - "identified_patterns"
      tools:
        - "text_analyzer"
        - "pattern_recognizer"
      constraints:
        time_budget: 600
        resource_limits:
          cpu: "300m"
          memory: "512Mi"
        required_permissions:
          - "perm_t1_read"
      expected_output_schema:
        type: "object"
        properties:
          analysis_report:
            type: "string"
          identified_patterns:
            type: "array"
            items:
              type: "object"
              properties:
                pattern:
                  type: "string"
                significance:
                  type: "string"
                sources:
                  type: "array"
                  items:
                    type: "string"
        required:
          - "analysis_report"
          - "identified_patterns"

  # Maps to WorkflowDefinition.edges
  dependencies:
    - from: "research-initial-query"
      to: "analyze-findings"
      condition: "initial_findings.length > 0"
```

### 2.2 persona.yaml → Persona Kernel Integration

**Location**: `/spec/userland/personas.yaml`

**Schema**:
```yaml
version: "1.0"
personas:
  - id: "researcher"
    name: "Research Specialist"
    description: "Specialized in academic research and literature review"
    tenant_id: "tenant-123"
    
    # Maps to ProviderPersona.context_overlay
    context_overlay:
      expertise: "Academic research, literature review, source verification"
      methodology: "Peer-reviewed sources, systematic review approach"
      limitations: "Cannot access paywalled content without proper credentials"
    
    # Maps to ProviderPersona.goals
    goals:
      - "Find relevant academic sources"
      - "Verify source credibility"
      - "Synthesize information coherently"
    
    # Maps to ProviderPersona.constraints
    constraints:
      safety_tier: "T2"
      required_permissions:
        - "perm_t1_read"
        - "perm_t2_read"
      resource_limits:
        cpu: "200m"
        memory: "256Mi"
        time_limit: 300  # seconds
    
    # Maps to ProviderPersona.provider_routing
    provider_preferences:
      priority_order:
        - "openai-gpt4"
        - "anthropic-claude"
        - "local-llama"
      fallback_timeout: 60  # seconds
    
    # Maps to ProviderPersona.signature_verification
    signature:
      manifest_sig: "sha256:abc123..."
      bundle_hash: "sha256:def456..."
```

### 2.3 tasks.yaml → Workflow Node Templates

**Location**: `/spec/userland/tasks.yaml`

**Schema**:
```yaml
version: "1.0"
task_templates:
  - id: "generic-research-task"
    name: "Generic Research Task Template"
    description: "Template for research-oriented tasks"
    
    # Maps to WorkflowNode constraints
    default_constraints:
      time_budget: 300
      resource_limits:
        cpu: "200m"
        memory: "256Mi"
      required_permissions:
        - "perm_t1_read"
    
    # Maps to ToolABI input/output schemas
    input_schema:
      type: "object"
      properties:
        query:
          type: "string"
          description: "Research query to execute"
        sources:
          type: "array"
          items:
            type: "string"
          description: "Optional list of specific sources to search"
        date_range:
          type: "object"
          properties:
            start:
              type: "string"  # ISO date
            end:
              type: "string"  # ISO date
          description: "Date range for research"
      required:
        - "query"
    
    output_schema:
      type: "object"
      properties:
        results:
          type: "array"
          items:
            type: "object"
            properties:
              title:
                type: "string"
              url:
                type: "string"
              summary:
                type: "string"
              relevance_score:
                type: "number"
                minimum: 0
                maximum: 1
          description: "Search results"
        metadata:
          type: "object"
          properties:
            query_time:
              type: "number"
            sources_searched:
              type: "array"
              items:
                type: "string"
          description: "Search metadata"
    
    # Maps to VerifyArtifact requirements
    verification_schema:
      type: "object"
      properties:
        completeness:
          type: "number"
          minimum: 0
          maximum: 1
        accuracy:
          type: "number"
          minimum: 0
          maximum: 1
        relevance:
          type: "number"
          minimum: 0
          maximum: 1
      required:
        - "completeness"
        - "accuracy"
        - "relevance"
```

### 2.4 expected_output.schema.json → Verify Artifact Contract

**Location**: `/spec/userland/expected_output.schema.json`

**Schema**:
```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "title": "Expected Output Verification Schema",
  "description": "Schema for verifying workflow task outputs",
  "type": "object",
  "properties": {
    "verification_results": {
      "type": "object",
      "properties": {
        "passed": {
          "type": "boolean",
          "description": "Whether verification passed"
        },
        "confidence": {
          "type": "number",
          "minimum": 0,
          "maximum": 1,
          "description": "Confidence level in verification"
        },
        "details": {
          "type": "object",
          "description": "Detailed verification information"
        },
        "issues": {
          "type": "array",
          "items": {
            "type": "object",
            "properties": {
              "issue_type": {
                "type": "string",
                "enum": ["completeness", "accuracy", "relevance", "format", "schema"]
              },
              "description": {
                "type": "string"
              },
              "severity": {
                "type": "string",
                "enum": ["info", "warning", "error", "critical"]
              },
              "location": {
                "type": "string"
              }
            },
            "required": ["issue_type", "description", "severity"]
          }
        }
      },
      "required": ["passed", "confidence", "details"]
    }
  },
  "required": ["verification_results"]
}
```

## 3. Compilation Process

### 3.1 Validation Flow
1. **YAML Schema Validation**: Validate against declared schemas
2. **Kernel Contract Mapping**: Map YAML fields to frozen kernel contracts
3. **Policy Validation**: Check against policy engine requirements
4. **Dependency Resolution**: Validate workflow DAG structure
5. **Resource Validation**: Verify resource constraints are acceptable

### 3.2 Execution Flow
1. **Compile to Kernel Objects**: Convert YAML to WorkflowDefinition, etc.
2. **Register with Kernel**: Store in workflow engine
3. **Validate Against Contracts**: Ensure compliance with frozen contracts
4. **Execute Through Kernel**: Run through workflow engine with full guarantees
5. **Verify Outputs**: Check against expected_output.schema.json

## 4. Determinism Guarantees

### 4.1 Configuration Determinism
- YAML configurations compile deterministically to kernel objects
- Same YAML always produces same kernel contract execution
- No hidden state or dynamic behavior in compilation

### 4.2 Execution Determinism  
- All execution follows frozen kernel contracts
- Tool Gateway enforces idempotency for side effects
- Context Router provides deterministic context compilation
- History ledger captures complete execution trace

### 4.3 Verification Determinism
- Expected outputs defined in schemas
- Verification artifacts required for completion
- Replay capability maintained for all executions

## 5. Security and Governance

### 5.1 Multi-Tenant Isolation
- All configurations include tenant_id
- Kernel enforces hard boundaries between tenants
- Resource quotas enforced at kernel level

### 5.2 Policy Enforcement
- All actions must pass policy engine
- Safety tiers enforced throughout execution
- Audit trail maintained for all activities

### 5.3 Verify-Gated Completion
- Workflows require verification artifacts to complete
- No completion without proper verification
- Policy gates enforced at each phase transition