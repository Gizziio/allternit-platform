# Playground Core Engine

**Version:** 1.0.0  
**Status:** ✅ Complete

Core engine for A2R Playground System - interactive visual surfaces for complex agent workflows.

---

## Overview

Playgrounds are **structured interaction surfaces** that transform freeform prompting into deterministic, auditable workflows. They serve as:

- Visual control planes for agent workflows
- Deterministic intent capture surfaces  
- Living Artifacts with full traceability
- Bridge between human reasoning and agent execution

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Playground Core                          │
├─────────────────────────────────────────────────────────────┤
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐ │
│  │   Types     │  │   Store     │  │      Relay          │ │
│  │  (schema)   │  │  (state)    │  │   (HTTP/SSE)        │ │
│  └─────────────┘  └─────────────┘  └─────────────────────┘ │
│  ┌─────────────────────────────────────────────────────────┐│
│  │                    Tools API                            ││
│  │  watch() | open() | submit() | controlChange()         ││
│  └─────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────┘
```

---

## Storage Model

```
playgrounds/
├── {id}/
│   ├── playground.json    # State & configuration
│   ├── inputs/            # Input bundles
│   │   ├── files/
│   │   ├── diffs/
│   │   └── graphs/
│   └── outputs/
│       ├── prompt.txt     # Generated prompt
│       ├── patch.json     # Machine-readable patch
│       └── receipts.jsonl # Event log
```

---

## Quick Start

### Create a Playground

```typescript
import { playgroundStore } from '@a2r/playground-core';

const playground = await playgroundStore.create({
  title: 'Code Review: Auth Module',
  templateType: 'diff-review',
  inputs: {
    context: {
      diffs: [{
        newPath: 'src/auth.ts',
        newContent: '...',
        hunks: [...]
      }]
    }
  }
});
```

### Watch for Events

```typescript
// HTTP polling
const response = await fetch('/playgrounds/{id}');
const playground = await response.json();

// SSE streaming
const eventSource = new EventSource(`/playgrounds/{id}/watch`);
eventSource.onmessage = (event) => {
  const playgroundEvent = JSON.parse(event.data);
  console.log('Event:', playgroundEvent);
};
```

### Agent Tools

```typescript
import { playgroundTools } from '@a2r/playground-core';

// Watch playground
const state = await playgroundTools.watch({ id: 'pg_123' });

// Open playground
await playgroundTools.open({ id: 'pg_123' });

// Submit output
await playgroundTools.submit({
  id: 'pg_123',
  output: {
    prompt: 'Refactor the auth module to...',
    patch: { patches: [...] }
  }
});

// Record events
await playgroundTools.controlChange('pg_123', 'show-comments', true);
await playgroundTools.approvalGiven('pg_123', {
  id: 'appr_123',
  author: 'agent-1',
  target: 'hunk-5',
  approved: true
});
```

---

## Template Library

### Foundational Templates (P3.7)

1. **Diff Review Playground**
   - Render git diffs with inline comments
   - Accept/reject hunks
   - Output: Approved patch set + review receipts

2. **Codebase Architecture Playground**
   - Dependency graph visualization
   - Module boundaries
   - Output: Refactor roadmap + issue generation

### UX Templates (P3.8)

3. **Site Structure Audit**
   - Sitemap graph with orphan detection
   - Navigation change proposals
   - Output: Redirect map + IA updates

4. **Component Variation**
   - Prop toggles + variant previews
   - Token adjustments
   - Output: Variant decisions

5. **Copy Review**
   - Baseline vs variants
   - Constraint validation
   - Output: Accepted copy patch

6. **Rive Playground**
   - Parameter controls for .riv files
   - Skill-based generation
   - Output: Generated .riv + parameters

---

## Event Types

| Event | Description |
|-------|-------------|
| `PLAYGROUND_OPENED` | User/agent opened playground |
| `CONTROL_CHANGED` | Interactive control modified |
| `COMMENT_ADDED` | Comment added to playground |
| `APPROVAL_GIVEN` | Approval/rejection recorded |
| `SUBMIT_OUTPUT` | Final output submitted |
| `AGENT_APPLIED_PATCH` | Agent applied generated patch |

---

## Security Model

- Sandboxed iframe / isolated BrowserView
- Strict CSP headers
- No direct filesystem write
- All writes routed through Rails/policy engine
- Receipts logged for auditability

---

## API Reference

### REST Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/playgrounds` | List all playgrounds |
| GET | `/playgrounds/:id` | Get playground by ID |
| POST | `/playgrounds` | Create new playground |
| PUT | `/playgrounds/:id` | Update playground |
| DELETE | `/playgrounds/:id` | Delete playground |
| POST | `/playgrounds/:id/events` | Emit event |
| GET | `/playgrounds/:id/watch` | SSE event stream |

---

## Integration Points

- **A2A Review Protocol**: Playground events → review receipts
- **Living Files**: Outputs become versioned artifacts
- **Rails Execution**: Patches gated by policy engine
- **Deterministic Replay**: Full event log enables replay

---

## Related

- [Playgrounda2r Spec](../../../../Need%20To%20Finish%20FIles%20A2rchitech/a2rchitech%20brainstorm%20session%20files/playgrounda2r.md)
- [A2A Review Protocol](../../spec/review-protocol.md)
- [Living Files Doctrine](../../docs/governance/LIVING_FILES_DOCTRINE.md)
