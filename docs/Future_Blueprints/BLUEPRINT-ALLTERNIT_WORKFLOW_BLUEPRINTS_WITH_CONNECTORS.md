# Workflow Blueprints: Including Connectors Specification

## Core Principle: Connectors Extend Reach

**Connectors bridge Allternit agents to external apps** (GitHub, Slack, Notion, Discord, etc.)

```
┌─────────────────────────────────────────────────────────────────────┐
│                    BLUEPRINT WITH CONNECTORS                        │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  ┌─────────────┐     ┌─────────────┐     ┌─────────────────────┐   │
│  │   AGENTS    │────▶│  CONNECTORS │────▶│   EXTERNAL APPS     │   │
│  │  (Personas) │     │  ( Bridges) │     │  (GitHub, Slack...) │   │
│  └─────────────┘     └─────────────┘     └─────────────────────┘   │
│         │                  │                                        │
│         │            ┌─────┴─────┐                                  │
│         │            ▼           ▼                                  │
│         │      ┌─────────┐  ┌─────────┐                           │
│         │      │  OAuth  │  │  API    │                           │
│         │      │  Flows  │  │  Keys   │                           │
│         │      └─────────┘  └─────────┘                           │
│         │                                                           │
│         └──────▶ ┌─────────────┐                                   │
│                  │   ROUTINES  │                                   │
│                  │  (Cowork    │                                   │
│                  │   Tasks)    │                                   │
│                  └─────────────┘                                   │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 1. Connectors in Allternit

### Existing Connector System

```
.allternit/connectors/
├── gmail.json                    # Gmail connector config
├── slack.json                    # Slack connector config  
├── github.json                   # GitHub connector config
├── notion.json                   # Notion connector config
├── discord.json                  # Discord connector config
├── linear.json                   # Linear connector config
└── hubspot.json                  # HubSpot connector config
```

### Connector Definition

```json
{
  "name": "GitHub",
  "appName": "GitHub",
  "description": "Connect to GitHub repositories, PRs, issues",
  "authType": "oauth",           // oauth, api_key, token, none
  "appUrl": "https://github.com",
  "apiBaseUrl": "https://api.github.com",
  "scopes": ["repo", "read:user"],
  "tags": ["dev", "git", "source-control"],
  "version": "1.0.0",
  "author": "Allternit",
  "createdAt": "2026-03-05T22:13:21.794Z",
  "updatedAt": "2026-03-05T22:14:24.734Z"
}
```

---

## 2. Blueprint with Connectors

### Updated Blueprint Structure

```yaml
# .allternit/blueprint.yaml
apiVersion: allternit.com/v1
kind: WorkflowBlueprint
metadata:
  name: saas-startup-team
  version: 1.0.0

# ─────────────────────────────────────────
# COMPONENT 1: AGENTS (Personas)
# ─────────────────────────────────────────
agents:
  - id: tech-lead
    name: "Tech Lead"
    model: claude-3-opus
    plugins: [engineering, operations]
    skills: [code-review, system-design]

# ─────────────────────────────────────────
# COMPONENT 2: CONNECTORS (External Apps)
# ─────────────────────────────────────────
# These are the bridges to external systems
connectors:
  # GitHub - for code, PRs, issues
  - id: github
    name: "GitHub"
    required: true                      # Blueprint won't work without this
    auth_type: token                    # token, oauth, api_key
    
    # What this connector provides access to
    provides:
      - repositories
      - pull_requests
      - issues
      - actions
    
    # Permissions needed
    permissions:
      - repo:read
      - repo:write
      - issues:read
      - issues:write
    
    # Config schema
    config:
      repo:
        type: string
        description: "Repository (owner/repo)"
        required: true
      token:
        type: secret
        description: "GitHub Personal Access Token"
        required: true
      webhook_secret:
        type: secret
        description: "Webhook secret for event triggers"
        required: false
    
    # Event triggers this connector enables
    events:
      - pull_request.opened
      - pull_request.merged
      - issue.created
      - push

  # Slack - for notifications
  - id: slack
    name: "Slack"
    required: true
    auth_type: oauth
    
    provides:
      - channels
      - direct_messages
      - notifications
    
    permissions:
      - chat:write
      - channels:read
      - users:read
    
    config:
      workspace:
        type: string
        description: "Slack workspace URL"
      channels:
        type: object
        properties:
          engineering:
            type: string
            default: "#engineering"
          general:
            type: string
            default: "#general"
          alerts:
            type: string
            default: "#alerts"

  # Notion - for documentation
  - id: notion
    name: "Notion"
    required: false                     # Optional connector
    auth_type: oauth
    
    provides:
      - pages
      - databases
      - wikis
    
    config:
      integration_token:
        type: secret
        required: true
      databases:
        competitive_intel:
          type: string
          description: "Database ID for competitive analysis"
        product_specs:
          type: string
          description: "Database ID for product specs"

  # Linear - for project management
  - id: linear
    name: "Linear"
    required: false
    auth_type: api_key
    
    provides:
      - issues
      - projects
      - cycles
    
    config:
      api_key:
        type: secret
        required: true
      team:
        type: string
        description: "Linear team key"

# ─────────────────────────────────────────
# COMPONENT 3: ROUTINES (Cowork Tasks)
# ─────────────────────────────────────────
# Routines use connectors to interact with external apps
routines:
  - id: daily-standup
    name: "Daily Engineering Standup"
    
    schedule:
      cron: "0 9 * * 1-5"
    
    agent: tech-lead
    
    # Which connectors this routine needs
    requires:
      - github                    # Needs GitHub for PRs
      - slack                   # Needs Slack for posting
    
    task:
      steps:
        - id: fetch_prs
          name: "Fetch Open PRs"
          # Uses GitHub connector
          connector:
            id: github
            action: list_pull_requests
            params:
              repo: "{{connectors.github.config.repo}}"
              state: open
              since: "24h"
        
        - id: analyze
          name: "Analyze Blockers"
          tool: agent.analyze
          agent: tech-lead
          input: "{{steps.fetch_prs.output}}"
        
        - id: post_summary
          name: "Post to Slack"
          # Uses Slack connector
          connector:
            id: slack
            action: post_message
            channel: "{{connectors.slack.config.channels.engineering}}"
            message: |
              📊 Daily Standup
              PRs: {{steps.fetch_prs.count}}
              {{steps.analyze.output}}

  - id: weekly-competitive
    name: "Weekly Competitive Analysis"
    
    schedule:
      cron: "0 10 * * 1"
    
    agent: product-manager
    
    requires:
      - notion                  # Save to Notion
      - slack                 # Notify team
    
    task:
      steps:
        - id: research
          name: "Research Competitors"
          tool: web.search
          queries:
            - "{{config.competitors[0]}} product updates"
        
        - id: save_notion
          name: "Save to Notion"
          connector:
            id: notion
            action: create_page
            parent_database: "{{connectors.notion.config.databases.competitive_intel}}"
            title: "Competitive Analysis - {{date.week_start}}"
            content: "{{steps.research.output}}"
        
        - id: notify
          name: "Notify Team"
          connector:
            id: slack
            action: post_message
            channel: "{{connectors.slack.config.channels.general}}"
            message: "New competitive intel: {{steps.save_notion.url}}"

  - id: on-pr-created
    name: "Auto-Assign PR Reviewers"
    
    trigger:
      type: webhook
      # Triggered by GitHub connector event
      connector:
        id: github
        event: pull_request.opened
        repo: "{{connectors.github.config.repo}}"
    
    agent: tech-lead
    
    requires:
      - github
    
    task:
      steps:
        - id: analyze_pr
          name: "Analyze PR"
          connector:
            id: github
            action: get_pull_request
            pr_number: "{{trigger.payload.number}}"
        
        - id: assign
          name: "Assign Reviewers"
          connector:
            id: github
            action: assign_reviewers
            pr_number: "{{trigger.payload.number}}"
            reviewers: "{{steps.analyze_pr.suggested_reviewers}}"

# ─────────────────────────────────────────
# COMPONENT 4: PLUGIN BUNDLE
# ─────────────────────────────────────────
plugins:
  bundle:
    - name: engineering
    - name: product-management
    - name: marketing

# ─────────────────────────────────────────
# COMPONENT 5: WORKSPACE TEMPLATE
# ─────────────────────────────────────────
workspace:
  directories:
    - .gizzi/agents/
    - .gizzi/memory/
    - .gizzi/runs/
    - .gizzi/routines/
    - .allternit/connectors/          # Connector configs stored here
```

---

## 3. Connector Installation Flow

### Step 1: Install Blueprint

```bash
$ gizzi blueprints install github.com/allternit/saas-startup-team

Installing blueprint: saas-startup-team v1.0.0

═══════════════════════════════════════════════════════════════
COMPONENT 1: CONNECTORS
═══════════════════════════════════════════════════════════════

This blueprint requires the following connectors:

  [REQUIRED] GitHub
    → Access your repositories
    → Read pull requests and issues
    → Post comments and assign reviewers
    
    Auth type: Personal Access Token
    
    To set up:
    1. Go to: https://github.com/settings/tokens
    2. Generate token with scopes: repo, read:user
    3. Paste token below

  [REQUIRED] Slack  
    → Post messages to channels
    → Send direct messages
    
    Auth type: OAuth
    
    To set up:
    1. Click to authorize: [Authorize Slack]
    2. Select workspace and channels

  [OPTIONAL] Notion (recommended)
    → Save documents and databases
    
    Auth type: OAuth
    
    To set up:
    1. Click to authorize: [Authorize Notion]

═══════════════════════════════════════════════════════════════

? GitHub Personal Access Token: [hidden]
✓ GitHub connector configured
✓ Testing connection... ✓ Connected to github.com/myorg

? GitHub repository (owner/repo): myorg/myproject

? Slack workspace: mycompany
? Slack #engineering channel: #engineering
? Slack #general channel: #general

[Opening browser for Slack OAuth...]
✓ Slack OAuth completed
✓ Connected to workspace: mycompany

? Set up Notion? (Y/n): Y
[Opening browser for Notion OAuth...]
✓ Notion OAuth completed
? Notion competitive intel database: [select from list]

═══════════════════════════════════════════════════════════════
CONNECTOR STATUS
═══════════════════════════════════════════════════════════════

✓ GitHub      Connected    repo:read, repo:write
✓ Slack       Connected    chat:write, channels:read  
✓ Notion      Connected    pages:write, databases:read

═══════════════════════════════════════════════════════════════
```

### Step 2: Connector Config Stored

```json
// .allternit/connectors/github.json (auto-created)
{
  "name": "GitHub",
  "appName": "GitHub",
  "authType": "token",
  "connected": true,
  "config": {
    "repo": "myorg/myproject",
    "token": "ghp_xxxxxxxxxxxx",
    "user": "@myusername"
  },
  "permissions": ["repo:read", "repo:write"],
  "installedBy": "saas-startup-team",
  "installedAt": "2026-03-26T10:30:00Z"
}
```

```json
// .allternit/connectors/slack.json (auto-created)
{
  "name": "Slack",
  "appName": "Slack",
  "authType": "oauth",
  "connected": true,
  "config": {
    "workspace": "mycompany",
    "workspaceId": "T123456",
    "channels": {
      "engineering": "#engineering",
      "general": "#general"
    },
    "accessToken": "xoxb-xxxxxxxxxxxx"
  },
  "permissions": ["chat:write", "channels:read"],
  "installedBy": "saas-startup-team"
}
```

### Step 3: Webhooks Auto-Configured

```bash
# Blueprint configures webhooks for event-triggered routines

Setting up GitHub webhooks for event triggers...
  → Webhook URL: https://hooks.allternit.com/webhooks/github/myorg/myproject
  → Events: pull_request.opened, pull_request.merged
  ✓ Webhook configured

Setting up Slack slash commands...
  → Command: /allternit-standup
  → URL: https://hooks.allternit.com/slash/myorg
  ✓ Slash command registered
```

---

## 4. Connector Commands

```bash
# ═══════════════════════════════════════════════════════════════
# CONNECTOR MANAGEMENT
# ═══════════════════════════════════════════════════════════════

# List all connectors
gizzi connectors list

Connector        Status    Auth Type    Blueprints Using
─────────────────────────────────────────────────────────
github          ✓ Conn    Token        saas-startup-team
slack           ✓ Conn    OAuth        saas-startup-team
notion          ✓ Conn    OAuth        saas-startup-team
linear          ✗ Disc    -            -
gmail           ✓ Conn    OAuth        ops-foundation

# Show connector details
gizzi connectors show github

Name: GitHub
Status: Connected
Account: @myusername
Permissions: repo:read, repo:write, issues:read
Configured by: saas-startup-team

# Add/update connector
gizzi connectors add github
? Auth type: token
? Personal Access Token: [hidden]
? Repository (owner/repo): myorg/myproject
✓ GitHub connector added

# Test connector
gizzi connectors test slack
Testing Slack connection...
✓ API reachable
✓ Can post to #engineering
✓ Can read channel list

# Disconnect (removes auth)
gizzi connectors disconnect notion
⚠ This will disconnect Notion for all blueprints
? Confirm? (y/N): y
✓ Notion disconnected

# Remove connector completely
gizzi connectors remove linear
✓ Linear connector removed

# View connector logs
gizzi connectors logs github
2026-03-26 10:30:15  GET  /repos/myorg/myproject/pulls  200  45ms
2026-03-26 10:30:16  GET  /repos/myorg/myproject/pulls/123  200  32ms
```

---

## 5. Using Connectors in Routines

### Direct Connector Actions

```yaml
# Example: Routine using multiple connectors

routines:
  - id: release-announcement
    name: "Release Announcement"
    
    trigger:
      type: webhook
      connector:
        id: github
        event: release.published
    
    agent: tech-lead
    
    requires:
      - github
      - slack
      - notion
      - twitter      # Optional social
    
    task:
      steps:
        # Step 1: Get release info from GitHub
        - id: get_release
          name: "Get Release Details"
          connector:
            id: github
            action: get_release
            tag: "{{trigger.payload.release.tag_name}}"
          
        # Step 2: Generate announcement
        - id: generate_announcement
          name: "Generate Announcement"
          tool: agent.write
          agent: tech-lead
          prompt: |
            Write a release announcement for {{steps.get_release.data.name}}
            
            Changelog:
            {{steps.get_release.data.body}}
        
        # Step 3: Post to Slack #engineering
        - id: notify_engineering
          name: "Notify Engineering"
          connector:
            id: slack
            action: post_message
            channel: "{{connectors.slack.config.channels.engineering}}"
            message: |
              🚀 **Release: {{steps.get_release.data.tag_name}}**
              
              {{steps.generate_announcement.output}}
              
              {{steps.get_release.data.html_url}}
        
        # Step 4: Post to Slack #general (wider audience)
        - id: notify_company
          name: "Notify Company"
          connector:
            id: slack
            action: post_message
            channel: "{{connectors.slack.config.channels.general}}"
            message: "📦 New release shipped: {{steps.get_release.data.name}}"
        
        # Step 5: Save to Notion release notes
        - id: save_notion
          name: "Save to Notion"
          connector:
            id: notion
            action: create_page
            parent_database: "{{connectors.notion.config.databases.releases}}"
            title: "{{steps.get_release.data.name}}"
            properties:
              Version: "{{steps.get_release.data.tag_name}}"
              Date: "{{date.today}}"
              Status: "Released"
            content: "{{steps.get_release.data.body}}"
        
        # Step 6: Tweet if Twitter connected (optional)
        - id: tweet
          name: "Tweet Announcement"
          condition: "{{connectors.twitter.connected}}"
          connector:
            id: twitter
            action: post_tweet
            content: |
              🚀 Shipped {{steps.get_release.data.tag_name}}!
              
              {{steps.generate_announcement.output | truncate: 200}}
              
              {{steps.get_release.data.html_url}}
```

---

## 6. Connector Marketplace

### Pre-Built Connectors

```bash
gizzi connectors marketplace list

DEVELOPMENT
  github              ✓ Official    Git repositories, PRs, issues
  gitlab              ✓ Official    Git repositories, MRs
  bitbucket           ✓ Official    Git repositories
  linear              ✓ Official    Issue tracking
  jira                ✓ Official    Project management
  sentry              ✓ Official    Error tracking

COMMUNICATION
  slack               ✓ Official    Team messaging
  discord             ✓ Official    Community chat
  teams               β Beta        Microsoft Teams
  email               ✓ Official    SMTP/email sending

PRODUCTIVITY
  notion              ✓ Official    Docs and databases
  confluence          ✓ Official    Wiki/documentation
  googledocs          β Beta        Google Workspace
  asana               ✓ Official    Task management
  trello              ✓ Official    Kanban boards

CRM/SALES
  hubspot             ✓ Official    CRM
  salesforce          β Beta        CRM
  pipedrive           ✓ Official    Sales pipeline

MARKETING
  twitter             ✓ Official    Social media
  linkedin            β Beta        Professional network
  mailchimp           ✓ Official    Email marketing

FINANCE
  stripe              ✓ Official    Payments
  quickbooks          β Beta        Accounting

Install a connector:
gizzi connectors marketplace install discord
```

---

## 7. Example: Discord Contributor Celebration (Full)

```yaml
# open-source-community.blueprint/blueprint.yaml

apiVersion: allternit.com/v1
kind: WorkflowBlueprint
metadata:
  name: open-source-community
  version: 1.0.0
  description: Celebrate contributors, manage releases, engage community

# ═══════════════════════════════════════════════════════════════
# AGENTS
# ═══════════════════════════════════════════════════════════════

agents:
  - id: community-manager
    name: "Community Manager"
    model: claude-3-sonnet
    plugins: [marketing, operations]
    skills: [content-creation, community-management]
    persona: |
      You are the community manager for {{connectors.github.config.repo}}.
      
      TONE: Enthusiastic, genuine, specific
      RULE: Always mention contributors by name
      RULE: Never use generic "thanks everyone"

# ═══════════════════════════════════════════════════════════════
# CONNECTORS (External Apps)
# ═══════════════════════════════════════════════════════════════

connectors:
  - id: github
    name: "GitHub"
    required: true
    auth_type: token
    
    provides:
      - repositories
      - pull_requests
      - issues
      - releases
    
    permissions:
      - repo:read
      - issues:read
    
    config:
      repo:
        type: string
        description: "Repository (owner/repo)"
        required: true
      token:
        type: secret
        description: "GitHub Personal Access Token"
        required: true
    
    events:
      - pull_request.merged
      - release.published
      - issue.created

  - id: discord
    name: "Discord"
    required: true
    auth_type: webhook
    
    provides:
      - channels
      - webhooks
      - announcements
    
    config:
      webhook_url:
        type: secret
        description: "Discord webhook URL for announcements"
        required: true
      community_channel:
        type: string
        description: "Channel name for community posts"
        default: "#general"

  - id: twitter
    name: "Twitter"
    required: false
    auth_type: oauth
    
    provides:
      - tweets
      - mentions
    
    config:
      account:
        type: string
        description: "Twitter handle"

# ═══════════════════════════════════════════════════════════════
# ROUTINES
# ═══════════════════════════════════════════════════════════════

routines:
  # Daily contributor celebration
  - id: celebrate-contributors
    name: "Daily Contributor Celebration"
    
    schedule:
      cron: "0 10 * * *"
    
    agent: community-manager
    
    requires:
      - github
      - discord
    
    task:
      steps:
        - id: fetch_merges
          name: "Fetch Recent Merges"
          connector:
            id: github
            action: graphql_query
            query: |
              query($since: DateTime!) {
                repository(owner: "{{github.org}}", name: "{{github.repo}}") {
                  pullRequests(states: MERGED, first: 20, 
                               orderBy: {field: UPDATED_AT, direction: DESC}) {
                    nodes { 
                      title 
                      author { login avatarUrl }
                      mergedAt
                      additions
                      deletions
                      url
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
            
            Amazing work from our community yesterday:
            
            {{#each steps.fetch_merges.data.repository.pullRequests.nodes}}
            👏 **<@{{author.login}}>** — {{title}}
               +{{additions}}/-{{deletions}} | <{{url}}>
            {{/each}}
            
            Your contributions make this project better every day! 💪
            
            Want to join them? Check out our [good first issues](https://github.com/{{github.org}}/{{github.repo}}/labels/good%20first%20issue)!
        
        - id: post_discord
          name: "Post to Discord"
          connector:
            id: discord
            action: webhook_post
            url: "{{connectors.discord.config.webhook_url}}"
            content: "{{steps.format_message.output}}"
        
        - id: track_metrics
          name: "Track Metrics"
          tool: metrics.record
          event: "contributor_celebration"
          contributors: "{{steps.fetch_merges.data.repository.pullRequests.nodes.length}}"

  # Announce new releases
  - id: announce-release
    name: "Announce New Release"
    
    trigger:
      type: webhook
      connector:
        id: github
        event: release.published
    
    agent: community-manager
    
    requires:
      - github
      - discord
      - twitter
    
    task:
      steps:
        - id: get_release
          name: "Get Release Info"
          connector:
            id: github
            action: get_release
            tag: "{{trigger.payload.release.tag_name}}"
        
        - id: generate_announcement
          name: "Generate Announcement"
          tool: agent.write
          prompt: |
            Write an exciting release announcement for version {{steps.get_release.data.tag_name}}
            Highlight key features from the changelog.
        
        - id: post_discord
          name: "Post to Discord"
          connector:
            id: discord
            action: webhook_post
            url: "{{connectors.discord.config.webhook_url}}"
            content: |
              🚀 **New Release: {{steps.get_release.data.tag_name}}**
              
              {{steps.generate_announcement.output}}
              
              {{steps.get_release.data.html_url}}
        
        - id: tweet
          name: "Tweet"
          condition: "{{connectors.twitter.connected}}"
          connector:
            id: twitter
            action: post_tweet
            content: |
              🚀 Shipped {{steps.get_release.data.tag_name}}!
              
              {{steps.generate_announcement.output | truncate: 200}}
              
              {{steps.get_release.data.html_url}}

# ═══════════════════════════════════════════════════════════════
# PLUGINS
# ═══════════════════════════════════════════════════════════════

plugins:
  bundle:
    - name: marketing
    - name: operations

# ═══════════════════════════════════════════════════════════════
# WORKSPACE
# ═══════════════════════════════════════════════════════════════

workspace:
  files:
    - path: .gizzi/agents/community-manager.yaml
      template: agents/community-manager.yaml
```

---

## Summary: Blueprints + Connectors

**Connectors are bridges to external apps** - they're critical because:
1. **Agents need to act** on GitHub, Slack, Notion, etc.
2. **Routines need triggers** from external events
3. **Different blueprints need different apps**

**A complete blueprint packages:**
1. **Agents** (personas in `.gizzi/agents/`)
2. **Connectors** (bridges to GitHub, Slack, etc.)
3. **Routines** (cowork tasks using connectors)
4. **Plugins** (capabilities)
5. **Workspace** (persistence)

**Installation flow:**
```
Install Blueprint
  → Install agents to .gizzi/agents/
  → Configure connectors (OAuth/token setup)
  → Store connector configs to .allternit/connectors/
  → Create cowork schedules
  → Set up workspace
```
