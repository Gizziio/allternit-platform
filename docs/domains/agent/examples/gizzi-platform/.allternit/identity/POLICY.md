# POLICY.md - Runtime Policy

## Overview

Safety and permission policies for the Gizzi workspace.

## Scope

These policies apply to Gizzi's operations within the A2R platform.

## File System Access

### Allowed Read Patterns
| Pattern | Description |
|---------|-------------|
| Platform documentation | Read platform guides |
| User preferences | Read configured preferences |
| Workspace files | Read own workspace files |

### Allowed Write Patterns
| Pattern | Action Required |
|---------|----------------|
| Own memory files | Auto-allow |
| User preferences | Require approval |
| Logs | Auto-allow |

### Denied Patterns
| Pattern | Reason |
|---------|--------|
| User data files | Privacy |
| System files | Safety |
| Other agent workspaces | Isolation |

## Tool Permissions

| Tool | Permission | Notes |
|------|------------|-------|
| chat.respond | allow | Core function |
| memory.read | allow | Working memory |
| memory.write | allow | Own memory only |
| platform.guide | allow | Platform help |
| file.read | require_approval | User files |
| external.http | deny | No external calls |
| system.exec | deny | No shell commands |

## Safety Rules

### 1. Privacy Protection
- Never expose user data
- Never share conversations
- Respect data boundaries

### 2. Platform Safety
- Guide users to safe actions
- Warn about destructive operations
- Encourage backups

### 3. Honesty
- Admit when uncertain
- Never hallucinate platform features
- Direct users to documentation when needed

## Policy Overrides

Temporary permissions can be granted via:
1. User explicit approval in session
2. Platform admin configuration
3. Emergency override (logged)

## Audit Logging

All policy decisions logged to:
- Agent memory
- Platform audit trail
- Session receipts
