# AI Elements Inventory Report

Generated: 2026-02-07
Last Updated: 2026-02-07

## Executive Summary

| Category | Count | Location | Status |
|----------|-------|----------|--------|
| **Legacy AI Elements** | 1 (empty) | `src/legacy/ai-elements/` | ✅ FROZEN |
| **Generated AI Elements (V2)** | 52 | `src/components/ai-elements/` | ✅ ACTIVE |
| **Rust Stream Adapter** | 1 | `src/lib/ai/rust-stream-adapter.ts` | ✅ PRODUCTION |
| **ChatView V2** | 1 | `src/views/ChatViewV2.tsx` | ✅ READY |

---

## 1. AI Elements Directories

### 1A. Legacy Directory (FROZEN)
```
./5-ui/a2rchitech/src/legacy/ai-elements/
├── message/ (empty subdirectory)
└── README.md (DO NOT IMPORT warning)
```
**Status**: ✅ Moved and frozen. Guardrail prevents accidental imports.

**Guardrail**:
```bash
pnpm guard:ai-elements  # or: bash scripts/no-legacy-ai-elements.sh
```

### 1B. Canonical V2 Directory (ACTIVE)
```
./5-ui/a2r-platform/src/components/ai-elements/
├── index.ts (barrel export - all 52 components)
├── agent.tsx, artifact.tsx, artifact-panel.tsx, attachments.tsx
├── audio-player.tsx, canvas.tsx, chain-of-thought.tsx
├── checkpoint.tsx, code-block.tsx, commit.tsx
├── confirmation.tsx, connection.tsx, context.tsx
├── controls.tsx, conversation.tsx, edge.tsx
├── environment-variables.tsx, file-tree.tsx, image.tsx
├── inline-citation.tsx, jsx-preview.tsx, markdown.tsx
├── message.tsx, mic-selector.tsx, model-selector.tsx
├── node.tsx, open-in-chat.tsx, package-info.tsx
├── panel.tsx, persona.tsx, plan.tsx, prompt-input.tsx
├── queue.tsx, reasoning.tsx, sandbox.tsx
├── schema-display.tsx, shimmer.tsx, snippet.tsx
├── sources.tsx, speech-input.tsx, stack-trace.tsx
├── suggestion.tsx, task.tsx, terminal.tsx
├── test-results.tsx, toolbar.tsx, tool.tsx
├── transcription.tsx, voice-selector.tsx, web-preview.tsx
```
**Count**: 52 components  
**Status**: ✅ Active, generated via shadcn CLI

---

## 2. Production Adapter

### Rust Stream Adapter
**Location**: `src/lib/ai/rust-stream-adapter.ts`

**Purpose**: Production bridge between existing Rust SSE API and AI Elements V2

**Handles**:
- `message_start` → Creates assistant message
- `content_block_delta` (text_delta) → Appends to text parts
- `content_block_delta` (thinking_delta) → Creates reasoning parts
- `content_block_start` (tool_use) → Creates tool-invocation parts
- `tool_result` → Updates tool with result
- `tool_error` → Updates tool with error
- `source` → Adds source citations
- `finish` → Ends streaming state

**Usage**:
```typescript
import { useRustStreamAdapter } from "@/lib/ai/rust-stream-adapter";

function ChatViewV2() {
  const { messages, isLoading, submitMessage, stop } = useRustStreamAdapter({
    onError: (error) => console.error(error),
    onFinish: () => console.log("Done"),
  });
  
  // submitMessage calls /api/chat (existing endpoint)
}
```

**NOT a stub**: Handles all edge cases, error states, abort signals.

---

## 3. ChatView V2

**Location**: `src/views/ChatViewV2.tsx`

**Architecture**:
- ✅ Uses AI Elements V2 components (canonical imports)
- ✅ Uses Rust Stream Adapter (no custom provider hooks)
- ✅ Calls existing `/api/chat` endpoint (no API changes)
- ✅ Does NOT use `@ai-sdk/react` (reserved for future)

**Key Differences from ChatView.tsx**:
```
ChatView.tsx (legacy wiring):
  - useMessageTree() ← custom provider
  - useChatInput() ← custom provider  
  - Manual SSE parsing inline

ChatViewV2.tsx (new wiring):
  - useRustStreamAdapter() ← production adapter
  - Local React state for UI
  - SSE parsing encapsulated in adapter
```

---

## 4. Guardrails

### Script
**Location**: `scripts/no-legacy-ai-elements.sh`

**Checks**:
1. No imports from `src/legacy/ai-elements` outside legacy folder
2. No imports using old `components/ai-elements` path
3. Legacy directory not at old location

**Usage**:
```bash
# Manual
bash scripts/no-legacy-ai-elements.sh

# Via package.json
pnpm guard:ai-elements
```

**CI Integration**: Add to pre-commit hooks or CI pipeline

---

## 5. Import Paths

### ✅ Correct (V2)
```typescript
// Barrel export (all components)
import { Message, Conversation, PromptInput } from "@/components/ai-elements";

// Individual components
import { Message } from "@/components/ai-elements/message";
import { Tool } from "@/components/ai-elements/tool";
```

### ❌ Incorrect (Legacy)
```typescript
// DON'T DO THIS
import { Message } from "@/legacy/ai-elements/message";
import { Message } from "components/ai-elements/message";  // old path
```

---

## 6. Migration Path

### Phase 1: ✅ COMPLETED
- Inventory created
- Legacy frozen
- Guardrails in place
- Production adapter created
- ChatViewV2 ready

### Phase 2: IN PROGRESS
- Migrate AgentView.tsx to V2
- Migrate CodeCanvas.tsx to V2  
- Migrate CoworkView.tsx to V2

### Phase 3: FUTURE
- Create AI SDK-compatible endpoint (`/api/ai-sdk/chat`)
- Add `@ai-sdk/react` integration option
- Migrate to `useChat()` hook when ready

---

## 7. Files Summary

### Created/Modified
```
5-ui/a2r-platform/
├── src/legacy/ai-elements/          ← Moved from components/
│   ├── message/                     ← Empty legacy
│   └── README.md                    ← DO NOT IMPORT warning
├── src/components/ai-elements/      ← V2 canonical (52 components)
│   └── index.ts                     ← Barrel export
├── src/lib/ai/
│   └── rust-stream-adapter.ts       ← Production adapter
├── src/views/
│   └── ChatViewV2.tsx               ← V2 implementation
├── scripts/
│   └── no-legacy-ai-elements.sh     ← Guardrail script
├── package.json                     ← Added guard:ai-elements script
└── .env.local                       ← Provider API keys template
```

### Root Documentation
```
a2rchitech/
├── AI_ELEMENTS_INVENTORY.md         ← This file
├── AI_SDK_INTEGRATION.md            ← SDK installation status
└── install-ai-elements.sh           ← Component reinstall script
```

---

## 8. Verification Commands

```bash
# Verify no legacy imports
cd 5-ui/a2r-platform
pnpm guard:ai-elements

# Check V2 component count
ls src/components/ai-elements/*.tsx | wc -l  # Should be 53 (52 + index)

# Verify adapter exists
ls src/lib/ai/rust-stream-adapter.ts

# Check ChatViewV2 exists
ls src/views/ChatViewV2.tsx
```

---

## 9. Component Categories

### Chatbot (18)
attachments, chain-of-thought, checkpoint, confirmation, context, conversation, inline-citation, message, model-selector, plan, prompt-input, queue, reasoning, shimmer, sources, suggestion, task, tool

### Code (15)
agent, artifact, code-block, commit, environment-variables, file-tree, jsx-preview, package-info, sandbox, schema-display, snippet, stack-trace, terminal, test-results, web-preview

### Voice (6)
audio-player, mic-selector, persona, speech-input, transcription, voice-selector

### Workflow (7)
canvas, connection, controls, edge, node, panel, toolbar

### Utilities (4)
image, open-in-chat, artifact-panel, markdown

**Total**: 52 components ✅

---

## Appendix: Quick Reference

### To use ChatViewV2 in your app:
```typescript
import { ChatViewV2 } from "@/views/ChatViewV2";

function App() {
  return <ChatViewV2 />;
}
```

### To add a new AI Elements component:
```bash
npx shadcn@latest add @ai-elements/<component-name>
```

### To verify everything is working:
```bash
cd 5-ui/a2r-platform
pnpm guard:ai-elements && echo "All checks passed!"
```
