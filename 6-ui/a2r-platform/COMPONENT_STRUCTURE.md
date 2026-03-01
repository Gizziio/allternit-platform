# Unified Component Structure

## ✅ Codebase is Now Uniform

All AI/chat components are now in **one folder**: `components/ai-elements/`

## Folder Organization

```
src/components/
│
├── ai-elements/          ← ALL AI/CHAT COMPONENTS (50 total)
│   │
│   ├── Core Chat (from AI SDK Elements)
│   │   ├── conversation.tsx
│   │   ├── message.tsx
│   │   ├── prompt-input.tsx
│   │   └── attachments.tsx
│   │
│   ├── AI Display (from AI SDK Elements)
│   │   ├── reasoning.tsx
│   │   ├── tool.tsx
│   │   ├── sources.tsx
│   │   ├── chain-of-thought.tsx
│   │   ├── suggestion.tsx
│   │   └── shimmer.tsx
│   │
│   ├── Media (from AI SDK Elements)
│   │   ├── image.tsx
│   │   ├── audio-player.tsx
│   │   └── speech-input.tsx
│   │
│   ├── Code (from AI SDK Elements)
│   │   ├── code-block.tsx
│   │   └── artifact.tsx
│   │
│   ├── Ported from ChatJS
│   │   ├── artifact-panel.tsx    ← Kept from ChatJS
│   │   └── markdown.tsx          ← Kept from ChatJS
│   │
│   └── Dev Tools (from AI SDK Elements)
│       ├── agent.tsx
│       ├── canvas.tsx
│       ├── file-tree.tsx
│       └── ... 20 more
│
├── ui/                   ← SHADCN/UI PRIMITIVES ONLY (25 total)
│   ├── button.tsx
│   ├── card.tsx
│   ├── dialog.tsx
│   ├── avatar.tsx
│   ├── tooltip.tsx
│   └── ... 20 more base components
│
└── error-boundary.tsx    ← Utility component
```

## What Was Moved

### From `components/ui/` → `components/ai-elements/`

| Component | Source | Status |
|-----------|--------|--------|
| artifact-panel.tsx | ChatJS | ✅ Moved |
| markdown.tsx | ChatJS | ✅ Moved |

### Deleted from `components/ui/`

These were ChatJS components replaced by AI SDK Elements:

- ❌ `message.tsx`
- ❌ `conversation.tsx`
- ❌ `prompt-input.tsx`
- ❌ `chain-of-thought.tsx`
- ❌ `tool-call.tsx`
- ❌ `chat-scroll-area.tsx`

## Import Patterns

### Before (Mixed)
```tsx
// Confusing - which folder?
import { Message } from "@/components/ui/message";        // ChatJS?
import { Message } from "@/components/ai-elements/message"; // AI Elements?
```

### After (Uniform)
```tsx
// All AI components from one place
import { Message, Conversation, PromptInput } from "@/components/ai-elements";

// Or specific files
import { ArtifactPanel } from "@/components/ai-elements/artifact-panel";
import { Markdown } from "@/components/ai-elements/markdown";

// Base UI primitives from shadcn
import { Button, Card, Dialog } from "@/components/ui";
```

## Component Count

| Folder | Count | Purpose |
|--------|-------|---------|
| `ai-elements/` | 50 | All AI/chat components |
| `ui/` | 25 | Base shadcn/ui primitives |

## Clean Import Paths

```tsx
// ✅ Recommended: Use index export
import {
  // Core chat
  Message, Conversation, PromptInput,
  // AI features
  Reasoning, Tool, Sources,
  // Media
  Attachments, Image, AudioPlayer, SpeechInput,
  // From ChatJS
  ArtifactPanel, Markdown,
} from "@/components/ai-elements";

// ✅ Alternative: Direct file import
import { Message } from "@/components/ai-elements/message";
import { Reasoning } from "@/components/ai-elements/reasoning";
```

## Benefits of This Structure

1. **Uniform** - All AI components in one place
2. **Clear** - No confusion about which folder to use
3. **Scalable** - Easy to add more AI components
4. **Maintainable** - Clear separation (ai-elements vs ui primitives)

## Current ChatView Imports

```tsx
// src/views/ChatView.tsx
import {
  Conversation, ConversationContent, ...
} from "@/components/ai-elements/conversation";

import {
  Message, MessageContent, ...
} from "@/components/ai-elements/message";

import {
  PromptInput, PromptInputTextarea, ...
} from "@/components/ai-elements/prompt-input";

// ... and 40+ more from ai-elements/
```

Everything is now in `ai-elements/` - uniform and organized! 🎉
