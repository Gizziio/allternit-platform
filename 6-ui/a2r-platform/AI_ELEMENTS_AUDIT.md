# AI Elements Usage Audit

**Project:** a2r-platform  
**AI Elements Location:** `src/components/ai-elements/`  
**Audit Date:** 2026-02-07  
**Total AI Element Files:** 54  
**Official Registered Components:** 48 (in registry.ts)

---

## Summary Statistics

| Metric | Count |
|--------|-------|
| Total AI Element Files | 54 |
| Components in Registry | 48 |
| Views Using AI Elements | 6 |
| Core Components (multi-view) | 17 |
| View-Specific Components | 15 |
| **Orphaned Components** | **17** |

---

## Core Components (Used in Multiple Views)

| Component | Chat | Agent | Code | Cowork | ElementsLab | Category |
|-----------|:----:|:-----:|:----:|:------:|:-----------:|----------|
| conversation | ✓ | | ✓ | | ✓ | chatbot |
| message | ✓ | | ✓ | | ✓ | chatbot |
| attachments | ✓ | ✓ | | ✓ | ✓ | chatbot |
| checkpoint | ✓ | ✓ | | ✓ | ✓ | chatbot |
| queue | ✓ | ✓ | | ✓ | ✓ | chatbot |
| task | ✓ | ✓ | | ✓ | ✓ | chatbot |
| shimmer | ✓ | | ✓ | ✓ | ✓ | chatbot |
| voice-presence | ✓ | ✓ | ✓ | | | voice |
| code-block | ✓ | | ✓ | | | code |
| plan | ✓ | | | ✓ | ✓ | chatbot |
| reasoning | ✓ | | | ✓ | ✓ | chatbot |
| sources | ✓ | | | ✓ | ✓ | chatbot |
| confirmation | ✓ | | | ✓ | ✓ | chatbot |
| suggestion | ✓ | | | ✓ | | chatbot |
| web-preview | ✓ | | | ✓ | ✓ | code |
| context | | | | ✓ | ✓ | chatbot |
| model-selector | | | | ✓ | ✓ | chatbot |

---

## View-Specific Components (Used in Only One View)

| Component | Used In | Category |
|-----------|---------|----------|
| persona | ChatView.tsx | voice |
| markdown | ChatView.tsx | code |
| UnifiedMessageRenderer | ChatView.tsx | core |
| prompt-input | CoworkRoot.tsx | chatbot |
| commit | AgentView.tsx | code |
| artifact | CoworkView.tsx | code |
| sandbox | CoworkView.tsx | code |
| canvas | CoworkView.tsx | workflow |
| node | CoworkView.tsx | workflow |
| panel | CoworkView.tsx | workflow |
| toolbar | CoworkView.tsx | workflow |
| image | CoworkView.tsx | utilities |
| inline-citation | CoworkView.tsx | chatbot |
| open-in-chat | CoworkView.tsx | utilities |
| chain-of-thought | CoworkView.tsx | chatbot |

---

## Orphaned Components (Not Used in Any View)

These 17 components are **not imported by any view** and may be candidates for removal or implementation:

### Voice Components
- `agent.tsx` - Agent information card (only in ElementsLab demo)
- `audio-player.tsx` - Audio playback (only in ElementsLab demo)
- `mic-selector.tsx` - Microphone device selector (only in ElementsLab demo)
- `speech-input.tsx` - Voice recording input (not used)
- `transcription.tsx` - Transcription display (only in ElementsLab demo)
- `voice-overlay.tsx` - Voice UI overlay (not used)
- `voice-selector.tsx` - Voice personality selector (only in ElementsLab demo)
- `voice-toolbar.tsx` - Voice control toolbar (not used)

### Code Components
- `environment-variables.tsx` - Environment variable editor (only in ElementsLab demo)
- `file-tree.tsx` - File system tree (only in ElementsLab demo)
- `jsx-preview.tsx` - Live JSX preview (only in ElementsLab demo)
- `package-info.tsx` - Package dependency info (only in ElementsLab demo)
- `schema-display.tsx` - JSON schema visualization (only in ElementsLab demo)
- `snippet.tsx` - Code snippet with copy (only in ElementsLab demo)
- `stack-trace.tsx` - Error stack trace display (only in ElementsLab demo)
- `terminal.tsx` - Terminal output display (only in ElementsLab demo)
- `test-results.tsx` - Test execution results (only in ElementsLab demo)

### Workflow Components
- `connection.tsx` - Workflow node link (only in ElementsLab demo)
- `controls.tsx` - Canvas zoom controls (only in ElementsLab demo)
- `edge.tsx` - Graph edge component (only in ElementsLab demo)

### Other
- `artifact-panel.tsx` - Artifact side panel (not used)

---

## Views Breakdown

### ChatView.tsx
**Location:** `src/views/ChatView.tsx`

**Imports:**
- `conversation` (Conversation, ConversationContent, ConversationScrollButton, ConversationEmptyState)
- `message` (Message, MessageContent, MessageActions, MessageAction)
- `attachments` (Attachments, Attachment, AttachmentPreview, AttachmentRemove)
- `voice-presence` (VoicePresence)
- `persona` (Persona)
- `markdown` (Markdown)
- `shimmer` (Shimmer)
- `suggestion` (Suggestion, Suggestions)
- `audio-player` (AudioPlayer)
- `reasoning` (Reasoning, ReasoningContent, ReasoningTrigger)
- `tool` (Tool, ToolContent, ToolHeader, ToolInput)
- `sources` (Sources, Source)
- `confirmation` (Confirmation, ConfirmationTitle, ConfirmationActions, ConfirmationAction)
- `checkpoint` (Checkpoint, CheckpointIcon, CheckpointTrigger)
- `queue` (Queue, QueueList, QueueItem, QueueItemIndicator, QueueItemContent)
- `task` (Task, TaskTrigger, TaskContent, TaskItem)
- `plan` (Plan, PlanHeader, PlanTitle, PlanDescription, PlanAction, PlanContent, PlanTrigger)
- `web-preview` (WebPreview, WebPreviewNavigation, WebPreviewUrl, WebPreviewBody)
- `code-block` (CodeBlock)
- `UnifiedMessageRenderer`

**Total:** 19 component imports

---

### AgentView.tsx
**Location:** `src/views/AgentView.tsx`

**Imports:**
- `task` (Task)
- `checkpoint` (Checkpoint)
- `commit` (Commit)
- `queue` (Queue)
- `attachments` (Attachments, Attachment, AttachmentPreview, AttachmentRemove)
- `voice-presence` (VoicePresence)

**Total:** 6 component imports

---

### RunnerView.tsx
**Location:** `src/views/RunnerView.tsx`

**Imports:** None - Does not use AI Elements

---

### CoworkView.tsx
**Location:** `src/views/CoworkView.tsx`

**Imports:**
- `artifact` (Artifact, ArtifactHeader, ArtifactTitle, ArtifactDescription, ArtifactActions, ArtifactClose)
- `sandbox` (Sandbox, SandboxHeader)
- `canvas` (Canvas)
- `node` (Node)
- `panel` (Panel as AIPanel)
- `toolbar` (Toolbar)
- `suggestion` (Suggestion, Suggestions)
- `web-preview` (WebPreview, WebPreviewBody)
- `jsx-preview` (JSXPreview, JSXPreviewError, JSXPreviewContent)
- `image` (Image as AIImage)
- `sources` (Sources, Source)
- `inline-citation` (InlineCitation)
- `open-in-chat` (OpenIn, OpenInChatGPT, OpenInClaude, OpenInTrigger, OpenInContent)
- `reasoning` (Reasoning, ReasoningTrigger, ReasoningContent)
- `chain-of-thought` (ChainOfThought, ChainOfThoughtHeader, ChainOfThoughtStep)
- `model-selector` (ModelSelector, ModelSelectorTrigger, ModelSelectorContent, ModelSelectorItem)
- `attachments` (Attachments, Attachment, AttachmentPreview, AttachmentInfo)
- `tool` (Tool, ToolHeader, ToolContent)
- `task` (Task, TaskTrigger, TaskContent, TaskItem)
- `plan` (Plan, PlanHeader, PlanTitle, PlanDescription, PlanAction, PlanContent, PlanTrigger)
- `context` (Context, ContextTrigger, ContextContent, ContextContentHeader, ContextInputUsage, ContextOutputUsage, ContextContentFooter)
- `confirmation` (Confirmation, ConfirmationTitle, ConfirmationRequest, ConfirmationActions, ConfirmationAction)
- `checkpoint` (Checkpoint, CheckpointIcon)
- `queue` (Queue, QueueSection, QueueSectionTrigger, QueueSectionLabel, QueueSectionContent, QueueList, QueueItem, QueueItemIndicator, QueueItemContent)
- `shimmer` (Shimmer)

**Total:** 25 component imports

---

### CoworkRoot.tsx
**Location:** `src/views/cowork/CoworkRoot.tsx`

**Imports:**
- `prompt-input` (PromptInputProvider)

**Total:** 1 component import

---

### CodeCanvas.tsx
**Location:** `src/views/code/CodeCanvas.tsx`

**Imports:**
- `conversation` (Conversation, ConversationContent, ConversationScrollButton)
- `message` (Message, MessageContent, MessageActions, MessageAction)
- `code-block` (CodeBlock)
- `shimmer` (Shimmer)
- `voice-presence` (VoicePresence)

**Total:** 5 component imports

---

### ElementsLab.tsx
**Location:** `src/views/ElementsLab.tsx`

**Imports:** (Comprehensive - imports all components via registry and direct imports for demos)
- `registry` (AI_ELEMENTS_REGISTRY, getComponentsByCategory, getAllCategories)
- `attachments` (Attachments, Attachment, AttachmentPreview, AttachmentInfo)
- `context` (Context, ContextTrigger, ContextContent, ContextContentHeader, ContextInputUsage, ContextOutputUsage)
- `conversation` (Conversation, ConversationContent, ConversationEmptyState)
- `message` (Message, MessageContent, MessageActions)
- `queue` (Queue, QueueSection, QueueSectionTrigger, QueueSectionLabel, QueueSectionContent, QueueList, QueueItem, QueueItemIndicator, QueueItemContent)
- `task` (Task, TaskTrigger, TaskContent, TaskItem)
- `agent` (AgentCard, AgentHeader, AgentContent, AgentInstructions)
- `artifact` (Artifact, ArtifactHeader, ArtifactTitle, ArtifactContent)
- `sandbox` (Sandbox, SandboxHeader, SandboxContent)
- `file-tree` (FileTree, FileTreeFolder, FileTreeFile)
- `audio-player` (AudioPlayer)
- `transcription` (Transcription, TranscriptionSegment)
- `panel` (Panel)
- `chain-of-thought` (ChainOfThought, ChainOfThoughtHeader, ChainOfThoughtStep, ChainOfThoughtContent)
- `checkpoint` (Checkpoint, CheckpointIcon, CheckpointTrigger)
- `confirmation` (Confirmation, ConfirmationTitle, ConfirmationRequest, ConfirmationActions, ConfirmationAction)
- `inline-citation` (InlineCitation)
- `model-selector` (ModelSelector, ModelSelectorTrigger, ModelSelectorContent)
- `plan` (Plan, PlanHeader, PlanTitle, PlanDescription, PlanAction, PlanContent, PlanTrigger)
- `shimmer` (Shimmer)
- `reasoning` (Reasoning, ReasoningTrigger, ReasoningContent)
- `stack-trace` (StackTrace, StackTraceHeader, StackTraceError, StackTraceErrorType, StackTraceErrorMessage, StackTraceActions, StackTraceCopyButton, StackTraceExpandButton, StackTraceContent, StackTraceFrames)
- `sources` (Sources, Source)
- `commit` (Commit, CommitHash, CommitMessage)
- `snippet` (Snippet, SnippetInput, SnippetCopyButton)
- `test-results` (TestResults, TestResultsHeader, TestResultsSummary, TestResultsProgress)
- `web-preview` (WebPreview, WebPreviewNavigation, WebPreviewUrl)
- `mic-selector` (MicSelector, MicSelectorTrigger, MicSelectorContent, MicSelectorInput, MicSelectorList, MicSelectorItem, MicSelectorLabel, MicSelectorEmpty, MicSelectorValue)
- `voice-selector` (VoiceSelector, VoiceSelectorTrigger, VoiceSelectorContent)
- `open-in-chat` (OpenIn, OpenInContent, OpenInItem)
- `prompt-input` (PromptInput, PromptInputTextarea)

**Total:** 30+ component imports (showcases all AI Elements)

---

## Component Usage by Category

### Chatbot Components (18 total)
| Component | Used | Views |
|-----------|:----:|-------|
| attachments | ✓ | Chat, Agent, Cowork, ElementsLab |
| chain-of-thought | ✓ | Cowork, ElementsLab |
| checkpoint | ✓ | Chat, Agent, Cowork, ElementsLab |
| confirmation | ✓ | Chat, Cowork, ElementsLab |
| context | ✓ | Cowork, ElementsLab |
| conversation | ✓ | Chat, Code, ElementsLab |
| inline-citation | ✓ | Cowork, ElementsLab |
| message | ✓ | Chat, Code, ElementsLab |
| model-selector | ✓ | Cowork, ElementsLab |
| plan | ✓ | Chat, Cowork, ElementsLab |
| prompt-input | ✓ | CoworkRoot, ElementsLab |
| queue | ✓ | Chat, Agent, Cowork, ElementsLab |
| reasoning | ✓ | Chat, Cowork, ElementsLab |
| shimmer | ✓ | Chat, Code, Cowork, ElementsLab |
| sources | ✓ | Chat, Cowork, ElementsLab |
| suggestion | ✓ | Chat, Cowork |
| task | ✓ | Chat, Agent, Cowork, ElementsLab |
| tool | ✓ | Chat, Cowork, ElementsLab |

### Code Components (15 total)
| Component | Used | Views |
|-----------|:----:|-------|
| agent | ✗ | ElementsLab only |
| artifact | ✓ | Cowork, ElementsLab |
| code-block | ✓ | Chat, Code |
| commit | ✓ | Agent, ElementsLab |
| environment-variables | ✗ | ElementsLab only |
| file-tree | ✗ | ElementsLab only |
| jsx-preview | ✗ | Cowork (imports), ElementsLab |
| markdown | ✓ | Chat |
| package-info | ✗ | ElementsLab only |
| sandbox | ✓ | Cowork, ElementsLab |
| schema-display | ✗ | ElementsLab only |
| snippet | ✗ | ElementsLab only |
| stack-trace | ✗ | ElementsLab only |
| terminal | ✗ | ElementsLab only |
| test-results | ✗ | ElementsLab only |
| web-preview | ✓ | Chat, Cowork, ElementsLab |

### Voice Components (6 total)
| Component | Used | Views |
|-----------|:----:|-------|
| audio-player | ✗ | ElementsLab only |
| mic-selector | ✗ | ElementsLab only |
| persona | ✓ | Chat |
| speech-input | ✗ | **Orphaned** |
| transcription | ✗ | ElementsLab only |
| voice-selector | ✗ | ElementsLab only |

### Workflow Components (7 total)
| Component | Used | Views |
|-----------|:----:|-------|
| canvas | ✓ | Cowork, ElementsLab |
| connection | ✗ | ElementsLab only |
| controls | ✗ | ElementsLab only |
| edge | ✗ | ElementsLab only |
| node | ✓ | Cowork, ElementsLab |
| panel | ✓ | Cowork, ElementsLab |
| toolbar | ✓ | Cowork, ElementsLab |

### Utilities (2 total)
| Component | Used | Views |
|-----------|:----:|-------|
| image | ✓ | Cowork |
| open-in-chat | ✓ | Cowork, ElementsLab |

### Other Components
| Component | Used | Views |
|-----------|:----:|-------|
| artifact-panel | ✗ | **Orphaned** |
| UnifiedMessageRenderer | ✓ | Chat |
| voice-overlay | ✗ | **Orphaned** |
| voice-toolbar | ✗ | **Orphaned** |

---

## Recommendations

### High Priority (Implement or Remove)
1. **`speech-input`** - Voice recording component, not used anywhere
2. **`artifact-panel`** - Artifact side panel, not used anywhere
3. **`voice-overlay`** - Voice UI overlay, not used anywhere
4. **`voice-toolbar`** - Voice control toolbar, not used anywhere

### Medium Priority (Evaluate Usage)
Components used only in ElementsLab demos may not have production use cases:
- `agent` - May be needed for future agent management UI
- `audio-player` - May be needed for voice responses
- `file-tree` - May be needed for code explorer
- `terminal` - May be needed for code execution display
- `test-results` - May be needed for code testing features

### Low Priority (Keep for Future)
Components with clear future use cases:
- `environment-variables` - For deployment configuration
- `jsx-preview` - For live component preview (imported but not fully used in CoworkView)
- `package-info` - For dependency management
- `schema-display` - For API documentation
- `snippet` - For code sharing
- `stack-trace` - For error debugging
- `transcription` - For voice-to-text features
- `mic-selector`, `voice-selector` - For voice configuration

### Workflow Components
All workflow components (`connection`, `controls`, `edge`) are only used in ElementsLab. These may be needed if workflow visualization features are implemented.

---

## Files Not Audited

The following files in `src/components/ai-elements/` are barrel/config files, not components:
- `index.ts` - Barrel export file
- `registry.ts` - Component registry for ElementsLab

---

## Notes

1. **CoworkRoot.tsx** imports `PromptInputProvider` but the actual PromptInput component is not directly used - only its React context provider.

2. **JSXPreview** is imported in CoworkView.tsx but the actual usage appears to be minimal - may need verification.

3. **RunnerView.tsx** does not use any AI Elements components - it uses custom DAK Runner UI components.

4. **ElementsLab.tsx** imports nearly all components for demonstration purposes, so its imports don't indicate production usage.

5. The **48 official components** in registry.ts match the AI SDK specification from elements.ai-sdk.dev/components.
