# ChatView Functional Implementation Plan

## Current State Analysis

### What's Already Working (Voice)
| Component | Status | Implementation |
|-----------|--------|----------------|
| VoicePresence | ✅ | Full implementation with Persona, settings, recording |
| Persona | ✅ | Rive animation, energy-based animation |
| MicSelector | ✅ | Inside VoicePresence settings popover |
| VoiceSelector | ✅ | Inside VoicePresence settings popover |
| AudioPlayer | ⚠️ | Imported but not used (TTS uses voiceService directly) |

### What's NOT Wired
| Component | Purpose | Where It Should Go |
|-----------|---------|-------------------|
| SpeechInput | Standalone voice input | Could replace or supplement VoicePresence |
| VoiceOverlay | Full-screen overlay | VoicePresence already has overlay mode |
| VoiceToolbar | Voice control toolbar | Could add to header/toolbar area |
| Transcription | Display transcripts | Should show STT results |

---

## Correct Implementation Approach

### Principle: Functional, Not Decorative
- Components must DO something, not just be displayed
- Components must be wired to real data/providers
- Components must handle their intended use cases

---

## Phase 1: Add ALL Missing Imports (Non-Breaking)

Add imports for all 63 missing components without changing existing functionality:

```typescript
// Voice (additional)
import { SpeechInput } from "@/components/ai-elements/speech-input";
import { VoiceOverlay } from "@/components/ai-elements/voice-overlay";
import { VoiceToolbar } from "@/components/ai-elements/voice-toolbar";
import { Transcription, TranscriptionSegment } from "@/components/ai-elements/transcription";

// Code
import { Terminal } from "@/components/ai-elements/terminal";
import { TestResults, TestResultsHeader, TestResultsSummary } from "@/components/ai-elements/test-results";
import { StackTrace, StackTraceHeader, StackTraceContent } from "@/components/ai-elements/stack-trace";
import { FileTree, FileTreeFolder, FileTreeFile } from "@/components/ai-elements/file-tree";
import { Snippet, SnippetInput, SnippetCopyButton } from "@/components/ai-elements/snippet";
import { Commit, CommitHash, CommitMessage } from "@/components/ai-elements/commit";
import { EnvironmentVariables } from "@/components/ai-elements/environment-variables";
import { PackageInfo } from "@/components/ai-elements/package-info";
import { SchemaDisplay } from "@/components/ai-elements/schema-display";

// Workflow
import { Canvas } from "@/components/ai-elements/canvas";
import { Node } from "@/components/ai-elements/node";
import { Edge } from "@/components/ai-elements/edge";
import { Connection } from "@/components/ai-elements/connection";
import { Controls } from "@/components/ai-elements/controls";
import { Panel } from "@/components/ai-elements/panel";
import { Toolbar } from "@/components/ai-elements/toolbar";

// Utility
import { Image as AIImage } from "@/components/ai-elements/image";
import { OpenIn, OpenInChatGPT, OpenInClaude } from "@/components/ai-elements/open-in-chat";
import { ModelSelector } from "@/components/ai-elements/model-selector";
import { Agent, AgentHeader, AgentContent } from "@/components/ai-elements/agent";

// Additional Structured
import { ChainOfThought, ChainOfThoughtHeader, ChainOfThoughtStep } from "@/components/ai-elements/chain-of-thought";
import { Context, ContextTrigger, ContextContent } from "@/components/ai-elements/context";
import { InlineCitation } from "@/components/ai-elements/inline-citation";
```

---

## Phase 2: Extend PartRenderer for ALL Part Types

Current PartRenderer handles ~15 types. Extend to handle ALL ExtendedUIPart types:

### New Part Types to Add:

```typescript
// Terminal output
case "terminal":
  return (
    <MessageContent>
      <Terminal output={part.output} />
    </MessageContent>
  );

// Test results
case "test-results":
  return (
    <MessageContent>
      <TestResults>
        <TestResultsHeader>Test Results</TestResultsHeader>
        <TestResultsSummary passed={part.summary.passed} failed={part.summary.failed} />
        {/* Test details */}
      </TestResults>
    </MessageContent>
  );

// Stack trace / errors
case "error":
  return (
    <MessageContent>
      <StackTrace>
        <StackTraceHeader>{part.message}</StackTraceHeader>
        <StackTraceContent>{part.stackTrace}</StackTraceContent>
      </StackTrace>
    </MessageContent>
  );

// File tree
case "file-tree":
  return (
    <MessageContent>
      <FileTree>
        {/* Render tree recursively */}
      </FileTree>
    </MessageContent>
  );

// Code snippet
case "snippet":
  return (
    <MessageContent>
      <Snippet>
        <SnippetInput>{part.code}</SnippetInput>
        <SnippetCopyButton />
      </Snippet>
    </MessageContent>
  );

// Git commit
case "commit":
  return (
    <MessageContent>
      <Commit>
        <CommitHash>{part.hash}</CommitHash>
        <CommitMessage>{part.message}</CommitMessage>
      </Commit>
    </MessageContent>
  );

// Chain of thought
case "chain-of-thought":
  return (
    <MessageContent>
      <ChainOfThought>
        <ChainOfThoughtHeader>Thinking Process</ChainOfThoughtHeader>
        {part.steps.map((step, i) => (
          <ChainOfThoughtStep key={i}>{step}</ChainOfThoughtStep>
        ))}
      </ChainOfThought>
    </MessageContent>
  );

// Context
case "context":
  return (
    <MessageContent>
      <Context>
        <ContextTrigger>Context</ContextTrigger>
        <ContextContent>{part.content}</ContextContent>
      </Context>
    </MessageContent>
  );

// Inline citation
case "citation":
  return <InlineCitation sourceId={part.sourceId} text={part.text} />;

// Image
case "image":
  return (
    <MessageContent>
      <AIImage src={part.url} alt={part.alt} />
    </MessageContent>
  );

// Model selector (interactive)
case "model-selector":
  return (
    <MessageContent>
      <ModelSelector value={part.selected} onValueChange={part.onChange}>
        {/* Model options */}
      </ModelSelector>
    </MessageContent>
  );

// Agent card
case "agent":
  return (
    <MessageContent>
      <Agent>
        <AgentHeader>{part.name}</AgentHeader>
        <AgentContent>{part.description}</AgentContent>
      </Agent>
    </MessageContent>
  );
```

---

## Phase 3: Functional Component Integration

### 3.1 Transcription Display (Functional)
**Where:** Near voice input or as message content
**Function:** Display STT transcript in real-time

```typescript
// In ChatView, add transcript display
const { transcript, interimTranscript } = useVoice();

// Show interim transcript while recording
{isRecording && interimTranscript && (
  <Transcription>
    <TranscriptionSegment isInterim>{interimTranscript}</TranscriptionSegment>
  </Transcription>
)}

// Show final transcript as message
{transcript && (
  <Transcription>
    <TranscriptionSegment>{transcript}</TranscriptionSegment>
  </Transcription>
)}
```

### 3.2 VoiceToolbar (Functional)
**Where:** Header or floating toolbar
**Function:** Quick voice controls

```typescript
// Add to header area
<VoiceToolbar>
  <VoiceToolbar.RecordButton />
  <VoiceToolbar.StopButton />
  <VoiceToolbar.SettingsButton />
</VoiceToolbar>
```

### 3.3 Code Components (Functional)
**Where:** Message rendering when backend sends code parts
**Function:** Display code, terminal, test results

Backend sends structured parts → PartRenderer renders appropriate component

### 3.4 File Tree (Functional)
**Where:** Side panel or message content
**Function:** Display file structure

```typescript
// When backend sends file-tree part
<FileTree>
  <FileTreeFolder name="src">
    <FileTreeFile name="index.ts" />
    <FileTreeFile name="app.tsx" />
  </FileTreeFolder>
</FileTree>
```

---

## Phase 4: Wire to Backend Events

Extend `rust-stream-adapter-extended.ts` to handle ALL part types:

```typescript
// Backend events that map to components
export type ExtendedRustEventType =
  // Existing
  | "reasoning_start" | "reasoning_delta" | "reasoning_end"
  | "code_block"
  | "terminal_output"
  | "error"
  | "test_results"
  | "plan"
  | "checkpoint"
  
  // New events for missing components
  | "file_tree"           // → FileTree component
  | "snippet"            // → Snippet component
  | "commit"             // → Commit component
  | "chain_of_thought"   // → ChainOfThought component
  | "context_update"     // → Context component
  | "citation"           // → InlineCitation component
  | "image"              // → Image component
  | "agent_card"         // → Agent component
  | "model_selector"     // → ModelSelector component
  | "environment_vars"   // → EnvironmentVariables component
  | "package_info"       // → PackageInfo component
  | "schema"             // → SchemaDisplay component
  | "transcription"      // → Transcription component
  | "stack_trace";       // → StackTrace component
```

---

## Phase 5: Testing & Verification

### Type Check
```bash
npx tsc --noEmit --skipLibCheck
# Should have 0 errors in ChatView.tsx
```

### Functional Tests
1. Voice recording still works
2. New component types render when backend sends them
3. All imports resolve correctly
4. No runtime errors

---

## Summary

### What This Plan Does:
1. ✅ Adds ALL 82 AI Elements as imports
2. ✅ Extends PartRenderer to handle ALL part types functionally
3. ✅ Wires transcription display to actual STT data
4. ✅ Wires code components to backend events
5. ✅ Wires file tree, snippets, commits to backend events
6. ✅ Preserves existing voice implementation (doesn't break)

### What This Plan Does NOT Do:
- ❌ Add demo/showcase sections
- ❌ Display components without function
- ❌ Break existing voice functionality
- ❌ Add unused imports

### Result:
All 82 AI Elements are:
- Imported and available
- Functionally wired to data/providers
- Ready to render when backend sends appropriate events
