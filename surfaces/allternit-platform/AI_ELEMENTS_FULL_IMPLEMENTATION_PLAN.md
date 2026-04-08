# AI Elements Full Implementation Plan

## Objective
Implement ALL 54 AI Elements components into EVERY view (Chat, Cowork, Agent, Runner, Code) with unified rendering surface.

---

## Complete AI Elements Inventory (54 Components)

### 1. Core Chat Components (8)
| # | Component | File | Purpose |
|---|-----------|------|---------|
| 1 | Conversation | conversation.tsx | Main chat container |
| 2 | Message | message.tsx | Individual message |
| 3 | MessageContent | message.tsx | Message content wrapper |
| 4 | MessageActions | message.tsx | Message action buttons |
| 5 | Attachments | attachments.tsx | File attachments |
| 6 | PromptInput | prompt-input.tsx | Chat input |
| 7 | Suggestion | suggestion.tsx | Quick suggestions |
| 8 | Shimmer | shimmer.tsx | Loading states |

### 2. Structured Content Components (18)
| # | Component | File | Purpose |
|---|-----------|------|---------|
| 9 | Reasoning | reasoning.tsx | AI thinking process |
| 10 | ReasoningTrigger | reasoning.tsx | Thinking toggle |
| 11 | ReasoningContent | reasoning.tsx | Thinking content |
| 12 | Tool | tool.tsx | Tool invocation |
| 13 | ToolHeader | tool.tsx | Tool header |
| 14 | ToolContent | tool.tsx | Tool content |
| 15 | ToolInput | tool.tsx | Tool input display |
| 16 | Sources | sources.tsx | RAG sources |
| 17 | Source | sources.tsx | Individual source |
| 18 | Confirmation | confirmation.tsx | User confirmation |
| 19 | ConfirmationTitle | confirmation.tsx | Confirmation title |
| 20 | ConfirmationActions | confirmation.tsx | Action buttons |
| 21 | ConfirmationAction | confirmation.tsx | Individual action |
| 22 | Checkpoint | checkpoint.tsx | Checkpoint marker |
| 23 | CheckpointIcon | checkpoint.tsx | Checkpoint icon |
| 24 | CheckpointTrigger | checkpoint.tsx | Checkpoint trigger |
| 25 | Queue | queue.tsx | Processing queue |
| 26 | QueueList | queue.tsx | Queue list |
| 27 | QueueItem | queue.tsx | Queue item |
| 28 | QueueItemIndicator | queue.tsx | Status indicator |
| 29 | QueueItemContent | queue.tsx | Item content |
| 30 | Task | task.tsx | Task display |
| 31 | TaskTrigger | task.tsx | Task toggle |
| 32 | TaskContent | task.tsx | Task content |
| 33 | TaskItem | task.tsx | Task item |
| 34 | Plan | plan.tsx | Execution plan |
| 35 | PlanHeader | plan.tsx | Plan header |
| 36 | PlanTitle | plan.tsx | Plan title |
| 37 | PlanDescription | plan.tsx | Plan description |
| 38 | PlanAction | plan.tsx | Plan actions |
| 39 | PlanContent | plan.tsx | Plan content |
| 40 | PlanTrigger | plan.tsx | Plan toggle |
| 41 | ChainOfThought | chain-of-thought.tsx | Step reasoning |
| 42 | Context | context.tsx | Context panel |
| 43 | InlineCitation | inline-citation.tsx | Inline reference |

### 3. Code Components (15)
| # | Component | File | Purpose |
|---|-----------|------|---------|
| 44 | CodeBlock | code-block.tsx | Syntax highlighted code |
| 45 | Markdown | markdown.tsx | Markdown rendering |
| 46 | Terminal | terminal.tsx | Terminal output |
| 47 | TestResults | test-results.tsx | Test results |
| 48 | StackTrace | stack-trace.tsx | Error stack trace |
| 49 | FileTree | file-tree.tsx | File system tree |
| 50 | FileTreeFolder | file-tree.tsx | Folder node |
| 51 | FileTreeFile | file-tree.tsx | File node |
| 52 | Snippet | snippet.tsx | Code snippet |
| 53 | Commit | commit.tsx | Git commit |
| 54 | EnvironmentVariables | environment-variables.tsx | Env vars |
| 55 | PackageInfo | package-info.tsx | Package info |
| 56 | SchemaDisplay | schema-display.tsx | Schema display |
| 57 | JSXPreview | jsx-preview.tsx | JSX preview |
| 58 | Sandbox | sandbox.tsx | Code sandbox |
| 59 | Artifact | artifact.tsx | Artifact display |
| 60 | ArtifactPanel | artifact-panel.tsx | Artifact panel |
| 61 | WebPreview | web-preview.tsx | Web preview |

### 4. Voice Components (8)
| # | Component | File | Purpose |
|---|-----------|------|---------|
| 62 | VoicePresence | voice-presence.tsx | Voice indicator |
| 63 | Persona | persona.tsx | AI persona |
| 64 | VoiceOverlay | voice-overlay.tsx | Voice UI overlay |
| 65 | VoiceToolbar | voice-toolbar.tsx | Voice controls |
| 66 | SpeechInput | speech-input.tsx | Voice input |
| 67 | Transcription | transcription.tsx | Transcript display |
| 68 | MicSelector | mic-selector.tsx | Mic device picker |
| 69 | VoiceSelector | voice-selector.tsx | Voice picker |
| 70 | AudioPlayer | audio-player.tsx | Audio playback |

### 5. Workflow Components (7)
| # | Component | File | Purpose |
|---|-----------|------|---------|
| 71 | Canvas | canvas.tsx | Workflow canvas |
| 72 | Node | node.tsx | Canvas node |
| 73 | Edge | edge.tsx | Graph edge |
| 74 | Connection | connection.tsx | Node connection |
| 75 | Controls | controls.tsx | Canvas controls |
| 76 | Panel | panel.tsx | Side panel |
| 77 | Toolbar | toolbar.tsx | Toolbar |

### 6. Utility Components (5)
| # | Component | File | Purpose |
|---|-----------|------|---------|
| 78 | Image | image.tsx | Image display |
| 79 | OpenInChat | open-in-chat.tsx | External chat links |
| 80 | ModelSelector | model-selector.tsx | Model picker |
| 81 | Agent | agent.tsx | Agent card |
| 82 | UnifiedMessageRenderer | UnifiedMessageRenderer.tsx | Unified renderer |

---

## View Implementation Matrix

### Target: 5 Views
1. **ChatView.tsx** - Main chat interface
2. **CoworkView.tsx** - Collaborative workspace
3. **AgentView.tsx** - Agent management
4. **RunnerView.tsx** - Code execution runner
5. **CodeCanvas.tsx** - Code editor canvas

### Implementation Strategy

Each view gets:
1. **ALL component imports** (even if not immediately used)
2. **PartRenderer component** handling all ExtendedUIPart types
3. **Demo/placeholder sections** showing each component
4. **Unified rendering surface** via UnifiedMessageRenderer

---

## Phase 1: ChatView.tsx (COMPLETE ✓)
**Status:** Already has 19 components wired
**Missing:** 63 components to add

### Components to Add:
```
Voice: VoiceOverlay, VoiceToolbar, SpeechInput, Transcription, MicSelector, VoiceSelector
Code: Terminal, TestResults, StackTrace, FileTree, Snippet, EnvironmentVariables, PackageInfo, SchemaDisplay
Workflow: Canvas, Node, Edge, Connection, Controls, Panel, Toolbar
Utility: Image, OpenInChat, ModelSelector, Agent
Structured: ChainOfThought, Context, InlineCitation
```

### Implementation Tasks:
- [ ] Add missing imports
- [ ] Create demo sections for each component category
- [ ] Wire voice components to voice provider
- [ ] Add code component demos
- [ ] Add workflow canvas section

---

## Phase 2: CoworkView.tsx (INCOMPLETE)
**Status:** Has 25 components
**Missing:** 57 components to add

### Components to Add:
```
Core: Conversation, Message, PromptInput
Voice: VoiceOverlay, VoiceToolbar, SpeechInput, Transcription, MicSelector, VoiceSelector, AudioPlayer, Persona
Code: Terminal, TestResults, StackTrace, FileTree, Snippet, EnvironmentVariables, PackageInfo, SchemaDisplay, Commit
Utility: ModelSelector, Agent
Structured: (some missing sub-components)
```

### Implementation Tasks:
- [ ] Add missing core chat components
- [ ] Add voice components
- [ ] Add code/terminal components
- [ ] Add utility components

---

## Phase 3: AgentView.tsx (MINIMAL)
**Status:** Has 6 components
**Missing:** 76 components to add

### Components to Add:
```
ALL except: Task, Checkpoint, Commit, Queue, Attachments, VoicePresence
```

### Implementation Tasks:
- [ ] Full component import
- [ ] Create agent dashboard layout
- [ ] Add conversation interface
- [ ] Add reasoning/planning displays
- [ ] Add code execution views
- [ ] Add voice interaction

---

## Phase 4: RunnerView.tsx (EMPTY)
**Status:** Has 0 components
**Missing:** 82 components to add

### Components to Add:
```
ALL 82 components
```

### Implementation Tasks:
- [ ] Create full view from scratch
- [ ] Add conversation for logs
- [ ] Add terminal for output
- [ ] Add test-results for results
- [ ] Add checkpoint for progress
- [ ] Add queue for job status
- [ ] Add file-tree for workspace
- [ ] Add stack-trace for errors
- [ ] Add voice components

---

## Phase 5: CodeCanvas.tsx (MINIMAL)
**Status:** Has 5 components
**Missing:** 77 components to add

### Components to Add:
```
ALL except: Conversation, Message, CodeBlock, Shimmer, VoicePresence
```

### Implementation Tasks:
- [ ] Add file-tree for explorer
- [ ] Add terminal for console
- [ ] Add test-results for tests
- [ ] Add stack-trace for errors
- [ ] Add commit for git
- [ ] Add sandbox for preview
- [ ] Add artifact for outputs
- [ ] Add reasoning for AI help
- [ ] Add planning for tasks

---

## Implementation Checklist

### Step 1: Update Imports (All Views)
- [ ] ChatView.tsx - Add 63 missing imports
- [ ] CoworkView.tsx - Add 57 missing imports  
- [ ] AgentView.tsx - Add 76 missing imports
- [ ] RunnerView.tsx - Add 82 imports (new)
- [ ] CodeCanvas.tsx - Add 77 missing imports

### Step 2: Create PartRenderer (All Views)
- [ ] ChatView.tsx - Extend PartRenderer for all types
- [ ] CoworkView.tsx - Create PartRenderer
- [ ] AgentView.tsx - Create PartRenderer
- [ ] RunnerView.tsx - Create PartRenderer
- [ ] CodeCanvas.tsx - Create PartRenderer

### Step 3: Add Demo Sections (All Views)
- [ ] ChatView.tsx - Component showcase section
- [ ] CoworkView.tsx - Component showcase section
- [ ] AgentView.tsx - Component showcase section
- [ ] RunnerView.tsx - Component showcase section
- [ ] CodeCanvas.tsx - Component showcase section

### Step 4: Wire to Providers
- [ ] Voice components → VoiceProvider
- [ ] Chat components → ChatStore
- [ ] Code components → Code execution
- [ ] Workflow components → Canvas state

### Step 5: Testing
- [ ] Type check all views
- [ ] Verify all imports resolve
- [ ] Test component rendering
- [ ] Test interactivity

---

## Files to Modify

### Primary Views:
1. `/src/views/ChatView.tsx` - Add 63 components
2. `/src/views/CoworkView.tsx` - Add 57 components
3. `/src/views/AgentView.tsx` - Add 76 components
4. `/src/views/RunnerView.tsx` - Rewrite with 82 components
5. `/src/views/code/CodeCanvas.tsx` - Add 77 components

### Support Files:
6. `/src/lib/ai/rust-stream-adapter-extended.ts` - Ensure all types defined
7. `/src/components/ai-elements/index.ts` - Verify all exports

---

## Expected Outcome

After implementation:
- ✅ Every view imports all 82 AI Elements
- ✅ Every view has PartRenderer handling all ExtendedUIPart types
- ✅ Unified rendering surface across all modes
- ✅ Smart content parsing in all views
- ✅ Voice integration in all views
- ✅ Code display in all views
- ✅ Workflow canvas available in all views

---

## Time Estimate

| Phase | Views | Components | Estimated Time |
|-------|-------|------------|----------------|
| Phase 1 | ChatView | 63 | 2 hours |
| Phase 2 | CoworkView | 57 | 2 hours |
| Phase 3 | AgentView | 76 | 3 hours |
| Phase 4 | RunnerView | 82 | 4 hours |
| Phase 5 | CodeCanvas | 77 | 3 hours |
| Testing | All | - | 2 hours |
| **Total** | **5** | **82** | **16 hours** |
