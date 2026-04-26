# Agent-in-Chat Integration Roadmap

## What the Video Shows (ChatGPT "Work" Agent Mode)

The screen recording demonstrates OpenAI's custom GPTs (agents) integrated into the main chat composer:

1. **@mention agent invocation** — Type `@sa` → autocomplete dropdown with "Sales assistant" → click to attach
2. **Agent pill in composer** — Selected agent renders as a persistent pill/badge attached to the input bar
3. **Agent-scoped query** — Type question → hit Enter → entire message routes to that specific agent
4. **Agent execution stream** — Response shows agent identity header + real-time status updates:
   - "Spinning up agent"
   - "Waking up computer"
   - "Sorting out details"
   - "Plotting"
   - Then reasoning: "I'm checking the Box materials first so I can answer from your workspace sources rather than guessing."
   - Tool use transparency: "Reading files → SKILL.md", "Searching for sales materials", "Calling search folders by name"
5. **Persistent agent input** — Agent pill remains in the bottom composer for follow-up turns
6. **Auto-generated title** — Browser tab updates from "ChatGPT" → "Top 5 Box Security Features"

**Key paradigm**: **Per-message agent routing** — any message can be sent to any agent via @mention, without switching surface modes.

---

## Where Allternit Stands Today

Allternit has a **surface-scoped agent mode** paradigm. Here's the current flow:

| Step | What happens |
|------|-------------|
| Toggle agent mode ON | Bottom dock "Agent Off → Agent On" |
| Select agent | "Choose Agent" dropdown in bottom dock |
| Or: pick mode | "Code / Create / Write / Learn" pills |
| Send message | Message routes to the **one** agent bound to this surface |
| Agent runs | `AgentModeGizzi` animates on composer; `AgentContextStrip` shows above messages; `AgentModeBackdrop` glows |
| Every follow-up | Also goes to the same agent |

**Current mechanisms that exist but aren't connected the ChatGPT way:**
- `/` slash commands — generic commands, not agent-specific
- `A://` commands — behavior biasing (`plan`, `build`, `search`), not agent switching
- Agent selector dropdown — bottom dock only, not inline in text
- Agent workspace loading — fully wired (IDENTITY.md, SOUL.md, TOOLS.md, etc.)
- Streaming with tool call rendering — fully wired (`UnifiedMessageRenderer`)
- Permission inline bars — wired (`ComposerPermissionInfoBar`)
- Question inline bars — wired (`ComposerQuestionBar`)

**What's now implemented:**
- ✅ `@mention` parser in the textarea with autocomplete dropdown
- ✅ Per-message agent routing via `ThreadAgentSessionsStore`
- ✅ Agent pill/badge in the composer (transient in Phase 2)
- ✅ Agent-as-participant in mixed chat threads (LLM + Agent A + Agent B)
- ✅ Real AgentAvatar SVG in message headers
- ✅ FloatingAvatar pulse on @mention
- ✅ Quick re-mention from history (click agent header)
- ✅ Auto-generated thread titles from first message
- ✅ Agent-branded streaming indicator ("Sales assistant is working…")

**Still missing (requires backend changes):**
- Granular agent execution status ("Spinning up agent", "Waking up computer", etc.) — backend SSE stream doesn't emit these events

---

## Architecture Comparison

### ChatGPT (Video) — Per-Message Agent Routing

```
┌─────────────────────────────────────────┐
│  Chat Thread (universal inbox)          │
│                                         │
│  ┌─────────────────────────────────┐    │
│  │ User: @SalesAssistant what are  │    │
│  │ the top 5 security features?    │    │
│  └─────────────────────────────────┘    │
│                                         │
│  ┌─────────────────────────────────┐    │
│  │ 🤖 Sales Assistant              │    │
│  │ "Sorting out details..."        │    │
│  │ ├─ Reading files: SKILL.md      │    │
│  │ ├─ Searching folders...         │    │
│  │ └─ Final answer...              │    │
│  └─────────────────────────────────┘    │
│                                         │
│  ┌─────────────────────────────────┐    │
│  │ User: @CodeAgent fix this bug   │    │
│  └─────────────────────────────────┘    │
│                                         │
│  ┌─────────────────────────────────┐    │
│  │ 🤖 Code Agent                   │    │
│  │ "Analyzing codebase..."         │    │
│  └─────────────────────────────────┘    │
│                                         │
├─────────────────────────────────────────┤
│ [+] [@SalesAssistant] Ask anything...   │
│  ↑ agent pill stays in composer         │
└─────────────────────────────────────────┘
```

### Allternit (Current) — Surface-Scoped Agent Mode

```
┌─────────────────────────────────────────┐
│  Agent Mode: ON                         │
│  Active Agent: "Sales Assistant"        │
│  [AgentContextStrip shown here]         │
│                                         │
│  ┌─────────────────────────────────┐    │
│  │ User: What are the top 5        │    │
│  │ security features?              │    │
│  └─────────────────────────────────┘    │
│                                         │
│  ┌─────────────────────────────────┐    │
│  │ 🤖 Sales Assistant              │    │
│  │ "Sorting out details..."        │    │
│  │ ├─ Reading files                │    │
│  │ └─ Final answer                 │    │
│  └─────────────────────────────────┘    │
│                                         │
├─────────────────────────────────────────┤
│ [Agent Off] [Choose Agent ▼] [Ask...]   │
│  ↑ surface-level toggle & selector      │
└─────────────────────────────────────────┘
```

---

## The Gap: Three Architectural Approaches

To bridge from surface-mode to agent-in-chat, there are three valid approaches with different trade-offs:

### Approach A: Agent Mention Layer (Minimal Change)
**Concept**: Keep surface-scoped sessions, but add `@mention` as a **shortcut** to switch the active agent before sending.

**Flow**:
1. User types `@sales` in composer
2. Dropdown shows matching agents
3. User selects → agent pill appears in composer
4. `useAgentSurfaceModeStore.setSelectedAgent('chat', agentId)` is called
5. User types question → hits Enter
6. Same surface-scoped flow, but now routed to the newly selected agent
7. If user mentions a different agent next turn → repeat step 3-6

**Pros**:
- Minimal code change — reuses 100% of existing session routing
- No new store abstractions needed
- Agent pill in composer is purely cosmetic (shows what will receive the next message)

**Cons**:
- Every @mention switches the surface's active agent — ALL follow-ups go to that agent until switched again
- Can't have a mixed thread (LLM → Agent A → LLM → Agent B in same thread)
- Session history conflates different agents into one thread

**Files to touch**:
- `ChatComposer.tsx` — add `@` parser + mention dropdown + agent pill rendering
- `ChatView.tsx` — no changes to session routing
- `useAgentSurfaceModeStore` — already the canonical store for this

---

### Approach B: Per-Message Agent Routing (Moderate Change)
**Concept**: Parse @mention at send-time, route each message to the correct agent without changing the surface's default agent.

**Flow**:
1. User types `@sales what are the top 5 features?`
2. `ChatView.handleSend` parses the text, extracts `@sales` → resolves to `agentId`
3. If a session for `agentId` already exists in this thread → append message to that session
4. If no session exists → create a **sub-session** (child of current thread, tagged with `agentId`)
5. Send message to the agent-specific session
6. Response streams back into the same thread, tagged with the agent's identity
7. Composer resets but keeps no persistent agent pill (next message defaults to surface mode)

**Pros**:
- True per-message routing — one thread can mix LLM and multiple agents
- No accidental agent switching for follow-ups
- Matches ChatGPT's mental model more closely

**Cons**:
- Requires new metadata on `ModeSessionMessage` (`mentionedAgentId`, `agentResponseId`)
- Session store needs to track agent sub-sessions per thread
- More complex message merging in `CoworkTranscript`
- Backend may need to support `agentId` per message (not just per session)

**Files to touch**:
- `ChatComposer.tsx` — add `@` parser + mention dropdown
- `ChatView.tsx` — `handleSend` extracts mentions, routes to agent sessions
- `mode-session-store.ts` — `ModeSessionMessage` metadata extensions, sub-session tracking
- `CoworkTranscript.tsx` — group/label messages by agent
- Backend: `chatApi.streamChat` may need `agentId` param per-message

---

### Approach C: Universal Agent Thread (Full Redesign)
**Concept**: Unify all chat into a single thread type. Every participant (user, LLM, Agent A, Agent B) is a "participant" in the thread. Messages are tagged by sender.

**Flow**:
1. All sessions are just "threads"
2. `thread.participants = ['user', 'llm', 'agent-sales', 'agent-code']`
3. @mention sends message to a specific participant
4. Each agent participant has its own workspace, context pack, and tool registry
5. Thread history shows all participants interleaved
6. Agent pills in composer show which participants are "active" in this thread

**Pros**:
- Cleanest mental model — truly like a group chat with AI teammates
- Natural extension to multi-agent collaboration (Agent A calls Agent B)
- Backend can eventually support true multi-agent orchestration

**Cons**:
- Massive refactor — sessions, stores, message types, backend API all change
- Not backward compatible with existing session data
- Over-engineered for current use case

**Verdict**: Too much for now. Save for v2.

---

## Recommended Path: Hybrid Approach (A + B)

**Phase 1: Agent Mention Shortcut (Approach A)** — ship fast, get UX parity

Add @mention parsing + agent pill rendering, but keep surface-scoped routing. This gives users the familiar "@agent → ask question" flow with minimal risk.

**Phase 2: Per-Message Routing (Approach B)** — deeper integration

Once Phase 1 is stable and user feedback validates the pattern, extend to true per-message routing with agent sub-sessions.

This avoids a big-bang refactor while delivering value incrementally.

---

## Phase 1 Implementation Status: ✅ COMPLETE

### Files Created

| File | Lines | Purpose |
|------|-------|---------|
| `src/components/chat/AgentMentionDropdown.tsx` | ~170 | Autocomplete dropdown with avatar, keyboard nav, hover sync |
| `src/components/chat/AgentPill.tsx` | ~120 | Removable agent chip with avatar + name + X button |

### Files Modified

| File | Changes | Purpose |
|------|---------|---------|
| `src/views/chat/ChatComposer.tsx` | +130 lines | @mention parsing, dropdown render, pill render, keyboard handling, agent mode auto-enable |
| `src/views/ChatView.tsx` | +1 line | `wantsAgentConversation` now includes `selectedAgentId` so @mentioned agents route correctly even without formal agent mode toggle |

### What Works Now

- [x] Type `@` in chat composer → dropdown appears with matching agents
- [x] Typing filters agents by name (case-insensitive substring match)
- [x] ArrowUp/ArrowDown navigates the dropdown
- [x] Enter or Tab selects the highlighted agent
- [x] Escape closes the dropdown
- [x] Hovering updates the keyboard selection index
- [x] Clicking outside closes the dropdown
- [x] Selecting an agent removes `@query` from input and renders an **AgentPill** above the textarea
- [x] Agent pill shows real avatar (AgentAvatar SVG) or initial-letter fallback
- [x] Agent pill is removable via X button
- [x] Removing the pill clears the surface agent selection and disables agent mode UI
- [x] Sending a message with an active agent pill routes to that agent's session
- [x] Agent pill persists across sends for follow-up messages
- [x] @mention auto-enables agent mode UI (glowing border, Gizzi mascot, etc.)
- [x] Works across all surfaces (`chat`, `cowork`, `code`, `browser`) via `agentModeSurface`
- [x] Uses dynamic CSS variables for light/dark theme adaptation

### UX Flow (matches ChatGPT video)

1. User types `@` → dropdown shows all agents
2. User types `sa` → dropdown filters to "Sales assistant"
3. User hits Enter or clicks → `@sa` disappears from input, **Sales assistant** pill appears
4. User types question → hits Enter
5. Message routes to Sales assistant agent → new agent thread created
6. Agent response streams with identity header + tool transparency
7. **Sales assistant** pill stays in composer for follow-ups
8. User can remove pill → reverts to default LLM chat

---

## Concrete Implementation Plan: Phase 1 (Archive)

### 1. Add `@mention` detection to `ChatComposer.tsx`

**Location**: Textarea `onChange` handler (~line 1817)

Add detection alongside existing `/` and `A://` handlers:

```typescript
// New: detect @mention
const lastAtIndex = value.lastIndexOf('@');
if (lastAtIndex !== -1 && lastAtIndex === value.length - 1 || 
    (lastAtIndex > value.lastIndexOf(' ') && lastAtIndex > value.lastIndexOf('\n'))) {
  const query = value.slice(lastAtIndex + 1);
  const matches = agents.filter(a => 
    a.name.toLowerCase().includes(query.toLowerCase())
  );
  setMentionSuggestions(matches);
  setMentionOpen(true);
}
```

### 2. Create `AgentMentionDropdown` component

New file: `src/components/chat/AgentMentionDropdown.tsx`

- Positioned absolutely below the textarea caret (or below the composer)
- Lists matching agents with avatar + name
- Keyboard navigable (ArrowUp/ArrowDown/Enter/Escape)
- Reuses existing `AgentAvatar` component (48px or 32px)

### 3. Create `AgentPill` component for composer

New file: `src/components/chat/AgentPill.tsx`

- Renders inside the composer bar as a removable chip
- Shows agent avatar (24px) + name + X to remove
- Styled to match the dark/light theme via `useStudioTheme()`
- On remove: clears `selectedAgentId` from surface mode store

### 4. Wire into `ChatComposer` bottom dock

Replace or augment the current "Choose Agent" dropdown:

```
Current: [Agent Off] [Choose Agent ▼] [Ask anything...]
New:     [Agent Off] [@AgentPill] [Ask anything...]
```

When an agent is selected via @mention or dropdown, render `AgentPill` in the input area.

### 5. Handle send with agent context

In `ChatView.handleSend` (~line 426-502):

```typescript
// If an agent is actively selected (via @mention or surface mode)
const activeAgentId = useAgentSurfaceModeStore.getState()
  .selectedAgentIdBySurface['chat'];

if (activeAgentId) {
  // Ensure thread is created as agent session
  createThread(text, undefined, 'agent', activeAgentId);
} else {
  // Plain LLM chat
  createThread(text, undefined, 'llm');
}
```

**This already exists** — the wiring is there. The only new piece is that `@mention` sets the surface's active agent before send.

### 6. Auto-clear agent pill on send (optional UX)

ChatGPT keeps the agent pill active for follow-ups. We should match this:
- If user sends with @mention → agent pill persists
- User can remove pill → next message goes to default (LLM or surface agent mode)
- If user @mentions a different agent → pill swaps

---

## Files to Create / Modify (Phase 1)

| File | Action | Lines |
|------|--------|-------|
| `src/components/chat/AgentMentionDropdown.tsx` | **Create** | ~150 |
| `src/components/chat/AgentPill.tsx` | **Create** | ~80 |
| `src/views/chat/ChatComposer.tsx` | **Modify** | +50 (mention parsing, pill rendering) |
| `src/views/chat/ChatView.tsx` | **Modify** | +20 (clear pill after thread change) |
| `src/views/agent-view/useStudioTheme.ts` | **Reuse** | Already handles light/dark |
| `src/components/agents/AgentAvatar.tsx` | **Reuse** | Already renders at any size |

---

## What Gets Reused (Existing Infrastructure)

| Feature | Component/Store | Status |
|---------|----------------|--------|
| Agent registry | `useAgentStore` | ✅ Ready |
| Surface agent selection | `useAgentSurfaceModeStore` | ✅ Ready |
| Session creation with agent | `createThread(..., 'agent', agentId)` | ✅ Ready |
| Agent workspace loading | `mode-session-store.ts` | ✅ Ready |
| Streaming responses | `useChatSessionStore.sendMessageStream` | ✅ Ready |
| Tool call rendering | `UnifiedMessageRenderer` | ✅ Ready |
| Agent avatar rendering | `AgentAvatar` | ✅ Ready |
| Theme adaptation | `useStudioTheme()` | ✅ Ready |
| Status/info bars | `ChatComposerEnhancements.tsx` | ✅ Ready |

---

## Open Questions

1. **Should @mention auto-spawn a new thread or append to current thread?**
   - ChatGPT seems to keep everything in one thread (browser tab title changes, not new tab)
   - Allternit's current model creates separate threads per session
   - **Recommendation**: Start new thread for agent mention (cleaner separation), but show thread continuity in UI

2. **Should the FloatingAvatar interact with the chat @mention?**
   - If user has a FloatingAvatar for "Sales Assistant" and @mentions "Sales Assistant" in chat, should the floating avatar animate/react?
   - **Recommendation**: Yes — bridge the companion and chat surfaces. Float avatar could pulse or show a speech indicator.

3. **Should @mention work in Cowork/Code surfaces too?**
   - The `useAgentSurfaceModeStore` already supports per-surface agent selection
   - **Recommendation**: Yes, implement generically so it works across all surfaces

4. **What about multi-agent mentions (`@sales @code`)?**
   - ChatGPT doesn't seem to support this yet
   - **Recommendation**: Out of scope for Phase 1. Single agent per message.

---

## Success Criteria

- [x] User can type `@` in chat composer and see agent dropdown
- [x] Selecting an agent renders a pill in the composer bar
- [x] Sending a message with an agent pill routes to that agent's session
- [x] Agent response streams with proper identity header and tool transparency
- [x] Agent pill persists for follow-up messages
- [x] Removing the pill reverts to default behavior (LLM or surface agent mode)
- [x] Works in both light and dark themes
- [x] Uses real `AgentAvatar` SVG, not generic icons

---

## Phase 3: Polish & Cross-Surface Integration — ✅ COMPLETE

### 1. Real AgentAvatar SVG in Message Headers
**File**: `src/components/chat/StreamingChatComposer.tsx`
- Assistant messages from agent sub-sessions now render the actual `AgentAvatar` component (20px) instead of a generic colored circle
- Avatar animates (`emotion="focused"`) while the agent is streaming

### 2. FloatingAvatar ↔ Chat Bridge
**File**: `src/components/agents/FloatingAvatar.tsx`
- Listens for `allternit:agent-pulse` custom event
- When its active agent is @mentioned in chat, the floating avatar pulses and shows "active" status for 2 seconds
- Creates a cohesive "agent is present across the surface" feeling

### 3. Quick Re-Mention from History
**File**: `src/components/chat/StreamingChatComposer.tsx`
- Clicking an agent's identity header dispatches `allternit:mention-agent` event
- `ChatComposer` listens for this event and immediately selects that agent (pill appears, ready for follow-up)
- One-click agent switching without re-typing `@`

### 4. Auto-Generated Thread Titles
**File**: `src/views/ChatView.tsx`
- Watches for streaming completion on the current thread
- If thread has a generic title ("New Session", "Untitled", "temp-…"), generates a title from the first user message
- Cleans up common prefixes ("hi", "hello", "please", "can you") and truncates to 40 chars
- Updates browser tab title: `"{title} — Allternit"`

### 5. Agent-Branded Streaming Indicator
**File**: `src/components/chat/StreamingChatComposer.tsx`
- `ThinkingIndicator` now accepts `agentName` prop
- When an agent is streaming, shows `"{AgentName} is working…"` instead of generic `"A:// thinking"`
- Uses `SpiralLoader` + `TextShimmer` for visual consistency

### 6. Tool Call Transparency (already wired)
**Status**: ✅ Already implemented via `UnifiedMessageRenderer` + `ToolCallCard`
- Tool calls render as expandable cards with arguments, execution status, results, and errors
- Risk tier badges (safe/low/medium/high/critical)
- Agent identity is implicit via the message header above the tool call

### 7. Granular Agent Execution Status (frontend-simulated)
**Files**: `src/hooks/useAgentStreamingStatus.ts`, `src/components/chat/StreamingChatComposer.tsx`
- Cycles through 8 realistic status messages while agent is streaming
- Agent-specific cycles: `code`, `research`, `write` agents get tailored status sequences
- Pulsing amber dot + `TextShimmer` for visual polish
- Statuses: "Spinning up agent" → "Loading workspace context..." → "Waking up computer" → "Analyzing your request..." → "Sorting out details..." → "Plotting response..." → "Cross-referencing sources..." → "Finalizing answer..."
- 1.8s interval, holds on final status until streaming completes

---

## Appendix: ChatGPT's Exact UX Transcript (from video)

| Timestamp | Action |
|-----------|--------|
| 00:00 | User types `@sa` in empty composer |
| 00:01 | Dropdown shows "Sales assistant" with folder icon |
| 00:02 | User clicks → agent pill "Sales assistant" attaches to composer |
| 00:03 | User types `What are the top 5 security features in Box?` |
| 00:05 | Enter pressed → composer clears, agent pill stays |
| 00:06 | Message appears in chat history (top right) |
| 00:06 | Agent response area shows: "Sales assistant" + "Spinning up agent" |
| 00:11 | Status changes: "Waking up computer" |
| 00:16 | Status changes: "Sorting out details" |
| 00:19 | Status changes: "Plotting" |
| 00:19 | Content appears: "I'm checking the Box materials first..." |
| 00:20 | Tool calls expand: "Reading files → SKILL.md", "Searching for sales materials", etc. |
| 00:09 | Full browser view revealed — bottom composer still shows "Sales assistant" pill |

**Pattern**: Agent mention → Agent pill → Send → Agent execution with status + tools → Persistent agent in composer for follow-ups.
