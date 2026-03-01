# Prompt Pack Service Specification

## Overview

The **Prompt Pack Service** is a standalone service (port 3005) that provides versioned, deterministic prompt templates to the A2R platform. It serves as the single source of truth for all prompts used by agents, ensuring consistency, auditability, and reproducibility across the system.

**Key Principle:** *Prompts are code. They must be versioned, tested, and deployed like any other artifact.*

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           PROMPT PACK SERVICE                                │
│                              (Port 3005)                                     │
├─────────────────────────────────────────────────────────────────────────────┤
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────────┐   │
│  │ Pack Store  │  │  Registry   │  │  Renderer   │  │ Version Control │   │
│  │             │  │             │  │             │  │                 │   │
│  │ - Core      │  │ - Metadata  │  │ - Jinja2    │  │ - Git-backed    │   │
│  │ - Orch      │  │ - Versions  │  │ - Variables │  │ - Immutable     │   │
│  │ - Roles     │  │ - Tags      │  │ - Partials  │  │ - Audit trail   │   │
│  │ - Evidence  │  │ - Search    │  │ - Macros    │  │ - Rollback      │   │
│  └─────────────┘  └─────────────┘  └─────────────┘  └─────────────────┘   │
└─────────────────────────────────────────────────────────────────────────────┘
         ▲                           ▲                           ▲
         │                           │                           │
         │                    ┌──────┴──────┐                    │
         │                    │   RAILS     │                    │
         │                    │  (Port 3011)│                    │
         │                    └──────┬──────┘                    │
         │                           │                           │
    ┌────┴────┐                 ┌────┴────┐                 ┌────┴────┐
    │   DAK   │                 │  Agent  │                 │  Studio │
    │ (Kernel)│                 │ Runner  │                 │   UI    │
    └────┬────┘                 └────┬────┘                 └────┬────┘
         │                           │                           │
    ┌────┴───────────────────────────┴───────────────────────────┴────┐
    │                     DETERMINISM CONTRACT                        │
    │  Same inputs (pack_id, version, variables) → Same output text   │
    └─────────────────────────────────────────────────────────────────┘
```

---

## Core Concepts

### 1. Prompt Pack

A **Prompt Pack** is a versioned collection of related prompt templates. Think of it as a library or package.

```yaml
pack_id: "core.v1"
name: "Core Prompts"
description: "Fundamental prompts for agent operation"
version: "1.2.3"
deterministic: true  # Guarantees same output for same inputs

author: "a2r-platform"
tags: ["core", "system", "required"]

# Dependencies on other packs
dependencies:
  - pack_id: "primitives.v1"
    version: ">=1.0.0"

# Required variables
variables:
  - name: "agent_name"
    type: "string"
    required: true
  - name: "capabilities"
    type: "array"
    default: []

# Prompt templates in this pack
prompts:
  - id: "system.base"
    template: "prompts/system/base.j2"
    description: "Base system prompt"
    
  - id: "tool.use"
    template: "prompts/tool/use.j2"
    description: "Tool usage instructions"
```

### 2. Prompt Template

A **Prompt Template** is a single, renderable prompt using Jinja2 syntax.

```jinja2
{# prompts/system/base.j2 #}
You are {{ agent_name }}, an AI assistant with the following capabilities:
{% for cap in capabilities %}
- {{ cap.name }}: {{ cap.description }}
{% endfor %}

Your task is to: {{ task_description }}

{% include 'partials/safety.j2' %}

Respond in {{ response_format | default('markdown') }}.
```

### 3. Rendered Prompt

A **Rendered Prompt** is the final, deterministic text after variable substitution.

```
You are Builder-Alpha, an AI assistant with the following capabilities:
- code-generation: Generate and edit code
- file-operations: Read, write, and manage files

Your task is to: Implement a user authentication system

Safety Guidelines:
- Never execute destructive commands without confirmation
- Validate all inputs before processing

Respond in markdown.
```

---

## Determinism Guarantee

The service provides **deterministic rendering** through:

1. **Immutable Versions**: Once a pack version is published, it cannot change
2. **Frozen Dependencies**: All dependencies are pinned to exact versions
3. **Sorted Rendering**: Dictionary keys are sorted, arrays preserve order
4. **No External Calls**: Rendering is pure computation, no I/O or network
5. **Content-Addressed Storage**: Packs are stored by content hash

```python
# Determinism check
rendered_1 = service.render("core.v1", "system.base", vars, version="1.2.3")
rendered_2 = service.render("core.v1", "system.base", vars, version="1.2.3")

assert hash(rendered_1) == hash(rendered_2)  # Always true
```

---

## API Specification

### Pack Management

```http
# List all packs
GET /v1/packs
Response: {
  "packs": [
    {
      "pack_id": "core.v1",
      "name": "Core Prompts",
      "latest_version": "1.2.3",
      "versions": ["1.0.0", "1.1.0", "1.2.3"],
      "tags": ["core", "system"]
    }
  ]
}

# Get pack metadata
GET /v1/packs/:pack_id
Response: { pack metadata including all versions }

# Get specific version
GET /v1/packs/:pack_id/versions/:version
Response: { full pack definition with all prompts }

# Create new pack (requires auth)
POST /v1/packs
Body: { pack definition }

# Publish new version (immutable)
POST /v1/packs/:pack_id/versions
Body: { pack files }
Response: { version: "1.2.4", content_hash: "sha256:abc..." }
```

### Rendering

```http
# Render a prompt
POST /v1/render
Body: {
  "pack_id": "core.v1",
  "prompt_id": "system.base",
  "version": "1.2.3",  # Optional, defaults to latest
  "variables": {
    "agent_name": "Builder-Alpha",
    "capabilities": [
      {"name": "code-generation", "description": "..."}
    ],
    "task_description": "Implement auth"
  },
  "options": {
    "trim_whitespace": true,
    "validate_variables": true
  }
}
Response: {
  "rendered": "You are Builder-Alpha...",
  "content_hash": "sha256:def...",
  "rendered_at": "2026-02-07T22:00:00Z",
  "deterministic": true
}

# Batch render multiple prompts
POST /v1/render/batch
Body: {
  "renders": [
    { "pack_id": "core.v1", "prompt_id": "system.base", ... },
    { "pack_id": "orch.v1", "prompt_id": "planner", ... }
  ]
}
Response: {
  "results": [
    { "rendered": "...", "content_hash": "..." },
    { "rendered": "...", "content_hash": "..." }
  ]
}

# Render with context pack (DAK integration)
POST /v1/render/contextual
Body: {
  "context_pack_id": "dag-123-run-456",
  "prompt_refs": [
    {"pack_id": "core.v1", "prompt_id": "system.base", "version": "1.2.3"}
  ],
  "variables": { ... }
}
Response: {
  "rendered_prompts": [...],
  "context_hash": "sha256:ghi...",
  "receipt_id": "receipt-789"
}
```

### Validation & Testing

```http
# Validate a pack before publishing
POST /v1/validate
Body: { pack files }
Response: {
  "valid": true/false,
  "errors": [
    {"file": "prompts/x.j2", "line": 10, "message": "Undefined variable"}
  ],
  "warnings": [...]
}

# Test render with sample variables
POST /v1/test-render
Body: {
  "template": "Hello {{ name }}",
  "variables": {"name": "World"}
}
Response: { "rendered": "Hello World" }

# Diff two pack versions
GET /v1/packs/:pack_id/diff?from=1.2.3&to=1.2.4
Response: {
  "changes": [
    {"type": "modified", "file": "prompts/x.j2", "diff": "..."}
  ]
}
```

### Integration with Rails

```http
# Get receipt for a render (Rails integration)
GET /v1/receipts/:receipt_id
Response: {
  "receipt_id": "receipt-789",
  "pack_id": "core.v1",
  "prompt_id": "system.base",
  "version": "1.2.3",
  "content_hash": "sha256:def...",
  "rendered_hash": "sha256:ghi...",
  "rendered_at": "2026-02-07T22:00:00Z",
  "rails_ledger_tx": "tx-abc..."
}

# Record Rails ledger transaction
POST /v1/receipts/:receipt_id/ledger
Body: {
  "rails_ledger_tx": "tx-abc...",
  "wih_id": "wih-123"
}
```

---

## DAK Integration

### How DAK Uses the Service

```typescript
// DAK calls Prompt Pack Service during context pack assembly
async function assembleContextPack(wihId: string, dagId: string): Promise<ContextPack> {
  
  // 1. Fetch deterministic prompts for this WIH
  const systemPrompt = await promptService.render({
    pack_id: 'dak.core',
    prompt_id: 'system.builder',
    version: '2.1.0',  // Pinned by policy
    variables: {
      wih_id: wihId,
      dag_id: dagId,
      agent_capabilities: ['code-gen', 'test'],
      policy_bundle_hash: 'sha256:abc...'
    }
  });
  
  // 2. Fetch tool instructions
  const toolPrompt = await promptService.render({
    pack_id: 'dak.tools',
    prompt_id: 'instructions.claude',
    version: '1.5.0',
    variables: {
      available_tools: getToolList(),
      policy_rules: getPolicyRules()
    }
  });
  
  // 3. Compose context pack
  const contextPack = {
    wih_id: wihId,
    dag_id: dagId,
    prompts: {
      system: systemPrompt.rendered,
      tools: toolPrompt.rendered,
    },
    // Content-addressed: hash of all inputs
    content_hash: computeHash(systemPrompt, toolPrompt),
    // Receipts for Rails ledger
    prompt_receipts: [systemPrompt.receipt_id, toolPrompt.receipt_id]
  };
  
  // 4. Seal context pack
  return await sealContextPack(contextPack);
}
```

### Determinism in DAK

The DAK achieves determinism through:

1. **Version Pinning**: All prompts use exact versions, never "latest"
2. **Content-Addressed**: Context packs are hashed and compared
3. **Receipt Tracking**: Every render produces a receipt for Rails ledger
4. **Replayability**: Same WIH + same prompt versions = identical execution

```typescript
// Deterministic replay
async function replayExecution(wihId: string): Promise<void> {
  const wih = await rails.wihs.show(wihId);
  
  // Get exact prompt versions from original run
  const promptVersions = wih.metadata.prompt_versions;
  
  // Re-render with same versions
  const contextPack = await assembleContextPack(wihId, wih.dag_id, promptVersions);
  
  // Execute - will produce identical results (given same tools)
  await executeWithContext(contextPack);
}
```

---

## Rails Integration

### How Rails Uses the Service

```rust
// Rails records prompt receipts in ledger
async fn record_prompt_usage(
    &self,
    wih_id: &str,
    receipt_id: &str
) -> Result<LedgerEntry> {
    
    // Get receipt from Prompt Pack Service
    let receipt = self.prompt_service
        .get_receipt(receipt_id)
        .await?;
    
    // Record in ledger
    let entry = self.ledger.append(LedgerEvent {
        event_type: "PromptRendered",
        wih_id: wih_id.to_string(),
        payload: json!({
            "pack_id": receipt.pack_id,
            "version": receipt.version,
            "content_hash": receipt.content_hash,
            "prompt_service_receipt": receipt_id
        }),
    }).await?;
    
    Ok(entry)
}
```

### Determinism in Rails

Rails ensures determinism through:

1. **Receipt Verification**: All prompts used must have valid receipts
2. **Hash Verification**: Content hash is verified before execution
3. **Audit Trail**: Ledger records every prompt version used
4. **Reproducibility**: DAG can be re-executed with identical prompts

```rust
// Gate check verifies prompt determinism
async fn gate_check(wih_id: &str) -> Result<GateDecision> {
    let wih = self.wihs.get(wih_id)?;
    
    // Verify all prompts have receipts
    for receipt_id in &wih.prompt_receipts {
        let receipt = self.prompt_service.get_receipt(receipt_id).await?;
        
        // Verify deterministic
        if !receipt.deterministic {
            return Ok(GateDecision::Block {
                reason: "Non-deterministic prompt used"
            });
        }
    }
    
    Ok(GateDecision::Allow)
}
```

---

## Pack Types

### Core Packs (System)

```yaml
pack_id: dak.core
name: DAK Core Prompts
purpose: Base prompts for all DAK operations
prompts:
  - system.builder      # Builder agent system prompt
  - system.validator    # Validator agent system prompt  
  - system.orchestrator # Orchestrator system prompt
  - tool.pre_use        # Pre-tool-use instructions
  - tool.post_use       # Post-tool-use instructions
  - gate.checkpoint     # Gate checkpoint prompts
```

### Orchestration Packs

```yaml
pack_id: dak.orch
name: DAK Orchestration
purpose: Planning, loops, worker management
prompts:
  - plan.decompose      # Task decomposition
  - loop.ralph          # Ralph execution loop
  - worker.spawn        # Worker spawn instructions
  - context.compact     # Context compaction
```

### Role Packs

```yaml
pack_id: dak.roles
name: DAK Role Definitions
purpose: Specific agent roles
prompts:
  - role.security       # Security reviewer
  - role.performance    # Performance optimizer
  - role.docs           # Documentation writer
  - role.tester         # Test generator
```

### Evidence Packs

```yaml
pack_id: dak.evidence
name: DAK Evidence & Receipts
purpose: Receipt generation, summaries
prompts:
  - evidence.receipt    # Receipt format
  - evidence.summary    # Execution summary
  - evidence.diff       # Diff generation
  - evidence.replay     # Replay instructions
```

---

## File Storage Layout

```
prompt-pack-service/
├── data/
│   ├── packs/                    # Git-backed pack storage
│   │   ├── dak/
│   │   │   ├── core/
│   │   │   │   ├── v1.0.0/      # Immutable version
│   │   │   │   ├── v1.1.0/
│   │   │   │   └── v1.2.3/
│   │   │   └── orch/
│   │   └── community/           # Community packs
│   │
│   ├── cache/                   # Rendered prompt cache
│   │   └── sha256/...
│   │
│   └── receipts/                # Render receipts
│       └── 2026/02/07/...
│
├── src/
│   ├── api/                     # HTTP API handlers
│   ├── renderer/                # Jinja2 rendering engine
│   ├── registry/                # Pack registry & versions
│   └── validator/               # Pack validation
│
└── tests/
    ├── packs/                   # Test packs
    └── integration/             # Integration tests
```

---

## Deployment & Operations

### Service Startup

```bash
# Environment variables
PROMPT_PACK_PORT=3005
PROMPT_PACK_DATA_DIR=/var/lib/prompt-packs
PROMPT_PACK_GIT_REMOTE=https://github.com/a2r/prompt-packs.git
PROMPT_PACK_CACHE_SIZE=1000
PROMPT_PACK_RAILS_URL=http://127.0.0.1:3011

# Start service
cargo run --bin prompt-pack-service
```

### Health Checks

```http
GET /health
Response: {
  "status": "healthy",
  "version": "1.0.0",
  "packs_loaded": 42,
  "cache_hit_rate": 0.94
}
```

### Metrics

```
prompt_renders_total{pack_id="dak.core", prompt_id="system.builder"}
prompt_render_duration_seconds
prompt_cache_hits_total
prompt_cache_misses_total
pack_versions_total{pack_id="dak.core"}
```

---

## Security Considerations

1. **No Secrets in Packs**: Prompts must not contain API keys or secrets
2. **Immutable Versions**: Prevents tampering with published prompts
3. **Audit Trail**: All renders logged with receipts
4. **Access Control**: Pack publishing requires authentication
5. **Sandboxed Rendering**: Template rendering is sandboxed (no filesystem/network access)

---

## Acceptance Criteria

- [ ] All DAK prompts are served by the Prompt Pack Service
- [ ] Every render produces a receipt recorded in Rails ledger
- [ ] Same inputs produce identical outputs (determinism)
- [ ] Version rollback is supported
- [ ] Pack validation catches syntax errors before publish
- [ ] Cache achieves >90% hit rate for repeated renders
- [ ] Service can render 1000 prompts/second
- [ ] All renders have <10ms latency (cached) or <100ms (uncached)

---

## Implementation Phases

### Phase 1: Core Service (MVP)
- [ ] HTTP API with pack CRUD
- [ ] Jinja2 rendering engine
- [ ] Version control with git
- [ ] Basic validation

### Phase 2: Determinism & Integration
- [ ] Content-addressed storage
- [ ] Receipt generation
- [ ] Rails ledger integration
- [ ] DAK context pack integration

### Phase 3: Advanced Features
- [ ] Batch rendering
- [ ] Contextual rendering
- [ ] Diff/version comparison
- [ ] Performance optimization

### Phase 4: Ecosystem
- [ ] Community pack registry
- [ ] Pack testing framework
- [ ] IDE integration
- [ ] Documentation generation

---

## Related Documents

- `agent/Agentic Prompts/prompt-packs-index.md` - Existing prompt pack definitions
- `agent/Agentic Prompts/formats/prompt-format-spec-v1.md` - Prompt format specification
- `agent/spec/BRIDGE_RAILS_RUNNER.md` - Rails/Runner bridge specification
- `docs/agent-runner-dag-plan.md` - DAK implementation plan
