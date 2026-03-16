# Unix-First Agent Orchestration Architecture (Enhanced with PAI Principles)

## Core Philosophy: Unix Principles + PAI v2 Architecture

1. **Modularity**: Each component does one thing and does it well (Unix)
2. **Connectivity**: Components communicate through standardized interfaces (Unix)
3. **Determinism**: Predictable behavior with clear inputs and outputs (Unix)
4. **Composability**: Simple tools combine to create complex workflows (Unix)
5. **Cognitive Operating System**: Continuously move from Current State → Desired State using verifiable iteration (PAI)
6. **System > Intelligence**: Determinism beats brilliance, Structure beats cleverness (PAI)

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                    PAI Agent Orchestration Platform           │
├─────────────────────────────────────────────────────────────────┤
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────┐ │
│  │  Agent      │  │  Agent      │  │  Agent      │  │  Agent  │ │
│  │  Adapter    │  │  Adapter    │  │  Adapter    │  │  Core   │ │
│  │  (Gemini)   │  │  (Claude)   │  │  (OpenAI)   │  │  API    │ │
│  └─────────────┘  └─────────────┘  └─────────────┘  └─────────┘ │
│         │                 │                 │            │      │
└─────────┼─────────────────┼─────────────────┼────────────┼──────┘
          │                 │                 │            │
          ▼                 ▼                 ▼            ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Message Bus Layer                          │
│  ┌─────────────────────────────────────────────────────────────┐ │
│  │  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────┐       │ │
│  │  │  Task   │  │  Event  │  │  State  │  │  Data   │       │ │
│  │  │  Queue  │  │  Bus    │  │  Store  │  │  Store  │       │ │
│  │  └─────────┘  └─────────┘  └─────────┘  └─────────┘       │ │
│  └─────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
          │                 │                 │            │
          │                 │                 │            │
          ▼                 ▼                 ▼            ▼
┌─────────────────────────────────────────────────────────────────┐
│                   Orchestration Engine                        │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐           │ │
│  │  Workflow   │  │  Task       │  │  Dependency │           │ │
│  │  Manager    │  │  Scheduler  │  │  Resolver   │           │ │
│  └─────────────┘  └─────────────┘  └─────────────┘           │ │
│         │                 │                 │                │ │
└─────────┼─────────────────┼─────────────────┼────────────────┘ │
          │                 │                 │                  │
          ▼                 ▼                 ▼                  │
┌─────────────────────────────────────────────────────────────────┐
│                    Intelligence Layer                         │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐           │ │
│  │  Analytics  │  │  AI/ML      │  │  Insights   │           │ │
│  │  Engine     │  │  Engine     │  │  Engine     │           │ │
│  └─────────────┘  └─────────────┘  └─────────────┘           │ │
└─────────────────────────────────────────────────────────────────┘
```

## PAI v2 Core Subsystems Integration

### 1. Core Identity / Constitution Layer (Immutable)
- **Purpose**: Trust, safety, coherence
- **Contains**: Non-overrideable rules, command authority boundaries, security axioms, values/mission constraints
- **Implementation**: Locked "root policy module" in the orchestration engine
- **Unix Integration**: Each policy module is a single-purpose tool that enforces constitutional rules

### 2. Skills System (Domain Intelligence Containers)
- **Definition**: A Skill = reusable, versioned unit of how you work
- **Components**:
  - SKILL.md → routing + domain knowledge
  - Workflows/ → procedures (scientific loop encoded)
  - Tools/ → deterministic executables
- **Unix Integration**: Skills are first-class packages, not prompts - each skill is a modular tool

### 3. Workflow Engine (Scientific Loop Executor)
- **Scientific Loop**: OBSERVE → THINK → PLAN → BUILD → EXECUTE → VERIFY → LEARN
- **Requirements**:
  - Every workflow starts with OBSERVE
  - Every workflow ends with VERIFY or LEARN
  - Every workflow emits artifacts
  - Every workflow declares success criteria
- **Verification Enforcement**: The VERIFY step is the kill-switch for hallucination and fake productivity

### 4. Agent System (Specialized Cognitive Roles)
- **Types**:
  - Named agents (persistent specialists)
  - Dynamic agents (composed on demand)
- **Definition**: Defined by personality traits, expertise scope, skill access, approach style
- **Unix Integration**: Agents = parameterized runtimes over the same core engine

### 5. Context Routing System (Precision Hydration)
- **Rules**:
  - Agents never get global context
  - Skills hydrate agents selectively
  - Context is loaded just-in-time
- **Unix Integration**: Context routing is a compiler problem, not a prompt problem

### 6. History System (UOCS – Universal Output Capture)
- **Capture Everything**:
  - Sessions
  - Tool calls
  - Decisions
  - Learnings
  - Failures
- **Storage Formats**:
  - Markdown (human)
  - JSONL (machine)
  - Timestamped
- **Unix Integration**: History is a write-only ledger + indexed knowledge graph

### 7. Hook System (Event-Driven Automation)
- **Hook Events**:
  - SessionStart, PreToolUse, PostToolUse
  - SubagentStop, Stop
- **Capabilities**:
  - Security validation
  - Logging
  - Voice summaries
  - Self-updates
  - Observability
- **Unix Integration**: Hooks = lifecycle middleware

### 8. Interface Layer (Replaceable)
- **Priority**: CLI first, Voice second, GUI optional, AR eventual
- **Unix Integration**: Interfaces do not contain logic; treat UI as a client, never the brain

## Enhanced File Structure Template

```
agent-orchestration/
├── adapters/                    # Agent-specific adapters
│   ├── gemini/
│   │   ├── adapter.py
│   │   ├── config.json
│   │   └── tests/
│   ├── claude/
│   │   ├── adapter.py
│   │   ├── config.json
│   │   └── tests/
│   ├── openai/
│   │   ├── adapter.py
│   │   ├── config.json
│   │   └── tests/
│   └── open-source/
│       ├── adapter.py
│       ├── config.json
│       └── tests/
├── core/                       # Core orchestration engine
│   ├── api/
│   │   ├── server.py
│   │   ├── routes/
│   │   │   ├── tasks.py
│   │   │   ├── workflows.py
│   │   │   └── agents.py
│   │   └── middleware/
│   ├── messaging/
│   │   ├── queue.py
│   │   ├── event_bus.py
│   │   └── protocols.py
│   ├── orchestration/
│   │   ├── workflow_manager.py
│   │   ├── task_scheduler.py
│   │   └── dependency_resolver.py
│   └── storage/
│       ├── state_store.py
│       ├── data_store.py
│       └── models/
├── constitution/               # Immutable policy layer
│   ├── policy_engine.py
│   ├── tenant_policy.py
│   └── security_axioms.py
├── skills/                     # Domain intelligence containers
│   ├── registry.py
│   ├── routing.py
│   ├── versioning.py
│   └── dependencies.py
├── workflows/                  # Scientific loop executor
│   ├── engine.py
│   ├── phases/
│   │   ├── observe.py
│   │   ├── think.py
│   │   ├── plan.py
│   │   ├── build.py
│   │   ├── execute.py
│   │   ├── verify.py
│   │   └── learn.py
│   └── verification.py
├── agents/                     # Specialized cognitive roles
│   ├── templates.py
│   ├── runtime.py
│   └── composition.py
├── context/                    # Precision hydration
│   ├── router.py
│   ├── pack_builder.py
│   └── scoping.py
├── history/                    # Universal output capture
│   ├── ledger.py
│   ├── capture.py
│   └── indexing.py
├── hooks/                      # Event-driven automation
│   ├── bus.py
│   ├── handlers/
│   │   ├── session_hooks.py
│   │   ├── tool_hooks.py
│   │   └── workflow_hooks.py
│   └── middleware.py
├── tools/                      # Deterministic executables
│   ├── gateway.py
│   ├── registry.py
│   ├── mcp_client.py
│   └── side_effects.py
├── intelligence/               # AI/ML components
│   ├── analytics/
│   │   ├── metrics_collector.py
│   │   └── dashboard.py
│   ├── ml/
│   │   ├── predictor.py
│   │   └── models/
│   └── insights/
│       └── recommender.py
├── config/                     # Configuration files
│   ├── default.json
│   ├── development.json
│   └── production.json
├── tests/                      # Test suites
│   ├── unit/
│   ├── integration/
│   └── e2e/
├── scripts/                    # Utility scripts
│   ├── setup.sh
│   ├── deploy.sh
│   └── migrate.sh
├── docs/                       # Documentation
│   ├── architecture.md
│   ├── api.md
│   └── deployment.md
├── Dockerfile
├── docker-compose.yml
├── requirements.txt
└── main.py
```

## System Design Specifications (Enhanced)

### 1. Agent Adapter Design (PAI-Enhanced)
```python
# adapters/base.py
class BaseAdapter:
    def authenticate(self) -> str:
        """Authenticate with the agent provider"""
        pass

    def send_request(self, prompt: str) -> dict:
        """Send request to the agent and return response"""
        pass

    def format_input(self, data: dict) -> str:
        """Format input data for the specific agent"""
        pass

    def format_output(self, response: dict) -> dict:
        """Format agent response to standardized format"""
        pass

    def get_expertise_scope(self) -> str:
        """Return the expertise scope of this agent"""
        pass

    def get_allowed_skills(self) -> list:
        """Return list of allowed skills for this agent"""
        pass
```

### 2. Policy Engine (Constitution Layer)
```python
# constitution/policy_engine.py
class PolicyDecision:
    decision: str  # "allow" | "deny" | "require_approval"
    reason: str
    constraints: dict  # e.g., redactions, domain allowlists
    approval_token_id: str  # if require_approval

class PolicyContext:
    principal: dict
    run_id: str
    tenant_id: str
    external_content: dict  # source, content_hash
    requested_action: str  # "route" | "context" | "tool_execute" | "artifact_write"
    metadata: dict

class PolicyEngine:
    def decide(self, ctx: PolicyContext) -> PolicyDecision:
        """Make policy decision based on context"""
        pass

    def approve(self, tenant_id: str, approval_token_id: str, principal: dict) -> None:
        """Approve a previously denied action"""
        pass
```

### 3. Skills System (Domain Intelligence)
```python
# skills/registry.py
class SkillRoutingRule:
    when: dict  # keywords, pathContains, intents
    route_to: dict  # workflowId
    priority: int

class SkillPackage:
    skill_id: str
    tenant_id: str
    name: str
    version: str  # semver
    description: str
    routing_rules: list[SkillRoutingRule]
    dependencies: list[dict]  # skillId, version
    assets: list[dict]  # path, contentHash
    workflows: list[dict]
    tools: list[dict]  # toolId references
    created_at: str

class SkillRegistry:
    def publish_skill(self, pkg: SkillPackage) -> None:
        """Publish a new skill package"""
        pass

    def list_skills(self, tenant_id: str) -> list:
        """List all skills for a tenant"""
        pass

    def get_skill(self, tenant_id: str, skill_id: str, version: str = None) -> SkillPackage:
        """Get a specific skill"""
        pass

    def resolve_dependencies(self, tenant_id: str, pins: dict) -> list[SkillPackage]:
        """Resolve skill dependencies"""
        pass
```

### 4. Workflow Engine (Scientific Loop)
```python
# workflows/engine.py
class VerifySpec:
    mode: str  # "auto" | "manual_gate"
    checks: list[dict]  # name, toolId, args
    success_criteria: list[str]

class WorkflowSpec:
    workflow_id: str
    name: str
    phases: list[str]  # OBSERVE, THINK, PLAN, BUILD, EXECUTE, VERIFY, LEARN
    input_schema: dict
    artifact_schema: dict
    verify: VerifySpec
    required_tools: list[str]
    recommended_agent_template_id: str

class WorkflowRunRequest:
    tenant_id: str
    principal: dict
    workflow_id: str
    input: dict
    skill_pins: dict
    scope: dict

class WorkflowEngine:
    def run(self, req: WorkflowRunRequest) -> dict:
        """Execute a workflow run"""
        pass
```

### 5. Context Router (Precision Hydration)
```python
# context/router.py
class ContextItem:
    source: str  # "skill_asset" | "history" | "project" | "policy"
    title: str
    content: str
    importance: float

class ContextPack:
    tenant_id: str
    run_id: str
    scope: dict
    items: list[ContextItem]
    token_budget: int
    redactions: list[str]

class ContextRouteRequest:
    tenant_id: str
    principal: dict
    run_id: str
    task: str
    skill_pins: dict
    agent_template_id: str
    workflow_id: str
    scope: dict

class ContextRouter:
    def build_context_pack(self, req: ContextRouteRequest) -> ContextPack:
        """Build a context pack for a specific request"""
        pass
```

### 6. History System (UOCS)
```python
# history/ledger.py
class HistoryEventType:
    # Core events
    SESSION_START = "SessionStart"
    SESSION_STOP = "SessionStop"
    WORKFLOW_START = "WorkflowStart"
    WORKFLOW_STOP = "WorkflowStop"
    AGENT_START = "AgentStart"
    AGENT_STOP = "AgentStop"
    # Tool events
    TOOL_CALL_REQUESTED = "ToolCallRequested"
    TOOL_CALL_POLICY_DECISION = "ToolCallPolicyDecision"
    TOOL_CALL_RESULT = "ToolCallResult"
    # Artifact events
    ARTIFACT_CREATED = "ArtifactCreated"
    ARTIFACT_UPDATED = "ArtifactUpdated"
    # Decision events
    DECISION_RECORDED = "DecisionRecorded"
    ERROR = "Error"
    VERIFY_RESULT = "VerifyResult"
    LEARNING_EXTRACTED = "LearningExtracted"

class HistoryEvent:
    event_id: str
    tenant_id: str
    run_id: str
    type: str
    timestamp: str  # ISO format
    payload: dict
    hash_prev: str
    hash: str

class HistoryQuery:
    tenant_id: str
    run_id: str = None
    types: list[str] = None
    time_range: dict = None  # start, end
    text_search: str = None
    vector_search: dict = None  # query, topK
    limit: int = None

class HistoryLedger:
    def append(self, event: dict) -> HistoryEvent:
        """Append an event to the ledger"""
        pass

    def query(self, q: HistoryQuery) -> list[HistoryEvent]:
        """Query the history ledger"""
        pass

    def verify_chain(self, tenant_id: str, run_id: str = None) -> dict:
        """Verify the integrity of the event chain"""
        pass
```

### 7. Hook System (Event-Driven Automation)
```python
# hooks/bus.py
class HookEventName:
    SESSION_START = "SessionStart"
    SESSION_STOP = "SessionStop"
    WORKFLOW_START = "WorkflowStart"
    WORKFLOW_STOP = "WorkflowStop"
    AGENT_START = "AgentStart"
    AGENT_STOP = "AgentStop"
    PRE_TOOL_USE = "PreToolUse"
    POST_TOOL_USE = "PostToolUse"
    VERIFY_RESULT = "VerifyResult"
    LEARNING_EXTRACTED = "LearningExtracted"

class HookEvent:
    name: str
    tenant_id: str
    run_id: str
    principal: dict
    payload: dict

class HookHandler:
    name: str
    def handle(self, event: HookEvent) -> None:
        """Handle a hook event (must be idempotent)"""
        pass

class HookBus:
    def register(self, tenant_id: str, event_name: str, handler: HookHandler) -> None:
        """Register a hook handler"""
        pass

    def emit(self, event: HookEvent) -> None:
        """Emit a hook event"""
        pass
```

### 8. Tool Gateway (Only Side-Effect Path)
```python
# tools/gateway.py
class SideEffectLevel:
    NONE = "none"
    READ = "read"
    WRITE = "write"
    DESTRUCTIVE = "destructive"

class ToolSpec:
    tool_id: str
    tenant_id: str
    name: str
    description: str
    side_effect: str  # SideEffectLevel
    input_schema: dict
    output_schema: dict
    provider: dict  # kind: "local" | "http" | "mcp", config
    policy: dict  # requiresApprovalFor, allowDomains

class ToolExecuteRequest:
    tenant_id: str
    principal: dict
    run_id: str
    tool_id: str
    input: dict
    approval_token_id: str = None

class ToolGateway:
    def execute(self, req: ToolExecuteRequest) -> dict:
        """Execute a tool with full policy enforcement"""
        pass
```

## Deterministic Template System (PAI-Enhanced)

### 1. Workflow Templates (Scientific Loop)
```yaml
# templates/data_analysis.yaml
name: "Data Analysis Pipeline"
description: "Analyze data using multiple agents with verification"
phases:
  - name: "OBSERVE"
    description: "Gather and analyze initial data state"
    adapter: "open-source"
    action: "observe_data"
    dependencies: []
    timeout: 300
  - name: "THINK"
    description: "Analyze patterns and form hypotheses"
    adapter: "gemini"
    action: "analyze_patterns"
    dependencies: ["OBSERVE"]
    timeout: 600
  - name: "PLAN"
    description: "Create analysis plan"
    adapter: "claude"
    action: "create_plan"
    dependencies: ["THINK"]
    timeout: 450
  - name: "BUILD"
    description: "Build analysis artifacts"
    adapter: "open-source"
    action: "build_artifacts"
    dependencies: ["PLAN"]
    timeout: 600
  - name: "EXECUTE"
    description: "Execute the analysis"
    adapter: "open-source"
    action: "execute_analysis"
    dependencies: ["BUILD"]
    timeout: 900
  - name: "VERIFY"
    description: "Verify analysis results"
    adapter: "open-source"
    action: "verify_results"
    dependencies: ["EXECUTE"]
    timeout: 300
    verification:
      mode: "auto"
      checks:
        - name: "data_integrity"
          tool_id: "data_validator"
          args: {"expected_format": "json"}
        - name: "result_accuracy"
          tool_id: "accuracy_checker"
          args: {"threshold": 0.95}
  - name: "LEARN"
    description: "Extract learnings for future use"
    adapter: "gemini"
    action: "extract_learnings"
    dependencies: ["VERIFY"]
    timeout: 300
```

### 2. Skill Package Template
```yaml
# skills/data_analysis/SKILL.md
name: "Data Analysis Skill"
version: "1.0.0"
description: "Comprehensive data analysis capabilities"
routing_rules:
  - when:
      keywords: ["analyze", "data", "pattern", "trend"]
      intents: ["analyze_data", "find_patterns", "data_insights"]
    route_to:
      workflow_id: "data_analysis_workflow"
    priority: 10

dependencies:
  - skill_id: "data_preprocessing"
    version: "^1.0.0"
  - skill_id: "report_generation"
    version: "^1.0.0"

assets:
  - path: "knowledge/data_analysis_methods.md"
  - path: "examples/sample_analysis.json"

workflows:
  - workflow_id: "data_analysis_workflow"
    name: "Comprehensive Data Analysis"
    phases: ["OBSERVE", "THINK", "PLAN", "BUILD", "EXECUTE", "VERIFY", "LEARN"]
    verify:
      mode: "auto"
      checks:
        - name: "data_integrity"
          tool_id: "data_validator"
          args: {"expected_format": "json"}
        - name: "result_accuracy"
          tool_id: "accuracy_checker"
          args: {"threshold": 0.95}
      success_criteria:
        - "Data integrity check passes"
        - "Result accuracy above threshold"
        - "No critical errors in processing"

tools:
  - tool_id: "data_validator"
  - tool_id: "accuracy_checker"
  - tool_id: "data_visualizer"
```

## Unix-First Implementation Principles (Enhanced)

### 1. Small, Single-Purpose Tools
- Each adapter handles only one agent provider
- Each service performs one specific function
- Each script has a single, clear purpose
- Each policy module enforces one type of rule

### 2. Standardized Input/Output
- All components use JSON for data exchange
- Standardized error formats across all services
- Consistent logging format for all components
- Universal output capture (UOCS) for all events

### 3. Chainability
- Output of one service can be input to another
- Services can be combined to create complex workflows
- Pipeline operations supported natively
- Scientific loop phases chain together deterministically

### 4. Configurability
- All services configurable via environment variables
- Configuration files for different environments
- Runtime configuration updates supported
- Tenant-specific policy overlays

### 5. Verification Enforcement
- Every workflow must include verification step
- No unverifiable workflow completion allowed
- Explicit manual gates where auto-verification unavailable
- Tamper-evident history ledger

## Deployment Architecture (PAI-Enhanced)

### Docker Compose Configuration
```yaml
version: '3.8'
services:
  api-gateway:
    build: .
    command: python -m core.api.server
    ports:
      - "8000:8000"
    environment:
      - REDIS_URL=redis://redis:6379
      - DB_URL=postgresql://user:pass@db:5432/orchestration
      - POLICY_ENGINE_URL=http://policy-engine:8080
    depends_on:
      - redis
      - db
      - policy-engine

  policy-engine:
    build: .
    command: python -m constitution.policy_engine
    environment:
      - DB_URL=postgresql://user:pass@db:5432/orchestration
    depends_on:
      - db

  workflow-engine:
    build: .
    command: python -m workflows.engine
    environment:
      - REDIS_URL=redis://redis:6379
      - DB_URL=postgresql://user:pass@db:5432/orchestration
    depends_on:
      - redis
      - db

  skill-registry:
    build: .
    command: python -m skills.registry
    environment:
      - DB_URL=postgresql://user:pass@db:5432/orchestration
    depends_on:
      - db

  context-router:
    build: .
    command: python -m context.router
    environment:
      - REDIS_URL=redis://redis:6379
      - DB_URL=postgresql://user:pass@db:5432/orchestration
    depends_on:
      - redis
      - db

  history-ledger:
    build: .
    command: python -m history.ledger
    environment:
      - DB_URL=postgresql://user:pass@db:5432/orchestration
    depends_on:
      - db

  hook-bus:
    build: .
    command: python -m hooks.bus
    environment:
      - REDIS_URL=redis://redis:6379
    depends_on:
      - redis

  tool-gateway:
    build: .
    command: python -m tools.gateway
    environment:
      - DB_URL=postgresql://user:pass@db:5432/orchestration
      - POLICY_ENGINE_URL=http://policy-engine:8080
    depends_on:
      - db
      - policy-engine

  redis:
    image: redis:alpine
    ports:
      - "6379:6379"

  db:
    image: postgres:13
    environment:
      - POSTGRES_DB=orchestration
      - POSTGRES_USER=user
      - POSTGRES_PASSWORD=pass
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data

volumes:
  postgres_data:
```

## Security & Governance (PAI-Enhanced)

### Defense-in-Depth Security Model
1. **Settings Hardening**: Tool allowlists, path restrictions
2. **Constitutional Defense**: External content read-only, command authority
3. **Pre-execution Validation**: Hook-based policy checks before every tool
4. **Safe Execution Primitives**: No shell injection, typed APIs, domain allowlists
5. **SSRF/Egress Control**: Block metadata IPs, private ranges
6. **Secret Scoping**: Least privilege, short-lived tokens
7. **Audit Chain**: Tamper-evident history events

### Multi-Tenancy Model
- **Data Isolation**: No cross-tenant reads/writes by default
- **Execution Isolation**: Agent/tool execution sandboxed per tenant
- **Secret Isolation**: Secrets never leave tenant boundary
- **Audit Isolation**: Logs are tenant-scoped and tamper-evident

This enhanced architecture provides a modular, interconnected system that follows Unix principles while incorporating PAI v2's cognitive operating system concepts. Each component can be developed, tested, and deployed independently while working together as a cohesive orchestration platform with strong verification, policy enforcement, and tenant isolation.

This architecture successfully combines the Unix-first principles of modularity and determinism with PAI's cognitive operating system approach, creating a platform that:
- Enforces the scientific loop (OBSERVE → THINK → PLAN → BUILD → EXECUTE → VERIFY → LEARN)
- Provides strong verification and anti-hallucination measures
- Maintains tenant isolation and security
- Supports skill-based domain intelligence
- Enables deterministic, reproducible workflows
- Provides comprehensive audit trails