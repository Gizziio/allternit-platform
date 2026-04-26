# Blueprint YAML Schema Specification

## Version: a2r.io/v1

## Overview

This document defines the complete YAML schema for A2R Workflow Blueprints.

---

## Phase 0: Core Schema

### Minimal Valid Blueprint

```yaml
apiVersion: a2r.io/v1
kind: WorkflowBlueprint

metadata:
  id: saas-startup-team
  name: "SaaS Startup Team"
  version: 1.0.0
  description: "Daily standup and PR review automation"
  author: "Jane Doe <jane@example.com>"

agents:
  - id: tech-lead
    name: "Tech Lead"
    model: claude-3-sonnet
    system_prompt: |
      You are a senior tech lead. Your job is to review PRs,
      identify blockers, and post standup summaries.

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
        - id: fetch_prs
          action: github.list_pull_requests
          params:
            repo: "{{config.repo}}"
            state: open
            
        - id: analyze
          action: agent.analyze
          params:
            input: "{{steps.fetch_prs.output}}"
            prompt: "Identify blockers and summarize"
            
        - id: post_summary
          action: slack.post_message
          params:
            channel: "{{config.channel}}"
            text: "{{steps.analyze.output}}"
```

---

## Schema Reference

### Top-Level Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `apiVersion` | string | Yes | Schema version: `"a2r.io/v1"` |
| `kind` | string | Yes | Resource type: `"WorkflowBlueprint"` |
| `metadata` | object | Yes | Blueprint metadata |
| `agents` | array | Yes | Agent definitions |
| `connectors` | array | Yes | Connector definitions |
| `routines` | array | Yes | Routine definitions |
| `plugins` | array | No | Plugin dependencies |

### Metadata Object

```yaml
metadata:
  id: string            # Required. Unique identifier [a-z0-9-]+
  name: string          # Required. Display name
  version: string       # Required. SemVer (e.g., "1.0.0")
  description: string   # Required. Brief description
  author: string        # Required. Name <email>
  tags: [string]        # Optional. Categorization tags
  license: string       # Optional. SPDX identifier
  homepage: string      # Optional. URL to docs
  repository: string    # Optional. GitHub URL
```

### Agent Object

```yaml
agents:
  - id: string                  # Required. Unique within blueprint
    name: string                # Required. Display name
    model: string               # Required. Model identifier
    system_prompt: string       # Required. Path or inline text
    temperature: number         # Optional. Default: 0.7 (0.0-2.0)
    max_tokens: integer         # Optional. Default: 4096
    top_p: number               # Optional. Default: 1.0
    skills: [string]            # Optional. Skill IDs to enable
    memory:                     # Optional. Memory configuration
      short_term: boolean       # Default: true
      long_term: boolean        # Default: true
    permissions:                # Optional. Agent permissions
      file_read: boolean        # Default: true
      file_write: boolean       # Default: false
      network: boolean          # Default: true
```

**Model Identifiers**:
- `claude-3-opus`
- `claude-3-sonnet`
- `claude-3-haiku`
- `gpt-4`
- `gpt-4-turbo`
- `gpt-3.5-turbo`
- `local/<model-id>` (for local models)

### Connector Object

```yaml
connectors:
  - id: string              # Required. Connector type identifier
    required: boolean       # Optional. Default: true
    auth_type: string       # Required. Auth method
    config:                 # Optional. Connector-specific config
      key: value
```

**Built-in Connector IDs**:
- `github`
- `slack`
- `discord`
- `notion`
- `linear`
- `jira`
- `gitlab`
- `hubspot`
- `salesforce`
- `zapier`
- `make`
- `google-calendar`
- `gmail`
- `airtable`
- `supabase`

**Auth Types**:
- `token` - API key/token
- `oauth` - OAuth 2.0 flow
- `basic` - Username/password
- `bearer` - Bearer token
- `none` - No authentication

### Routine Object

```yaml
routines:
  - id: string              # Required. Unique identifier
    name: string            # Optional. Display name
    description: string     # Optional. Description
    schedule: string        # Required. Cron expression
    timezone: string        # Optional. Default: "UTC"
    enabled: boolean        # Optional. Default: true
    requires: [string]      # Required. Connector IDs needed
    retries:                # Optional. Retry configuration
      max_attempts: integer # Default: 3
      backoff: string       # "fixed" | "exponential"
    timeout: string         # Optional. Duration (e.g., "5m")
    task:                   # Required. Task definition
      agent: string         # Required. Agent ID
      steps: [Step]         # Required. Steps to execute
```

### Step Object

```yaml
steps:
  - id: string              # Required. Unique within routine
    name: string            # Optional. Display name
    action: string          # Required. Action to execute
    params: object          # Optional. Action parameters
    condition: string       # Optional. Conditional expression
    timeout: string         # Optional. Step timeout
    retries:                # Optional. Step-specific retries
      max_attempts: integer
      backoff: string
```

**Action Types**:

| Pattern | Description | Example |
|---------|-------------|---------|
| `connector.<action>` | Connector action | `github.list_pull_requests` |
| `agent.<action>` | Agent action | `agent.analyze`, `agent.generate` |
| `control.<action>` | Control flow | `control.wait`, `control.branch` |

**Built-in Actions**:

```yaml
# GitHub actions
github.list_pull_requests
github.get_pull_request
github.create_comment
github.merge_pull_request

# Slack actions
slack.post_message
slack.update_message
slack.create_channel
slack.add_reaction

# Agent actions
agent.analyze          # Analyze input with agent
agent.generate         # Generate content
agent.decide           # Make a decision
agent.summarize        # Summarize content

# Control actions
control.wait           # Wait for duration
control.approve        # Request human approval
control.branch         # Conditional branch
control.parallel       # Execute steps in parallel
```

### Templating

Use `{{...}}` syntax for dynamic values:

```yaml
params:
  # Config values
  repo: "{{config.github.repo}}"
  
  # Previous step output
  prs: "{{steps.fetch_prs.output}}"
  
  # Environment variables
  api_key: "{{env.GITHUB_TOKEN}}"
  
  # Secrets
  token: "{{secrets.github.token}}"
  
  # Computed values
  count: "{{steps.fetch_prs.output.length}}"
```

---

## Phase 1: Environments & Versioning

### Environment Configuration

```yaml
environments:
  dev:
    variables:              # Environment variables
      LOG_LEVEL: debug
      
    model:                  # Model overrides
      provider: openai
      model: gpt-3.5-turbo
      
    connectors:             # Connector overrides
      slack:
        channel: "#engineering-dev"
        
    agents:                 # Agent overrides
      tech-lead:
        temperature: 0.9    # More creative in dev
        
    approvals:              # Approval settings
      required: false       # No approvals in dev
      
  staging:
    model:
      provider: anthropic
      model: claude-3-sonnet
      
    approvals:
      required: false
      
  prod:
    model:
      provider: anthropic
      model: claude-3-opus
      
    connectors:
      slack:
        channel: "#engineering"
        
    approvals:
      required: true
      approvers: [tech-lead, senior-engineer]
      timeout: 4h
```

### Version Metadata

```yaml
metadata:
  id: saas-startup-team
  version: 1.0.0
  
versioning:
  type: git               # git | semver | calendar
  branch: main
  tag_prefix: "v"
  
  dependencies:           # Other blueprint dependencies
    - id: base-infrastructure
      version: ">=1.0.0"
      
  migrations:             # Migration scripts
    - from: "0.9.0"
      to: "1.0.0"
      script: ./migrations/v0.9-to-v1.0.sh
```

---

## Phase 2: Observability

```yaml
observability:
  logging:
    enabled: true
    level: detailed        # minimal | detailed | debug
    include:
      - prompts
      - responses
      - tool_calls
      - token_usage
    destination:
      - file: .a2r/logs/
      - console: pretty
      - external: datadog   # External logging
      
  tracing:
    enabled: true
    sampling: 1.0          # 0.0-1.0, percentage to trace
    
  metrics:
    enabled: true
    export_interval: 60s
    destination: prometheus
```

---

## Phase 3: Reliability

```yaml
reliability:
  circuit_breakers:
    enabled: true
    max_iterations: 5
    max_tool_calls: 10
    max_tokens_per_run: 100000
    timeout: 300s
    
  retry_policy:
    max_retries: 3
    backoff: exponential    # fixed | exponential | linear
    initial_delay: 1s
    max_delay: 30s
    
  fallback:
    enabled: true
    on_failure: notify_and_continue
    fallback_agent: human-escalation
    
  checkpoints:
    enabled: true
    frequency: every_step   # every_step | on_error | manual
    retention: 30days
    
  determinism:
    enabled: false          # Enable for testing
    seed: 42                # Random seed
```

---

## Phase 4: Security & Cost Control

```yaml
security:
  rbac:
    enabled: true
    roles:
      - name: admin
        permissions: [all]
      - name: operator
        permissions: [run, read, update]
      - name: viewer
        permissions: [read]
        
  secrets:
    storage: encrypted_file   # encrypted_file | vault | aws_secrets
    encryption: aes256
    
  audit:
    enabled: true
    events:
      - blueprint_created
      - blueprint_modified
      - routine_executed
      - approval_given
      - secret_accessed
    retention: 1year
    
cost_control:
  budgets:
    daily:
      tokens: 1000000
      cost_usd: 50.00
    monthly:
      tokens: 20000000
      cost_usd: 1000.00
      
  on_exceed:
    action: notify_and_throttle
    notify: [admin, finance-team]
    
  model_routing:
    enabled: true
    strategy: cost_optimized
```

---

## Complete Example (All Phases)

```yaml
apiVersion: a2r.io/v1
kind: WorkflowBlueprint

metadata:
  id: enterprise-saas-team
  name: "Enterprise SaaS Team"
  version: 2.1.0
  description: "Production-grade engineering team automation"
  author: "A2R Team <team@a2r.io>"
  tags: [engineering, saas, enterprise]
  license: MIT
  homepage: https://blueprints.a2r.io/enterprise-saas-team
  repository: https://github.com/a2r-blueprints/enterprise-saas-team

agents:
  - id: tech-lead
    name: "Tech Lead"
    model: claude-3-opus
    system_prompt: ./prompts/tech-lead.txt
    temperature: 0.3
    max_tokens: 8192
    skills:
      - code-review
      - system-design
      - incident-response
    memory:
      short_term: true
      long_term: true
    permissions:
      file_read: true
      file_write: false
      network: true

  - id: on-call-engineer
    name: "On-Call Engineer"
    model: claude-3-sonnet
    system_prompt: ./prompts/on-call.txt
    skills:
      - incident-response
      - monitoring
      - alerting

connectors:
  - id: github
    required: true
    auth_type: token
    config:
      enterprise_url: "{{config.github.enterprise_url}}"
      
  - id: slack
    required: true
    auth_type: oauth
    config:
      workspace: "{{config.slack.workspace}}"
      
  - id: pagerduty
    required: false
    auth_type: token
    
  - id: datadog
    required: false
    auth_type: token

routines:
  - id: daily-standup
    name: "Daily Standup Report"
    schedule: "0 9 * * 1-5"
    timezone: "America/New_York"
    requires: [github, slack]
    enabled: true
    retries:
      max_attempts: 3
      backoff: exponential
    timeout: "10m"
    task:
      agent: tech-lead
      steps:
        - id: fetch_prs
          name: "Fetch Open PRs"
          action: github.list_pull_requests
          params:
            repo: "{{config.repo}}"
            state: open
            limit: 50
            
        - id: check_ci_status
          name: "Check CI Status"
          action: github.list_workflow_runs
          params:
            repo: "{{config.repo}}"
            branch: main
            
        - id: analyze_blockers
          name: "Identify Blockers"
          action: agent.analyze
          params:
            input:
              prs: "{{steps.fetch_prs.output}}"
              ci_status: "{{steps.check_ci_status.output}}"
            prompt: |
              Identify PRs that are:
              1. Ready to merge (approved, green CI)
              2. Blocked (failing CI, no reviews)
              3. Stale (>3 days old)
              
        - id: post_summary
          name: "Post to Slack"
          action: slack.post_message
          params:
            channel: "{{config.channel}}"
            text: "{{steps.analyze_blockers.output}}"
            unfurl_links: false

  - id: incident-response
    name: "Incident Response"
    schedule: "*/5 * * * *"  # Every 5 minutes
    requires: [pagerduty, slack, datadog]
    enabled: false  # Manual trigger only
    task:
      agent: on-call-engineer
      steps:
        - id: check_alerts
          action: datadog.list_alerts
          params:
            status: triggered
            
        - id: create_incident
          condition: "{{steps.check_alerts.output.length > 0}}"
          action: pagerduty.create_incident
          params:
            title: "{{steps.check_alerts.output.0.title}}"
            
        - id: notify_slack
          action: slack.post_message
          params:
            channel: "#incidents"
            text: "🚨 Incident created: {{steps.create_incident.output.url}}"

plugins:
  - id: engineering
    version: ">=2.0.0"
  - id: operations
    version: ">=1.5.0"

environments:
  dev:
    model:
      provider: openai
      model: gpt-3.5-turbo
    connectors:
      slack:
        channel: "#engineering-dev"
    approvals:
      required: false
      
  staging:
    model:
      provider: anthropic
      model: claude-3-sonnet
    connectors:
      slack:
        channel: "#engineering-staging"
    approvals:
      required: false
      
  prod:
    model:
      provider: anthropic
      model: claude-3-opus
    connectors:
      slack:
        channel: "#engineering"
      github:
        enterprise_url: "https://github.mycompany.com"
    approvals:
      required: true
      approvers: [tech-lead, engineering-manager]
      timeout: 2h
      urgent_approval:
        enabled: true
        approvers: [on-call-engineer]
        
observability:
  logging:
    enabled: true
    level: detailed
    include:
      - prompts
      - responses
      - tool_calls
      - token_usage
    destination:
      - file: .a2r/logs/
      
  tracing:
    enabled: true
    sampling: 1.0
    
  metrics:
    enabled: true
    export_interval: 60s

reliability:
  circuit_breakers:
    enabled: true
    max_iterations: 5
    max_tool_calls: 20
    max_tokens_per_run: 200000
    timeout: 600s
    
  retry_policy:
    max_retries: 3
    backoff: exponential
    initial_delay: 1s
    max_delay: 60s
    
  fallback:
    enabled: true
    on_failure: notify_and_escalate
    fallback_agent: human-escalation
    
  checkpoints:
    enabled: true
    frequency: every_step
    retention: 90days

security:
  rbac:
    enabled: true
    roles:
      - name: blueprint_admin
        permissions: [create, read, update, delete, run, promote]
      - name: blueprint_operator
        permissions: [read, run, update]
      - name: blueprint_viewer
        permissions: [read]
        
  secrets:
    storage: encrypted_file
    encryption: aes256
    
  audit:
    enabled: true
    events: [all]
    retention: 1year

cost_control:
  budgets:
    daily:
      tokens: 2000000
      cost_usd: 100.00
    monthly:
      tokens: 50000000
      cost_usd: 2000.00
      
  on_exceed:
    action: notify_and_throttle
    notify: [admin, finance-team]
    
  model_routing:
    enabled: true
    strategy: cost_optimized
    tiers:
      - condition: "task.priority == 'low'"
        model: claude-3-haiku
      - condition: "task.priority == 'medium'"
        model: claude-3-sonnet
      - condition: "task.priority == 'high'"
        model: claude-3-opus
```

---

## JSON Schema (For Validation)

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "$id": "https://a2r.io/schemas/blueprint-v1.json",
  "title": "A2R Workflow Blueprint",
  "type": "object",
  "required": ["apiVersion", "kind", "metadata", "agents", "connectors", "routines"],
  "properties": {
    "apiVersion": {
      "type": "string",
      "enum": ["a2r.io/v1"]
    },
    "kind": {
      "type": "string",
      "enum": ["WorkflowBlueprint"]
    },
    "metadata": {
      "type": "object",
      "required": ["id", "name", "version", "description", "author"],
      "properties": {
        "id": {
          "type": "string",
          "pattern": "^[a-z0-9-]+$"
        },
        "name": {"type": "string"},
        "version": {
          "type": "string",
          "pattern": "^\\d+\\.\\d+\\.\\d+"
        },
        "description": {"type": "string"},
        "author": {"type": "string"},
        "tags": {
          "type": "array",
          "items": {"type": "string"}
        },
        "license": {"type": "string"},
        "homepage": {"type": "string", "format": "uri"},
        "repository": {"type": "string", "format": "uri"}
      }
    },
    "agents": {
      "type": "array",
      "minItems": 1,
      "items": {
        "type": "object",
        "required": ["id", "name", "model", "system_prompt"],
        "properties": {
          "id": {"type": "string"},
          "name": {"type": "string"},
          "model": {"type": "string"},
          "system_prompt": {"type": "string"},
          "temperature": {"type": "number", "minimum": 0, "maximum": 2},
          "max_tokens": {"type": "integer", "minimum": 1},
          "skills": {
            "type": "array",
            "items": {"type": "string"}
          }
        }
      }
    },
    "connectors": {
      "type": "array",
      "minItems": 1,
      "items": {
        "type": "object",
        "required": ["id", "auth_type"],
        "properties": {
          "id": {"type": "string"},
          "required": {"type": "boolean", "default": true},
          "auth_type": {
            "type": "string",
            "enum": ["token", "oauth", "basic", "bearer", "none"]
          },
          "config": {"type": "object"}
        }
      }
    },
    "routines": {
      "type": "array",
      "minItems": 1,
      "items": {
        "type": "object",
        "required": ["id", "schedule", "requires", "task"],
        "properties": {
          "id": {"type": "string"},
          "name": {"type": "string"},
          "description": {"type": "string"},
          "schedule": {"type": "string"},
          "timezone": {"type": "string"},
          "enabled": {"type": "boolean", "default": true},
          "requires": {
            "type": "array",
            "items": {"type": "string"}
          },
          "task": {
            "type": "object",
            "required": ["agent", "steps"],
            "properties": {
              "agent": {"type": "string"},
              "steps": {
                "type": "array",
                "minItems": 1,
                "items": {
                  "type": "object",
                  "required": ["id", "action"],
                  "properties": {
                    "id": {"type": "string"},
                    "name": {"type": "string"},
                    "action": {"type": "string"},
                    "params": {"type": "object"},
                    "condition": {"type": "string"}
                  }
                }
              }
            }
          }
        }
      }
    }
  }
}
```
