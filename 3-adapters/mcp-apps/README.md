# MCP Apps / Interactive Capsules

Protocol and runtime for interactive tool surfaces in A2R.

## Overview

MCP Apps (Model Context Protocol Apps) enable tools to return interactive UI surfaces instead of just text or JSON. These "Interactive Capsules" run in sandboxed iframes with bidirectional communication between the tool and the host.

## Key Concepts

### Interactive Capsule

A containerized UI surface that:
- Runs in a sandboxed iframe with strict CSP
- Can invoke tools via `window.a2r.invokeTool()`
- Receives real-time updates from the tool via SSE/WebSocket
- Has a defined lifecycle: pending → active → closed

### Tool UI Surface

The UI definition that includes:
- `html`: HTML content rendered in the capsule
- `css`: Optional styles
- `js`: Optional JavaScript for interactivity
- `props`: Initial data passed to the capsule
- `permissions`: Capabilities granted to the capsule

### MCP Bridge

The bidirectional communication protocol:
- **Tool → UI**: Data updates, events, errors
- **UI → Tool**: Tool invocations, user actions, state updates
- Uses `postMessage` API with origin validation

## Quick Start

```typescript
import { 
  CreateCapsuleRequest,
  ToolUISurface,
  MCPMessageType 
} from '@a2r/mcp-apps';

// Define a UI surface
const surface: ToolUISurface = {
  html: `
    <div class="counter">
      <h1>Count: <span id="count">0</span></h1>
      <button id="increment">+</button>
      <button id="decrement">-</button>
    </div>
  `,
  css: `
    .counter { padding: 20px; text-align: center; }
    button { padding: 10px 20px; margin: 5px; }
  `,
  js: `
    let count = 0;
    const countEl = document.getElementById('count');
    
    document.getElementById('increment').onclick = async () => {
      const result = await a2r.invokeTool('counter:increment', { current: count });
      count = result.newCount;
      countEl.textContent = count;
    };
    
    // Subscribe to external updates
    a2r.subscribe('counter:updated', (data) => {
      count = data.count;
      countEl.textContent = count;
    });
  `,
  permissions: [
    { type: 'tool:invoke', resource: 'counter:increment' },
    { type: 'tool:invoke', resource: 'counter:decrement' },
    { type: 'event:subscribe', resource: 'counter:updated' },
  ],
};

// Create capsule request
const request: CreateCapsuleRequest = {
  type: 'counter-widget',
  toolId: 'counter-tool',
  surface,
  ttlSeconds: 1800,
};
```

## Capsule Lifecycle

```
┌─────────┐    create     ┌─────────┐    render     ┌─────────┐
│  None   │ ─────────────>│ Pending │ ─────────────>│ Active  │
└─────────┘               └─────────┘               └────┬────┘
                                                         │
                              ┌──────────────────────────┤
                              │                          │
                              ▼                          │
                         ┌─────────┐                     │
                         │  Error  │<────────────────────┤
                         └────┬────┘   error            │
                              │                         │
                              ▼                         │
                         ┌─────────┐                    │
                         │ Closed  │<───────────────────┘
                         └─────────┘   close/user action
```

## Security Model

### Sandboxing
- Capsules run in `sandbox="allow-scripts"` iframes
- No access to cookies, storage, or parent DOM
- Strict CSP: `default-src 'none'; script-src 'unsafe-inline'`

### Permission System
- All capabilities must be explicitly granted
- Tool invocations are validated against allowlist
- Events are filtered by subscription list

### Origin Validation
- All postMessages validated against expected origin
- Reject messages from unknown sources

## API Reference

### Types

- `InteractiveCapsule` - Core capsule type
- `ToolUISurface` - UI surface definition
- `CapsulePermission` - Permission grants
- `MCPMessage` - Bridge message format

### Functions

- `createMCPMessage()` - Build bridge messages
- `validateMCPMessage()` - Validate incoming messages
- `validateToolUISurface()` - Validate surface definitions

## License

MIT
