# SSH Connection Components - Claude Code Style BYOC

## Overview

This module provides a **simplified SSH connection flow** for Allternit's BYOC (Bring Your Own Cloud) feature, inspired by Claude Code's SSH connection modal. It's designed to complement (not replace) the existing VPS wizard for users who already have a VPS provisioned.

## Philosophy

> **"Just like Claude Code - assume the VPS is already set up and just create the connection."**

Instead of a multi-step wizard, users get a simple form:
1. Name the connection
2. Enter SSH host (user@hostname)
3. Choose auth method (key or password)
4. Connect

## Components

### `AddSSHConnectionForm`

The main modal form for adding SSH connections. Features:

- **Clean, focused UI**: Inspired by Claude Code's SSH modal
- **Dual auth support**: SSH key (paste or file upload) or password
- **Connection testing**: Validate before saving
- **Setup guide**: Built-in help tab with SSH key generation instructions
- **Auto-installation**: Automatically installs Allternit Node agent upon connection

```tsx
import { AddSSHConnectionForm } from '@/components/ssh';

<AddSSHConnectionForm
  isOpen={isOpen}
  onClose={() => setIsOpen(false)}
  onSubmit={handleSubmit}
  onTest={handleTest}
/>
```

### `SSHConnectionsList`

Management interface for existing SSH connections:

- **Status indicators**: Connected, disconnected, connecting, error states
- **Quick actions**: Connect/disconnect, test, edit, delete
- **System info**: Shows OS, architecture, Docker/Allternit installation status
- **Expandable details**: Click to see full connection details

```tsx
import { SSHConnectionsList } from '@/components/ssh';

<SSHConnectionsList
  connections={connections}
  onAddConnection={() => setIsAddModalOpen(true)}
  onEditConnection={handleEdit}
  onDeleteConnection={handleDelete}
/>
```

## Integration Points

### 1. VPS Connection Modal (Unified Entry Point)

The `VPSConnectionModal` provides a menu with two options:

```
┌─────────────────────────────────────────┐
│         Add Compute Resource            │
├─────────────────────────────────────────┤
│                                         │
│  ┌─────────────┐  ┌─────────────────┐   │
│  │  Get a New  │  │ Connect Existing│   │
│  │    VPS      │  │      VPS        │   │
│  │             │  │                 │   │
│  │ • Provision │  │ • SSH direct    │   │
│  │ • Wizard    │  │ • Claude style  │   │
│  │ • 5+ providers│ • Fast setup    │   │
│  └─────────────┘  └─────────────────┘   │
│                                         │
└─────────────────────────────────────────┘
```

### 2. Environment Selector

The `EnvironmentSelector` now includes:
- **Quick Add**: "Add Environment" button opens the unified modal
- **Manage**: Opens Control Center for detailed management

### 3. Control Center

The SSH Connections section in Control Center now uses the new components:
- Full connection management
- Status monitoring
- Quick terminal access

## User Flows

### Flow 1: New User (No VPS)

1. Click "Add Environment"
2. Select "Get a New VPS" → Opens VPSMarketplace
3. Choose provider (Hetzner, DigitalOcean, etc.)
4. Complete wizard with provider signup + provisioning
5. Allternit auto-installs on the new VPS

### Flow 2: Existing VPS Owner

1. Click "Add Environment"
2. Select "Connect Existing VPS" → Opens AddSSHConnectionForm
3. Fill in SSH details (host, user, key)
4. Test connection
5. Save → Allternit auto-installs agent

### Flow 3: Control Center Management

1. Open Control Center
2. Go to "SSH Connections"
3. View all connections with status
4. Add/edit/delete connections
5. Open terminal for connected servers

## API Client

The `sshConnectionsApi` provides:

```typescript
// CRUD operations
sshConnectionsApi.listConnections()
sshConnectionsApi.createConnection(data)
sshConnectionsApi.updateConnection(id, data)
sshConnectionsApi.deleteConnection(id)

// Connection management
sshConnectionsApi.testConnection(data)  // Test without saving
sshConnectionsApi.connect(id)
sshConnectionsApi.disconnect(id)

// Agent management
sshConnectionsApi.installAgent(id)
sshConnectionsApi.getAgentStatus(id)
```

React hook for convenience:

```typescript
const {
  connections,
  isLoading,
  createConnection,
  testConnection,
  connect,
  disconnect,
} = useSSHConnections();
```

## Comparison: Old vs New

| Aspect | Old Wizard | New SSH Form |
|--------|-----------|--------------|
| **Target user** | New to VPS | Already has VPS |
| **Steps** | 5+ steps | Single form |
| **Time to connect** | 5-10 minutes | 30 seconds |
| **Provider signup** | Integrated | Assumes done |
| **Agent install** | Automatic | Automatic |
| **Best for** | First-time setup | Quick addition |

## File Structure

```
components/ssh/
├── AddSSHConnectionForm.tsx    # Main connection form (Claude style)
├── SSHConnectionsList.tsx      # Connection management UI
├── index.ts                    # Exports
└── README.md                   # This file

components/vps/
├── VPSMarketplace.tsx          # Existing provider selection
├── VPSConnectionModal.tsx      # NEW: Unified entry point
└── index.ts

api/infrastructure/
├── ssh.ts                      # NEW: API client + React hook
└── index.ts                    # Updated exports

shell/
├── ControlCenter.tsx           # Updated with SSH section
└── EnvironmentSelector.tsx     # Updated with quick add
```

## Design Decisions

### Why keep the wizard?

The existing VPS wizard is excellent for:
- Users who don't have a VPS yet
- Comparing providers and pricing
- Automated provisioning via cloud-init
- First-time Allternit setup

### Why add the SSH form?

The SSH form addresses:
- Users who already have VPS running
- Quick iteration/testing
- Claude Code users familiar with the pattern
- BYOC power users

### Why Claude Code style?

Claude Code's SSH modal is:
- Clean and focused
- Assumes user knows what they're doing
- No unnecessary hand-holding
- Fast path to productivity

## Security Considerations

1. **Private keys**: Never stored in plain text
2. **Passwords**: Always transmitted securely
3. **Agent installation**: Uses signed, verified scripts
4. **Connection testing**: Validates without full login
5. **Local storage**: Only connection metadata, never credentials

## Future Enhancements

- [ ] SSH config file import (~/.ssh/config)
- [ ] Jump host / bastion support
- [ ] SSH certificate authentication
- [ ] Connection health monitoring
- [ ] Auto-reconnect on disconnect
- [ ] Connection groups/labels
- [ ] Transfer connections between teams

## References

- [Claude Code SSH Blog Post](https://medium.com/@joe.njenga/how-i-use-claude-code-ssh-to-connect-to-any-remote-server-like-a-pro-f08ed35e5569)
- [Allternit BYOD Architecture](../../docs/architecture/cloud/BYOD_ARCHITECTURE.md)
- [Existing VPS Marketplace](./VPSMarketplace.tsx)
