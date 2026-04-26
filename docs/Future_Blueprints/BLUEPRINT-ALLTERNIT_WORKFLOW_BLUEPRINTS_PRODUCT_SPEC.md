# Workflow Blueprints: Complete Product Specification

## 1. Blueprint Anatomy: What Comes Packaged

### The 7 Core Components

```yaml
# Complete Blueprint Structure
apiVersion: allternit.com/v1
kind: WorkflowBlueprint
metadata:
  # ─────────────────────────────────────────
  # COMPONENT 1: Identity & Discovery
  # ─────────────────────────────────────────
  name: saas-startup-team                    # URL-friendly slug
  version: 1.2.0
  displayName: "SaaS Startup Team"           # Human-readable
  description: "Complete engineering, product, and marketing workflow for seed-stage SaaS startups"
  author: 
    name: "Allternit Team"
    org: "allternit"
    email: "blueprints@allternit.com"
  tags: [startup, saas, engineering, product, marketing, seed-stage]
  categories: [vertical/saas, stage/seed, team-size/5-20]
  license: MIT                               # or Enterprise, Commercial
  pricing: free                              # free, premium, enterprise
  
  # Discovery & SEO
  keywords: [startup, engineering, agile, scrum, product-management]
  useCases: 
    - "Seed-stage SaaS team coordination"
    - "Engineering standups and reviews"
    - "Product sprint planning"
  
  # Stats
  downloads: 15420
  rating: 4.8
  reviews: 127
  lastUpdated: "2026-03-20"

# ─────────────────────────────────────────
# COMPONENT 2: Agent Personas (The "Who")
# ─────────────────────────────────────────
agents:
  # Each agent = role + context + capabilities
  tech-lead:
    id: tech-lead
    name: "Tech Lead"
    avatar: "👨‍💻"                              # Emoji or image URL
    role: senior-engineer
    
    # Model configuration
    model:
      provider: anthropic
      model: claude-3-opus
      temperature: 0.7
      maxTokens: 4000
    
    # Capabilities (from existing systems)
    plugins: [engineering, operations, security]
    skills: 
      - code-review
      - system-design
      - tech-debt-analysis
      - incident-response
    
    # Knowledge context
    knowledgeBases:
      - type: github
        repos: ["{{config.github.repo}}"]
      - type: notion
        pages: ["{{config.notion.engineering_wiki}}"]
    
    # The "Heartbeat" - persistent identity context
    heartbeat:
      template: |
        You are the Tech Lead at {{organization.name}}.
        
        YOUR ROLE:
        - Lead technical decisions and architecture
        - Unblock engineers and review PRs
        - Maintain code quality and standards
        
        CURRENT CONTEXT:
        - Sprint: {{context.sprint_name}} (ends {{context.sprint_end}})
        - Active PRs: {{context.open_prs_count}}
        - Blockers: {{context.blockers}}
        
        YOUR VALUES:
        {{organization.values}}
        
        TODAY'S FOCUS: {{context.today_focus}}
      
      # Dynamic context sources
      contextSources:
        - type: github
          query: "repo:{{github.repo}} is:pr is:open"
          as: open_prs_count
        - type: database
          query: "SELECT * FROM blockers WHERE status='active'"
          as: blockers
    
    # Working preferences
    preferences:
      responseStyle: concise
      codeStyle: "{{config.code_style}}"
      reviewDepth: thorough

  product-manager:
    id: product-manager
    name: "Product Manager"
    avatar: "📊"
    role: product-manager
    model:
      provider: anthropic
      model: claude-3-sonnet
    plugins: [product-management, data, design]
    skills:
      - feature-spec-writing
      - competitive-analysis
      - user-research
      - roadmap-management
    heartbeat:
      template: |
        You are the PM at {{organization.name}}.
        CURRENT SPRINT: {{context.sprint_name}}
        GOAL: Ship features that solve {{config.target_customer}} pain.

  growth-marketer:
    id: growth-marketer
    name: "Growth Marketer"
    avatar: "📈"
    role: marketer
    model:
      provider: openai
      model: gpt-4
    plugins: [marketing, sales, analytics]
    skills:
      - content-creation
      - seo-optimization
      - social-media
      - email-marketing

# ─────────────────────────────────────────
# COMPONENT 3: Routines (The "When/What")
# ─────────────────────────────────────────
# Routines = scheduled deterministic workflows
routines:
  # Example 1: Daily recurring
  daily-standup:
    id: daily-standup
    name: "Daily Engineering Standup"
    description: "Automated standup report with PRs, blockers, and highlights"
    
    # Scheduling
    schedule:
      cron: "0 9 * * 1-5"                    # 9am weekdays
      timezone: "{{config.timezone}}"
      # Alternative: natural language
      # natural: "every weekday at 9am"
    
    # Execution context
    agent: tech-lead
    
    # The workflow steps
    steps:
      - id: fetch_prs
        name: "Fetch Open PRs"
        action: github.list_prs
        params:
          repo: "{{config.github.repo}}"
          state: open
          since: "24h"
        output: prs
      
      - id: analyze_blockers
        name: "Analyze Blockers"
        action: agent.analyze
        agent: tech-lead
        input: "{{steps.fetch_prs.output}}"
        prompt: |
          Review these PRs and identify:
          1. PRs stuck >3 days
          2. PRs with failing CI
          3. PRs needing review
          Format as bullet points.
        output: blockers
      
      - id: generate_summary
        name: "Generate Summary"
        action: template.render
        template: |
          📊 **Engineering Standup - {{date.today}}**
          
          **PRs:** {{steps.fetch_prs.count}} open
          **Merged (24h):** {{steps.fetch_prs.merged_24h}}
          
          **Blockers:**
          {{steps.analyze_blockers.output}}
          
          **Action Items:**
          - Review stuck PRs
          - Unblock failing CI
        output: message
      
      - id: post_slack
        name: "Post to Slack"
        action: slack.post
        channel: "{{config.slack.channels.engineering}}"
        message: "{{steps.generate_summary.output}}"
      
      - id: notify_blockers
        name: "DM Blocker Owners"
        action: slack.dm
        condition: "{{steps.analyze_blockers.has_blockers}}"
        to: "{{steps.analyze_blockers.blocker_owners}}"
        message: "Your PR needs attention: {{pr.url}}"
    
    # Notifications
    notifications:
      onStart: false
      onComplete: 
        type: log
      onFailure:
        type: slack
        channel: "#engineering-alerts"
    
    # History/tracking
    history:
      retention: 30days
      storeOutput: true

  # Example 2: Weekly recurring
  weekly-competitive-analysis:
    id: weekly-competitive
    name: "Weekly Competitive Analysis"
    schedule:
      cron: "0 10 * * 1"                      # Monday 10am
    agent: product-manager
    steps:
      - id: research_competitors
        action: web.search.multi
        queries:
          - "{{config.competitors[0].name}} new features"
          - "{{config.competitors[0].name}} pricing changes"
          - "{{config.competitors[1].name}} product updates"
      
      - id: synthesize_findings
        action: agent.research
        agent: product-manager
        prompt: |
          Analyze competitor movements:
          {{steps.research_competitors.results}}
          
          Provide:
          1. Key changes (pricing, features, messaging)
          2. Threat level (High/Medium/Low)
          3. Recommended responses
      
      - id: create_notion_page
        action: notion.create
        parent: "{{config.notion.competitive_db}}"
        title: "Competitive Analysis - {{date.week_start}}"
        content: "{{steps.synthesize_findings.output}}"
      
      - id: notify_stakeholders
        action: email.send
        to: "{{config.stakeholders.product}}"
        subject: "Weekly Competitive Intel"
        body: "New analysis: {{steps.create_notion_page.url}}"

  # Example 3: Event-triggered
  on-pr-created:
    id: on-pr-created
    name: "PR Review Assignment"
    trigger:                                  # Instead of schedule
      type: webhook
      source: github
      event: pull_request.opened
    agent: tech-lead
    steps:
      - id: analyze_pr
        action: agent.analyze
        prompt: |
          Review this PR for:
          1. Complexity (Simple/Medium/Complex)
          2. Area (Frontend/Backend/DevOps)
          3. Required reviewers
      
      - id: assign_reviewers
        action: github.assign
        basedOn: "{{steps.analyze_pr.output}}"
        rules:
          - if: "{{steps.analyze_pr.complexity}} == 'Complex'"
            assign: ["{{config.reviewers.senior}}"]
          - if: "{{steps.analyze_pr.area}} == 'Frontend'"
            assign: ["{{config.reviewers.frontend}}"]

  # Example 4: Manual trigger
  release-checklist:
    id: release-checklist
    name: "Production Release"
    trigger:
      type: manual
      approval: true                          # Requires approval to start
    agent: tech-lead
    steps:
      - id: run_tests
        action: github.actions.trigger
        workflow: test-suite
      
      - id: check_metrics
        action: datadog.query
        query: "avg:app.error_rate{*}"
        condition: "{{result}} < 0.01"
      
      - id: approval_gate
        action: approval.request
        approvers: ["{{config.approvers.release}}"]
        description: "Approve production deploy?"
      
      - id: deploy
        action: github.actions.trigger
        workflow: deploy-production

# ─────────────────────────────────────────
# COMPONENT 4: Skills Bundle (The "How")
# ─────────────────────────────────────────
# What capabilities are included
skills:
  # Reference to existing Allternit skills
  included:
    - name: code-review
      source: github.com/allternit/skills/code-review
      version: ^2.0.0
    - name: system-design
      source: github.com/allternit/skills/system-design
      version: ^1.5.0
    - name: feature-spec-writing
      source: github.com/allternit/skills/feature-spec
    - name: competitive-analysis
      source: github.com/allternit/skills/competitive-analysis
  
  # Blueprint-specific custom skills
  custom:
    - name: saas-metrics-analysis
      description: "Analyze SaaS metrics (MRR, churn, LTV)"
      template: |
        Analyze these SaaS metrics:
        - MRR: {{metrics.mrr}}
        - Churn: {{metrics.churn}}
        - LTV: {{metrics.ltv}}
        
        Identify trends and flag concerns.

# ─────────────────────────────────────────
# COMPONENT 5: Configuration Schema
# ─────────────────────────────────────────
# What users must/configure provide
config:
  schema:
    # Required - blueprint won't run without these
    required:
      github:
        repo:
          type: string
          description: "GitHub repository (owner/repo)"
          example: "mycompany/myproduct"
        token:
          type: secret
          description: "GitHub personal access token"
      
      slack:
        channels:
          engineering:
            type: string
            description: "Slack channel for engineering updates"
            default: "#engineering"
      
      organization:
        name:
          type: string
          description: "Your company name"
        values:
          type: array
          description: "Company values to embed in agent context"
    
    # Optional - have defaults
    optional:
      timezone:
        type: string
        default: "America/New_York"
      
      code_style:
        type: enum
        values: [google, airbnb, standard]
        default: "google"
      
      notification_preferences:
        type: object
        properties:
          daily_digest:
            type: boolean
            default: true
          blocker_alerts:
            type: boolean
            default: true

# ─────────────────────────────────────────
# COMPONENT 6: Knowledge & Context
# ─────────────────────────────────────────
knowledge:
  # Documents that provide context to agents
  documents:
    - name: "Engineering Handbook"
      source: 
        type: url
        url: "{{config.handbook_url}}"
      vectorize: true
    
    - name: "API Documentation"
      source:
        type: github
        repo: "{{config.github.repo}}"
        path: "/docs"
      vectorize: true
    
    - name: "Codebase"
      source:
        type: github
        repo: "{{config.github.repo}}"
      include:
        - "*.md"
        - "docs/**"
      exclude:
        - "node_modules/**"
  
  # Dynamic context that changes
  dynamicContext:
    - name: "Current Sprint"
      source:
        type: linear
        query: "sprint:current"
      refresh: hourly
    
    - name: "Open Issues"
      source:
        type: github
        query: "is:issue is:open label:priority-high"
      refresh: daily

# ─────────────────────────────────────────
# COMPONENT 7: Enterprise & Governance
# ─────────────────────────────────────────
enterprise:
  # Security
  security:
    dataIsolation: true
    secretEncryption: aes256
    auditLogging: true
    compliance:
      - soc2
      - gdpr
      - hipaa
  
  # Governance
  governance:
    approvalWorkflows: true
    roleBasedAccess: true
    changeManagement:
      requireApprovalFor: [deploy, delete]
      approvers: ["admin", "tech-lead"]
  
  # Observability
  observability:
    metrics: true
    tracing: true
    alerting: true
    dashboards:
      - "Routine Success Rate"
      - "Agent Performance"
      - "Token Usage"
  
  # Management
  management:
    versionControl: git
    rollbackEnabled: true
    environments: [dev, staging, prod]
    backup:
      frequency: daily
      retention: 90days

# Dependencies on other blueprints (optional)
dependencies:
  blueprints:
    - name: github-integrations
      version: ^1.0.0
      optional: false
    - name: slack-notifications
      version: ^2.0.0
      optional: true
```

---

## 2. How to Make a Blueprint: Creation Workflows

### 2.1 Path 1: CLI-First (Developers)

```bash
# Step 1: Initialize
gizzi blueprint init

? Blueprint name: saas-startup-team
? Display name: SaaS Startup Team
? Description: Complete engineering, product, and marketing workflow
? Category: vertical/saas
? Pricing: free
✓ Created blueprint.yaml
✓ Created README.md
✓ Created .gitignore

# Step 2: Add agents interactively
gizzi blueprint add-agent

? Agent ID: tech-lead
? Name: Tech Lead
? Model: claude-3-opus
? Plugins: [engineering, operations]
? Skills: [code-review, system-design]
✓ Agent "tech-lead" added

# Step 3: Add routines interactively
gizzi blueprint add-routine

? Routine name: daily-standup
? Schedule: 0 9 * * 1-5
? Agent: tech-lead

# Interactive step builder
? Add step: github.list_prs
? Step name: Fetch PRs
? Parameters: 
  - repo: {{config.github.repo}}
  - state: open

? Add step: agent.analyze
? Prompt: Review these PRs and identify blockers...

? Add step: slack.post
? Channel: #engineering

✓ Routine "daily-standup" created with 3 steps

# Step 4: Validate
gizzi blueprint validate

✓ Schema validation passed
✓ All required config fields defined
✓ Plugins available: engineering, operations
✓ Skills available: code-review, system-design
⚠ Warning: No tests defined

# Step 5: Test locally
gizzi blueprint test --routine=daily-standup --dry-run

Running routine "daily-standup"...
✓ Step 1: Fetch PRs - 5 PRs found
✓ Step 2: Analyze blockers - 2 blockers identified
✓ Step 3: Post to Slack - Message sent

# Step 6: Package
gizzi blueprint package

✓ Created saas-startup-team-v1.0.0.allternitpkg
✓ Size: 45KB
✓ Includes: 3 agents, 4 routines, 5 skills

# Step 7: Publish
gizzi blueprint publish

? Registry: GitHub
? Visibility: public
✓ Published to github.com/allternit/blueprints/saas-startup-team
✓ Version: 1.0.0
✓ Marketplace listing created
```

### 2.2 Path 2: Visual Editor (Business Users)

```
┌─────────────────────────────────────────────────────────────────┐
│  Blueprint Studio                                                │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ CANVAS                                                  │   │
│  │                                                         │   │
│  │  ┌──────────┐      ┌──────────┐      ┌──────────┐      │   │
│  │  │  Agent   │──────▶│ Routine  │──────▶│  Output  │      │   │
│  │  │ Tech Lead│      │ Standup  │      │  Slack   │      │   │
│  │  └──────────┘      └──────────┘      └──────────┘      │   │
│  │       │                 │                               │   │
│  │       ▼                 ▼                               │   │
│  │  ┌──────────┐      ┌──────────┐                         │   │
│  │  │  Skills  │      │ Schedule │                         │   │
│  │  │ Review   │      │ 9am Daily│                         │   │
│  │  └──────────┘      └──────────┘                         │   │
│  │                                                         │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                  │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐          │
│  │  Agents  │ │ Routines │ │  Skills  │ │ Config   │          │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘          │
└─────────────────────────────────────────────────────────────────┘
```

**Visual Creation Flow:**
1. Drag "Agent" onto canvas
2. Configure model, plugins, skills
3. Write heartbeat template (AI-assisted)
4. Drag "Routine" onto canvas
5. Connect to Agent
6. Build workflow with visual step builder
7. Configure schedule
8. Test with "Run Now"
9. Publish to marketplace

### 2.3 Path 3: Fork & Customize (Power Users)

```bash
# Find existing blueprint
gizzi blueprints search "saas"

Found 5 blueprints:
1. saas-startup-team (allternit) - ⭐ 4.8 (15420 downloads)
2. saas-growth-engine (growth-hacker) - ⭐ 4.6
3. b2b-saas-sales (sales-leader) - ⭐ 4.7

# Fork it
gizzi blueprints fork allternit/saas-startup-team my-saas-team

✓ Forked to ./my-saas-team
✓ Created git repo
✓ Ready to customize

# Customize
cd my-saas-team
vim blueprint.yaml

# Change model
tech-lead:
  model: gpt-4  # Changed from claude-3-opus

# Add new routine
routines:
  weekly-architecture-review:
    schedule: "0 14 * * 5"  # Friday 2pm
    ...

# Publish as new blueprint
gizzi blueprint publish --as=new

Published as "my-saas-team"
```

---

## 3. Strategic Focus: Verticals vs Domains vs Specialty

### 3.1 The Taxonomy Strategy

We use a **3-tier taxonomy** that lets users discover blueprints multiple ways:

```
┌─────────────────────────────────────────────────────────────────┐
│  TIER 1: VERTICAL (Industry)                                     │
│  Who is this for?                                               │
├─────────────────────────────────────────────────────────────────┤
│  • saas (Software/SaaS)                                         │
│  • fintech (Financial services)                                 │
│  • healthcare (Medical/Health)                                  │
│  • ecommerce (Retail/E-commerce)                                │
│  • media (Publishing/Media)                                     │
│  • professional-services (Consulting/Legal)                     │
│  • manufacturing (Industrial)                                   │
│  • education (EdTech)                                           │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  TIER 2: DOMAIN (Function)                                       │
│  What business function?                                        │
├─────────────────────────────────────────────────────────────────┤
│  • engineering (Software development)                           │
│  • product (Product management)                                 │
│  • sales (Sales & BD)                                           │
│  • marketing (Growth & Marketing)                               │
│  • customer-success (Support & CS)                              │
│  • operations (BizOps & Analytics)                              │
│  • finance (Accounting & Finance)                               │
│  • hr (People & HR)                                             │
│  • legal (Legal & Compliance)                                   │
│  • security (Security & Infosec)                                │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  TIER 3: SPECIALTY (Specific Use Case)                           │
│  What specific workflow?                                        │
├─────────────────────────────────────────────────────────────────┤
│  • standups (Daily/weekly standups)                             │
│  • code-review (PR reviews)                                     │
│  • sprint-planning (Agile ceremonies)                           │
│  • incident-response (On-call & incidents)                      │
│  • content-calendar (Content scheduling)                        │
│  • lead-scoring (Sales qualification)                           │
│  • competitive-analysis (Market intel)                          │
│  • release-management (Deploys & releases)                      │
└─────────────────────────────────────────────────────────────────┘
```

### 3.2 Blueprint Categories (Launch Strategy)

#### Phase 1: Foundation (Horizontal Domains)
**Focus**: Core business functions everyone needs
**Goal**: Prove value, build usage

| Domain | Blueprint | Use Case |
|--------|-----------|----------|
| Engineering | `engineering-foundation` | Standups, code reviews, releases |
| Product | `product-foundation` | Sprint planning, specs, retros |
| Marketing | `marketing-foundation` | Content calendar, social, analytics |
| Sales | `sales-foundation` | Lead research, outreach, follow-ups |
| Operations | `ops-foundation` | Reporting, data sync, monitoring |

**Example**: `engineering-foundation`
- Daily standup automation
- PR review assignment
- Release checklist
- Incident response
- Weekly retro facilitator

#### Phase 2: Vertical Solutions (Industry-Specific)
**Focus**: Complete workflows for specific industries
**Goal**: Enterprise sales, higher ACV

| Vertical | Blueprint | Target |
|----------|-----------|--------|
| SaaS | `saas-startup-team` | Seed-Series B startups |
| Fintech | `fintech-compliance-team` | Banks, fintechs |
| Healthcare | `clinical-documentation` | Medical practices |
| E-commerce | `shopify-operations` | DTC brands |
| Agency | `client-delivery-management` | Creative agencies |

**Example**: `fintech-compliance-team`
- Regulatory reporting automation
- Audit trail monitoring
- Risk assessment workflows
- Customer due diligence
- Transaction monitoring alerts

#### Phase 3: Specialty Deep-Dives (Specific Workflows)
**Focus**: Best-in-class single workflows
**Goal**: Community contributions, marketplace depth

| Specialty | Blueprint | Complexity |
|-----------|-----------|------------|
| SEO | `seo-content-machine` | Advanced |
| DevOps | `kubernetes-incident-response` | Expert |
| Sales | `enterprise-deal-desk` | Advanced |
| Product | `user-research-synthesis` | Intermediate |
| Security | `vulnerability-management` | Expert |

**Example**: `seo-content-machine`
- Keyword research automation
- Content brief generation
- SERP analysis
- Internal linking optimization
- Performance tracking

### 3.3 Discovery Strategy

Users can find blueprints **3 ways**:

```
1. By Vertical (Industry)
   "I'm a SaaS startup"
   → Shows: saas-startup-team, saas-growth-engine, saas-sales

2. By Domain (Function)
   "I need engineering workflows"
   → Shows: engineering-foundation, code-review-assistant, release-automation

3. By Specialty (Use Case)
   "I need daily standups"
   → Shows: daily-standup-blueprint (works across verticals)
```

---

## 4. Product Offering Tiers

### 4.1 Free Tier (Individual Developers)

**What's Included:**
- Access to all public blueprints
- Up to 3 installed blueprints
- Run on local machine only
- Community support
- Basic scheduling

**Limitations:**
- No cloud execution
- No team sharing
- No advanced observability
- No enterprise integrations

**Monetization Hook:**
- "Upgrade to run this in the cloud"
- "Upgrade to share with your team"
- "Upgrade for advanced monitoring"

### 4.2 Pro Tier ($29/user/month)

**What's Included:**
- Unlimited blueprints
- Cloud execution (cron jobs run in cloud)
- Team sharing (up to 10 users)
- Private blueprints
- Advanced observability (logs, traces)
- Email/Slack support
- Version control (rollback)

**Target:** Small teams, startups

### 4.3 Enterprise Tier (Contact Sales)

**What's Included:**
- Everything in Pro
- Unlimited team size
- Private registry (host your own)
- Custom blueprint development
- SSO/SAML
- Audit logging
- Compliance (SOC2, GDPR, HIPAA)
- SLA guarantees
- Dedicated support
- Training & onboarding

**Add-Ons:**
- Professional Services: Custom blueprint development
- Managed Infrastructure: We host your agents
- Training: Team workshops

### 4.4 Marketplace Economics

**For Blueprint Creators:**
```
Free Blueprint:
  → Creator gets: Exposure, community recognition
  
Premium Blueprint:
  → User pays: $29/month
  → Creator gets: 70% ($20.30/month)
  → Allternit gets: 30% ($8.70/month)
  
Enterprise Blueprint:
  → User pays: Custom (e.g., $5000/year)
  → Creator gets: 60% ($3000/year)
  → Allternit gets: 40% ($2000/year)
```

**Incentives:**
- Quality rating affects discoverability
- Popular blueprints get featured placement
- Enterprise-ready blueprints get sales support

---

## 5. Example Blueprints by Category

### 5.1 Horizontal: Engineering Foundation

```yaml
metadata:
  name: engineering-foundation
  displayName: "Engineering Team Foundation"
  category: domain/engineering
  tags: [engineering, agile, github, slack]
  
agents:
  - tech-lead
  - senior-engineer
  - junior-engineer

routines:
  - daily-standup
  - pr-review-assignment
  - weekly-retro
  - release-checklist
  - incident-response

pricing: free
```

### 5.2 Vertical: SaaS Startup

```yaml
metadata:
  name: saas-startup-team
  displayName: "SaaS Startup Team"
  category: vertical/saas
  tags: [startup, saas, engineering, product, marketing]
  
agents:
  - tech-lead
  - product-manager
  - growth-marketer

routines:
  # Engineering
  - daily-standup
  - release-checklist
  
  # Product
  - sprint-planning
  - competitive-analysis
  
  # Marketing
  - content-calendar
  - social-media-scheduler
  
  # Growth
  - weekly-metrics-review

pricing: free
```

### 5.3 Specialty: SEO Content Machine

```yaml
metadata:
  name: seo-content-machine
  displayName: "SEO Content Machine"
  category: specialty/content-marketing
  tags: [seo, content, marketing, automation]
  
agents:
  - seo-specialist
  - content-writer
  - editor

routines:
  - keyword-research
  - content-brief-generation
  - serp-monitoring
  - internal-linking-optimization

pricing: premium
```

---

## 6. Success Metrics

### 6.1 Product Metrics

**Adoption:**
- Blueprint installs / month
- Active blueprints (running routines)
- Repeat usage rate

**Engagement:**
- Routines executed / day
- Average steps per routine
- Customization rate (users who modify)

**Quality:**
- Blueprint ratings
- Support tickets / blueprint
- Churn rate by blueprint

### 6.2 Business Metrics

**Free Tier:**
- User signups
- Blueprint installs
- Conversion rate to Pro

**Pro Tier:**
- MRR (Monthly Recurring Revenue)
- ARPU (Average Revenue Per User)
- Net Revenue Retention

**Enterprise:**
- Deal size
- Sales cycle length
- Expansion revenue

---

## Summary

**Workflow Blueprints** package:
1. **Agents** (personas with heartbeat context)
2. **Routines** (scheduled deterministic workflows)
3. **Skills** (bundled capabilities)
4. **Configuration** (user-specific settings)
5. **Knowledge** (context documents)
6. **Governance** (enterprise controls)

**Strategic Focus:**
- Phase 1: Horizontal domains (engineering, product, sales)
- Phase 2: Vertical solutions (SaaS, fintech, healthcare)
- Phase 3: Specialty deep-dives (SEO, DevOps, security)

**Product Tiers:**
- Free: Individual, local-only
- Pro ($29/user): Cloud, team sharing
- Enterprise (custom): Private registry, compliance

**Market Position:**
- Like CrewAI but local-first
- Like Dify but code-friendly
- Like n8n but agent-native
