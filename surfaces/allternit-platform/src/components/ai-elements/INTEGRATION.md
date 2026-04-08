# AI Elements Integration Guide

This document describes how AI Elements should be intelligently integrated into the platform UX.

## Core Principle

**Elements should appear based on DATA, not be statically placed.**

Each element renders when the stream contains the corresponding content type.

---

## Chat Mode Integration

### Message Rendering Pipeline

```
Rust Stream → UIParts → MessagePartsRenderer → AI Elements
```

### Element Mapping

| Element | Triggers When | Data Source |
|---------|--------------|-------------|
| `Message` | Always | Chat message wrapper |
| `MessagePartsRenderer` | Always | Inside Message content |
| `Reasoning` | `<thinking>` tag in text OR `reasoning` part type | Stream text parsing |
| `Tool` | `tool-invocation` part in stream | Tool call result |
| `Sources` | `source` or `source-document` part | RAG context |
| `ChainOfThought` | Multiple reasoning steps detected | Parsed from text |
| `InlineCitation` | `[citation:N]` or `citation` part | Message text |
| `AudioPlayer` | `audio` part OR TTS response | Voice service |
| `Attachments` | User uploads files | Input state |
| `Suggestion` | Empty state or follow-ups | Static/config |

### Implementation

```tsx
// In ChatView Message rendering
<Message from={msg.role}>
  {isAssistant ? (
    <MessagePartsRenderer 
      parts={msg.content} 
      isStreaming={isLoading && isLast}
    />
  ) : (
    <UserMessageContent content={msg.content} />
  )}
</Message>
```

---

## Code Mode Integration

### File Explorer Panel
- **FileTree** - Shows project structure
- **EnvironmentVariables** - Toggle/show env vars panel

### Editor Area
- **CodeBlock** - Syntax highlighted code
- **Snippet** - Code snippets with copy

### Terminal Panel
- **Terminal** - Live terminal output
- **StackTrace** - Error display with expand

### Preview Panel
- **Sandbox** - Sandboxed preview
- **WebPreview** - Web page preview
- **JSXPreview** - React component preview

### Status/Info
- **Plan** - Execution plan steps
- **Checkpoint** - Code checkpoint indicators
- **TestResults** - Test output with progress

### Implementation

```tsx
// Dynamic element rendering based on stream content
{streamPart.type === 'code' && <CodeBlock language={part.lang}>{part.code}</CodeBlock>}
{streamPart.type === 'terminal' && <Terminal output={part.output} />}
{streamPart.type === 'error' && <StackTrace error={part.error} />}
{streamPart.type === 'test' && <TestResults results={part.results} />}
{streamPart.type === 'plan' && <Plan steps={part.steps} />}
{streamPart.type === 'checkpoint' && <Checkpoint id={part.id} />}
```

---

## Cowork Mode Integration

### Canvas
- **Canvas** - Main workspace
- **Node** - Draggable nodes
- **Edge** - Connections between nodes
- **Panel** - Side panels

### Artifacts
- **Artifact** - Rendered artifacts
- **ArtifactPanel** - Artifact details/editor
- **Image** - Generated/displayed images
- **AudioPlayer** - Audio artifacts

### Toolbar
- **Toolbar** - Contextual tools
- **Controls** - Playback controls

### Context
- **Context** - Context panel
- **Sources** - Document sources

---

## Agent/Runner Mode Integration

### Task Management
- **Task** - Active tasks
- **Queue** - Pending operations
- **Plan** - Agent execution plan

### State Management
- **Checkpoint** - Save/restore points
- **Commit** - Git operations
- **Confirmation** - User approval dialogs

### Progress
- **ChainOfThought** - Agent reasoning steps
- **Reasoning** - Current thought process
- **Shimmer** - Loading states

---

## Stream Part Types to Implement

### Standard AI SDK Parts (already supported)
- `text` - Plain text
- `tool-invocation` - Tool calls
- `source` / `source-document` - RAG sources

### Extended Parts (need backend support)
- `reasoning` - Explicit reasoning block
- `chain-of-thought` - Multi-step reasoning
- `audio` - Audio response
- `citation` - Inline citation
- `code` - Code block
- `terminal` - Terminal output
- `error` / `stack-trace` - Error info
- `test` / `test-results` - Test output
- `plan` - Execution plan
- `checkpoint` - Checkpoint marker
- `image` - Image data
- `file` - File attachment

---

## Implementation Priority

### Phase 1: Chat Mode (High Priority)
1. ✅ Message/Conversation structure
2. ✅ Basic text rendering
3. 🔄 Tool invocation rendering (needs wiring)
4. 🔄 Reasoning extraction from text
5. ❌ Sources panel for RAG
6. ❌ Audio player for TTS

### Phase 2: Code Mode (Medium Priority)
1. ✅ CodeBlock rendering
2. 🔄 Terminal output (needs backend)
3. ❌ Stack trace for errors
4. ❌ Test results display
5. ❌ Plan visualization
6. ❌ Checkpoint indicators

### Phase 3: Cowork/Agent (Lower Priority)
1. ✅ Canvas/Node basics
2. ✅ Artifact display
3. 🔄 Task/Queue (needs state management)
4. ❌ Confirmation dialogs
5. ❌ Commit operations

---

## Backend Requirements

The Rust backend needs to output structured UIParts:

```rust
pub enum UIPart {
    Text { text: String },
    ToolInvocation { tool_name: String, arguments: Value, result: Option<Value> },
    Source { id: String, title: String, url: String, content: String },
    Reasoning { reasoning: String },
    ChainOfThought { steps: Vec<ThoughtStep> },
    Audio { url: String, duration: f64 },
    Code { language: String, code: String },
    Terminal { command: String, output: String, exit_code: i32 },
    Error { message: String, stack_trace: Option<String> },
    TestResults { passed: i32, failed: i32, tests: Vec<TestResult> },
    Plan { steps: Vec<PlanStep> },
    Checkpoint { id: String, description: String },
    Image { url: String, alt: String },
}
```

---

## Current Gaps

1. **Stream Parser**: No intelligent parsing of `<thinking>` tags
2. **Tool Rendering**: Tools show but not with real data
3. **Source Display**: Sources not wired to RAG
4. **Audio Playback**: TTS works but not integrated into message flow
5. **Error Display**: Errors show as text, not StackTrace element
6. **Test Results**: No test result streaming
7. **Plan Visualization**: Plans not streamed from agent
