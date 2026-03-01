# Unified Rendering System

## Core Principle

**All modes share the same rendering surface.** Elements appear based on DATA, not view mode.

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     ALL MODES (Chat/Cowork/Agent/Code)       │
│                                                              │
│  ┌──────────────────────────────────────────────────────┐   │
│  │         UnifiedMessageRenderer                        │   │
│  │  (Renders AI Elements based on stream content type)   │   │
│  └──────────────────────────────────────────────────────┘   │
│                         │                                    │
│         ┌───────────────┼───────────────┐                    │
│         ▼               ▼               ▼                    │
│  ┌──────────┐   ┌──────────┐   ┌──────────┐                 │
│  │  Text    │   │  Code    │   │  Tools   │  etc...         │
│  │ Markdown │   │ Blocks   │   │          │                 │
│  └──────────┘   └──────────┘   └──────────┘                 │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

## Usage

All views use the same renderer:

```tsx
import { UnifiedMessageRenderer } from '@/components/ai-elements';

// In ChatView, CoworkView, AgentView, RunnerView, CodeView:
<UnifiedMessageRenderer 
  parts={message.parts} 
  isStreaming={isLoading}
/>
```

## Element Mapping

| Content Type | AI Element | Appears In |
|--------------|------------|------------|
| `text` | Markdown | All modes |
| `reasoning` | Collapsible thinking | All modes |
| `code` | CodeBlock | All modes |
| `terminal` | Terminal output | All modes (styled for Code) |
| `dynamic-tool` | Tool invocation | All modes |
| `source-document` | Source citation | All modes |
| `error` | Error display | All modes |
| `test-results` | Test results | All modes |
| `plan` | Execution plan | All modes |
| `checkpoint` | Checkpoint marker | All modes |
| `audio` | Audio player | All modes |
| `artifact` | Image/SVG preview | All modes |
| `queue` | Processing queue | All modes |
| `task` | Background task | All modes |
| `commit` | Git commit | All modes |
| `confirmation` | User approval | All modes |
| `file-tree` | File structure | All modes |
| `sandbox` | Sandboxed preview | All modes |
| `web-preview` | Web preview | All modes |
| `canvas` | Visual canvas | All modes |
| `file-operation` | File change | All modes |

## Mode Differences

The modes are **layout contexts**, not capability boundaries:

### Chat Mode
- Floating conversation layout
- Voice input prominent
- Focus on back-and-forth dialogue

### Cowork Mode  
- Canvas-centric layout
- Artifacts in sidebar
- Multi-modal workspace

### Agent/Runner Mode
- Task queue visible
- Plan steps sidebar
- Execution-focused UI

### Code Mode
- Same elements as above PLUS:
- **Terminal panel** (dedicated space)
- **Sandbox panel** (live preview)
- File explorer sidebar

## Backend Integration

The Rust backend emits events that map to these elements:

```rust
// Any mode can receive any event type
stream.send(Event::Text { text: "Hello" });
stream.send(Event::Code { language: "rust", code: "..." });
stream.send(Event::Terminal { command: "cargo build", output: "..." });
stream.send(Event::Plan { steps: [...] });
// etc
```

The frontend automatically renders the appropriate element.

## Smart Parsing (Fallback)

When backend sends plain text with embedded patterns, the frontend auto-detects:

```
<thinking>reasoning</thinking>     → Reasoning element
```language code```              → CodeBlock element
$ command
output                          → Terminal element
Error: message
Stack: trace                    → Error element
[citation:1]                    → Citation element
```

## Migration Path

1. **Phase 1**: All views use `UnifiedMessageRenderer` for assistant messages
2. **Phase 2**: Backend starts emitting structured events for new elements
3. **Phase 3**: Elements appear automatically as backend sends them

## Key Insight

**The mode doesn't determine what's possible. The data does.**

- Chat mode CAN show code, terminal, plans, etc
- Code mode CAN show reasoning, confirmations, tasks
- All modes are equally capable

The mode is just a **default layout preference**, not a constraint.
