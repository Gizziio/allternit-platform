# Extended Rust Stream Contract

Extends the Rust SSE stream protocol to support structured AI Elements rendering.

## Current Contract (Baseline)

```rust
// Existing events - DO NOT CHANGE
message_start      -> { type: "message_start", messageId: string }
content_block_delta-> { type: "content_block_delta", delta: { type: "text_delta", text: string } }
content_block_start-> { type: "content_block_start", content_block: { type: "tool_use", id, name, input } }
tool_result        -> { type: "tool_result", toolCallId: string, result: any }
tool_error         -> { type: "tool_error", toolCallId: string, error: string }
source             -> { type: "source", sourceId, url, title }
finish             -> { type: "finish" }
```

## Extended Contract (New Events)

### Reasoning Events
```rust
// When AI starts reasoning
{ 
  type: "reasoning_start",
  reasoningId: string,  // Unique ID for this reasoning block
}

// Reasoning content delta (streamed)
{
  type: "reasoning_delta",
  reasoningId: string,
  delta: { text: string }
}

// Reasoning complete
{
  type: "reasoning_end",
  reasoningId: string,
}
```

### Chain of Thought Events
```rust
// Multi-step reasoning
{
  type: "chain_of_thought",
  steps: [
    { id: "step-1", title: "Analyzing request", status: "complete", content: "..." },
    { id: "step-2", title: "Retrieving context", status: "in_progress" },
    { id: "step-3", title: "Generating response", status: "pending" }
  ]
}
```

### Code/Terminal Events
```rust
// Code block with language
{
  type: "code_block",
  language: "rust",
  code: "fn main() { ... }",
  filename: "main.rs"  // optional
}

// Terminal output
{
  type: "terminal_output",
  command: "cargo build",
  output: "Compiling...\nFinished dev",
  exit_code: 0,  // null if still running
  status: "running" | "completed" | "error"
}

// Error with stack trace
{
  type: "error",
  message: "Failed to compile",
  stack_trace: "  at main.rs:10:5\n  at lib.rs:20",
  kind: "compilation" | "runtime" | "validation"
}
```

### Test Events
```rust
// Test results
{
  type: "test_results",
  summary: { total: 10, passed: 8, failed: 2, skipped: 0 },
  tests: [
    { name: "test_add", status: "passed", duration_ms: 5 },
    { name: "test_divide", status: "failed", error: "panicked", duration_ms: 10 }
  ]
}
```

### Plan Events
```rust
// Execution plan
{
  type: "plan",
  planId: string,
  title: "Refactor authentication",
  steps: [
    { id: "1", description: "Update User model", status: "complete" },
    { id: "2", description: "Migrate database", status: "in_progress" },
    { id: "3", description: "Update API endpoints", status: "pending" }
  ]
}

// Checkpoint reached
{
  type: "checkpoint",
  checkpointId: string,
  description: "Database migration complete",
  metadata: { ... }
}
```

### Audio Events
```rust
// TTS audio available
{
  type: "audio",
  audioUrl: "/v1/voice/audio/tts_123.wav",
  duration: 3.5,
  voice: "chatterbox-default"
}
```

### File/Artifact Events
```rust
// File operation
{
  type: "file",
  operation: "create" | "modify" | "delete",
  path: "src/main.rs",
  content: "...",  // For create/modify
  diff: "..."     // Optional: show changes
}

// Generated artifact (image, etc)
{
  type: "artifact",
  artifactId: string,
  kind: "image" | "svg" | "mermaid" | "jsx",
  url: "/artifacts/img_123.png",
  title: "Generated diagram"
}
```

### Citation Events
```rust
// Inline citation
{
  type: "citation",
  citationId: string,
  sourceId: string,  // References a previous 'source' event
  text: "According to the documentation...",
  indices: [145, 189]  // Character positions in message
}
```

### Confirmation Events
```rust
// Request user confirmation
{
  type: "confirmation_request",
  confirmationId: string,
  title: "Delete file?",
  description: "This will permanently delete src/old.rs",
  actions: [
    { id: "confirm", label: "Delete", style: "danger" },
    { id: "cancel", label: "Cancel", style: "secondary" }
  ]
}

// User response (sent from frontend)
{
  type: "confirmation_response",
  confirmationId: string,
  actionId: "confirm" | "cancel"
}
```

## Implementation Guide

### Rust Backend Changes

1. **Update Event Types** (`src/stream/events.rs`):
```rust
#[derive(Serialize)]
#[serde(tag = "type")]
pub enum StreamEvent {
    // ... existing variants
    
    // New variants
    #[serde(rename = "reasoning_start")]
    ReasoningStart { reasoning_id: String },
    
    #[serde(rename = "reasoning_delta")]
    ReasoningDelta { reasoning_id: String, delta: ReasoningDelta },
    
    #[serde(rename = "code_block")]
    CodeBlock { language: String, code: String, filename: Option<String> },
    
    #[serde(rename = "terminal_output")]
    TerminalOutput { command: String, output: String, exit_code: Option<i32>, status: String },
    
    // ... etc
}
```

2. **Emit Events from LLM Loop**:
```rust
// When detecting <thinking> tags
if content.contains("<thinking>") {
    stream.send(StreamEvent::ReasoningStart { 
        reasoning_id: uuid() 
    }).await?;
}

// When tool execution completes
stream.send(StreamEvent::TerminalOutput {
    command: tool_call.name.clone(),
    output: result.to_string(),
    exit_code: Some(0),
    status: "completed".to_string()
}).await?;
```

3. **Structured Output Parser**:
```rust
// Parse LLM output for structured sections
pub fn parse_structured_output(text: &str) -> Vec<ContentBlock> {
    let mut blocks = vec![];
    
    // Extract <thinking> sections
    for cap in THINKING_REGEX.captures_iter(text) {
        blocks.push(ContentBlock::Reasoning {
            content: cap[1].to_string()
        });
    }
    
    // Extract ```code blocks
    for cap in CODE_REGEX.captures_iter(text) {
        blocks.push(ContentBlock::Code {
            language: cap[1].to_string(),
            code: cap[2].to_string()
        });
    }
    
    blocks
}
```

### Frontend Adapter Changes

1. **Extend RustEventType**:
```typescript
export type RustEventType = 
  | "message_start"
  | "content_block_delta"
  | // ... existing
  | "reasoning_start"
  | "reasoning_delta"
  | "reasoning_end"
  | "code_block"
  | "terminal_output"
  | "error"
  | "test_results"
  | "plan"
  | "checkpoint"
  | "audio"
  | "file"
  | "artifact"
  | "citation";
```

2. **Add Event Handlers**:
```typescript
const RUST_EVENT_MAP: Record<RustEventType, RustEventHandler> = {
  // ... existing handlers
  
  reasoning_start: (event, ctx) => {
    const part: ReasoningUIPart = {
      type: "reasoning",
      reasoningId: event.reasoningId,
      content: "",
      isOpen: true
    };
    ctx.assistantParts.push(part);
  },
  
  reasoning_delta: (event, ctx) => {
    const part = ctx.assistantParts.find(
      p => p.type === "reasoning" && p.reasoningId === event.reasoningId
    );
    if (part) part.content += event.delta.text;
  },
  
  code_block: (event, ctx) => {
    const part: CodeUIPart = {
      type: "code",
      language: event.language,
      code: event.code,
      filename: event.filename
    };
    ctx.assistantParts.push(part);
  },
  
  // ... etc
};
```

## Migration Strategy

### Phase 1: Non-Breaking Additions (Safe)
Add new event types that don't conflict with existing ones:
- `reasoning_start/delta/end`
- `code_block`
- `audio`
- `citation`

### Phase 2: Enhanced Parsing (Medium Risk)
Parse existing text content for structure:
- Auto-detect code blocks in text
- Extract thinking sections
- Parse citations

### Phase 3: Full Structured Output (Breaking)
Replace text streaming with structured blocks:
- LLM outputs JSON instead of raw text
- Each block has explicit type
- Frontend renders based on type

## Example: Complete Message Flow

```
1. message_start { messageId: "msg-1" }

2. reasoning_start { reasoningId: "r-1" }
3. reasoning_delta { reasoningId: "r-1", delta: { text: "Let me think" } }
4. reasoning_delta { reasoningId: "r-1", delta: { text: " about this..." } }
5. reasoning_end { reasoningId: "r-1" }

6. content_block_delta { delta: { text: "Here's the solution:" } }

7. code_block { language: "rust", code: "fn main() {}", filename: "main.rs" }

8. terminal_output { 
     command: "cargo run", 
     output: "Hello, world!", 
     exit_code: 0,
     status: "completed"
   }

9. content_block_delta { delta: { text: "The program ran successfully!" } }

10. source { sourceId: "s-1", url: "https://doc.rust-lang.org", title: "Rust Docs" }

11. finish {}
```

Frontend renders:
- Collapsible "Thinking" section (reasoning)
- Text: "Here's the solution:"
- Code block with syntax highlighting
- Terminal output showing command result
- Text: "The program ran successfully!"
- Source citation
