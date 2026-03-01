# AI SDK Elements Integration

## What Was Installed

AI SDK Elements components have been added to the a2rchitech platform.

### Location
- AI Elements: `src/components/ai-elements/`
- UI Primitives: `src/components/ui/`

### Components Installed

#### Phase 1: Core Chat Components

| Component | File | Purpose |
|-----------|------|---------|
| **Message** | `message.tsx` | Message display with branching, actions, markdown |
| **Conversation** | `conversation.tsx` | Scroll container with auto-scroll and download |
| **PromptInput** | `prompt-input.tsx` | Multi-modal input with attachments, model selector |
| **Attachments** | `attachments.tsx` | File display (grid/inline/list variants) |

#### Phase 2: AI Display Components

| Component | File | Purpose |
|-----------|------|---------|
| **Reasoning** | `reasoning.tsx` | Collapsible reasoning display (DeepSeek R1, Claude thinking) |
| **Tool** | `tool.tsx` | Tool call/result display with status |
| **Sources** | `sources.tsx` | Citations and source references |

#### Phase 3: Media & Voice

| Component | File | Purpose |
|-----------|------|---------|
| **SpeechInput** | `speech-input.tsx` | Voice-to-text button (Web Speech API) |

### UI Dependencies Added

The following shadcn/ui components were also installed/updated:
- `button.tsx` - Updated with AI Elements styles
- `separator.tsx` - Divider component
- `markdown.tsx` - Streamdown markdown renderer

### NPM Dependencies Added

See `package.json` for full list. Key additions:
```json
{
  "ai": "^6.0.73",
  "streamdown": "^2.1.0",
  "@streamdown/cjk": "^1.0.1",
  "@streamdown/code": "^1.0.1",
  "@streamdown/math": "^1.0.1",
  "@streamdown/mermaid": "^1.0.1",
  "use-stick-to-bottom": "^1.1.2",
  "nanoid": "^5.0.0"
}
```

### New Files Created

```
5-ui/a2r-platform/
├── components.json              # shadcn/ui configuration
├── tailwind.config.ts           # Tailwind CSS configuration
├── src/app/globals.css          # Global styles with CSS variables
└── src/components/
    ├── ai-elements/
    │   ├── attachments.tsx
    │   ├── conversation.tsx
    │   ├── message.tsx
    │   ├── prompt-input.tsx
    │   ├── reasoning.tsx
    │   ├── sources.tsx
    │   ├── speech-input.tsx
    │   └── tool.tsx
    └── ui/
        ├── button.tsx           # Updated
        ├── markdown.tsx         # New
        └── separator.tsx        # New
```

## Usage Example

### Basic Chat UI

```tsx
import {
  Conversation,
  ConversationContent,
  ConversationScrollButton,
} from "@/components/ai-elements/conversation";
import {
  Message,
  MessageContent,
  MessageResponse,
} from "@/components/ai-elements/message";
import {
  PromptInput,
  PromptInputTextarea,
  PromptInputSubmit,
} from "@/components/ai-elements/prompt-input";

function Chat() {
  return (
    <div className="flex flex-col h-full">
      <Conversation>
        <ConversationContent>
          {messages.map((msg) => (
            <Message from={msg.role} key={msg.id}>
              <MessageContent>
                <MessageResponse>{msg.content}</MessageResponse>
              </MessageContent>
            </Message>
          ))}
        </ConversationContent>
        <ConversationScrollButton />
      </Conversation>

      <PromptInput onSubmit={handleSubmit}>
        <PromptInputTextarea />
        <PromptInputSubmit />
      </PromptInput>
    </div>
  );
}
```

### With Reasoning (DeepSeek R1)

```tsx
import {
  Reasoning,
  ReasoningContent,
  ReasoningTrigger,
} from "@/components/ai-elements/reasoning";

function MessageWithReasoning({ message }) {
  const reasoningParts = message.parts.filter(p => p.type === "reasoning");
  const textParts = message.parts.filter(p => p.type === "text");
  
  return (
    <Message from="assistant">
      <MessageContent>
        {reasoningParts.length > 0 && (
          <Reasoning>
            <ReasoningTrigger />
            <ReasoningContent>
              {reasoningParts.map(p => p.text).join("\n")}
            </ReasoningContent>
          </Reasoning>
        )}
        {textParts.map(p => (
          <MessageResponse key={p.id}>{p.text}</MessageResponse>
        ))}
      </MessageContent>
    </Message>
  );
}
```

### With Tool Calls

```tsx
import {
  Tool,
  ToolContent,
  ToolHeader,
  ToolInput,
  ToolOutput,
} from "@/components/ai-elements/tool";

function ToolDisplay({ toolPart }) {
  return (
    <Tool>
      <ToolHeader type={toolPart.toolName} state={toolPart.state} />
      <ToolContent>
        <ToolInput input={toolPart.input} />
        <ToolOutput 
          output={toolPart.output}
          errorText={toolPart.errorText}
        />
      </ToolContent>
    </Tool>
  );
}
```

### With Attachments

```tsx
import {
  Attachments,
  Attachment,
  AttachmentPreview,
  AttachmentRemove,
} from "@/components/ai-elements/attachments";

function FileAttachments({ files, onRemove }) {
  return (
    <Attachments variant="grid">
      {files.map((file) => (
        <Attachment
          key={file.id}
          data={file}
          onRemove={() => onRemove(file.id)}
        >
          <AttachmentPreview />
          <AttachmentRemove />
        </Attachment>
      ))}
    </Attachments>
  );
}
```

### With Speech Input

```tsx
import { SpeechInput } from "@/components/ai-elements/speech-input";

function InputWithVoice({ onTranscript }) {
  return (
    <div className="flex gap-2">
      <PromptInputTextarea value={text} onChange={setText} />
      <SpeechInput 
        onTranscriptionChange={onTranscript}
        onAudioRecorded={async (blob) => {
          // Send to Whisper API for Firefox/Safari
          const text = await transcribeAudio(blob);
          return text;
        }}
      />
    </div>
  );
}
```

## Style Integration

The AI SDK Elements use Tailwind CSS with CSS variables. The variables are mapped in `src/app/globals.css`:

```css
:root {
  --background: 0 0% 100%;
  --foreground: 0 0% 3.9%;
  --primary: 0 0% 9%;
  --secondary: 0 0% 96.1%;
  --muted: 0 0% 96.1%;
  --accent: 0 0% 96.1%;
  --border: 0 0% 89.8%;
  /* ... */
}
```

### A2rchitech Theme Mapping

To match a2rchitech's design system, update `globals.css`:

```css
:root {
  /* Map to a2rchitech CSS variables */
  --background: var(--bg-primary-hsl);
  --foreground: var(--text-primary-hsl);
  --primary: var(--accent-chat-hsl);
  --secondary: var(--bg-secondary-hsl);
  --muted: var(--bg-tertiary-hsl);
  --accent: var(--accent-chat-hsl);
  --border: var(--border-subtle-hsl);
}
```

## Next Steps

1. **Install dependencies**:
   ```bash
   pnpm install
   ```

2. **Update ChatView** to use new components:
   - Replace `src/views/ChatView.tsx` with AI Elements implementation
   - Import from `@/components/ai-elements/*`

3. **Add remaining components** (optional):
   ```bash
   # Phase 4: Code components
   npx ai-elements@latest add code-block sandbox terminal
   
   # Phase 5: Advanced components
   npx ai-elements@latest add canvas suggestion
   ```

## Component Reference

### Message Component

```tsx
<Message from="user" | "assistant">
  <MessageContent>
    <MessageResponse>{text}</MessageResponse>
  </MessageContent>
  <MessageActions>
    <MessageAction onClick={...} label="Copy">
      <CopyIcon />
    </MessageAction>
  </MessageActions>
  <MessageBranch>
    <MessageBranchPrevious />
    <MessageBranchPage />
    <MessageBranchNext />
  </MessageBranch>
</Message>
```

### PromptInput Component

```tsx
<PromptInput 
  onSubmit={(message) => {...}}
  globalDrop      // Enable global drag-drop
  multiple        // Allow multiple files
  maxFiles={5}
  maxFileSize={10 * 1024 * 1024} // 10MB
>
  <PromptInputHeader>
    <Attachments />
  </PromptInputHeader>
  <PromptInputBody>
    <PromptInputTextarea />
  </PromptInputBody>
  <PromptInputFooter>
    <PromptInputTools>
      <PromptInputButton tooltip="Search">
        <GlobeIcon />
      </PromptInputButton>
      <PromptInputSelect>
        <PromptInputSelectTrigger />
        <PromptInputSelectContent>
          <PromptInputSelectItem value="gpt-4o">GPT-4o</PromptInputSelectItem>
        </PromptInputSelectContent>
      </PromptInputSelect>
    </PromptInputTools>
    <PromptInputSubmit />
  </PromptInputFooter>
</PromptInput>
```

### Conversation Component

```tsx
<Conversation>
  <ConversationContent>
    {/* Messages */}
  </ConversationContent>
  <ConversationDownload messages={messages} />
  <ConversationScrollButton />
</Conversation>
```

## Migration from ChatJS

| ChatJS Component | AI SDK Elements Replacement |
|------------------|---------------------------|
| `components/ui/message.tsx` | `components/ai-elements/message.tsx` |
| `components/ui/conversation.tsx` | `components/ai-elements/conversation.tsx` |
| `components/ui/prompt-input.tsx` | `components/ai-elements/prompt-input.tsx` |
| `components/ui/markdown.tsx` | Use `MessageResponse` with Streamdown |
| `providers/message-tree-provider.tsx` | Keep - works with new components |
| `providers/chat-input-provider.tsx` | Keep - works with new components |

## Troubleshooting

### Streamdown styles not applied
Add to `globals.css`:
```css
@source "../node_modules/streamdown/dist/*.js";
```

### Tailwind classes not working
Ensure `tailwind.config.ts` includes:
```ts
content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"]
```

### Component import errors
Check that `components.json` has correct aliases:
```json
{
  "aliases": {
    "components": "@/components",
    "utils": "@/lib/utils"
  }
}
```
