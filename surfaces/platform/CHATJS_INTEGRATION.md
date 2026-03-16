# ChatJS Integration Report

## What Was Done

This document describes the ChatJS absorption into a2rchitech shell UI.

### 1. Database Schema (Ported from ChatJS)

**Location:** `src/lib/db/schema-sqlite.ts` (dev) / `src/lib/db/schema.ts` (prod)

**Tables Created:**
- `user`, `session`, `account`, `verification` - Better Auth user management
- `chat` - Chat threads with titles, visibility, pins
- `message` - Messages with parent references for branching/forking
- `part` - Normalized message parts (text, reasoning, files, tools, data)
- `project` - Project grouping for chats
- `vote` - Message up/down votes
- `document` - Artifacts (code, text, sheets)
- `suggestion` - Document edit suggestions
- `mcpConnector` - MCP server configurations
- `userCredit` - Usage credits
- `userModelPreference` - Per-user model enablement
- `kernelSession` - A2rchitech kernel session tracking

**Key Features:**
- Message tree structure for branching conversations
- Part-based content storage (replaces simple text)
- Foreign key relationships with cascading deletes

### 2. Authentication System (Ported from ChatJS)

**Location:** `src/lib/auth.ts`

**Features:**
- Better Auth with Drizzle adapter
- OAuth providers: Google, GitHub
- Session caching (5-minute cookie cache)
- Anonymous sessions supported (for dev)

### 3. API Routes (Ported + Kernel Bridge)

**Location:** `src/app/api/`

**Routes:**
- `POST /api/auth/[...all]` - Better Auth handler
- `POST /api/chat` - Chat completion with kernel integration
- `GET /api/chat?chatId=xxx` - Get chat messages

**Kernel Bridge Features:**
- Creates kernel sessions via `POST /v1/sessions`
- Streams events via `EventSource /v1/sessions/{id}/events`
- Sends input via `POST /v1/sessions/{id}/input`
- Handles: chat.delta, tool.call, tool.result, artifact.created

### 4. React Providers (Ported from ChatJS)

**Location:** `src/providers/`

**Providers:**
- `SessionProvider` - Auth session context
- `ChatIdProvider` - Current chat ID and persistence state
- `DataStreamProvider` - Real-time stream data (text deltas, tool calls)
- `MessageTreeProvider` - Message branching/navigation (parent-child tree)
- `ChatInputProvider` - Input state, attachments, selected model/tool
- `ChatModelsProvider` - Available models (GPT-4o, Claude, Codex CLI)

### 5. AI SDK Elements (Full Implementation)

**Location:** `src/components/ai-elements/`

**Status:** ✅ All 48 components installed (2025-02-06)

**DAG Task:** `docs/dag-ai-sdk-elements.json`

#### Core Chat (4)
- `attachments` - File display (grid/inline/list variants)
- `conversation` - Scroll container with auto-scroll
- `message` - Message with branching, actions, Streamdown markdown
- `prompt-input` - Multi-modal input with attachments, tools, speech

#### AI Display (5)
- `reasoning` - Collapsible reasoning (DeepSeek R1, Claude thinking)
- `sources` - Citations and source references
- `tool` - Tool call/result display with status
- `chain-of-thought` - Chain of thought visualization
- `artifact` - Artifact display panel

#### Media & Voice (6)
- `audio-player` - Audio playback with waveform
- `image` - Image display component
- `speech-input` - Voice-to-text button (Web Speech API)
- `transcription` - Transcript with timestamps
- `voice-selector` - Voice selection UI
- `mic-selector` - Microphone selection

#### Code & Developer Tools (12)
- `code-block` - Syntax highlighted code with copy button
- `sandbox` - Isolated code execution preview
- `terminal` - Terminal output display
- `snippet` - Code snippet component
- `shimmer` - Loading skeleton
- `file-tree` - File explorer
- `schema-display` - JSON schema viewer
- `stack-trace` - Error stack display
- `test-results` - Test output display
- `package-info` - Package info display
- `environment-variables` - Environment variable display
- `jsx-preview` - JSX live preview

#### Interactive Components (8)
- `suggestion` - Follow-up question chips
- `toolbar` - Action toolbar component
- `controls` - Form controls
- `model-selector` - Model picker UI
- `web-preview` - Web page preview
- `confirmation` - Confirmation dialog
- `inline-citation` - Inline citations
- `open-in-chat` - Open in chat button

#### Agent System (10)
- `agent` - Agent display component
- `persona` - Persona configuration
- `task` - Task display
- `plan` - Execution plan visualization
- `queue` - Queue/status display
- `checkpoint` - Checkpoint indicator
- `commit` - Commit display
- `connection` - Connection status
- `context` - Context provider UI
- `confirmation` - Confirmation dialogs

#### Canvas & Visual (4)
- `canvas` - Canvas container
- `node` - Node component for workflows
- `edge` - Edge connector for nodes
- `panel` - Panel layout component

**Index Export:** `src/components/ai-elements/index.ts`

```typescript
import {
  Message, Conversation, PromptInput, Attachments,
  Reasoning, Tool, Sources,
  CodeBlock, Sandbox, Terminal,
  // ... all 48 components
} from "@/components/ai-elements";
```

### 6. UI Primitives (shadcn/ui)

**Location:** `src/components/ui/`

**Components:**
- `badge` - Status badges
- `button` - Button variants
- `button-group` - Grouped buttons
- `collapsible` - Collapsible sections
- `dropdown-menu` - Dropdown menus
- `hover-card` - Hover preview cards
- `input-group` - Input with addons
- `select` - Dropdown select
- `separator` - Divider lines
- `spinner` - Loading spinner
- `tooltip` - Tooltips
- `markdown` - Streamdown markdown renderer

### 7. ChatView Integration

**Location:** `src/views/ChatView.tsx`

**Features:**
- Full AI SDK Elements integration
- Streaming message display
- Artifact panel toggle
- Message actions (branch, regenerate)
- Model selector dropdown
- Web search toggle
- File attachments
- Speech input support

## Current Setup (Development)

### SQLite Mode

**Why SQLite?**
- No PostgreSQL server required
- File-based database (`data/a2rchitech.db`)
- Zero configuration for local dev
- All features work identically

**Files Used:**
- `src/lib/db/schema-sqlite.ts` - SQLite schema
- `src/lib/db/client-sqlite.ts` - SQLite connection
- `src/lib/auth-sqlite.ts` - SQLite auth config
- `src/lib/env-sqlite.ts` - SQLite env vars
- `src/app/api/chat/route-sqlite.ts` - SQLite chat API
- `src/app/api/auth/[...all]/route-sqlite.ts` - SQLite auth API

**Environment:**
```bash
# .env
DATABASE_URL=file:./data/a2rchitech.db
AUTH_SECRET=dev-secret-change-in-production-min-32-chars
KERNEL_URL=http://127.0.0.1:3004
```

**Run:**
```bash
pnpm install
pnpm db:push
pnpm dev
```

## Production Switch

### Step 1: Install PostgreSQL Dependencies

```bash
pnpm add postgres
pnpm remove better-sqlite3
```

### Step 2: Switch Files

Rename or replace these files:

```bash
# Option A: Copy PostgreSQL versions over SQLite
cp src/lib/db/schema.ts src/lib/db/schema-active.ts
cp src/lib/db/client.ts src/lib/db/client-active.ts
cp src/lib/auth.ts src/lib/auth-active.ts
cp src/lib/env.ts src/lib/env-active.ts
cp src/app/api/chat/route.ts src/app/api/chat/route-active.ts
cp src/app/api/auth/[...all]/route.ts src/app/api/auth/[...all]/route-active.ts

# Then update imports OR use the originals directly
```

**Files to Use in Production:**
| SQLite (Dev) | PostgreSQL (Prod) |
|--------------|-------------------|
| `schema-sqlite.ts` | `schema.ts` |
| `client-sqlite.ts` | `client.ts` |
| `auth-sqlite.ts` | `auth.ts` (need to update provider) |
| `env-sqlite.ts` | `env.ts` (need DATABASE_URL required) |
| `route-sqlite.ts` | `route.ts` |

### Step 3: Update Environment Variables

```bash
# .env (Production)
DATABASE_URL=postgresql://user:password@host:5432/a2rchitech
AUTH_SECRET=your-32-char-secret-here
AUTH_GOOGLE_ID=your-google-client-id
AUTH_GOOGLE_SECRET=your-google-client-secret
AUTH_GITHUB_ID=your-github-client-id
AUTH_GITHUB_SECRET=your-github-client-secret
KERNEL_URL=http://your-kernel-host:3004
NEXT_PUBLIC_KERNEL_URL=http://your-kernel-host:3004
NEXT_PUBLIC_APP_URL=https://your-domain.com
APP_URL=https://your-domain.com
NODE_ENV=production
```

### Step 4: Run Migrations (Not Push)

```bash
# Generate migration files
pnpm db:generate

# Run migrations safely
pnpm db:migrate
```

### Step 5: Update drizzle.config.ts

```typescript
import { defineConfig } from "drizzle-kit";
import { env } from "./src/lib/env";

export default defineConfig({
  schema: "./src/lib/db/schema.ts",  // Use PostgreSQL schema
  out: "./src/lib/db/migrations",
  dialect: "postgresql",
  dbCredentials: {
    url: env.DATABASE_URL,
  },
});
```

### Key Differences

| Feature | SQLite (Dev) | PostgreSQL (Prod) |
|---------|--------------|-------------------|
| **Setup** | `pnpm db:push` | `pnpm db:generate && pnpm db:migrate` |
| **UUID** | `text().$defaultFn(crypto.randomUUID)` | `uuid().defaultRandom()` |
| **Timestamps** | `integer({ mode: "timestamp" })` | `timestamp()` |
| **JSON** | `text()` (manual JSON) | `json()` (native) |
| **Arrays** | JSON strings | Native arrays |
| **Checks** | Not supported | Full check constraints |

### Provider Update for PostgreSQL

**`src/lib/db/client.ts`** (Production):
```typescript
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { env } from "../env";
import * as schema from "./schema";

const globalForDb = globalThis as unknown as {
  conn: postgres.Sql | undefined;
};

const conn = globalForDb.conn ?? postgres(env.DATABASE_URL);
if (env.NODE_ENV !== "production") globalForDb.conn = conn;

export const db = drizzle(conn, { schema });
```

**`src/lib/auth.ts`** (Production):
```typescript
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { nextCookies } from "better-auth/next-js";
import { db } from "./db/client";  // PostgreSQL client
import { schema } from "./db/schema";  // PostgreSQL schema
import { env } from "./env";

export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: "pg",  // Changed from "sqlite"
    schema,
  }),
  // ... rest same
});
```

## Feature Checklist

### Working Now (SQLite Dev)
- [x] Chat threads with titles
- [x] Message branching/forking
- [x] Multi-part messages (text, reasoning, files)
- [x] Kernel integration (Codex/Claude CLI)
- [x] Streaming responses
- [x] Tool call display
- [x] Artifact panel (code/docs)
- [x] File attachments (drag-drop)
- [x] Model selection
- [x] Message actions (copy, regenerate)
- [x] Auth (anonymous or OAuth)
- [x] Projects
- [x] AI SDK Elements (all 48 components)

### AI SDK Elements Available
- [x] Core Chat: Message, Conversation, PromptInput, Attachments
- [x] AI Display: Reasoning, Sources, Tool, ChainOfThought, Artifact
- [x] Media: AudioPlayer, Image, SpeechInput, Transcription, VoiceSelector, MicSelector
- [x] Code: CodeBlock, Sandbox, Terminal, Snippet, Shimmer
- [x] Dev Tools: FileTree, SchemaDisplay, StackTrace, TestResults, PackageInfo, EnvironmentVariables, JSXPreview
- [x] Interactive: Suggestion, Toolbar, Controls, ModelSelector, WebPreview, Confirmation, InlineCitation, OpenInChat
- [x] Agent: Agent, Persona, Task, Plan, Queue, Checkpoint, Commit, Connection, Context
- [x] Canvas: Canvas, Node, Edge, Panel

### Requires Production Setup
- [ ] OAuth login (Google/GitHub)
- [ ] Usage credits
- [ ] Vote/suggestion system
- [ ] MCP connectors
- [ ] Document suggestions

## Troubleshooting

### SQLite "database is locked"
```bash
# Kill any hanging processes
lsof data/a2rchitech.db
# Then retry pnpm db:push
```

### Kernel connection failed
```bash
# Ensure kernel is running
curl http://127.0.0.1:3004/health
# Should return OK
```

### Better Auth errors
- Check `AUTH_SECRET` is set
- For dev, anonymous sessions work without OAuth

### AI SDK Elements imports not found
Ensure you're importing from the correct path:
```typescript
// Correct
import { Message, Conversation } from "@/components/ai-elements";

// Or specific file
import { Message } from "@/components/ai-elements/message";
```

### Streamdown styles not applied
Add to `globals.css`:
```css
@source "../node_modules/streamdown/dist/*.js";
```

## Summary

The ChatJS absorption is **complete** with:
- Full schema ported (messages, parts, branching)
- Auth system (Better Auth)
- API routes with kernel bridge
- **All 48 AI SDK Elements components** (full implementation from elements.ai-sdk.dev)
- Provider architecture for state management
- shadcn/ui primitives

**Development:** Use SQLite (current setup)
**Production:** Switch to PostgreSQL (see steps above)

## Files Modified/Created

```
5-ui/a2r-platform/
├── .env                          # SQLite config
├── components.json               # shadcn/ui config
├── tailwind.config.ts            # Tailwind CSS
├── drizzle.config.sqlite.ts      # SQLite migrations
├── CHATJS_INTEGRATION.md         # This file
├── AI_SDK_ELEMENTS.md            # AI SDK Elements usage guide
├── docs/
│   └── dag-ai-sdk-elements.json  # DAG task for implementation
├── src/
│   ├── app/
│   │   ├── api/
│   │   │   ├── auth/[...all]/route.ts
│   │   │   └── chat/route.ts
│   │   └── globals.css           # Global styles + Streamdown source
│   ├── components/
│   │   ├── ai-elements/          # 48 AI SDK Elements components
│   │   │   ├── index.ts          # Export all
│   │   │   ├── attachments.tsx
│   │   │   ├── conversation.tsx
│   │   │   ├── message.tsx
│   │   │   ├── prompt-input.tsx
│   │   │   ├── reasoning.tsx
│   │   │   ├── sources.tsx
│   │   │   ├── speech-input.tsx
│   │   │   ├── tool.tsx
│   │   │   ├── agent.tsx
│   │   │   ├── artifact.tsx
│   │   │   ├── audio-player.tsx
│   │   │   ├── canvas.tsx
│   │   │   ├── chain-of-thought.tsx
│   │   │   ├── checkpoint.tsx
│   │   │   ├── code-block.tsx
│   │   │   ├── commit.tsx
│   │   │   ├── confirmation.tsx
│   │   │   ├── connection.tsx
│   │   │   ├── context.tsx
│   │   │   ├── controls.tsx
│   │   │   ├── edge.tsx
│   │   │   ├── environment-variables.tsx
│   │   │   ├── file-tree.tsx
│   │   │   ├── image.tsx
│   │   │   ├── inline-citation.tsx
│   │   │   ├── jsx-preview.tsx
│   │   │   ├── mic-selector.tsx
│   │   │   ├── model-selector.tsx
│   │   │   ├── node.tsx
│   │   │   ├── open-in-chat.tsx
│   │   │   ├── package-info.tsx
│   │   │   ├── panel.tsx
│   │   │   ├── persona.tsx
│   │   │   ├── plan.tsx
│   │   │   ├── queue.tsx
│   │   │   ├── sandbox.tsx
│   │   │   ├── schema-display.tsx
│   │   │   ├── shimmer.tsx
│   │   │   ├── snippet.tsx
│   │   │   ├── stack-trace.tsx
│   │   │   ├── suggestion.tsx
│   │   │   ├── task.tsx
│   │   │   ├── terminal.tsx
│   │   │   ├── test-results.tsx
│   │   │   ├── toolbar.tsx
│   │   │   ├── transcription.tsx
│   │   │   ├── voice-selector.tsx
│   │   │   └── web-preview.tsx
│   │   └── ui/                   # shadcn/ui primitives
│   │       ├── badge.tsx
│   │       ├── button.tsx
│   │       ├── button-group.tsx
│   │       ├── collapsible.tsx
│   │       ├── dropdown-menu.tsx
│   │       ├── hover-card.tsx
│   │       ├── input-group.tsx
│   │       ├── markdown.tsx
│   │       ├── select.tsx
│   │       ├── separator.tsx
│   │       ├── spinner.tsx
│   │       └── tooltip.tsx
│   ├── lib/
│   │   ├── ai/
│   │   │   ├── types.ts
│   │   │   └── kernel-adapter.ts
│   │   ├── db/
│   │   │   ├── schema-sqlite.ts
│   │   │   ├── client-sqlite.ts
│   │   │   └── schema.ts
│   │   ├── auth.ts
│   │   ├── auth-sqlite.ts
│   │   ├── env.ts
│   │   └── utils.ts
│   ├── providers/
│   │   ├── session-provider.tsx
│   │   ├── chat-id-provider.tsx
│   │   ├── data-stream-provider.tsx
│   │   ├── message-tree-provider.tsx
│   │   ├── chat-input-provider.tsx
│   │   └── chat-models-provider.tsx
│   ├── shell/ShellApp.tsx (updated)
│   └── views/ChatView.tsx (updated with AI Elements)
└── data/                         # SQLite database directory
    └── .gitignore
```
