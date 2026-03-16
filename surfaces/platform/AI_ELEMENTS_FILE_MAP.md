# AI Elements File Implementation Guide

Specific file locations for implementing each AI Element component.

---

## Views Directory (`src/views/`)

### `ChatView.tsx` (Main Chat Interface)
```typescript
// Imports needed:
import { Conversation, ConversationContent } from "@/components/ai-elements";
import { Message, MessageContent, MessageActions } from "@/components/ai-elements";
import { PromptInput, PromptInputTextarea } from "@/components/ai-elements";
import { Attachments, Attachment, AttachmentPreview, AttachmentInfo } from "@/components/ai-elements";
import { Context, ContextTrigger, ContextContent } from "@/components/ai-elements";
import { ModelSelector, ModelSelectorTrigger, ModelSelectorContent } from "@/components/ai-elements";
import { Sources, Source } from "@/components/ai-elements";
import { InlineCitation } from "@/components/ai-elements";
import { Confirmation, ConfirmationTitle, ConfirmationActions, ConfirmationAction } from "@/components/ai-elements";
import { Reasoning, ReasoningTrigger, ReasoningContent } from "@/components/ai-elements";
import { Shimmer } from "@/components/ai-elements";
import { Tool, ToolHeader, ToolContent } from "@/components/ai-elements";
import { Queue, QueueSection, QueueItem } from "@/components/ai-elements";
import { Task, TaskTrigger, TaskContent } from "@/components/ai-elements";
import { Plan, PlanHeader, PlanContent } from "@/components/ai-elements";
import { Suggestion, Suggestions } from "@/components/ai-elements";
import { Checkpoint } from "@/components/ai-elements";

// Usage locations:
// - Conversation → Main message list container
// - Message → Each chat bubble
// - PromptInput → Bottom input area
// - Context → Right sidebar or header
// - ModelSelector → Header model dropdown
// - Sources → Below assistant messages
// - Confirmation → Tool approval modal
// - Reasoning → Thinking sections (o1, Claude)
// - Shimmer → Streaming loading state
// - Tool → Tool call display
// - Queue → Multi-step task list
// - Plan → Plan visualization
```

### `CodeWorkspaceView.tsx`
```typescript
// Imports needed:
import { CodeBlock } from "@/components/ai-elements";
import { Snippet, SnippetInput, SnippetCopyButton } from "@/components/ai-elements";
import { Terminal, TerminalHeader, TerminalContent } from "@/components/ai-elements";
import { FileTree, FileTreeFolder, FileTreeFile } from "@/components/ai-elements";
import { Sandbox, SandboxHeader, SandboxContent } from "@/components/ai-elements";
import { Artifact, ArtifactHeader, ArtifactContent } from "@/components/ai-elements";
import { AgentCard, AgentHeader, AgentContent, AgentInstructions } from "@/components/ai-elements";
import { EnvironmentVariables } from "@/components/ai-elements";
import { PackageInfo } from "@/components/ai-elements";
import { Commit, CommitHash, CommitMessage } from "@/components/ai-elements";
import { TestResults, TestResultsHeader, TestResultsSummary } from "@/components/ai-elements";
import { StackTrace, StackTraceHeader, StackTraceContent } from "@/components/ai-elements";
import { JSXPreview } from "@/components/ai-elements";
import { WebPreview, WebPreviewNavigation, WebPreviewUrl } from "@/components/ai-elements";
import { SchemaDisplay } from "@/components/ai-elements";

// Usage locations:
// - CodeBlock → Code output panels
// - Snippet → Copyable command examples
// - Terminal → Shell output
// - FileTree → Left sidebar explorer
// - Sandbox → Code execution panel
// - Artifact → Generated code files
// - AgentCard → Agent configurations
// - EnvironmentVariables → Secrets panel
// - PackageInfo → Dependencies view
// - Commit → Git history
// - TestResults → Test output panel
// - StackTrace → Error display
// - JSXPreview → Component preview
// - WebPreview → Live preview
// - SchemaDisplay → API docs
```

### `VoiceView.tsx`
```typescript
// Imports needed:
import { SpeechInput } from "@/components/ai-elements";
import { AudioPlayer } from "@/components/ai-elements";
import { Transcription, TranscriptionSegment } from "@/components/ai-elements";
import { MicSelector, MicSelectorTrigger, MicSelectorContent } from "@/components/ai-elements";
import { VoiceSelector, VoiceSelectorTrigger, VoiceSelectorContent } from "@/components/ai-elements";
import { Persona } from "@/components/ai-elements";

// Usage locations:
// - SpeechInput → Main voice record button
// - AudioPlayer → Playback controls
// - Transcription → Speech-to-text display
// - MicSelector → Settings > Input device
// - VoiceSelector → Settings > Voice
// - Persona → Voice characteristics
```

### `WorkflowView.tsx`
```typescript
// Imports needed:
import { Canvas } from "@/components/ai-elements";
import { Node, NodeHeader, NodeContent } from "@/components/ai-elements";
import { Edge } from "@/components/ai-elements/edge";
import { Connection } from "@/components/ai-elements";
import { Controls } from "@/components/ai-elements";
import { Panel, PanelHeader, PanelContent } from "@/components/ai-elements";
import { Toolbar, ToolbarButton } from "@/components/ai-elements";
import { Queue, QueueSection, QueueItem } from "@/components/ai-elements";
import { Task, TaskTrigger, TaskContent } from "@/components/ai-elements";

// Usage locations:
// - Canvas → Main workflow editor
// - Node → Workflow nodes (LLM, Tool, If)
// - Edge → Connections between nodes
// - Connection → Custom animated edges
// - Controls → Zoom, fit controls
// - Panel → Properties sidebar
// - Toolbar → Top action bar
// - Queue → Execution queue
// - Task → Individual steps
```

### `AgentRunnerView.tsx`
```typescript
// Imports needed:
import { AgentCard, AgentHeader, AgentContent, AgentInstructions } from "@/components/ai-elements";
import { Tool, ToolHeader, ToolContent } from "@/components/ai-elements";
import { Message, MessageContent } from "@/components/ai-elements";
import { Context, ContextTrigger, ContextContent } from "@/components/ai-elements";
import { Confirmation } from "@/components/ai-elements";
import { Checkpoint } from "@/components/ai-elements";
import { Queue, QueueItem } from "@/components/ai-elements";
import { Reasoning, ReasoningTrigger, ReasoningContent } from "@/components/ai-elements";
import { Shimmer } from "@/components/ai-elements";
import { Image } from "@/components/ai-elements";
import { OpenIn, OpenInTrigger } from "@/components/ai-elements";

// Usage locations:
// - AgentCard → Header with agent info
// - Tool → Real-time tool execution
// - Message → Agent responses
// - Context → Token usage sidebar
// - Confirmation → Approval dialogs
// - Checkpoint → Save status
// - Queue → Task list
// - Reasoning → Show thinking
// - Shimmer → Loading states
// - Image → Generated images
// - OpenIn → Share to chat
```

---

## Components Directory (`src/components/`)

### `chat/MessageRenderer.tsx` (Message Component)
```typescript
// Renders different message types:
// - Text → MessageContent
// - Code → CodeBlock
// - Tool call → Tool
// - Image → Image
// - Reasoning → Reasoning
// - Sources → Sources
```

### `chat/StreamingMessage.tsx`
```typescript
// Uses:
// - Shimmer → While streaming
// - Message → Partial content
// - Reasoning → Chain of thought
```

### `code/CodeArtifact.tsx`
```typescript
// Uses:
// - Artifact → Container
// - CodeBlock → Code display
// - WebPreview → Preview tab
// - Snippet → Copy command
```

### `workflow/NodeTypes.tsx`
```typescript
// Custom nodes using:
// - Node → Base component
// - NodeHeader → Title bar
// - NodeContent → Body
// - Connection → Input/output ports
```

### `workflow/EdgeTypes.tsx`
```typescript
// Custom edges using:
// - Edge.Animated → Data flow
// - Edge.Temporary → Dragging
// - Connection → Custom SVG
```

---

## Hooks Directory (`src/hooks/`)

### `useStreamingMessage.ts`
```typescript
// Returns components:
// - Shimmer for loading
// - Reasoning for thinking
// - Message for content
```

### `useToolExecution.ts`
```typescript
// Manages:
// - Tool component state
// - Confirmation dialogs
// - Queue updates
```

---

## Store Directory (`src/store/`)

### `chatStore.ts`
```typescript
// State includes:
// - Messages[] (Message props)
// - Context (token usage)
// - Queue (task state)
```

### `workflowStore.ts`
```typescript
// State includes:
// - Nodes[] (Node data)
// - Edges[] (Edge data)
// - Canvas viewport
```

---

## Routes Implementation

| Route | File | Key Components |
|-------|------|----------------|
| `/chat` | `views/ChatView.tsx` | Conversation, Message, PromptInput, Context |
| `/chat/:id` | `views/ChatView.tsx` | + Sources, Confirmation |
| `/code` | `views/CodeWorkspaceView.tsx` | FileTree, CodeBlock, Terminal, Sandbox |
| `/code/:projectId` | `views/CodeWorkspaceView.tsx` | + Artifact, WebPreview |
| `/voice` | `views/VoiceView.tsx` | SpeechInput, AudioPlayer, Transcription |
| `/workflows` | `views/WorkflowView.tsx` | Canvas, Node, Edge, Controls |
| `/workflows/:id` | `views/WorkflowView.tsx` | + Panel, Toolbar, Queue |
| `/agents` | `views/AgentsView.tsx` | AgentCard grid |
| `/agents/:id/run` | `views/AgentRunnerView.tsx` | AgentCard, Tool, Message, Context |
| `/elements-lab` | `views/ElementsLab.tsx` | All 48 components |

---

## Component Import Quick Reference

### Chatbot (18)
```typescript
import {
  // Container
  Conversation, ConversationContent, ConversationEmptyState,
  // Messages
  Message, MessageContent, MessageActions,
  // Input
  PromptInput, PromptInputTextarea, PromptInputBody, PromptInputHeader, PromptInputFooter, PromptInputTools,
  // Attachments
  Attachments, Attachment, AttachmentPreview, AttachmentInfo,
  // Context
  Context, ContextTrigger, ContextContent, ContextContentHeader, ContextInputUsage, ContextOutputUsage, ContextContentFooter,
  // Selection
  ModelSelector, ModelSelectorTrigger, ModelSelectorContent, ModelSelectorItem,
  // Citations
  Sources, Source, InlineCitation,
  // Actions
  Confirmation, ConfirmationTitle, ConfirmationRequest, ConfirmationActions, ConfirmationAction,
  // Reasoning
  Reasoning, ReasoningTrigger, ReasoningContent, ChainOfThought, ChainOfThoughtHeader, ChainOfThoughtStep, ChainOfThoughtContent,
  // Status
  Checkpoint, CheckpointIcon, CheckpointTrigger,
  // Loading
  Shimmer,
  // Tools
  Tool, ToolHeader, ToolContent, ToolInput,
  // Tasks
  Queue, QueueSection, QueueSectionTrigger, QueueSectionLabel, QueueSectionContent, QueueList, QueueItem, QueueItemIndicator, QueueItemContent,
  Task, TaskTrigger, TaskContent, TaskItem,
  Plan, PlanHeader, PlanTitle, PlanDescription, PlanAction, PlanContent, PlanTrigger,
  // Suggestions
  Suggestion, Suggestions,
} from "@/components/ai-elements";
```

### Code (15)
```typescript
import {
  CodeBlock,
  Snippet, SnippetInput, SnippetCopyButton, SnippetAddon, SnippetText,
  Terminal, TerminalHeader, TerminalContent,
  FileTree, FileTreeFolder, FileTreeFile,
  Sandbox, SandboxHeader, SandboxContent,
  Artifact, ArtifactHeader, ArtifactTitle, ArtifactContent, ArtifactActions,
  AgentCard, AgentHeader, AgentContent, AgentInstructions, AgentTools, AgentTool, AgentOutput,
  EnvironmentVariables,
  PackageInfo,
  Commit, CommitHash, CommitMessage,
  TestResults, TestResultsHeader, TestResultsSummary, TestResultsProgress, TestResultsList, TestResultsItem,
  StackTrace, StackTraceHeader, StackTraceError, StackTraceErrorType, StackTraceErrorMessage, StackTraceActions, StackTraceCopyButton, StackTraceExpandButton, StackTraceContent, StackTraceFrames,
  JSXPreview,
  WebPreview, WebPreviewNavigation, WebPreviewUrl, WebPreviewFrame,
  SchemaDisplay,
} from "@/components/ai-elements";
```

### Voice (6)
```typescript
import {
  SpeechInput,
  AudioPlayer, AudioPlayerControls, AudioPlayerPlayButton, AudioPlayerSeekBar, AudioPlayerVolumeButton, AudioPlayerTimeDisplay,
  Transcription, TranscriptionSegment,
  MicSelector, MicSelectorTrigger, MicSelectorContent, MicSelectorInput, MicSelectorList, MicSelectorItem, MicSelectorLabel, MicSelectorEmpty, MicSelectorValue,
  VoiceSelector, VoiceSelectorTrigger, VoiceSelectorContent, VoiceSelectorItem,
  Persona, PersonaAvatar, PersonaName, PersonaDescription,
} from "@/components/ai-elements";
```

### Workflow (7)
```typescript
import {
  Canvas,
  Node, NodeHeader, NodeContent,
  Edge,
  Connection,
  Controls,
  Panel, PanelHeader, PanelContent,
  Toolbar, ToolbarButton,
} from "@/components/ai-elements";
```

### Utilities (2)
```typescript
import {
  Image,
  OpenIn, OpenInTrigger, OpenInContent, OpenInItem,
} from "@/components/ai-elements";
```
