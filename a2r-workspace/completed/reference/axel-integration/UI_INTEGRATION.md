# UI Integration Guide

This document describes the UI integration for the Axel workspace features.

## Components

### TerminalGrid

Multi-pane terminal grid that connects to the workspace service.

```tsx
import { TerminalGrid } from '@/components/workspace';

// Inside your component
<TerminalGrid sessionId="a2r-session" />
```

### FiveColumnLayout

Main workspace layout with five columns:
- DAG Status
- Inbox  
- Terminals
- Skills
- Mail

```tsx
import { FiveColumnLayout } from '@/components/workspace';

<FiveColumnLayout
  dagStatusColumn={<DAGStatus />}
  inboxColumn={<Inbox />}
  skillsColumn={<SkillsHub />}
  mailColumn={<Mail />}
  sessionId="a2r-session"
/>
```

### SkillsHub

Manage portable skills across LLM tools.

```tsx
import { SkillsHub } from '@/components/workspace';

<SkillsHub 
  onSync={(skillName, llms) => console.log(`Sync ${skillName} to ${llms}`)}
/>
```

## Console Drawer Integration

The ConsoleDrawer now includes a "Workspace" tab that shows the multi-pane terminal grid.

To use:
1. Click the drawer handle at the bottom of the screen
2. Select the "Workspace" tab
3. Create panes for agent execution

## Configuration

Set the workspace service URL:

```bash
# .env.local
NEXT_PUBLIC_WORKSPACE_SERVICE_URL=http://127.0.0.1:3021
```

## API Integration

The UI uses the workspace service client:

```typescript
import { workspaceClient } from '@/services/workspace';

// List sessions
const sessions = await workspaceClient.listSessions();

// Create pane
const pane = await workspaceClient.createPane(sessionId, {
  name: 'Agent 1',
  command: 'npm run dev',
});

// Stream logs
const ws = workspaceClient.createLogStream(paneId);
ws.onmessage = (event) => console.log(event.data);
```

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     Console Drawer                          │
├─────────────────────────────────────────────────────────────┤
│  Tabs: Queue | Context | Terminal | ... | Workspace         │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌─────────┐ ┌─────────┐ ┌─────────┐                       │
│  │ Pane 1  │ │ Pane 2  │ │ Pane 3  │  TerminalGrid          │
│  │ (live)  │ │ (live)  │ │ (live)  │                       │
│  └─────────┘ └─────────┘ └─────────┘                       │
│                                                             │
│  WebSocket ←→ Workspace Service ←→ tmux                    │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

## Future Enhancements

- [ ] Resizable panes within the grid
- [ ] Drag-and-drop pane reordering
- [ ] Pane snapshots and restore
- [ ] Better integration with DAG execution
- [ ] CRDT sync for multi-device support
