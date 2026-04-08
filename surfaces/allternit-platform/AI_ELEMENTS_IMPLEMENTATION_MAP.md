# AI Elements Implementation Map

Complete mapping of where all 48 AI Elements components can be implemented in the a2r-platform UI.

---

## 1. Chat Interface (`/chat`)

| Component | Location | Use Case |
|-----------|----------|----------|
| **Conversation** | Main container | Message list container with scroll handling |
| **Message** | Inside Conversation | Individual user/assistant messages |
| **MessageContent** | Inside Message | Message text content with markdown |
| **MessageActions** | Inside Message | Copy, regenerate, thumbs up/down actions |
| **PromptInput** | Bottom of chat | Main input field with attachments, submit |
| **PromptInputTextarea** | Inside PromptInput | Auto-resizing text input |
| **Attachments** | Inside PromptInput | File attachment chips |
| **Attachment** | Inside Attachments | Individual file preview |
| **Context** | Sidebar/context panel | Token usage, model info display |
| **ModelSelector** | Header/Context | Switch between GPT-4, Claude, etc. |
| **Suggestion** | Below messages | Quick action chips ("Explain this", "Summarize") |
| **Sources** | Below assistant response | RAG source citations |
| **InlineCitation** | Inside MessageContent | Superscript citation numbers |
| **Confirmation** | Modal overlay | Tool approval requests |
| **Reasoning** | Inside assistant message | Expandable thinking process |
| **ChainOfThought** | Complex responses | Multi-step reasoning steps |
| **Checkpoint** | Auto-save indicator | "Saved" status after generations |
| **Shimmer** | Loading states | Placeholder while streaming |
| **Tool** | Function call display | Tool invocations with input/output |
| **Queue** | Multi-step tasks | Task queue visualization |
| **Task** | Inside Queue | Individual task status |
| **Plan** | Complex workflows | Multi-step plan visualization |

---

## 2. Code Workspace (`/code`, `/sandbox`)

| Component | Location | Use Case |
|-----------|----------|----------|
| **CodeBlock** | Code display | Syntax-highlighted code output |
| **Snippet** | Copyable code | One-line code with copy button |
| **Terminal** | Bottom panel | CLI output, build logs |
| **FileTree** | Left sidebar | Project file explorer |
| **Sandbox** | Main area | Code execution environment |
| **Artifact** | Generated files | AI-generated code artifacts |
| **AgentCard** | Agent configs | Agent setup display |
| **AgentHeader** | Inside Agent | Name, model info |
| **AgentInstructions** | Inside Agent | System prompt display |
| **EnvironmentVariables** | Settings panel | .env editor |
| **PackageInfo** | Dependencies | package.json viewer |
| **Commit** | Git panel | Recent commits display |
| **TestResults** | CI/CD panel | Unit test output |
| **StackTrace** | Error display | Runtime error details |
| **JSXPreview** | React components | Live component preview |
| **WebPreview** | Full preview | Web app preview iframe |
| **SchemaDisplay** | API docs | Endpoint documentation |

---

## 3. Voice Interface (`/voice`)

| Component | Location | Use Case |
|-----------|----------|----------|
| **SpeechInput** | Main input | Voice recording button |
| **AudioPlayer** | Message audio | Play back voice messages |
| **Transcription** | Below audio | Transcribed text segments |
| **TranscriptionSegment** | Inside Transcription | Individual timestamped text |
| **MicSelector** | Settings | Choose input device |
| **VoiceSelector** | Settings | Choose voice persona |
| **Persona** | Voice config | Voice characteristics display |

---

## 4. Workflow Builder (`/workflows`, `/agents`)

| Component | Location | Use Case |
|-----------|----------|----------|
| **Canvas** | Main workspace | Visual workflow editor |
| **Node** | Inside Canvas | Workflow nodes (LLM, Tool, If) |
| **Edge** | Between nodes | Connection lines |
| **Connection** | Custom edges | Animated data flow lines |
| **Controls** | Canvas corner | Zoom, fit, minimap |
| **Panel** | Sidebar | Node properties, variables |
| **Toolbar** | Top of canvas | Add node, run, save buttons |
| **AgentCard** | Agent library | Browse available agents |
| **Queue** | Execution view | Running workflow steps |
| **Task** | Inside Queue | Individual step status |

---

## 5. Agent Runner (`/agent-runner`)

| Component | Location | Use Case |
|-----------|----------|----------|
| **AgentCard** | Header | Running agent info |
| **AgentHeader** | Inside Card | Name, model, status |
| **AgentContent** | Main area | Agent execution display |
| **AgentInstructions** | Expandable | View system prompt |
| **Tool** | Tool calls | Real-time tool execution |
| **Message** | Chat history | Agent responses |
| **Context** | Sidebar | Token usage, context window |
| **Confirmation** | Modal | Tool approval requests |
| **Checkpoint** | Status bar | Auto-save indicator |
| **Queue** | Multi-step | Task execution queue |
| **Reasoning** | Reasoning models | Show thinking process |
| **Shimmer** | Streaming | Loading animation |

---

## 6. Elements Lab (`/elements-lab`)

| Component | Location | Use Case |
|-----------|----------|----------|
| **All 48 components** | Grid view | Component showcase |
| **Message** | Chatbot section | Demo conversation |
| **CodeBlock** | Code section | Syntax examples |
| **Canvas** | Workflow section | Interactive workflow demo |
| **AudioPlayer** | Voice section | Audio playback demo |

---

## 7. Settings / Preferences

| Component | Location | Use Case |
|-----------|----------|----------|
| **ModelSelector** | AI Settings | Default model selection |
| **MicSelector** | Voice Settings | Input device selection |
| **VoiceSelector** | Voice Settings | Output voice selection |
| **EnvironmentVariables** | Advanced | API keys, env vars |
| **Context** | Usage Stats | Token consumption |

---

## 8. Shared UI Components (Cross-Cutting)

| Component | Used In | Purpose |
|-----------|---------|---------|
| **Image** | Chat, Artifacts | Generated/attached images |
| **OpenInChat** | Anywhere | Share to conversation |
| **Sources** | RAG responses | Citation management |
| **InlineCitation** | Messages | Source references |
| **Shimmer** | Loading states | Skeleton screens |

---

## Implementation Priority

### Phase 1: Core Chat (MVP)
- [ ] Conversation + Message + MessageContent
- [ ] PromptInput + PromptInputTextarea
- [ ] Attachments
- [ ] Shimmer (loading)
- [ ] Sources + InlineCitation

### Phase 2: Code Features
- [ ] CodeBlock + Snippet
- [ ] Terminal
- [ ] Sandbox
- [ ] FileTree
- [ ] Artifact

### Phase 3: Workflow
- [ ] Canvas + Node + Edge
- [ ] Controls + Panel + Toolbar
- [ ] Connection
- [ ] Queue + Task

### Phase 4: Voice
- [ ] SpeechInput
- [ ] AudioPlayer
- [ ] Transcription
- [ ] MicSelector + VoiceSelector

### Phase 5: Advanced
- [ ] Reasoning + ChainOfThought
- [ ] Tool + Confirmation
- [ ] AgentCard + AgentInstructions
- [ ] Plan
- [ ] All remaining components

---

## Component Dependencies

```
Conversation
├── Message
│   ├── MessageContent
│   ├── MessageActions
│   └── Sources (optional)
│       └── Source
├── Reasoning (optional)
│   ├── ReasoningTrigger
│   └── ReasoningContent
└── Tool (optional)
    ├── ToolHeader
    └── ToolContent

PromptInput
├── PromptInputBody
├── PromptInputTextarea
├── PromptInputHeader (optional)
│   └── Attachments
│       └── Attachment
└── PromptInputFooter (optional)
    └── PromptInputTools

Canvas (ReactFlow)
├── Node
├── Edge
├── Controls
├── Panel
└── Connection (custom)

AgentCard
├── AgentHeader
├── AgentContent
└── AgentInstructions (optional)
```

---

## Quick Reference by View

| View | Primary Components | Supporting Components |
|------|-------------------|----------------------|
| `/chat` | Conversation, Message, PromptInput | Context, Sources, Shimmer, Confirmation |
| `/code` | CodeBlock, Terminal, FileTree | Snippet, Sandbox, Artifact |
| `/voice` | SpeechInput, AudioPlayer | Transcription, MicSelector, VoiceSelector |
| `/workflows` | Canvas, Node, Edge, Controls | Panel, Toolbar, Connection, Queue |
| `/agent-runner` | AgentCard, Tool, Message | Context, Confirmation, Checkpoint |
| `/elements-lab` | All 48 | - |

---

## Notes

- **Chatbot category** (18) → Primarily `/chat` view
- **Code category** (15) → `/code`, `/sandbox` views
- **Voice category** (6) → `/voice` view + voice mode in chat
- **Workflow category** (7) → `/workflows`, `/agents` views
- **Utilities** (2) → Used across all views
