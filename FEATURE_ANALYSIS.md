# Feature Analysis: ChatJS vs A2rchitech

## Overview
This document compares features from [ChatJS](https://github.com/franciscomoretti/chat-js) with the current A2rchitech implementation and outlines what needs to be built.

---

## Feature Matrix

| Feature | ChatJS | A2rchitech | Status | Notes |
|---------|--------|------------|--------|-------|
| **Auth** (GitHub, Google, Anonymous) | ✅ Better Auth | ✅ Better Auth | ✅ Ready | Both use same stack |
| **Attachments** (Images, PDFs, Docs) | ✅ Vercel Blob | ⚠️ Partial | ⚠️ Needs Work | DB schema ready, UI needs drag-drop |
| **Resumable Streams** | ✅ Redis + activeStreamId | ⚠️ Partial | ⚠️ Needs Redis | activeStreamId exists, needs Redis layer |
| **Branching** (Fork conversations) | ✅ Full tree UI | ⚠️ Partial | ⚠️ Needs UI | parentMessageId exists, needs full UI |
| **Sharing** (Public links) | ✅ visibility field | ⚠️ Partial | ⚠️ Needs routes | visibility field exists, needs share routes |
| **Web Search** | ✅ Tool-based | ✅ Implemented | ✅ Ready | `browser-web-search.ts` + multi-query |
| **Image Generation** | ✅ AI SDK | ✅ Implemented | ✅ Ready | `generate-image.ts` with multimodal support |
| **Code Execution** | ✅ E2B | ✅ Multi-sandbox | ✅ Ready | WASM + Docker + WebVM smart routing |
| **MCP** | ✅ AI SDK MCP | ✅ Implemented | ✅ Ready | Full OAuth + caching implemented |

---

## Detailed Implementation Status

### 1. Auth (GitHub, Google, Anonymous) ✅ READY

**Current State:**
- File: `src/lib/auth-sqlite.ts`
- Uses Better Auth with Google/GitHub providers
- Anonymous auth needs explicit configuration

**ChatJS Stack:** Same - Better Auth

**What's Needed:**
```typescript
// Add anonymous provider to auth config
plugins: [
  nextCookies(),
  anonymousProvider({
    // Enable anonymous sessions
  }),
]
```

---

### 2. Attachments (Images, PDFs, Docs) ⚠️ PARTIAL

**Current State:**
- Database: `message.attachments` JSON field exists
- Schema supports: `{ name, contentType, url }`
- Part storage: `file_*` fields in Part table
- Blob util: `src/lib/blob.ts` with `uploadFile()`

**What's Missing:**
1. **Drag & Drop UI Component**
2. **File type validation**
3. **Progress indicators**
4. **PDF text extraction**
5. **Image preview/thumbnails**

**Implementation Plan:**
```typescript
// New component: src/components/chat/AttachmentDropzone.tsx
// Features:
- react-dropzone for drag-drop
- File type validation (images, PDF, doc, docx, txt)
- Upload progress tracking
- PDF.js for text extraction client-side
- Integration with existing blob storage
```

**Files to Create:**
- `src/components/chat/AttachmentDropzone.tsx`
- `src/lib/attachments/extract-text.ts` (PDF/DOCX text extraction)
- `src/hooks/useAttachmentUpload.ts`

---

### 3. Resumable Streams ⚠️ PARTIAL

**Current State:**
- Database: `message.activeStreamId` field exists
- SSE streaming: `src/app/api/a2ui/actions/stream/route.ts`
- Kernel streaming adapter exists

**What's Missing:**
1. **Redis integration** for stream state persistence
2. **Stream recovery on page refresh**
3. **Client-side stream resumption logic**

**ChatJS Approach:**
- Uses Redis to store stream state
- Client reconnects with streamId
- Server resumes from last known position

**Implementation Plan:**
```typescript
// New: src/lib/stream/resumable-stream.ts
// New: src/lib/redis/client.ts (if not exists)

// Features:
- Store stream chunks in Redis with TTL
- Resume endpoint: /api/chat/resume?streamId=xxx
- Client stores activeStreamId in sessionStorage
- On refresh, check for active stream and resume
```

---

### 4. Branching (Fork Conversations) ⚠️ PARTIAL

**Current State:**
- Database: `message.parentMessageId` exists
- Provider: `src/providers/message-tree-provider.tsx` has:
  - `forkMessage()` method
  - `navigateToSibling()` for switching branches
  - Tree building logic

**What's Missing:**
1. **Visual branch indicator UI**
2. **Branch selector dropdown**
3. **Fork button on messages**
4. **Branch timeline visualization**

**ChatJS Approach:**
- Full tree visualization
- Click any message to see alternatives
- Visual diff between branches

**Implementation Plan:**
```typescript
// New components:
- src/components/chat/BranchIndicator.tsx (shows "3 alternatives")
- src/components/chat/BranchSelector.tsx (dropdown to switch)
- src/components/chat/ForkButton.tsx (on hover of messages)

// Integrate with existing MessageTreeProvider
// Add UI for visualizing the conversation tree
```

---

### 5. Sharing (Public Links) ⚠️ PARTIAL

**Current State:**
- Database: `chat.visibility` enum ('public' | 'private')
- Field exists but not fully utilized

**What's Missing:**
1. **Share dialog UI**
2. **Public chat route** (e.g., `/share/[chatId]`)
3. **Read-only public view**
4. **Link generation & copying**

**Implementation Plan:**
```typescript
// New route: src/app/share/[id]/page.tsx
// - Read-only view of public chats
// - No input composer
// - "Fork this chat" button

// New component: src/components/chat/ShareDialog.tsx
// - Toggle public/private
// - Copy link button
// - QR code generation

// API: src/app/api/chat/[id]/visibility/route.ts
// - PATCH to update visibility
```

---

### 6. Web Search ✅ READY

**Current State:**
- File: `src/lib/ai/tools/browser-web-search.ts`
- Multi-query search: `src/lib/ai/tools/steps/multi-query-web-search.ts`
- Browser preview utils included

**Status:** Fully implemented, better than ChatJS basic search.

---

### 7. Image Generation ✅ READY

**Current State:**
- File: `src/lib/ai/tools/generate-image.ts`
- Features:
  - Traditional image models (DALL-E, etc.)
  - Multimodal models (Gemini) for image generation
  - Image editing mode (upload image + prompt)
  - Automatic file upload to blob storage

**Status:** Fully implemented with advanced features.

---

### 8. Code Execution ✅ READY

**Current State:**
- File: `src/lib/ai/tools/code-execution.ts`
- Smart sandbox routing:
  - **WASM**: Fastest for simple Python (numpy/pandas)
  - **Docker**: Complex Python with pip packages
  - **WebVM**: Multi-language (JS, Bash, Rust)
- Status checking endpoint
- Resource limits enforced

**Sandbox System:**
- `src/lib/sandbox/smart-sandbox.ts` - Auto-selects best method
- `src/lib/sandbox/wasm-sandbox.ts` - WebAssembly Python
- `src/lib/sandbox/docker-sandbox.ts` - Containerized execution
- `src/lib/sandbox/webvm-connector.ts` - Full Linux VM

**Status:** More advanced than ChatJS's E2B approach.

---

### 9. MCP (Model Context Protocol) ✅ READY

**Current State:**
- Client: `src/lib/ai/mcp/mcp-client.ts`
- OAuth: `src/lib/ai/mcp/mcp-oauth-provider.ts`
- Cache: `src/lib/ai/mcp/cache.ts`
- Full OAuth flow with PKCE
- Connection status tracking
- Tools/resources/prompts listing

**Features:**
- Dynamic client registration
- OAuth callback handling
- Token refresh
- Cache invalidation on auth errors

**Status:** Production-ready MCP implementation.

---

## Summary: What Needs Implementation

### High Priority (Core UX)

1. **Attachments UI**
   - Drag & drop zone
   - File upload progress
   - PDF/DOCX text extraction
   - Image previews

2. **Resumable Streams**
   - Redis integration
   - Stream recovery logic
   - Client-side persistence

3. **Branching UI**
   - Visual branch indicators
   - Fork button on messages
   - Branch switcher

4. **Sharing**
   - Share dialog
   - Public chat route
   - Link management

### Medium Priority (Polish)

5. **Anonymous Auth** - Simple Better Auth plugin addition

---

## Recommended Implementation Order

1. **Sharing** - Easiest, high impact (public visibility already in schema)
2. **Attachments** - Critical for rich chat experience
3. **Branching UI** - Tree logic exists, just needs UI
4. **Resumable Streams** - Requires Redis infrastructure
5. **Anonymous Auth** - Single config change

---

## ChatJS Advantages to Port

1. **Streamdown** - Markdown rendering optimized for streaming
2. **AI Elements** - Native AI UI components
3. **Langfuse Integration** - LLM observability (if not present)

## A2rchitech Advantages Over ChatJS

1. **Multi-sandbox code execution** (WASM/Docker/WebVM vs E2B only)
2. **Kernel integration** - Rust backend for advanced operations
3. **Agent system** - Durable agent sessions
4. **Cowork mode** - Task management integration
5. **MCP OAuth** - Full OAuth flow implementation
