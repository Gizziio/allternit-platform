# Allternit Workflow Packaging: From Skills to Deterministic Workflows

## The Hierarchy You Identified

```
┌─────────────────────────────────────────────────────────────┐
│  WORKFLOW TEMPLATE (Company/Team)                           │
│  ├── Cross-domain deterministic workflows                   │
│  ├── Agent personas with values                             │
│  ├── Scheduled routines                                     │
│  └── Quality gates                                          │
│  Example: "SaaS Startup Team"                               │
├─────────────────────────────────────────────────────────────┤
│  PLUGIN (Domain Capability Bundle)     ← Allternit HAS THIS       │
│  ├── Skills (SKILL.md files)                                │
│  ├── Commands (slash commands)                              │
│  └── MCP server configs                                     │
│  Example: "engineering", "marketing", "sales"               │
├─────────────────────────────────────────────────────────────┤
│  SKILL (Atomic Capability)             ← Allternit HAS THIS       │
│  └── Single focused capability                              │
│  Example: "code-review", "accessibility-audit"              │
└─────────────────────────────────────────────────────────────┘
```

## What Paperclip Calls "Company" = Allternit's Missing "Workflow Template"

### Current Allternit: You Have Plugins
```
cmd/gizzi-code/src/runtime/plugins/builtin/
├── engineering/          ← Plugin (domain bundle)
│   ├── commands/
│   │   ├── standup.md
│   │   ├── review.md
│   │   └── architecture.md
│   └── skills/
│       ├── code-review/SKILL.md
│       └── system-design/SKILL.md
├── marketing/            ← Plugin (domain bundle)
├── sales/                ← Plugin (domain bundle)
└── product-management/   ← Plugin (domain bundle)
```

### What's Missing: Workflow Templates

```yaml
# .allternit/workflows/saas-startup-team.yaml
name: SaaS Startup Team
version: 1.0.0
description: Complete engineering + product + marketing workflow for SaaS startups

# The "Company" persona layer
organization:
  name: "{{project.name}}"
  mission: "Build fast, iterate faster"
  values:
    - "Ship daily"
    - "Customer-first"
    - "No meetings without agendas"

# The "Agents" - personas with specific workflows
agents:
  - id: tech-lead
    name: Tech Lead
    plugins:
      - engineering
      - operations
    skills:
      - code-review
      - system-design
      - tech-debt
    heartbeat: |
      You are the Tech Lead for {{organization.name}}.
      VALUES: {{organization.values}}
      CURRENT SPRINT: {{sprint.name}}
      TODAY'S GOAL: Review all open PRs and unblock blockers

  - id: product-manager
    name: Product Manager  
    plugins:
      - product-management
      - data
    skills:
      - feature-spec
      - competitive-analysis
    heartbeat: |
      You are the PM for {{organization.name}}.
      FOCUS: Ship features that solve customer pain

  - id: growth-marketer
    name: Growth Marketer
    plugins:
      - marketing
      - sales
    skills:
      - content-creation
      - competitive-analysis
    heartbeat: |
      You are Growth at {{organization.name}}.
      METRIC: Weekly active users

# The "Routines" - deterministic workflows
routines:
  - name: Daily Standup
    schedule: "0 9 * * *"  # 9am daily
    agent: tech-lead
    workflow:
      - step: gather_prs
        action: github.list_open_prs
      - step: review_blockers
        action: analyze_pr_blockers
      - step: post_summary
        action: slack.post_message
        template: |
          📊 Daily Standup
          {{steps.gather_prs.count}} open PRs
          Blockers: {{steps.review_blockers.blockers}}

  - name: Weekly Competitive Analysis
    schedule: "0 10 * * 1"  # Monday 10am
    agent: product-manager
    workflow:
      - step: research_competitors
        action: web.search
        queries: ["{{competitor.name}} new features", "{{competitor.name}} pricing"]
      - step: synthesize
        action: agent.run
        prompt: "Analyze competitor movements and suggest responses"
      - step: share_findings
        action: notion.create_page

  - name: Daily Content Generation
    schedule: "0 11 * * *"  # 11am daily
    agent: growth-marketer
    workflow:
      - step: check_analytics
        action: google_analytics.fetch
      - step: draft_content
        action: agent.run
        prompt: "Draft social posts based on yesterday's wins"
      - step: schedule_posts
        action: buffer.schedule

# Quality Gates (approvals)
approvals:
  - trigger: before_deploy
    approvers: [tech-lead]
    description: "Production deployment approval"
  - trigger: before_publish
    approvers: [product-manager]
    description: "Content publish approval"

# Install this workflow
gizzi workflow install saas-startup-team
```

## How This Maps to Existing Allternit

| Workflow Template Component | Allternit Equivalent |
|-----------------------------|----------------|
| `agents` | Cowork runs with specific personas |
| `plugins` | Existing plugin system |
| `skills` | Existing skills system |
| `routines` | Cowork schedules + cron |
| `approvals` | Cowork approval gates |
| `heartbeat` | Run context template |

## The "Packaging" Concept

### Install a Complete Workflow (like Paperclip's "Import Company")

```bash
# Install a pre-built workflow template
gizzi workflow install github.com/garytan/g-stack

# This installs:
# ├── Agents (personas + plugins + skills)
# ├── Routines (scheduled workflows)
# ├── Quality gates (approval rules)
# └── Config templates (secrets, URLs)

# Start using it
gizzi workflow start saas-startup-team

# List running workflows
gizzi workflow list

# Check routine status
gizzi workflow status saas-startup-team
```

### Create Your Own Workflow

```bash
# Create new workflow template
gizzi workflow init my-team

# Add agents (select from plugins)
gizzi workflow add-agent --name="Tech Lead" --plugins=engineering,operations

# Add routines
gizzi workflow add-routine \
  --name="Daily Standup" \
  --schedule="0 9 * * *" \
  --agent="tech-lead" \
  --prompt="Review PRs and post summary"

# Publish for your org
gizzi workflow publish github.com/myorg/my-team-workflow
```

## Concrete Example: The Discord Contributor Celebration

### Paperclip Style (as routine in workflow template):

```yaml
# .allternit/workflows/open-source-community.yaml
name: Open Source Community Management

agents:
  - id: community-manager
    name: Community Manager
    plugins: [marketing, operations]
    heartbeat: |
      You celebrate contributors enthusiastically.
      RULE: Always mention specific people by name.
      RULE: Never generic "thanks everyone".

routines:
  - name: Daily Contributor Celebration
    schedule: "0 10 * * *"  # 10am daily
    agent: community-manager
    workflow:
      - step: fetch_commits
        action: github.graphql
        query: |
          query($since: DateTime!) {
            repository(owner: "{{github.org}}", name: "{{github.repo}}") {
              pullRequests(states: MERGED, first: 20, 
                           orderBy: {field: UPDATED_AT, direction: DESC}) {
                nodes { title author { login } mergedAt }
              }
            }
          }
        
      - step: format_message
        action: template.render
        template: |
          🎉 **Daily Contributor Shout-out!**
          
          Amazing work from our community:
          {{#each steps.fetch_commits.prs}}
          👏 **@{{author}}** — {{title}}
          {{/each}}
          
          Your contributions make us better! 💪

      - step: post_discord
        action: discord.webhook
        webhook: "{{secrets.discord.community}}"
        content: "{{steps.format_message.output}}"

      - step: log_metrics
        action: metrics.record
        event: "contributor_celebration_sent"
        count: "{{steps.fetch_commits.prs.length}}"
```

### Install and Run:

```bash
# Install the workflow
gizzi workflow install ./open-source-community.yaml

# It creates:
# - The community-manager agent persona
# - The daily routine scheduled for 10am
# - The quality gate (if configured)

# Check it's scheduled
gizzi workflow routines open-source-community
# Output:
# Daily Contributor Celebration
#   Schedule: 0 10 * * * (daily at 10:00 AM)
#   Next run: Tomorrow 10:00 AM
#   Status: Enabled

# Trigger manually to test
gizzi workflow trigger open-source-community daily-contributor-celebration

# View logs
gizzi workflow logs open-source-community --routine=daily-contributor-celebration
```

## The Core Insight

**Paperclip's "Company" is a Workflow Template that packages:**

1. **Who** - Agent personas (with heartbeat context)
2. **What** - Plugins + Skills (capabilities)
3. **When** - Routines (scheduled deterministic workflows)
4. **How** - Quality gates (approvals, checkpoints)

**Allternit already has 2, 3, and 4. What's missing is the packaging layer that combines them into reusable, installable workflow templates.**

This is exactly like:
- **npm package** → reusable code
- **Allternit plugin** → reusable capabilities  
- **Allternit workflow template** → reusable deterministic workflows

## Next Steps

The implementation is essentially:

1. **Workflow Template Schema** - YAML/JSON spec for defining workflows
2. **Workflow Registry** - Like skills registry, but for workflows
3. **CLI Commands** - `gizzi workflow install|list|run|publish`
4. **Cowork Integration** - Workflows become runnable cowork projects

This leverages **everything Allternit already has** - plugins, skills, cowork runtime, scheduling - and just adds the **packaging layer** on top.
