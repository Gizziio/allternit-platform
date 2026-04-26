# CLI Commands Specification

## Overview

This document defines all CLI commands for A2R Workflow Blueprints.

**Command Structure**: `gizzi blueprint <command> [options]`

---

## Phase 0 Commands

### `gizzi blueprint validate`

Validate a blueprint YAML file.

**Usage**:
```bash
gizzi blueprint validate <path> [options]
```

**Options**:
| Option | Description |
|--------|-------------|
| `--schema <version>` | Validate against specific schema version |
| `--strict` | Treat warnings as errors |
| `--format <format>` | Output format: table, json, yaml |

**Examples**:
```bash
# Basic validation
gizzi blueprint validate ./blueprint.yaml

# Strict validation
gizzi blueprint validate ./blueprint.yaml --strict

# JSON output for CI
gizzi blueprint validate ./blueprint.yaml --format json
```

**Output (Success)**:
```
✓ Blueprint validation passed

File: ./blueprint.yaml
Schema: a2r.io/v1

Summary:
  Agents: 2
  Connectors: 3
  Routines: 4
  Estimated cost per day: $2.50
```

**Output (Failure)**:
```
✗ Blueprint validation failed

File: ./blueprint.yaml
Line 23, Column 8

Error: Invalid value for field 'connectors[0].auth_type'
Expected one of: token, oauth, basic, bearer, none
Got: "api_key"

Fix: Change auth_type to "token" for GitHub connector
Docs: https://docs.a2r.io/connectors/github
```

---

### `gizzi blueprint install`

Install a blueprint to the workspace.

**Usage**:
```bash
gizzi blueprint install <path-or-url> [options]
```

**Options**:
| Option | Description |
|--------|-------------|
| `--name <name>` | Override blueprint name |
| `--env <env>` | Install for specific environment |
| `--dry-run` | Show what would be installed |
| `--force` | Reinstall if already exists |
| `--skip-connectors` | Skip connector configuration |

**Examples**:
```bash
# Install from local file
gizzi blueprint install ./saas-startup-team.yaml

# Install from GitHub
gizzi blueprint install github.com/a2r-blueprints/saas-startup-team

# Dry run
gizzi blueprint install ./blueprint.yaml --dry-run

# Force reinstall
gizzi blueprint install ./blueprint.yaml --force
```

**Interactive Installation**:
```bash
$ gizzi blueprint install ./saas-startup-team.yaml

Installing saas-startup-team v1.0.0
  Author: Jane Doe <jane@example.com>
  License: MIT

This blueprint will:
  ✓ Create 2 agents
  ✓ Configure 3 connectors
  ✓ Install 2 plugins
  ✓ Schedule 4 routines

Estimated daily cost: $2.50

Continue? (y/N): y

Configuring connectors...

  GitHub:
    ? Token (or set GITHUB_TOKEN env var): [hidden]
    ✓ Validated connection
    
  Slack:
    ? OAuth flow: Opening browser...
    ✓ OAuth completed
    ✓ Connected to workspace "MyCompany"

Installing agents...
  ✓ tech-lead
  ✓ on-call-engineer

Installing plugins...
  ✓ engineering v2.1.0
  ✓ operations v1.5.0

Registering routines...
  ✓ daily-standup (schedule: 0 9 * * 1-5)
  ✓ incident-response (manual)

✓ Installed saas-startup-team v1.0.0

Next steps:
  gizzi blueprint run saas-startup-team --routine=daily-standup
  gizzi blueprint list
```

---

### `gizzi blueprint list`

List installed blueprints.

**Usage**:
```bash
gizzi blueprint list [options]
```

**Options**:
| Option | Description |
|--------|-------------|
| `--format <format>` | Output format |
| `--all` | Include disabled blueprints |
| `--env <env>` | Filter by environment |

**Examples**:
```bash
# List all blueprints
gizzi blueprint list

# JSON output
gizzi blueprint list --format json
```

**Output**:
```
INSTALLED BLUEPRINTS

Name                    Version    Status    Agents    Routines    Daily Cost
──────────────────────────────────────────────────────────────────────────────
saas-startup-team       1.0.0      active    2         4           $2.50
seo-content-machine     1.2.0      active    1         3           $5.00
incident-response       0.9.0      paused    1         2           $0.50

Total: 3 blueprints, $8.00/day estimated

Run 'gizzi blueprint info <name>' for details
```

---

### `gizzi blueprint info`

Show detailed information about a blueprint.

**Usage**:
```bash
gizzi blueprint info <name> [options]
```

**Examples**:
```bash
gizzi blueprint info saas-startup-team
```

**Output**:
```
BLUEPRINT: saas-startup-team

Metadata:
  ID: saas-startup-team
  Version: 1.0.0
  Author: Jane Doe <jane@example.com>
  Description: Daily standup and PR review automation
  License: MIT
  Homepage: https://blueprints.a2r.io/saas-startup-team

Status: active
Environment: prod
Installed: 2026-03-26 10:30:00
Last run: 2026-03-26 09:00:00

Components:
  Agents: 2
    - tech-lead
    - on-call-engineer
    
  Connectors: 2
    - github (✓ connected)
    - slack (✓ connected)
    
  Routines: 4
    - daily-standup (enabled, schedule: 0 9 * * 1-5)
    - incident-response (disabled)
    - weekly-review (enabled, schedule: 0 17 * * 5)
    - dependency-check (enabled, schedule: 0 9 * * 1)

Usage (7 days):
  Runs: 28
  Success rate: 98%
  Tokens: 125,000
  Cost: $6.25

Commands:
  gizzi blueprint run saas-startup-team
  gizzi blueprint logs saas-startup-team
  gizzi blueprint edit saas-startup-team
```

---

### `gizzi blueprint run`

Manually run a blueprint routine.

**Usage**:
```bash
gizzi blueprint run <name> [options]
```

**Options**:
| Option | Description |
|--------|-------------|
| `--routine <id>` | Run specific routine |
| `--env <env>` | Run in specific environment |
| `--input <json>` | Input parameters as JSON |
| `--dry-run` | Simulate without executing |
| `--watch` | Watch execution in real-time |
| `--debug` | Enable debug output |

**Examples**:
```bash
# Run default routine
gizzi blueprint run saas-startup-team

# Run specific routine
gizzi blueprint run saas-startup-team --routine=daily-standup

# With input parameters
gizzi blueprint run saas-startup-team --input='{"repo": "myorg/special"}'

# Watch execution
gizzi blueprint run saas-startup-team --watch
```

**Output (Watch Mode)**:
```bash
$ gizzi blueprint run saas-startup-team --watch

Starting routine: daily-standup
Run ID: run_20260326_090000_abc123

[10:00:00] Step 1/3: fetch_prs
  → github.list_pull_requests
  ✓ Completed (890ms)
  Found 8 open PRs

[10:00:01] Step 2/3: analyze
  → agent.analyze
  ✓ Completed (2,340ms)
  Identified 2 blockers

[10:00:03] Step 3/3: post_summary
  → slack.post_message
  ✓ Completed (145ms)
  Posted to #engineering

✓ Routine completed successfully
Duration: 3.4s
Tokens: 4,567
Cost: $0.12

View details: gizzi blueprint logs saas-startup-team --run=run_20260326_090000_abc123
```

---

### `gizzi blueprint uninstall`

Remove an installed blueprint.

**Usage**:
```bash
gizzi blueprint uninstall <name> [options]
```

**Options**:
| Option | Description |
|--------|-------------|
| `--force` | Skip confirmation |
| `--keep-data` | Keep agent memory and logs |
| `--keep-runs` | Keep run history |

**Examples**:
```bash
# Uninstall with confirmation
gizzi blueprint uninstall saas-startup-team

# Force uninstall
gizzi blueprint uninstall saas-startup-team --force
```

---

## Phase 1 Commands (Dev/Prod & Versioning)

### `gizzi blueprint deploy`

Deploy a blueprint to an environment.

**Usage**:
```bash
gizzi blueprint deploy <name> --env <env> [options]
```

**Options**:
| Option | Description |
|--------|-------------|
| `--env <env>` | Target environment (required) |
| `--version <version>` | Deploy specific version |
| `--dry-run` | Preview changes |
| `--auto-approve` | Skip approval gates |

**Examples**:
```bash
# Deploy to staging
gizzi blueprint deploy saas-startup-team --env=staging

# Dry run
gizzi blueprint deploy saas-startup-team --env=prod --dry-run

# Deploy specific version
gizzi blueprint deploy saas-startup-team --env=prod --version=1.2.0
```

**Output**:
```bash
$ gizzi blueprint deploy saas-startup-team --env=prod

Deploying saas-startup-team to production

Current: v1.0.0
Target:  v1.1.0

Changes:
  + Added routine: weekly-retro
  ~ Modified: daily-standup (schedule changed)
  - Removed: old-routine

Approval required from: tech-lead, engineering-manager

? Approve deployment? (y/N): y
? Add comment: Deploying new retro routine

✓ Approved by admin
✓ Deployed to production
✓ Routines updated

Rollback if needed: gizzi blueprint rollback saas-startup-team
```

---

### `gizzi blueprint promote`

Promote a blueprint between environments.

**Usage**:
```bash
gizzi blueprint promote <name> --from <env> --to <env> [options]
```

**Examples**:
```bash
# Promote staging to production
gizzi blueprint promote saas-startup-team --from=staging --to=prod
```

---

### `gizzi blueprint rollback`

Rollback to a previous version.

**Usage**:
```bash
gizzi blueprint rollback <name> [options]
```

**Options**:
| Option | Description |
|--------|-------------|
| `--to <version>` | Rollback to specific version |
| `--to-previous` | Rollback to previous version |
| `--dry-run` | Preview rollback |

**Examples**:
```bash
# Rollback to previous
gizzi blueprint rollback saas-startup-team --to-previous

# Rollback to specific version
gizzi blueprint rollback saas-startup-team --to=1.0.2
```

**Output**:
```bash
$ gizzi blueprint rollback saas-startup-team --to-previous

Rolling back saas-startup-team
Current: v1.1.0
Target:  v1.0.2

⚠ This will revert all changes since v1.0.2

? Confirm rollback? (y/N): y

✓ Stopped active routines
✓ Restored v1.0.2 configuration
✓ Restarted routines

Rollback complete.
Run 'gizzi blueprint logs saas-startup-team' to verify.
```

---

### `gizzi blueprint versions`

List blueprint versions.

**Usage**:
```bash
gizzi blueprint versions <name> [options]
```

**Examples**:
```bash
gizzi blueprint versions saas-startup-team
```

**Output**:
```
VERSIONS: saas-startup-team

Version    Date          Author        Message
─────────────────────────────────────────────────────────
v1.1.0     2 days ago    jane          Added weekly retro
v1.0.2     1 week ago    john          Fixed Slack channel  
v1.0.1     2 weeks ago   jane          Bug fixes
v1.0.0     3 weeks ago   jane          Initial release

Current: v1.1.0
```

---

### `gizzi blueprint diff`

Show differences between versions.

**Usage**:
```bash
gizzi blueprint diff <name> [version1] [version2]
```

**Examples**:
```bash
# Diff current vs specific version
gizzi blueprint diff saas-startup-team v1.0.0

# Diff two versions
gizzi blueprint diff saas-startup-team v1.0.0 v1.1.0
```

---

### `gizzi blueprint approvals`

Manage deployment approvals.

**Usage**:
```bash
gizzi blueprint approvals <subcommand>
```

**Subcommands**:
- `list` - List pending approvals
- `approve <id>` - Approve a deployment
- `decline <id>` - Decline a deployment

**Examples**:
```bash
# List pending approvals
gizzi blueprint approvals list

PENDING APPROVALS

ID      Blueprint            Environment  Requested        Timeout
─────────────────────────────────────────────────────────────────────
123     saas-startup-team    prod         10 min ago       3h 50m
124     incident-response    prod         1 hour ago       3h

# Approve
gizzi blueprint approvals approve 123

# Decline with reason
gizzi blueprint approvals decline 124 --reason="Wait for QA"
```

---

## Phase 2 Commands (Observability)

### `gizzi blueprint runs`

List blueprint run history.

**Usage**:
```bash
gizzi blueprint runs <name> [options]
```

**Options**:
| Option | Description |
|--------|-------------|
| `--limit <n>` | Number of runs to show |
| `--status <status>` | Filter by status |
| `--routine <id>` | Filter by routine |
| `--since <date>` | Show runs since date |

**Examples**:
```bash
# Recent runs
gizzi blueprint runs saas-startup-team --limit=20

# Failed runs only
gizzi blueprint runs saas-startup-team --status=failed
```

**Output**:
```
RECENT RUNS: saas-startup-team

Run ID              Routine          Status    Duration    Tokens    Cost    Time
──────────────────────────────────────────────────────────────────────────────────
run_abc123          daily-standup    ✓ success  3.4s        4,567    $0.12   9:00 AM
run_def456          incident-check   ✓ success  1.2s        1,234    $0.04   8:55 AM
run_ghi789          weekly-review    ✗ failed   5.0s        8,901    $0.25   8:00 AM

View details: gizzi blueprint logs saas-startup-team --run=<run_id>
```

---

### `gizzi blueprint logs`

View blueprint execution logs.

**Usage**:
```bash
gizzi blueprint logs <name> [options]
```

**Options**:
| Option | Description |
|--------|-------------|
| `--run <id>` | Show logs for specific run |
| `--routine <id>` | Filter by routine |
| `--follow` | Follow logs in real-time |
| `--since <time>` | Show logs since time |
| `--level <level>` | Filter by log level |

**Examples**:
```bash
# Recent logs
gizzi blueprint logs saas-startup-team

# Specific run
gizzi blueprint logs saas-startup-team --run=run_abc123

# Follow real-time
gizzi blueprint logs saas-startup-team --follow
```

**Output**:
```
LOGS: saas-startup-team
Run: run_abc123 | Routine: daily-standup

[10:00:00.123] INFO  Starting routine: daily-standup
[10:00:00.124] INFO  Agent: tech-lead
[10:00:00.125] INFO  Step 1/3: fetch_prs
[10:00:00.126] DEBUG Calling connector: github.list_pull_requests
[10:00:00.890] DEBUG GitHub API: 200 OK (764ms)
[10:00:00.891] INFO  Found 8 open PRs
[10:00:01.000] INFO  Step 2/3: analyze
[10:00:01.001] DEBUG Calling agent.analyze
[10:00:01.500] DEBUG LLM request: 2,345 tokens
[10:00:03.340] DEBUG LLM response: 1,234 tokens
[10:00:03.341] INFO  Analysis complete: 2 blockers identified
[10:00:03.400] INFO  Step 3/3: post_summary
[10:00:03.401] DEBUG Calling connector: slack.post_message
[10:00:03.546] DEBUG Slack API: 200 OK (145ms)
[10:00:03.547] INFO  Posted to #engineering
[10:00:03.548] INFO  Routine completed: 3.4s, 4,567 tokens, $0.12
```

---

### `gizzi blueprint trace`

Show detailed execution trace.

**Usage**:
```bash
gizzi blueprint trace <name> --run <id> [options]
```

**Options**:
| Option | Description |
|--------|-------------|
| `--step <id>` | Show trace for specific step |
| `--show-prompts` | Include LLM prompts |
| `--show-responses` | Include LLM responses |

**Examples**:
```bash
gizzi blueprint trace saas-startup-team --run=run_abc123 --show-prompts
```

---

### `gizzi blueprint costs`

View cost breakdown.

**Usage**:
```bash
gizzi blueprint costs <name> [options]
```

**Options**:
| Option | Description |
|--------|-------------|
| `--period <period>` | day, week, month |
| `--breakdown` | Show detailed breakdown |
| `--budget` | Show budget status |

**Examples**:
```bash
# Today's costs
gizzi blueprint costs saas-startup-team

# Monthly breakdown
gizzi blueprint costs saas-startup-team --period=month --breakdown
```

**Output**:
```
COSTS: saas-startup-team

Today: $2.34 / $50.00 budget (5%)

Breakdown:
  daily-standup:    $0.45 (12 runs, 45K tokens)
  incident-check:   $0.89 (48 runs, 89K tokens)
  weekly-review:    $1.00 (1 run, 100K tokens)

By Model:
  claude-3-opus:    $1.80 (77%)
  claude-3-sonnet:  $0.54 (23%)

This Month: $45.50 / $1000 budget (5%)
Projected: $520 (under budget)
```

---

### `gizzi blueprint dashboard`

Show real-time dashboard.

**Usage**:
```bash
gizzi blueprint dashboard [name]
```

**Examples**:
```bash
# Dashboard for specific blueprint
gizzi blueprint dashboard saas-startup-team

# Global dashboard
gizzi blueprint dashboard
```

**Output (Interactive)**:
```
┌─────────────────────────────────────────────────────────────────────┐
│  DASHBOARD: saas-startup-team                          [Refresh: 5s]│
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  Health: ● Healthy (99.9% uptime)                                   │
│                                                                     │
│  Today:                                                             │
│    Runs: 28          Success: 27 (96%)          Failed: 1           │
│    Tokens: 125K      Cost: $3.25                Budget: $50 (6%)    │
│                                                                     │
│  Recent Runs:                                                       │
│    10:00  daily-standup     ● success     3.4s     $0.12            │
│    09:55  incident-check    ● success     1.2s     $0.04            │
│    09:30  daily-standup     ● success     3.1s     $0.11            │
│                                                                     │
│  Active Routines:                                                   │
│    ● daily-standup (schedule: 0 9 * * 1-5)                          │
│    ● incident-check (schedule: */5 * * * *)                         │
│    ○ weekly-review (manual)                                         │
│                                                                     │
│  [View Logs] [Run Now] [Pause] [Settings]                          │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Phase 3 Commands (Reliability)

### `gizzi blueprint test`

Run reliability tests on a blueprint.

**Usage**:
```bash
gizzi blueprint test <name> [options]
```

**Options**:
| Option | Description |
|--------|-------------|
| `--suite <suite>` | Test suite: determinism, load, chaos |
| `--iterations <n>` | Number of test iterations |
| `--routine <id>` | Test specific routine |

**Examples**:
```bash
# Run determinism test
gizzi blueprint test saas-startup-team --suite=determinism

# Load test
gizzi blueprint test saas-startup-team --suite=load --iterations=100
```

---

### `gizzi blueprint resume`

Resume a failed run from checkpoint.

**Usage**:
```bash
gizzi blueprint resume <name> --run <id> [options]
```

**Options**:
| Option | Description |
|--------|-------------|
| `--from-step <id>` | Resume from specific step |
| `--retry-failed` | Retry only failed steps |

**Examples**:
```bash
gizzi blueprint resume saas-startup-team --run=run_failed_123
```

---

## Phase 4 Commands (Security)

### `gizzi blueprint secrets`

Manage blueprint secrets.

**Usage**:
```bash
gizzi blueprint secrets <subcommand>
```

**Subcommands**:
- `list <name>` - List secrets for blueprint
- `set <name> <key>` - Set a secret
- `get <name> <key>` - Get a secret
- `delete <name> <key>` - Delete a secret
- `rotate <name>` - Rotate all secrets

**Examples**:
```bash
# Set secret
gizzi blueprint secrets set saas-startup-team GITHUB_TOKEN
? Value: [hidden]
✓ Secret stored

# List secrets
gizzi blueprint secrets list saas-startup-team
SECRET NAME       LAST UPDATED    ROTATION DUE
────────────────────────────────────────────────
GITHUB_TOKEN      2 days ago      88 days
SLACK_TOKEN       1 week ago      83 days
```

---

### `gizzi blueprint users`

Manage blueprint users and permissions.

**Usage**:
```bash
gizzi blueprint users <subcommand>
```

**Subcommands**:
- `list <name>` - List users
- `add <name> <user>` - Add user
- `remove <name> <user>` - Remove user
- `set-role <name> <user> <role>` - Set user role

**Examples**:
```bash
# Add user
gizzi blueprint users add saas-startup-team alice --role=operator

# List users
gizzi blueprint users list saas-startup-team
USER      ROLE         ADDED
─────────────────────────────────
alice     operator     2 days ago
bob       admin        1 week ago
carol     viewer       3 days ago
```

---

### `gizzi blueprint audit`

View audit logs.

**Usage**:
```bash
gizzi blueprint audit <name> [options]
```

**Options**:
| Option | Description |
|--------|-------------|
| `--event <type>` | Filter by event type |
| `--user <user>` | Filter by user |
| `--since <date>` | Filter by date |
| `--export <format>` | Export to file |

**Examples**:
```bash
# View audit log
gizzi blueprint audit saas-startup-team

# Export for compliance
gizzi blueprint audit saas-startup-team --export=csv --since=2026-01-01
```

---

## Phase 5 Commands (Registry)

### `gizzi blueprint search`

Search the blueprint registry.

**Usage**:
```bash
gizzi blueprint search <query> [options]
```

**Options**:
| Option | Description |
|--------|-------------|
| `--tag <tag>` | Filter by tag |
| `--sort <field>` | Sort by: downloads, rating, updated |
| `--registry <url>` | Use specific registry |

**Examples**:
```bash
# Search
gizzi blueprint search "engineering"

# Filter by tag
gizzi blueprint search --tag=saas
```

**Output**:
```
SEARCH RESULTS: "engineering"

NAME                  VERSION  RATING  DOWNLOADS  AUTHOR
──────────────────────────────────────────────────────────
saas-startup-team     1.2.0    ⭐ 4.8   1,234      a2r-team
devops-automation     2.0.1    ⭐ 4.5   892        devops-pro
incident-response     1.5.0    ⭐ 4.9   567        sre-team

Install: gizzi blueprint install <name>
```

---

### `gizzi blueprint publish`

Publish a blueprint to the registry.

**Usage**:
```bash
gizzi blueprint publish <path> [options]
```

**Options**:
| Option | Description |
|--------|-------------|
| `--registry <url>` | Target registry |
| `--version <version>` | Override version |
| `--dry-run` | Validate before publishing |

**Examples**:
```bash
# Publish to default registry
gizzi blueprint publish ./saas-startup-team

# Dry run
gizzi blueprint publish ./saas-startup-team --dry-run
```

---

### `gizzi blueprint bundle`

Manage plugin bundles.

**Usage**:
```bash
gizzi blueprint bundle <subcommand>
```

**Subcommands**:
- `list` - List available bundles
- `install <name>` - Install a bundle
- `uninstall <name>` - Uninstall a bundle

**Examples**:
```bash
# List bundles
gizzi blueprint bundle list

# Install engineering bundle
gizzi blueprint bundle install engineering
```

---

## Global Options

All commands support:

| Option | Description |
|--------|-------------|
| `--help` | Show help |
| `--version` | Show version |
| `--verbose` | Verbose output |
| `--quiet` | Suppress output |
| `--config <path>` | Use specific config file |
| `--format <format>` | Output format (table, json, yaml) |

---

## Error Codes

| Code | Description |
|------|-------------|
| 0 | Success |
| 1 | General error |
| 2 | Invalid arguments |
| 3 | Validation failed |
| 4 | Installation failed |
| 5 | Runtime error |
| 6 | Network error |
| 7 | Permission denied |
| 8 | Not found |
| 9 | Already exists |
| 10 | Timeout |
