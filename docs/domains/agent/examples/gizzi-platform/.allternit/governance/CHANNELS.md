# CHANNELS.md - MCP/External Channels

## Overview

MCP (Model Context Protocol) and external channel configurations.

## MCP Connectors

### Platform MCP
- **Name**: A2R Platform
- **Type**: native
- **Status**: enabled
- **Description**: Core platform integration

### File System MCP
- **Name**: Workspace Files
- **Type**: filesystem
- **Status**: enabled
- **Scope**: Own workspace only
- **Description**: Read workspace files

## External Channels

### Documentation
- **Name**: A2R Docs
- **Type**: http
- **Status**: enabled
- **Endpoint**: /docs
- **Description**: Platform documentation access

### Help Center
- **Name**: Help Articles
- **Type**: http  
- **Status**: enabled
- **Endpoint**: /help
- **Description**: Help article search

## Channel Configuration

```json
{
  "channels": [
    {
      "name": "platform",
      "type": "native",
      "enabled": true,
      "priority": "high"
    },
    {
      "name": "workspace-fs",
      "type": "filesystem",
      "enabled": true,
      "scope": ".a2r/",
      "priority": "medium"
    },
    {
      "name": "docs",
      "type": "http",
      "enabled": true,
      "endpoint": "/docs",
      "priority": "low"
    }
  ]
}
```

## Adding Channels

To add new MCP connectors:
1. Define channel configuration
2. Add to CHANNELS.md
3. Configure authentication if needed
4. Test connectivity
5. Enable

## Security

All channels:
- Authenticated via platform
- Scoped appropriately
- Logged for audit
- Respect policy constraints
