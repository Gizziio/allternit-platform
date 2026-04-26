# Workflow Blueprints: Grounded Specification (Allternit-Native)

## Core Principle: Package Existing Allternit Components

**Don't invent new concepts. Map to what exists:**

| Blueprint Component | Allternit Existing System | Location |
|---------------------|---------------------|----------|
| **Agents** | Agent workspace files + personas | `.gizzi/agents/`, `.allternit/agents/` |
| **Routines** | Cowork tasks/schedules | Cowork runtime, cron service |
| **Capabilities** | Plugin bundles | `cmd/gizzi-code/src/runtime/plugins/builtin/` |
| **Execution** | Capsules/DAGs | `.allternit/work/dags/`, Cowork runs |
| **Persistence** | .gizzi workspace | `.gizzi/` |

---

## 1. Blueprint Structure: Allternit-Native

```yaml
# .allternit/blueprint.yaml - References existing systems
apiVersion: allternit.com/v1
kind: WorkflowBlueprint
metadata:
  name: saas-startup-team
  version: 1.0.0
  
# ─────────────────────────────────────────
# COMPONENT 1: AGENTS (Agent Workspace Files)
# ─────────────────────────────────────────
# These are agent personas that get installed to .gizzi/agents/
# They reference existing agent configurations
agents:
  # References an agent workspace file
  - ref: .gizzi/agents/tech-lead.yaml
    
    # Or inline definition that gets written to workspace
    inline:
      id: tech-lead
      name: "Tech Lead"
      model: claude-3-opus
      
      # Context that persists in .gizzi memory
      workspace:
        # Long-term memory files
        memory:
          - type: codebase
            path: "{{config.github.repo}}"
          - type: documents
            paths: ["docs/architecture.md", "docs/standards.md"]
          - type: history
            retention: 90days
      
      # The "heartbeat" - loaded on each run
      persona: |
        You are the Tech Lead at {{config.org.name}}.
        
        CONTEXT FROM WORKSPACE:
        {{workspace.memory.codebase.overview}}
        {{workspace.memory.documents.standards}}
        
        ACTIVE SPRINT: {{workspace.current_sprint}}
        OPEN PRS: {{workspace.open_prs}}

  - ref: .gizzi/agents/product-manager.yaml
    
  - ref: .gizzi/agents/growth-marketer.yaml

# ─────────────────────────────────────────
# COMPONENT 2: ROUTINES (Cowork Tasks)
# ─────────────────────────────────────────
# These become cowork tasks/schedules in the runtime
routines:
  # Maps to: gizzi cowork schedule create
  - id: daily-standup
    name: "Daily Engineering Standup"
    
    # Cowork schedule configuration
    schedule:
      type: cron
      expression: "0 9 * * 1-5"
      timezone: "{{config.timezone}}"
    
    # Which agent runs this
    agent: tech-lead
    
    # The routine = cowork task template
    # This creates a reusable task in the cowork system
    task:
      # Task metadata for cowork runtime
      name: "Daily Standup - {{date.today}}"
      description: "Automated standup report"
      
      # The execution steps = cowork run steps
      steps:
        - name: fetch-prs
          tool: github.list_prs
          params:
            repo: "{{config.github.repo}}"
            state: open
            since: "24h"
          
        - name: analyze-blockers
          tool: agent.analyze
          agent: tech-lead
          input: "{{steps.fetch-prs.output}}"
          prompt: "Identify blockers from these PRs..."
          
        - name: post-summary
          tool: slack.post
          channel: "{{config.slack.engineering}}"
          message: |
            📊 Standup {{date.today}}
            PRs: {{steps.fetch-prs.count}}
            {{steps.analyze-blockers.output}}
    
    # Cowork-specific options
    cowork:
      # Run in specific mode
      mode: local
      
      # Checkpoint settings
      checkpoints: true
      
      # Approval gates
      approvals:
        before_start: false
        on_failure: true
      
      # Notifications
      notify:
        on_complete: slack
        on_failure: email

  # Another routine - weekly competitive analysis
  - id: weekly-competitive
    name: "Weekly Competitive Analysis"
    schedule:
      type: cron
      expression: "0 10 * * 1"  # Monday 10am
    agent: product-manager
    task:
      steps:
        - name: research
          tool: web.search
          queries:
            - "{{config.competitors[0]}} new features"
            - "{{config.competitors[0]}} pricing"
        - name: synthesize
          tool: agent.run
          prompt: "Analyze these findings..."
        - name: save
          tool: notion.create_page
          parent: "{{config.notion.competitive_db}}"

  # Event-triggered routine (webhook)
  - id: on-pr-created
    name: "PR Review Assignment"
    trigger:
      type: webhook
      source: github
      event: pull_request.opened
    agent: tech-lead
    task:
      steps:
        - name: analyze
          tool: agent.analyze
          prompt: "Review this PR for complexity and area..."
        - name: assign
          tool: github.assign_reviewers
          based_on: "{{steps.analyze.output}}"

# ─────────────────────────────────────────
# COMPONENT 3: PLUGIN BUNDLE (Capabilities)
# ─────────────────────────────────────────
# References existing Allternit plugins
# These are the plugin bundles from:
# cmd/gizzi-code/src/runtime/plugins/builtin/
plugins:
  # Bundle of plugins this blueprint needs
  bundle:
    - name: engineering
      version: ^1.1.0
      source: builtin
      
    - name: product-management
      version: ^1.0.0
      source: builtin
      
    - name: marketing
      version: ^1.0.0
      source: builtin
      
    - name: operations
      version: ^1.0.0
      source: builtin
  
  # Auto-install these plugins when blueprint is installed
  auto_install: true
  
  # Or just validate they exist
  validate: true

# ─────────────────────────────────────────
# COMPONENT 4: CAPSULE/DAG (Execution Unit)
# ─────────────────────────────────────────
# For complex workflows, define a DAG
capsule:
  # References a DAG definition
  ref: .allternit/work/dags/saas-startup-dag.yaml
  
  # Or inline simple DAG
  inline:
    name: saas-startup-workflow
    nodes:
      - id: engineering-tasks
        routine: daily-standup
        agent: tech-lead
      
      - id: product-tasks
        routine: weekly-competitive
        agent: product-manager
        depends_on: [engineering-tasks]
      
      - id: marketing-tasks
        routine: content-calendar
        agent: growth-marketer
        depends_on: [product-tasks]

# ─────────────────────────────────────────
# COMPONENT 5: CONFIGURATION
# ─────────────────────────────────────────
config:
  schema:
    required:
      org:
        name:
          type: string
          description: "Your company name"
      
      github:
        repo:
          type: string
          description: "GitHub repo (owner/repo)"
        token:
          type: secret
          description: "GitHub token"
      
      slack:
        engineering:
          type: string
          default: "#engineering"
    
    optional:
      timezone:
        type: string
        default: "America/New_York"
      
      competitors:
        type: array
        item_type: string

# ─────────────────────────────────────────
# COMPONENT 6: WORKSPACE TEMPLATE
# ─────────────────────────────────────────
# Defines the .gizzi workspace structure
workspace:
  # Directories to create
  directories:
    - .gizzi/agents/
    - .gizzi/memory/
    - .gizzi/runs/
    - .gizzi/routines/
  
  # Initial files to populate
  files:
    - path: .gizzi/agents/tech-lead.yaml
      template: agents/tech-lead.yaml
    
    - path: .gizzi/agents/product-manager.yaml
      template: agents/product-manager.yaml
    
    - path: .gizzi/memory/standards.md
      template: memory/standards.md

# ─────────────────────────────────────────
# COMPONENT 7: ENTERPRISE
# ─────────────────────────────────────────
enterprise:
  governance:
    # Requires approval before first run
    approval_required: true
    approvers: [admin]
    
    # Audit to .allternit/ledger/
    audit:
      enabled: true
      store: .allternit/ledger/blueprints/
  
  compliance:
    - soc2
    - gdpr
```

---

## 2. How Blueprints Map to Allternit Commands

### Installation: Blueprint → Allternit Components

```bash
# User runs:
gizzi blueprints install github.com/allternit/saas-startup-team

# What happens under the hood:

# 1. Download blueprint
#    → Unpacks to ~/.allternit/blueprints/saas-startup-team/

# 2. Install agent workspace files
#    → Copies agents/ to .gizzi/agents/
#    → Creates .gizzi/agents/tech-lead.yaml
#    → Creates .gizzi/agents/product-manager.yaml
#    → Creates .gizzi/agents/growth-marketer.yaml

echo "Installing agent: tech-lead"
cp ~/.allternit/blueprints/saas-startup-team/agents/tech-lead.yaml .gizzi/agents/

# 3. Install/validate plugin bundle
#    → Checks if engineering, product-management, marketing plugins exist
#    → If not, prompts to install

gizzi plugins install engineering
# Installing plugin: engineering v1.1.0
# ✓ Plugin installed

gizzi plugins install product-management
# Installing plugin: product-management v1.0.0
# ✓ Plugin installed

# 4. Create cowork schedules (routines)
#    → For each routine with schedule, creates cowork schedule

gizzi cowork schedule create "daily-standup" \
  --agent=tech-lead \
  --schedule="0 9 * * 1-5" \
  --task=".gizzi/routines/daily-standup.yaml"

# Schedule created: sched_12345
# Next run: Tomorrow 9:00 AM

gizzi cowork schedule create "weekly-competitive" \
  --agent=product-manager \
  --schedule="0 10 * * 1" \
  --task=".gizzi/routines/weekly-competitive.yaml"

# 5. Set up workspace
#    → Creates .gizzi directories
#    → Populates initial memory/context

mkdir -p .gizzi/memory
mkdir -p .gizzi/runs
mkdir -p .gizzi/routines

cp ~/.allternit/blueprints/saas-startup-team/memory/* .gizzi/memory/

# 6. Prompt for config
#    → Interactive config for required fields

? GitHub repo (owner/repo): mycompany/myproduct
? Slack #engineering channel: #engineering
? Company name: MyCompany

# 7. Write config
#    → Saves to .allternit/blueprint-configs/saas-startup-team.yaml

# 8. Register blueprint as installed
echo "saas-startup-team: 1.0.0" >> .allternit/blueprints.lock

✓ Blueprint "saas-startup-team" installed successfully
✓ 3 agents configured
✓ 4 plugins installed/validated
✓ 2 schedules created
✓ Workspace initialized

Run: gizzi blueprints run saas-startup-team --routine=daily-standup
```

### Running a Routine

```bash
# User runs:
gizzi blueprints run saas-startup-team --routine=daily-standup

# What happens:

# 1. Load agent workspace
#    → Reads .gizzi/agents/tech-lead.yaml
#    → Loads agent memory/context

# 2. Start cowork run
#    → Creates a new cowork run
#    → Uses the routine's task definition

gizzi cowork start "daily-standup-manual" \
  --agent=tech-lead \
  --task=".gizzi/routines/daily-standup.yaml" \
  --config=".allternit/blueprint-configs/saas-startup-team.yaml"

# Run started: run_67890
# Agent: tech-lead
# Status: running

# 3. Execute steps
#    → Each step = cowork run step
#    → Results logged to .gizzi/runs/

Step 1: fetch-prs
  → github.list_prs
  ✓ Found 8 open PRs

Step 2: analyze-blockers
  → agent.analyze (tech-lead)
  ✓ Analysis complete
  Output: "2 PRs stuck >3 days..."

Step 3: post-summary
  → slack.post
  ✓ Posted to #engineering

# 4. Complete
✓ Run completed: run_67890
✓ Duration: 45s
✓ View logs: gizzi cowork logs run_67890
```

### Listing Routines

```bash
# User runs:
gizzi blueprints routines saas-startup-team

# Shows:
Blueprint: saas-startup-team

ROUTINES:
  daily-standup
    Schedule: 0 9 * * 1-5 (9:00 AM weekdays)
    Next run: Tomorrow 9:00 AM
    Agent: tech-lead
    Status: scheduled
    
  weekly-competitive
    Schedule: 0 10 * * 1 (Monday 10:00 AM)
    Next run: Monday 10:00 AM
    Agent: product-manager
    Status: scheduled
    
  on-pr-created
    Trigger: webhook (github.pull_request.opened)
    Agent: tech-lead
    Status: listening

Run a routine manually:
  gizzi blueprints run saas-startup-team --routine=daily-standup
```

---

## 3. File Structure: Blueprint Package

```
saas-startup-team.blueprint/
├── blueprint.yaml                    # Main manifest
├── README.md                         # Documentation
├── CHANGELOG.md                      # Version history
├── LICENSE                           # License file
│
├── agents/                           # COMPONENT 1: Agent Workspace Files
│   ├── tech-lead.yaml
│   ├── product-manager.yaml
│   └── growth-marketer.yaml
│
├── routines/                         # COMPONENT 2: Cowork Tasks
│   ├── daily-standup.yaml           # Cowork task template
│   ├── weekly-competitive.yaml
│   ├── on-pr-created.yaml
│   └── release-checklist.yaml
│
├── plugins/                          # COMPONENT 3: Plugin References
│   └── bundle.yaml                  # Lists required plugins
│
├── capsule/                          # COMPONENT 4: DAG (optional)
│   └── saas-workflow.yaml
│
├── workspace/                        # COMPONENT 5: Workspace Template
│   ├── memory/
│   │   ├── standards.md
│   │   └── architecture-template.md
│   └── context/
│       └── sprint-template.yaml
│
├── config/                           # COMPONENT 6: Config Schema
│   ├── schema.yaml                  # Config validation schema
│   └── defaults.yaml                # Default values
│
└── tests/                            # Tests
    ├── validate.yaml
    └── test-runs/
```

### Agent Workspace File Example

```yaml
# agents/tech-lead.yaml
# This gets installed to .gizzi/agents/tech-lead.yaml

id: tech-lead
name: "Tech Lead"
avatar: "👨‍💻"

model:
  provider: anthropic
  model: claude-3-opus
  temperature: 0.7

plugins:
  - engineering
  - operations
  - security

skills:
  - code-review
  - system-design
  - tech-debt-analysis
  - incident-response

# Agent-specific memory
memory:
  codebase:
    type: github
    repo: "{{config.github.repo}}"
    index: true
    
  documents:
    - docs/architecture.md
    - docs/coding-standards.md
    - docs/deployment.md
    
  history:
    runs: 50
    retention: 90days

# The persona/heartbeat
persona: |
  You are the Tech Lead at {{config.org.name}}.
  
  YOUR RESPONSIBILITIES:
  - Lead technical architecture decisions
  - Review PRs and unblock engineers
  - Maintain code quality standards
  - Handle production incidents
  
  CONTEXT FROM YOUR WORKSPACE:
  {{memory.codebase.overview}}
  {{memory.documents.standards}}
  
  CURRENT STATE:
  - Sprint: {{context.sprint_name}}
  - Open PRs: {{context.open_prs_count}}
  - Active incidents: {{context.active_incidents}}
  
  TODAY'S FOCUS: {{context.today_focus}}

# Working preferences
preferences:
  response_style: concise
  code_style: "{{config.code_style}}"
  review_depth: thorough
  
# Scheduled tasks this agent owns
tasks:
  - daily-standup
  - release-checklist
```

### Cowork Task Template Example

```yaml
# routines/daily-standup.yaml
# This is a cowork task template

name: "Daily Engineering Standup"
description: "Automated standup report with PRs and blockers"

# Execution context
agent: tech-lead
mode: local

# Steps = cowork run steps
steps:
  - id: fetch_prs
    name: "Fetch Open PRs"
    tool: github.list_prs
    params:
      repo: "{{config.github.repo}}"
      state: open
      since: "24h"
    
  - id: analyze
    name: "Analyze Blockers"
    tool: agent.analyze
    params:
      agent: tech-lead
      prompt: |
        Review these PRs and identify blockers:
        {{steps.fetch_prs.output}}
        
        Look for:
        1. PRs stuck >3 days
        2. PRs with failing CI
        3. PRs needing review
    
  - id: generate_message
    name: "Generate Summary"
    tool: template.render
    params:
      template: |
        📊 **Engineering Standup - {{date.today}}**
        
        **PRs:** {{steps.fetch_prs.count}} open
        **Merged (24h):** {{steps.fetch_prs.merged_24h}}
        
        **Blockers:**
        {{steps.analyze.output}}
        
        **Action Items:**
        - Review stuck PRs
        - Address failing CI
    
  - id: post_slack
    name: "Post to Slack"
    tool: slack.post_message
    params:
      channel: "{{config.slack.engineering}}"
      message: "{{steps.generate_message.output}}"

# Error handling
on_error:
  action: slack.post_message
  channel: "#engineering-alerts"
  message: "Standup routine failed: {{error.message}}"

# Checkpoints (cowork feature)
checkpoints:
  enabled: true
  save_after_each_step: false
```

---

## 4. CLI Commands: Blueprint ↔ Allternit Integration

```bash
# ═══════════════════════════════════════════════════════════════
# BLUEPRINT LIFECYCLE
# ═══════════════════════════════════════════════════════════════

# DISCOVER
gizzi blueprints list                          # List installed
gizzi blueprints search "saas"                 # Search marketplace
gizzi blueprints show saas-startup-team        # Show details

# INSTALL (maps to Allternit components)
gizzi blueprints install github.com/allternit/saas-startup-team
  # ↓ Creates agents in .gizzi/agents/
  # ↓ Installs/validates plugins
  # ↓ Creates cowork schedules
  # ↓ Sets up workspace
  # ↓ Prompts for config

# CONFIGURE
gizzi blueprints config saas-startup-team      # Interactive config
gizzi blueprints config saas-startup-team --set github.repo=owner/repo

# RUN (maps to cowork runs)
gizzi blueprints run saas-startup-team --routine=daily-standup
  # ↓ Loads agent from .gizzi/agents/
  # ↓ Starts cowork run
  # ↓ Executes routine steps

gizzi blueprints run saas-startup-team --routine=release-checklist --attach
  # ↓ Runs and attaches to output

# STATUS (maps to cowork schedules)
gizzi blueprints status saas-startup-team
  # Shows:
  # - Installed agents (from .gizzi/agents/)
  # - Active schedules (from cowork)
  # - Recent runs (from .gizzi/runs/)
  # - Next scheduled runs

# UPDATE
gizzi blueprints update saas-startup-team
  # ↓ Downloads new version
  # ↓ Migrates agents (preserves memory)
  # ↓ Updates routines
  # ↓ Keeps config

# UNINSTALL
gizzi blueprints uninstall saas-startup-team
  # ↓ Removes schedules (asks: keep history?)
  # ↓ Removes agents (asks: preserve memory?)
  # ↓ Keeps workspace files (asks)

# ═══════════════════════════════════════════════════════════════
# CREATION WORKFLOW
# ═══════════════════════════════════════════════════════════════

# Initialize
gizzi blueprint init
  # Creates blueprint.yaml structure
  # Creates directories: agents/, routines/, workspace/

# Add agent (creates agent workspace file)
gizzi blueprint add-agent
  # Creates agents/{id}.yaml
  # Prompts for model, plugins, skills
  # Writes persona template

# Add routine (creates cowork task template)
gizzi blueprint add-routine
  # Creates routines/{id}.yaml
  # Interactive step builder
  # Links to agent

# Validate
gizzi blueprint validate
  # Checks blueprint.yaml schema
  # Validates agent files
  # Validates routine syntax
  # Checks plugin availability

# Test
gizzi blueprint test --routine=daily-standup --dry-run
  # Runs routine locally without side effects
  # Validates all steps work
  # Shows output preview

# Package
gizzi blueprint package
  # Creates .allternitpkg file
  # Includes all agents, routines, workspace files

# Publish
gizzi blueprint publish
  # Publishes to GitHub/registry
  # Creates marketplace listing
```

---

## 5. Example: The Discord Contributor Celebration

```yaml
# blueprint.yaml for open-source-community

apiVersion: allternit.com/v1
kind: WorkflowBlueprint
metadata:
  name: open-source-community
  version: 1.0.0
  description: Celebrate contributors, manage releases, engage community

agents:
  - inline:
      id: community-manager
      name: "Community Manager"
      model: claude-3-sonnet
      plugins: [marketing, operations]
      skills: [content-creation, community-management]
      
      workspace:
        memory:
          - type: github
            repo: "{{config.github.repo}}"
            events: [pull_request, release, issue]
      
      persona: |
        You are the community manager for {{config.github.repo}}.
        
        TONE: Enthusiastic, genuine, specific
        RULE: Always mention contributors by name
        RULE: Never generic "thanks everyone"
        
        TOP CONTRIBUTORS: {{workspace.memory.github.top_contributors}}

routines:
  - id: celebrate-contributors
    name: "Daily Contributor Celebration"
    schedule:
      cron: "0 10 * * *"
    agent: community-manager
    task:
      steps:
        - id: fetch_merges
          name: "Fetch Recent Merges"
          tool: github.graphql
          query: |
            query($since: DateTime!) {
              repository(owner: "{{github.org}}", name: "{{github.repo}}") {
                pullRequests(states: MERGED, first: 20, 
                             orderBy: {field: UPDATED_AT, direction: DESC}) {
                  nodes { 
                    title 
                    author { login } 
                    mergedAt
                    additions
                    deletions
                  }
                }
              }
            }
          variables:
            since: "{{time.24h_ago}}"
        
        - id: format_message
          name: "Format Discord Message"
          tool: template.render
          template: |
            🎉 **Daily Contributor Shout-out!**
            
            Amazing work from our community:
            {{#each steps.fetch_merges.data}}
            👏 **@{{author.login}}** — {{title}} (+{{additions}}/-{{deletions}})
            {{/each}}
            
            Your contributions make us better every day! 💪
            
            Want to join? Check out our [good first issues]({{config.github.issues_url}})!
        
        - id: post_discord
          name: "Post to Discord"
          tool: discord.webhook
          webhook_url: "{{secrets.discord.community}}"
          content: "{{steps.format_message.output}}"
        
        - id: track_metrics
          name: "Track Metrics"
          tool: metrics.record
          event: "contributor_celebration_sent"
          contributors: "{{steps.fetch_merges.data.length}}"

plugins:
  bundle:
    - name: marketing
    - name: operations

config:
  schema:
    required:
      github:
        org:
          type: string
        repo:
          type: string
    secrets:
      discord:
        community:
          type: string
          description: "Discord webhook URL for community channel"
```

**Installation:**

```bash
$ gizzi blueprints install github.com/allternit/open-source-community

Installing blueprint: open-source-community v1.0.0

Component 1: Agents
  → Installing agent: community-manager
  → Writing to: .gizzi/agents/community-manager.yaml
  ✓ Agent installed

Component 2: Routines
  → Creating schedule: celebrate-contributors
  → Schedule: 0 10 * * * (daily at 10:00 AM)
  ✓ Schedule created

Component 3: Plugins
  → Checking plugins: marketing, operations
  ✓ marketing v1.0.0 already installed
  ✓ operations v1.0.0 already installed

Component 4: Configuration
  ? GitHub org: myorg
  ? GitHub repo: myproject
  ? Discord webhook URL: [hidden]
  ✓ Configuration saved

✓ Blueprint installed successfully!

Next run: Tomorrow 10:00 AM
Test now: gizzi blueprints run open-source-community --routine=celebrate-contributors
```

---

## Summary: Allternit-Native Blueprints

| Don't Invent | Use Instead |
|--------------|-------------|
| Custom agents | `.gizzi/agents/` workspace files |
| Custom routines | Cowork tasks/schedules |
| Custom skills | Existing plugin bundles |
| Custom execution | Cowork runs/capsules |
| Custom memory | `.gizzi/` workspace persistence |

**Blueprint = Allternit component installer + configurator + packager**
