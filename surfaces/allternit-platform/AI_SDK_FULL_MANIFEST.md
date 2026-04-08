# AI SDK Full Adoption Manifest

Generated: 2026-02-07
Package: @a2r/platform

---

## 1) Core Packages

| Package | Version | Import Sites |
|---------|---------|--------------|
| `ai` | ^6.0.73 | `src/lib/ai/rust-stream-adapter.ts`, `src/lib/ai/providers.ts`, `src/lib/ai/core-chat-agent.ts`, `src/lib/ai/tools/*.ts`, `src/components/ai-elements/*.tsx` (18 files) |
| `@ai-sdk/react` | ^3.0.75 | NOT DIRECTLY IMPORTED (future use) |
| `@ai-sdk/rsc` | ^2.0.77 | NOT DIRECTLY IMPORTED (future use) |
| `@ai-sdk/gateway` | ^3.0.36 | `src/lib/ai/providers.ts`, `src/lib/ai/app-model-id.ts` |
| `@ai-sdk/mcp` | ^1.0.18 | `src/lib/ai/mcp/mcp-client.ts`, `src/lib/ai/mcp/mcp-oauth-provider.ts` |

**Note**: `@ai-sdk/react` and `@ai-sdk/rsc` are installed but not yet used. Reserved for future migration to `useChat()` hook.

---

## 2) Provider Packages

### Referenced in Code

| Provider | Version | Used In |
|----------|---------|---------|
| `@ai-sdk/anthropic` | ^3.0.38 | `src/lib/ai/providers.ts` (AnthropicProviderOptions type) |
| `@ai-sdk/google` | ^3.0.22 | `src/lib/ai/providers.ts` (GoogleGenerativeAIProviderOptions type) |
| `@ai-sdk/openai` | ^3.0.26 | `src/lib/ai/providers.ts` (OpenAIResponsesProviderOptions type) |
| `@ai-sdk/gateway` | ^3.0.36 | `src/lib/ai/providers.ts` (gateway import), `src/lib/ai/app-model-id.ts` |

### Installed-Only (Not Referenced in Source)

| Provider | Version | Status |
|----------|---------|--------|
| `@ai-sdk/alibaba` | ^1.0.1 | Installed-only |
| `@ai-sdk/amazon-bedrock` | ^4.0.51 | Installed-only |
| `@ai-sdk/assemblyai` | ^2.0.18 | Installed-only |
| `@ai-sdk/azure` | ^3.0.27 | Installed-only |
| `@ai-sdk/baseten` | ^1.0.31 | Installed-only |
| `@ai-sdk/black-forest-labs` | ^1.0.18 | Installed-only |
| `@ai-sdk/cerebras` | ^2.0.31 | Installed-only |
| `@ai-sdk/cohere` | ^3.0.19 | Installed-only |
| `@ai-sdk/deepgram` | ^2.0.18 | Installed-only |
| `@ai-sdk/deepinfra` | ^2.0.32 | Installed-only |
| `@ai-sdk/deepseek` | ^2.0.18 | Installed-only |
| `@ai-sdk/elevenlabs` | ^2.0.18 | Installed-only |
| `@ai-sdk/fal` | ^2.0.19 | Installed-only |
| `@ai-sdk/fireworks` | ^2.0.32 | Installed-only |
| `@ai-sdk/gladia` | ^2.0.18 | Installed-only |
| `@ai-sdk/google-vertex` | ^4.0.45 | Installed-only |
| `@ai-sdk/groq` | ^3.0.22 | Installed-only |
| `@ai-sdk/huggingface` | ^1.0.30 | Installed-only |
| `@ai-sdk/hume` | ^2.0.18 | Installed-only |
| `@ai-sdk/klingai` | ^3.0.0 | Installed-only |
| `@ai-sdk/lmnt` | ^2.0.18 | Installed-only |
| `@ai-sdk/luma` | ^2.0.18 | Installed-only |
| `@ai-sdk/mistral` | ^3.0.19 | Installed-only |
| `@ai-sdk/moonshotai` | ^2.0.3 | Installed-only |
| `@ai-sdk/open-responses` | ^1.0.1 | Installed-only |
| `@ai-sdk/perplexity` | ^3.0.18 | Installed-only |
| `@ai-sdk/prodia` | ^1.0.14 | Installed-only |
| `@ai-sdk/replicate` | ^2.0.18 | Installed-only |
| `@ai-sdk/revai` | ^2.0.18 | Installed-only |
| `@ai-sdk/togetherai` | ^2.0.31 | Installed-only |
| `@ai-sdk/vercel` | ^2.0.30 | Installed-only |
| `@ai-sdk/xai` | ^3.0.48 | Installed-only |

**Total**: 35 provider packages installed, 4 referenced, 31 installed-only.

---

## 3) AI Elements Components (50 Total)

### Used in Runtime

| Component | File Path | Export Path | Import Site |
|-----------|-----------|-------------|-------------|
| agent | `src/components/ai-elements/agent.tsx` | `index.ts` | `src/views/AgentView.tsx:import { AgentCard, AgentHeader } from "@/components/ai-elements/agent"` |
| artifact | `src/components/ai-elements/artifact.tsx` | `index.ts` | `src/views/CoworkView.tsx` |
| artifact-panel | `src/components/ai-elements/artifact-panel.tsx` | `index.ts` | NOT USED |
| attachments | `src/components/ai-elements/attachments.tsx` | `index.ts` | `src/views/ChatView.tsx`, `src/views/ChatViewV2.tsx` |
| audio-player | `src/components/ai-elements/audio-player.tsx` | `index.ts` | `src/views/CoworkView.tsx` |
| canvas | `src/components/ai-elements/canvas.tsx` | `index.ts` | `src/views/CoworkView.tsx` |
| chain-of-thought | `src/components/ai-elements/chain-of-thought.tsx` | `index.ts` | NOT USED |
| checkpoint | `src/components/ai-elements/checkpoint.tsx` | `index.ts` | `src/views/AgentView.tsx` |
| code-block | `src/components/ai-elements/code-block.tsx` | `index.ts` | `src/views/code/CodeCanvas.tsx` |
| commit | `src/components/ai-elements/commit.tsx` | `index.ts` | `src/views/AgentView.tsx` |
| confirmation | `src/components/ai-elements/confirmation.tsx` | `index.ts` | NOT USED |
| connection | `src/components/ai-elements/connection.tsx` | `index.ts` | NOT USED |
| context | `src/components/ai-elements/context.tsx` | `index.ts` | NOT USED |
| controls | `src/components/ai-elements/controls.tsx` | `index.ts` | NOT USED |
| conversation | `src/components/ai-elements/conversation.tsx` | `index.ts` | `src/views/ChatView.tsx`, `src/views/ChatViewV2.tsx`, `src/views/code/CodeCanvas.tsx` |
| edge | `src/components/ai-elements/edge.tsx` | `index.ts` | NOT USED |
| environment-variables | `src/components/ai-elements/environment-variables.tsx` | `index.ts` | NOT USED |
| file-tree | `src/components/ai-elements/file-tree.tsx` | `index.ts` | NOT USED |
| image | `src/components/ai-elements/image.tsx` | `index.ts` | `src/views/CoworkView.tsx` |
| inline-citation | `src/components/ai-elements/inline-citation.tsx` | `index.ts` | `src/views/CoworkView.tsx` |
| jsx-preview | `src/components/ai-elements/jsx-preview.tsx` | `index.ts` | `src/views/CoworkView.tsx` |
| markdown | `src/components/ai-elements/markdown.tsx` | `index.ts` | NOT USED |
| message | `src/components/ai-elements/message.tsx` | `index.ts` | `src/views/ChatView.tsx`, `src/views/ChatViewV2.tsx`, `src/views/code/CodeCanvas.tsx` |
| mic-selector | `src/components/ai-elements/mic-selector.tsx` | `index.ts` | NOT USED |
| model-selector | `src/components/ai-elements/model-selector.tsx` | `index.ts` | NOT USED |
| node | `src/components/ai-elements/node.tsx` | `index.ts` | `src/views/CoworkView.tsx` |
| open-in-chat | `src/components/ai-elements/open-in-chat.tsx` | `index.ts` | `src/views/CoworkView.tsx` |
| package-info | `src/components/ai-elements/package-info.tsx` | `index.ts` | NOT USED |
| panel | `src/components/ai-elements/panel.tsx` | `index.ts` | `src/views/CoworkView.tsx`, `src/views/AgentView.tsx`, `src/views/code/CodeCanvas.tsx` |
| persona | `src/components/ai-elements/persona.tsx` | `index.ts` | `src/views/AgentView.tsx` |
| plan | `src/components/ai-elements/plan.tsx` | `index.ts` | `src/views/AgentView.tsx` |
| prompt-input | `src/components/ai-elements/prompt-input.tsx` | `index.ts` | `src/views/ChatView.tsx`, `src/views/code/CodeCanvas.tsx`, `src/shell/ShellApp.tsx` |
| queue | `src/components/ai-elements/queue.tsx` | `index.ts` | `src/views/AgentView.tsx` |
| reasoning | `src/components/ai-elements/reasoning.tsx` | `index.ts` | `src/views/ChatView.tsx` |
| sandbox | `src/components/ai-elements/sandbox.tsx` | `index.ts` | `src/views/CoworkView.tsx` |
| schema-display | `src/components/ai-elements/schema-display.tsx` | `index.ts` | NOT USED |
| shimmer | `src/components/ai-elements/shimmer.tsx` | `index.ts` | `src/views/ChatViewV2.tsx`, `src/views/code/CodeCanvas.tsx` |
| snippet | `src/components/ai-elements/snippet.tsx` | `index.ts` | NOT USED |
| sources | `src/components/ai-elements/sources.tsx` | `index.ts` | `src/views/CoworkView.tsx` |
| speech-input | `src/components/ai-elements/speech-input.tsx` | `index.ts` | NOT USED |
| stack-trace | `src/components/ai-elements/stack-trace.tsx` | `index.ts` | NOT USED |
| suggestion | `src/components/ai-elements/suggestion.tsx` | `index.ts` | `src/views/ChatViewV2.tsx`, `src/views/CoworkView.tsx`, `src/views/ChatView.tsx` |
| task | `src/components/ai-elements/task.tsx` | `index.ts` | `src/views/AgentView.tsx` |
| terminal | `src/components/ai-elements/terminal.tsx` | `index.ts` | `src/views/code/CodeCanvas.tsx` |
| test-results | `src/components/ai-elements/test-results.tsx` | `index.ts` | NOT USED |
| toolbar | `src/components/ai-elements/toolbar.tsx` | `index.ts` | `src/views/AgentView.tsx`, `src/views/CoworkView.tsx` |
| tool | `src/components/ai-elements/tool.tsx` | `index.ts` | `src/views/ChatView.tsx`, `src/views/AgentView.tsx`, `src/views/CoworkView.tsx` |
| transcription | `src/components/ai-elements/transcription.tsx` | `index.ts` | NOT USED |
| voice-selector | `src/components/ai-elements/voice-selector.tsx` | `index.ts` | NOT USED |
| web-preview | `src/components/ai-elements/web-preview.tsx` | `index.ts` | `src/views/code/CodeCanvas.tsx`, `src/views/CoworkView.tsx` |

**Usage Summary**:
- Used: 34 components
- Not Used: 16 components (chain-of-thought, confirmation, connection, context, controls, edge, environment-variables, file-tree, markdown, mic-selector, model-selector, package-info, schema-display, snippet, speech-input, stack-trace, test-results, transcription, voice-selector)

---

## 4) Chat Implementation Coverage

### Default Chat Route Components (ChatViewV2.tsx)

```typescript
// AI Elements imports from ChatViewV2.tsx:
import {
  Conversation, ConversationContent, ConversationScrollButton, ConversationEmptyState,
} from "@/components/ai-elements/conversation";
import { Message, MessageContent, MessageActions, MessageAction } from "@/components/ai-elements/message";
import {
  PromptInput, PromptInputTextarea, PromptInputSubmit, PromptInputTools,
  PromptInputButton, PromptInputActionAddAttachments, PromptInputHeader, PromptInputFooter,
} from "@/components/ai-elements/prompt-input";
import { Attachments, Attachment, AttachmentPreview, AttachmentRemove } from "@/components/ai-elements/attachments";
import { Tool, ToolContent, ToolHeader, ToolInput } from "@/components/ai-elements/tool";
import { Suggestion, Suggestions } from "@/components/ai-elements/suggestion";
import { Shimmer } from "@/components/ai-elements/shimmer";
```

### Adapter UI Part Support (rust-stream-adapter.ts)

**Supported**:
| UI Part Type | Rust Event Source | Notes |
|--------------|-------------------|-------|
| `TextUIPart` | `content_block_delta` (text_delta) | Full support |
| `DynamicToolUIPart` | `content_block_start` (tool_use), `tool_result`, `tool_error` | Full lifecycle: input-available → output-available/error |
| `SourceDocumentUIPart` | `source` event | Maps sourceId, url, title |

**Not Supported**:
| UI Part Type | Gap | Required Data |
|--------------|-----|---------------|
| `FileUIPart` | Not implemented in adapter | File uploads not handled |
| `ReasoningUIPart` | AI SDK type doesn't exist | thinking_delta events not mapped |
| Audio parts | Not implemented | Would need audio_delta events |
| Image parts | Not implemented | Would need image events |

---

## 5) Correctness Checks

### Command: pnpm typecheck
```
> @a2r/platform@1.0.0 typecheck /Users/macbook/Desktop/a2rchitech-workspace/a2rchitech/5-ui/a2r-platform
> tsc --noEmit

EXIT: 0
```
**Status**: ✅ ZERO ERRORS

### Command: pnpm guard:ai-elements
```
> @a2r/platform@1.0.0 guard:ai-elements /Users/macbook/Desktop/a2rchitech-workspace/a2rchitech/5-ui/a2r-platform
> bash scripts/no-legacy-ai-elements.sh

Checking for legacy ai-elements imports...
✅ OK: No legacy ai-elements imports found
EXIT: 0
```
**Status**: ✅ PASS

### Command: pnpm guard:no-drift
```
Running drift guard checks...
→ Checking for legacy imports...
→ Checking for deprecated 'tool-invocation' type...
→ Checking for 'as any' in V2 files...
→ Checking for @ts-ignore in V2 files...
→ Checking for @eslint-disable in V2 files...
→ Checking for div-based tool rendering...
→ Verifying Tool component imports...

✅ All drift guard checks passed!
EXIT: 0
```
**Status**: ✅ PASS

### Command: pnpm test -- rust-stream-adapter.test.ts
```
✓ src/lib/ai/rust-stream-adapter.test.ts (15 tests) 8ms
✓ src/lib/sandbox/smart-sandbox.test.ts (32 tests) 10ms
✓ src/lib/ai/text-splitter.test.ts (4 tests) 6ms
✓ src/lib/ai/token-utils.test.ts (19 tests) 12ms

Test Files  4 passed (4)
Tests  70 passed (70)
EXIT: 0
```
**Status**: ✅ PASS

---

## Component Activation Plan

### Phase 1: Immediate (No Backend Changes)

| Component | Feature Activation | Mount Location | Data Source | Adapter Ready |
|-----------|-------------------|----------------|-------------|---------------|
| model-selector | Chat toolbar model picker | ChatViewV2 header | Local state (selectedModel) | ✅ N/A |
| mic-selector | Voice input mode | PromptInput toolbar | Browser MediaDevices API | ✅ No adapter change |
| speech-input | Voice transcription panel | ChatViewV2 side panel | Web Speech API or Whisper | ⚠️ Needs audio UI part |
| reasoning | Thinking/reasoning display | Message parts | `thinking_delta` events | ⚠️ Needs new UI part type |

### Phase 2: Adapter Extension (No Backend Changes)

| Component | Feature Activation | Mount Location | Data Source | Adapter Change |
|-----------|-------------------|----------------|-------------|----------------|
| chain-of-thought | Multi-step reasoning visualization | Message parts below reasoning | `thinking_delta` + step markers | Map thinking to ReasoningUIPart (when available) |
| file-tree | Code sandbox file explorer | CodeCanvas side panel | Tool result file listings | Map tool output to FileTree props |
| schema-display | JSON schema visualization | Tool input/output display | Tool arguments/results | Pass through Tool component |
| test-results | Test execution display | CodeCanvas bottom panel | Tool result (test tool) | Map test tool output |

### Phase 3: Requires Backend/Event Extension

| Component | Feature Activation | Mount Location | Required Backend Data |
|-----------|-------------------|----------------|----------------------|
| confirmation | User approval flows | Message inline | `approval-requested` events |
| transcription | Audio transcription panel | ChatViewV2 | `audio_delta` + transcription events |
| voice-selector | Voice personality picker | Settings/persona panel | Voice configuration endpoint |
| web-preview | Live preview panel | CoworkView | URL from tool result (already supported) |
| sandbox | Isolated execution environment | CoworkView | Sandbox provisioning API |

### Not Recommended for Current Architecture

| Component | Reason |
|-----------|--------|
| connection, edge, node | Workflow graph components - requires workflow engine |
| context | Context panel - requires context management system |
| controls | Generic controls - needs specific use case |
| environment-variables | Env var editor - needs deployment integration |
| inline-citation | Citation links - requires source tracking |
| open-in-chat | External chat export - low priority |
| package-info | Package metadata - needs package registry |
| queue | Task queue UI - needs queue backend |
| stack-trace | Error display - needs structured error events |
| commit | Git commit UI - needs git integration |

---

## Release Gates

Before any merge, the following must be green:

```bash
pnpm typecheck                    # Must exit 0
pnpm guard:ai-elements            # Must exit 0  
pnpm guard:no-drift               # Must exit 0
pnpm test -- rust-stream-adapter.test.ts  # Must exit 0
```

Optional (when fixture exists):
```bash
pnpm test:replay                  # Replay test against real SSE
```
