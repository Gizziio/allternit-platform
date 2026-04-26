# A2R Workflow Blueprints - System Architecture

## Executive Summary

A2R Workflow Blueprints is a **manifest-based packaging system** that orchestrates existing A2R infrastructure (Cowork runtime, .gizzi persistence, connectors, plugins) into installable, shareable workflow templates.

**Core Principle**: Blueprints are YAML manifests, not new infrastructure.

---

## System Components

```
┌─────────────────────────────────────────────────────────────────────────────────────┐
│                              A2R WORKFLOW BLUEPRINTS                                │
│                              SYSTEM ARCHITECTURE                                    │
└─────────────────────────────────────────────────────────────────────────────────────┘

┌──────────────────┐     ┌──────────────────┐     ┌──────────────────┐
│   CLI Interface  │────▶│  Blueprint Core  │────▶│  A2R Infrastructure│
│    (gizzi)       │     │   (New Layer)    │     │   (Existing)       │
└──────────────────┘     └──────────────────┘     └──────────────────┘
         │                        │                       │
         │                        ▼                       │
         │               ┌──────────────────┐            │
         │               │  Manifest Layer  │            │
         │               │  - Validation    │            │
         │               │  - Parsing       │            │
         │               │  - Resolution    │            │
         │               └──────────────────┘            │
         │                                               │
         ▼                                               ▼
┌──────────────────┐                          ┌──────────────────┐
│  User Commands   │                          │  .gizzi Workspace │
│  - validate      │                          │  - agents/        │
│  - install       │                          │  - memory/        │
│  - run           │                          │  - connectors/    │
│  - list          │                          │  - blueprints/    │
└──────────────────┘                          └──────────────────┘
                                                       │
                                                       ▼
                                              ┌──────────────────┐
                                              │  Cowork Runtime   │
                                              │  - Scheduling     │
                                              │  - Execution      │
                                              │  - Approvals      │
                                              └──────────────────┘
```

---

## Layer 1: CLI Interface

### Purpose
User-facing command interface for blueprint operations.

### Components
```
a2r/cli/blueprint/
├── __init__.py
├── main.py              # Entry point, argument parsing
├── commands/
│   ├── validate.py      # gizzi blueprint validate
│   ├── install.py       # gizzi blueprint install
│   ├── list.py          # gizzi blueprint list
│   ├── run.py           # gizzi blueprint run
│   ├── deploy.py        # gizzi blueprint deploy (P1)
│   ├── logs.py          # gizzi blueprint logs (P2)
│   └── rollback.py      # gizzi blueprint rollback (P1)
├── formatters/
│   ├── table.py         # CLI table output
│   ├── json.py          # JSON output
│   └── yaml.py          # YAML output
└── exceptions.py        # CLI-specific errors
```

### Key Design Decisions
1. **Single entry point**: All blueprint commands under `gizzi blueprint`
2. **Consistent output**: Support `--format=(table|json|yaml)`
3. **Rich errors**: Human-readable error messages with suggestions
4. **Progress indication**: Show progress for long-running operations

---

## Layer 2: Blueprint Core (Manifest Layer)

### Purpose
Parse, validate, and resolve blueprint manifests.

### Components
```
a2r/blueprint/
├── __init__.py
├── models/
│   ├── __init__.py
│   ├── blueprint.py     # Main Blueprint dataclass
│   ├── agent.py         # Agent configuration
│   ├── connector.py     # Connector configuration
│   ├── routine.py       # Routine configuration
│   ├── environment.py   # Environment config (P1)
│   └── version.py       # Version metadata (P1)
├── parser/
│   ├── __init__.py
│   ├── loader.py        # YAML loading
│   ├── validator.py     # Schema validation
│   └── resolver.py      # Dependency resolution
├── schemas/
│   ├── blueprint-v1.json
│   └── blueprint-v2.json (future)
└── exceptions.py
```

### Data Flow
```
Blueprint YAML File
       │
       ▼
┌──────────────────┐
│  YAML Loader     │  → Parse YAML, handle syntax errors
└──────────────────┘
       │
       ▼
┌──────────────────┐
│  JSON Schema     │  → Validate structure, types
│  Validator       │
└──────────────────┘
       │
       ▼
┌──────────────────┐
│  Semantic        │  → Validate references, dependencies
│  Validator       │    Check agent IDs exist
└──────────────────┘       Check connector availability
       │
       ▼
┌──────────────────┐
│  Dependency      │  → Resolve blueprint dependencies
│  Resolver        │    Download external blueprints
└──────────────────┘
       │
       ▼
Blueprint Object (Python dataclass)
```

---

## Layer 3: Installer

### Purpose
Install blueprint components into .gizzi workspace.

### Components
```
a2r/blueprint/
├── installer/
│   ├── __init__.py
│   ├── installer.py     # Main installer orchestrator
│   ├── agents.py        # Agent installation
│   ├── connectors.py    # Connector configuration
│   ├── routines.py      # Routine registration
│   ├── plugins.py       # Plugin installation
│   └── rollback.py      # Rollback on failure
```

### Installation Flow
```
Blueprint Object
       │
       ▼
┌─────────────────────────────────────────────────────┐
│              PRE-INSTALL VALIDATION                  │
│  - Check disk space                                   │
│  - Verify permissions                                 │
│  - Validate connector credentials exist               │
└─────────────────────────────────────────────────────┘
       │
       ▼
┌─────────────────────────────────────────────────────┐
│              INSTALL AGENTS                          │
│  - Create .gizzi/agents/<agent_id>/                  │
│  - Write agent.yaml (persona, model, prompt)         │
│  - Install skills                                    │
└─────────────────────────────────────────────────────┘
       │
       ▼
┌─────────────────────────────────────────────────────┐
│           CONFIGURE CONNECTORS                       │
│  - Validate auth tokens/credentials                  │
│  - Test connectivity                                 │
│  - Store encrypted credentials                       │
└─────────────────────────────────────────────────────┘
       │
       ▼
┌─────────────────────────────────────────────────────┐
│           INSTALL PLUGINS                            │
│  - Check plugin availability                         │
│  - Install to .gizzi/plugins/                        │
└─────────────────────────────────────────────────────┘
       │
       ▼
┌─────────────────────────────────────────────────────┐
│           REGISTER ROUTINES                          │
│  - Create cowork routine entries                     │
│  - Schedule cron jobs                                │
│  - Set up approval gates (P1)                        │
└─────────────────────────────────────────────────────┘
       │
       ▼
┌─────────────────────────────────────────────────────┐
│           WRITE MANIFEST                             │
│  - Create .gizzi/blueprints/<id>/manifest.yaml       │
│  - Store installation metadata                       │
│  - Store version info                                │
└─────────────────────────────────────────────────────┘
       │
       ▼
    SUCCESS
```

### Rollback Strategy
Each installation step is **atomic** and **reversible**:
```python
class InstallationStep:
    def execute(self) -> Result:
        raise NotImplementedError
    
    def rollback(self) -> None:
        raise NotImplementedError

class AgentInstallationStep(InstallationStep):
    def execute(self):
        # Create backup first
        self.backup = self.create_backup()
        # Install
        self.install_agents()
    
    def rollback(self):
        # Restore from backup
        self.restore(self.backup)
```

---

## Layer 4: A2R Infrastructure Integration

### Cowork Runtime Integration
```python
# a2r/blueprint/runtime/cowork_adapter.py

class CoworkAdapter:
    """Integrate blueprints with Cowork runtime."""
    
    def register_routine(self, routine: Routine) -> str:
        """Register a blueprint routine with Cowork."""
        cowork_routine = CoworkRoutine(
            id=routine.id,
            schedule=routine.schedule,
            task=self.build_task(routine),
            approvals=self.build_approvals(routine),
        )
        return cowork.create_routine(cowork_routine)
    
    def build_task(self, routine: Routine) -> Task:
        """Convert blueprint routine to Cowork task."""
        return Task(
            agent_id=routine.task.agent,
            steps=[self.build_step(s) for s in routine.task.steps]
        )
```

### .gizzi Workspace Integration
```
.gizzi/
├── agents/                    # Existing
│   └── <agent_id>/
│       ├── agent.yaml
│       ├── memory/
│       └── skills/
├── connectors/                # Existing
│   └── <connector_id>/
│       ├── config.yaml
│       └── auth.json
├── blueprints/               # NEW
│   └── <blueprint_id>/
│       ├── manifest.yaml      # Installation metadata
│       ├── routines/          # Routine definitions
│       └── versions/          # Version history (P1)
├── cowork/                   # Existing
│   └── routines/
└── plugins/                  # Existing
    └── <plugin_id>/
```

---

## Data Models

### Blueprint Model
```python
@dataclass
class Blueprint:
    """Top-level blueprint model."""
    api_version: str          # "a2r.io/v1"
    kind: str                 # "WorkflowBlueprint"
    
    metadata: BlueprintMetadata
    agents: List[Agent]
    connectors: List[Connector]
    routines: List[Routine]
    plugins: List[Plugin]
    
    # Phase 1+
    environments: Optional[Environments]
    reliability: Optional[ReliabilityConfig]
    observability: Optional[ObservabilityConfig]

@dataclass
class BlueprintMetadata:
    id: str                   # Unique identifier
    name: str                 # Display name
    version: str              # SemVer
    description: str
    author: str
    tags: List[str]
    license: str
```

### Agent Model
```python
@dataclass
class Agent:
    id: str
    name: str
    model: str               # claude-3-opus, gpt-4, etc.
    system_prompt: str       # Path or inline
    temperature: float = 0.7
    max_tokens: int = 4096
    skills: List[str] = field(default_factory=list)
```

### Connector Model
```python
@dataclass
class Connector:
    id: str
    required: bool = True
    auth_type: str           # token, oauth, basic
    config: Dict[str, Any] = field(default_factory=dict)
```

### Routine Model
```python
@dataclass
class Routine:
    id: str
    schedule: str           # Cron expression
    requires: List[str]     # Required connector IDs
    task: Task
    enabled: bool = True

@dataclass
class Task:
    agent: str              # Agent ID
    steps: List[Step]

@dataclass
class Step:
    id: str
    action: str
    params: Dict[str, Any]
```

---

## Security Architecture

### Phase 0-2 (Basic)
```
- Local file storage only
- No secrets in blueprint files
- Connector credentials stored separately
```

### Phase 4 (Enterprise)
```
- Encrypted secret storage
- RBAC with role definitions
- Audit logging
- Input validation
- Output sanitization
```

### Secret Storage
```
.a2r/secrets/
├── keys/                  # Encryption keys
│   └── master.key        # Master encryption key
├── connectors/
│   ├── github.json.enc   # Encrypted connector secrets
│   └── slack.json.enc
└── index.json            # Secret metadata
```

---

## Scalability Architecture

### Phase 0-2 (Single Node)
```
- Local SQLite for metadata
- File system for storage
- Single process execution
```

### Phase 6 (Enterprise)
```
┌─────────────────────────────────────────────────────────────┐
│                      Load Balancer                          │
└─────────────────────────────────────────────────────────────┘
                         │
         ┌───────────────┼───────────────┐
         ▼               ▼               ▼
┌─────────────────┐ ┌─────────────────┐ ┌─────────────────┐
│  Blueprint      │ │  Blueprint      │ │  Blueprint      │
│  Instance 1     │ │  Instance 2     │ │  Instance N     │
└─────────────────┘ └─────────────────┘ └─────────────────┘
         │               │               │
         └───────────────┼───────────────┘
                         ▼
              ┌─────────────────┐
              │  Shared State   │
              │  (PostgreSQL)   │
              └─────────────────┘
```

---

## Error Handling Strategy

### Error Categories
```python
class BlueprintError(Exception):
    """Base blueprint error."""
    pass

class ValidationError(BlueprintError):
    """YAML/schema validation failed."""
    pass

class InstallationError(BlueprintError):
    """Installation failed."""
    def __init__(self, message, rollback_successful=False):
        super().__init__(message)
        self.rollback_successful = rollback_successful

class RuntimeError(BlueprintError):
    """Routine execution failed."""
    pass
```

### User-Facing Errors
```
ERROR: Blueprint validation failed

File: ./saas-startup-team.yaml
Line 23: connectors[0].auth_type

Expected one of: token, oauth, basic
Got: "api_key"

Fix: Change auth_type to "token" for GitHub connector.
See: https://docs.a2r.io/connectors/github
```

---

## Technology Stack

| Component | Technology | Rationale |
|-----------|-----------|-----------|
| CLI Framework | Click (Python) | Mature, extensible |
| YAML Parsing | PyYAML + yamllint | Standard, validates |
| Schema Validation | jsonschema | Industry standard |
| Data Classes | Pydantic | Validation, serialization |
| Testing | pytest | Standard for Python |
| Documentation | MkDocs | Good CLI integration |

---

## Migration Path

### From Existing A2R
```bash
# Users with existing .gizzi workspace
gizzi blueprint init
✓ Existing agents detected
✓ Existing connectors detected
✓ Would you like to create a blueprint? (y/N): y
✓ Created blueprint from existing configuration
```

### Backward Compatibility
- Existing `gizzi` commands continue to work
- Blueprints are additive, not replacing
- Manual configurations still supported
