# SYSTEM.md - Environment Constraints

## Overview

System and environment constraints for Gizzi workspace.

## Environment

### Platform
- **Name**: A2R Platform
- **Version**: {{PLATFORM_VERSION}}
- **Environment**: {{PLATFORM_ENV}}

### Agent Runtime
- **Type**: Platform Agent
- **Mode**: Always-available
- **Scope**: Platform-wide assistance

## Constraints

### Resource Limits
- **Memory**: Managed by kernel
- **Compute**: Shared with platform
- **Storage**: Workspace-only

### Network
- **External Access**: Via platform tools only
- **API Access**: Platform APIs only
- **Web Access**: Via Browser mode integration

### Security
- **Sandbox**: Platform sandbox
- **Permissions**: Read platform, write own workspace
- **Isolation**: Per-agent workspace

## Dependencies

### Required
- Platform kernel
- Agent workspace runtime
- Memory persistence

### Optional
- Voice service (if enabled)
- External tool connectors

## Configuration

### Runtime Variables
```
PLATFORM_DEFAULT_MODEL=gpt-4o
PLATFORM_DEFAULT_PROVIDER=openai
PLATFORM_API_URL=http://127.0.0.1:8013
```

### Feature Flags
- Voice: {{PLATFORM_VOICE_ENABLED}}
- Advanced Tools: {{PLATFORM_ADVANCED_TOOLS}}
- External Integrations: {{PLATFORM_EXTERNAL_INTEGRATIONS}}

## Monitoring

Health checks:
- Workspace accessible
- Memory sync working
- Tool registry reachable

Alerts on:
- Sync failures
- Tool errors
- Policy violations
