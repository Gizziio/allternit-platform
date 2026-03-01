# POLICY.md

## Overview
Safety and permission policies for the Code Assistant workspace.

## File System Access

### Allowed Read Patterns
| Pattern | Description |
|---------|-------------|
| `*.rs`, `*.ts`, `*.js`, `*.py` | Source code files |
| `*.md`, `*.txt` | Documentation |
| `*.json`, `*.yaml`, `*.yml` | Configuration |
| `*.toml`, `*.ini` | Project config |
| `Makefile`, `Dockerfile` | Build files |

### Allowed Write Patterns
| Pattern | Action Required |
|---------|----------------|
| `/tmp/*` | Auto-allow |
| `*.patch` | Auto-allow |
| `*.diff` | Auto-allow |
| Workspace files | Require approval |

### Denied Patterns
| Pattern | Reason |
|---------|--------|
| `*.key`, `*.pem`, `*.p12` | Secrets |
| `.env*`, `*.secret` | Environment files |
| `/etc/*`, `/sys/*` | System files |
| `node_modules/`, `target/` | Build artifacts |
| `.git/` (direct write) | Version control |

## Tool Permissions

| Tool | Permission | Notes |
|------|------------|-------|
| filesystem.read | allow | Within allowed patterns |
| filesystem.write | require_approval | Except /tmp and patches |
| filesystem.delete | deny | Safety precaution |
| git.diff | allow | Read-only operations |
| git.show | allow | Read-only operations |
| git.status | allow | Read-only operations |
| git.add | require_approval | Staging changes |
| git.commit | require_approval | Requires message review |
| git.push | deny | Manual only |
| network.http | deny | No external calls |
| system.exec | deny | No shell commands |

## Safety Rules

### 1. Secret Protection
- NEVER read files matching secret patterns
- NEVER log content that might contain secrets
- Scan all output for potential secret leakage

### 2. Code Modification Safety
- Always show diff before applying changes
- Require explicit approval for workspace writes
- Never modify files outside the workspace

### 3. Git Safety
- Never force-push
- Never delete branches
- Never modify .git directory directly

### 4. Review Requirements
- All suggestions must include reasoning
- Flag security issues immediately
- Provide severity levels for all findings

## Policy Overrides

Temporary permissions can be granted via:
1. User explicit approval in session
2. Temporary policy file (POLICY.override.md)
3. Emergency override with --force flag

## Audit Logging

All policy decisions are logged to:
- `memory/policy-decisions.log`
- CLI audit trail
- Shell UI activity feed
