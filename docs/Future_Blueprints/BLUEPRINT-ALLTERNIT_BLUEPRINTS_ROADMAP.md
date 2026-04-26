# Allternit Workflow Blueprints: Implementation Roadmap

## Current Foundation (What Allternit Already Has)

```
✓ Cowork Runtime     - Task execution, scheduling, approvals
✓ .gizzi Workspace   - Persistence, agents, heartbeat
✓ Connector System   - External app integrations
✓ Plugin System      - Skill bundles
✓ CLI (gizzi)        - Basic commands
✗ Blueprint System   - Need to build
```

**The blueprint system is a manifest layer on TOP of existing infrastructure** - not new infrastructure.

---

## Phase 0: Foundation (Weeks 1-3) - "Core Blueprint Engine"

**Goal**: Validate blueprint structure, install agents, run first routine

### 0.1 Blueprint Schema & Validation

```yaml
# .allternit/blueprints/saas-startup-team/blueprint.yaml
apiVersion: allternit.com/v1
kind: WorkflowBlueprint

metadata:
  id: saas-startup-team
  name: "SaaS Startup Team"
  version: 1.0.0
  author: "Allternit Team"

# Phase 0: Just these 3 components
agents:
  - id: tech-lead
    name: "Tech Lead"
    model: claude-3-sonnet
    system_prompt: "..."  # Path or inline
    
connectors:
  - id: github
    required: true
    auth_type: token
  - id: slack
    required: true
    auth_type: oauth

routines:
  - id: daily-standup
    schedule: "0 9 * * 1-5"
    requires: [github, slack]
    task:
      agent: tech-lead
      steps:
        - fetch_prs
        - analyze
        - post_summary
```

**Implementation:**
```python
# allternit/cli/blueprint.py
class BlueprintLoader:
    def load(self, path: str) -> Blueprint:
        # Validate YAML against schema
        # Check all required fields
        # Validate agent references
        pass

class BlueprintInstaller:
    def install(self, blueprint: Blueprint):
        # 1. Install agents to .gizzi/agents/
        # 2. Configure connectors (prompt for auth)
        # 3. Create cowork routines
        # 4. Write blueprint manifest
        pass
```

### 0.2 CLI Commands

```bash
# Validate a blueprint
gizzi blueprint validate ./blueprint.yaml

# Install a blueprint
gizzi blueprint install ./blueprint.yaml
✓ Installing saas-startup-team v1.0.0
✓ Installing agents...
✓ Configuring connectors...
  ? GitHub token: [hidden]
  ? Slack OAuth: [opening browser...]
✓ Creating routines...
✓ Installed successfully

# List installed blueprints
gizzi blueprint list
NAME                    VERSION  ROUTINES  STATUS
saas-startup-team       1.0.0    5         active
seo-content-machine     1.2.0    3         paused

# Run a routine manually
gizzi blueprint run saas-startup-team --routine=daily-standup
```

### 0.3 Basic Workspace Structure

```
.gizzi/
├── agents/
│   ├── tech-lead/
│   │   ├── agent.yaml          # Persona, model, system prompt
│   │   ├── memory/             # Long-term memory
│   │   └── skills/             # Available skills
├── blueprints/                 # NEW
│   ├── saas-startup-team/
│   │   ├── blueprint.yaml      # Manifest
│   │   ├── routines/
│   │   │   └── daily-standup.yaml
│   │   └── installed_at: 2026-03-26
├── connectors/
│   ├── github/
│   │   ├── config.yaml
│   │   └── auth.json           # Encrypted tokens
├── cowork/
│   └── routines/               # Scheduled tasks
└── memory/
```

**Phase 0 Success Criteria:**
- [ ] Can validate a blueprint YAML
- [ ] Can install a blueprint (agents, connectors, routines)
- [ ] Can run a routine manually
- [ ] Routine appears in `cowork list`

---

## Phase 1: Dev/Prod & Versioning (Weeks 4-6) - "Professional Workflow"

**Goal**: Stop deploying to production blindly

### 1.1 Environment Separation

```yaml
# In blueprint.yaml
environments:
  dev:
    model: gpt-3.5-turbo        # Cheaper
    connectors:
      slack:
        channel: "#test-channel"
        
  staging:
    model: claude-3-sonnet
    connectors:
      slack:
        channel: "#eng-staging"
        
  prod:
    model: claude-3-opus
    connectors:
      slack:
        channel: "#engineering"
    approvals:
      required: true
```

```bash
# Deploy to specific environment
gizzi blueprint deploy saas-startup-team --env=staging

# Promote between environments
gizzi blueprint promote saas-startup-team --from=staging --to=prod
⚠ Approval required
? Approve? (y/N): y
✓ Promoted
```

### 1.2 Basic Versioning

```bash
# Version commands
gizzi blueprint versions saas-startup-team
v1.0.2  current  2 days ago
v1.0.1           1 week ago
v1.0.0           2 weeks ago

# Simple rollback
gizzi blueprint rollback saas-startup-team --to=v1.0.1
```

**Phase 1 Success Criteria:**
- [ ] Can deploy to dev/staging/prod
- [ ] Can rollback to previous version
- [ ] Production requires approval

---

## Phase 2: Observability (Weeks 7-9) - "Stop Flying Blind"

**Goal**: See what's happening when things break

### 2.1 Execution Logging

```yaml
# Auto-injected on blueprint install
observability:
  logging:
    enabled: true
    level: detailed
    destination: .allternit/logs/
  
  tracing:
    enabled: true
    include_prompts: true
    include_responses: true
```

```bash
# View recent runs
gizzi blueprint runs saas-startup-team --limit=10
RUN_ID      ROUTINE          STATUS    DURATION  TOKENS
run_67890   daily-standup    success   3.2s      4,567
run_67889   incident-check   failed    1.1s      1,234

# View specific run
gizzi blueprint logs saas-startup-team --run=run_67890

[10:00:00] Step 1: fetch_prs
  Input: {repo: "myorg/myproject"}
  Prompt: "List open pull requests..."
  Output: {count: 8}
  Duration: 890ms
  
[10:00:01] Step 2: analyze
  Prompt: "Review these PRs..."
  Output: "Found 2 blockers..."
  Duration: 2,340ms
```

### 2.2 Simple Metrics

```bash
# Cost tracking
gizzi blueprint costs saas-startup-team
Today: $0.57 / $50.00 budget
This Month: $234 / $1000

# Simple dashboard (text-based)
gizzi blueprint dashboard saas-startup-team
┌─────────────────────────────────────────┐
│  Blueprint: saas-startup-team          │
├─────────────────────────────────────────┤
│  Runs Today: 12   Success: 11 (92%)    │
│  Avg Duration: 2.3s                    │
│  Tokens Used: 45K                      │
│  Cost Today: $0.57                     │
└─────────────────────────────────────────┘
```

**Phase 2 Success Criteria:**
- [ ] Can see full execution trace
- [ ] Can see prompts and responses
- [ ] Can view costs

---

## Phase 3: Reliability (Weeks 10-13) - "Production Hardening"

**Goal**: Stop the infinite loops, add circuit breakers

### 3.1 Circuit Breakers

```yaml
reliability:
  circuit_breakers:
    max_iterations: 5           # Prevent infinite loops
    max_tool_calls: 10          # Prevent runaway API calls
    max_tokens_per_run: 100000  # Prevent runaway costs
    timeout: 300s               # Prevent hanging
    
  retry_policy:
    max_retries: 3
    backoff: exponential
    
  fallback:
    enabled: true
    on_failure: notify_and_continue
```

### 3.2 Determinism Mode

```bash
# Test for determinism
gizzi blueprint test saas-startup-team --routine=daily-standup
Running 5 times with same input...
✓ Run 1: success, output hash: abc123
✓ Run 2: success, output hash: abc123  # Same!
✓ Run 3: success, output hash: abc123
✓ Deterministic: True
```

### 3.3 State Checkpoints

```yaml
# Save state after each step
checkpoints:
  enabled: true
  frequency: every_step
  retention: 30days
```

```bash
# Resume from checkpoint after failure
gizzi blueprint resume saas-startup-team --run=run_67890 --from=step_2
```

**Phase 3 Success Criteria:**
- [ ] Infinite loops are caught and stopped
- [ ] Can resume from checkpoint after failure
- [ ] Deterministic mode available

---

## Phase 4: Security & Cost Control (Weeks 14-17) - "Enterprise Ready"

**Goal**: Make it safe for real companies

### 4.1 Basic RBAC

```yaml
security:
  rbac:
    enabled: true
    roles:
      - name: admin
        permissions: [all]
      - name: user
        permissions: [run, read]
      - name: viewer
        permissions: [read]
```

```bash
# Add user
gizzi blueprint users add saas-startup-team --user=alice --role=user
```

### 4.2 Budget Controls

```yaml
cost_control:
  budgets:
    daily:
      cost_usd: 50.00
    monthly:
      cost_usd: 1000.00
  on_exceed: notify_and_throttle
```

### 4.3 Secret Management

```bash
# Store secrets securely
gizzi secrets set GITHUB_TOKEN --value=ghp_xxxx
✓ Secret encrypted and stored
```

**Phase 4 Success Criteria:**
- [ ] Budget limits enforced
- [ ] RBAC controls access
- [ ] Secrets encrypted

---

## Phase 5: Registry & Marketplace (Weeks 18-22) - "Distribution"

**Goal**: Share and discover blueprints

### 5.1 GitHub Registry

```bash
# Publish to GitHub
gizzi blueprint publish saas-startup-team --registry=github
✓ Published to github.com/allternit-blueprints/saas-startup-team

# Install from registry
gizzi blueprint install github.com/allternit-blueprints/saas-startup-team
```

### 5.2 Search & Discovery

```bash
# Search registry
gizzi blueprint search --tag=engineering
Found 5 blueprints:
  - saas-startup-team ⭐ 234
  - incident-response ⭐ 189
  - code-review-bot ⭐ 156

# Install from search
gizzi blueprint install incident-response
```

### 5.3 Plugin Bundles

```bash
# Install domain bundle
gizzi bundle install engineering
✓ Installed engineering bundle
  Includes: code-review, system-design, incident-response
```

**Phase 5 Success Criteria:**
- [ ] Can publish to GitHub
- [ ] Can install from GitHub
- [ ] Can search blueprints

---

## Phase 6: Advanced Enterprise (Weeks 23-28) - "Scale"

**Goal**: Handle real enterprise complexity

### 6.1 Auto-scaling
```yaml
scaling:
  autoscaling:
    enabled: true
    min_instances: 2
    max_instances: 50
```

### 6.2 Audit Logging
```yaml
audit:
  enabled: true
  log_all: true
  retention: 1year
```

### 6.3 Compliance
```yaml
compliance:
  soc2: true
  gdpr: true
  data_residency: us-east-1
```

**Phase 6 Success Criteria:**
- [ ] Auto-scaling works
- [ ] Full audit trail
- [ ] Compliance certifications

---

## Where We Begin: Phase 0, Week 1

### Week 1 Sprint: "First Blueprint"

**Day 1-2**: Blueprint schema definition
- Define YAML schema (agents, connectors, routines)
- Build validation logic

**Day 3-4**: Blueprint loader
- Parse blueprint YAML
- Validate against existing agents/connectors

**Day 5**: First end-to-end test
- Create test blueprint
- Install it
- Verify files created correctly

### Week 2 Sprint: "First Run"

**Day 1-2**: Blueprint installer
- Copy agent files to .gizzi/agents/
- Configure connectors
- Create cowork routines

**Day 3-4**: CLI commands
- `gizzi blueprint validate`
- `gizzi blueprint install`
- `gizzi blueprint list`

**Day 5**: Manual routine execution
- `gizzi blueprint run <name> --routine=<routine>`

### Week 3 Sprint: "Polish"

- Error handling
- Better CLI output
- Documentation

---

## Risk Mitigation

### What Could Go Wrong?

| Risk | Mitigation |
|------|------------|
| Schema changes break blueprints | Version the schema (v1, v2) |
| Connector auth is complex | Start with token-based only |
| Routine execution fails | Build on existing Cowork runtime |
| Users want features we don't have | Phase 0 = minimal, listen to users |

### Success Metrics by Phase

**Phase 0**: Can install 1 blueprint, run 1 routine
**Phase 1**: No prod deployments without approval
**Phase 2**: Debug a failed run in <5 minutes
**Phase 3**: 0 infinite loops in production
**Phase 4**: Pass security audit
**Phase 5**: 10 blueprints published
**Phase 6**: 1 enterprise customer

---

## The Team Needed

**Phase 0-2** (Core Platform):
- 1 Backend Engineer (Go/Rust) - blueprint engine
- 1 CLI Engineer - gizzi commands
- 1/2 Designer - CLI UX

**Phase 3-4** (Enterprise):
- 1 Security Engineer - RBAC, audit
- 1 DevOps Engineer - scaling, reliability

**Phase 5-6** (Ecosystem):
- 1 Community Manager - blueprints, docs
- 1 Enterprise Sales - customer validation

---

## Summary

**We start small**: Phase 0 is just a manifest parser + installer.
**We build on existing foundation**: Cowork, .gizzi, connectors already work.
**We ship incrementally**: Each phase delivers working software.
**We validate with users**: After Phase 2, get real users, adjust roadmap.

**First commit goal**: `gizzi blueprint validate ./blueprint.yaml` passes.

**First demo goal**: Install a blueprint, run a routine, see it in cowork list.
