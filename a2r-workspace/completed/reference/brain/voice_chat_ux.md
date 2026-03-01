# Voice/Chat UX Implementation - PR0–PR5

Production-feeling UX for a2rchitech shell with voice orb, brain session routing, TTS, and activity tracking.

## Overview

This document describes the voice/chat UX system implemented in PR0–PR5, covering:
- Conversation management with brain session linking
- Event-driven activity tracking
- TTS integration with completion ID guards
- Deep-linking via ActivityPill

---

## 1. PR Descriptions

### PR0 - Fix Routing Gate + Event Consumption Cursor

**File**: `apps/shell/src/components/ChatInterface.tsx`

**What it does**:
- Removes `hasActiveBrain && isStreaming` gating that was blocking valid brain sessions
- Uses `activeSessionId` directly as the routing condition
- Adds per-session event index cursor to process ALL new events, not just the latest
- Emits `brainMessageCompleted` events for TTS hooks

**Key change**:
```typescript
// BEFORE (broken): Only routed if streaming
if (hasActiveBrain && activeBrainSession) { ... }

// AFTER (fixed): Route if session exists
if (activeSessionId && activeBrainSession) {
  await sendInput(activeBrainSession.session.id, userContent);
}
```

### PR1 - Pure ConversationStore

**File**: `apps/shell/src/runtime/ConversationStore.ts`

**What it does**:
- Bridges ChatStorage (manages chat sessions) with BrainContext (manages brain sessions)
- Creates internal `Conversation` records that link the two systems
- Exposes `chatSessionId` for navigation (what App.tsx understands)

**Key types**:
```typescript
interface Conversation {
  id: string;                    // Internal conversation ID
  chatSessionId: string;         // What App.tsx uses for navigation
  linkedBrainSessionId?: string; // Optional brain session linkage
  mode: 'brain' | 'api';
}

type NavTarget =
  | { kind: 'tab'; tabId: 'chats' | 'console' | 'uiTars' }
  | { kind: 'chatSession'; chatSessionId: string }
  | { kind: 'brainSession'; sessionId: string };
```

### PR2 - ActivityCenter

**File**: `apps/shell/src/runtime/ActivityCenter.ts`

**What it does**:
- Extends BrainManagerWidget's `eventToStep` mapping with session events
- Manages activity lifecycle: `connecting` → `thinking` → `streaming` → `speaking` → `done` → `error`
- Records timeline entries for debugging

**Status flow**:
```
idle → connecting → thinking → streaming → speaking → done
                                    ↘         ↙
                                      error
```

### PR3 - ActivityPill + Navigation

**Files**:
- `apps/shell/src/components/ActivityPill.tsx`
- `apps/shell/src/App.tsx` (navigation listener)

**What it does**:
- Pill UI showing current activity status with animations
- Dispatch `navigateToTarget` custom events on click
- App.tsx listens and performs navigation based on NavTarget

### PR4 - VoiceOrb Integration

**File**: `apps/shell/src/App.tsx`

**What it does**:
- On transcript complete: creates conversation → creates/links brain session → starts activity
- Sends input to brain via `/v1/sessions/:id/input`
- Auto-navigates only if user is on Home view (conditional)

### PR5 - TTS Wiring

**File**: `apps/shell/src/components/ChatInterface.tsx`

**What it does**:
- On `chat.message.completed`: calls `voiceService.speak()` with autoPlay
- Uses completion ID guard (not time-based) to prevent double-triggering
- Updates ActivityCenter status: `speaking` → TTS → `done`

---

## 2. The IDs Story

### Why Two IDs?

| ID Type | Purpose | Used By |
|---------|---------|---------|
| `conversationId` | Internal tracking in ConversationStore | VoiceOrb, ActivityCenter |
| `chatSessionId` | Navigation and display | App.tsx, ChatSessions, ChatInterface |
| `sessionId` (brain) | Brain kernel session | BrainContext, SSE streaming |

### Why NavTarget Uses `chatSessionId`

App.tsx and ChatSessions already use `chatSessionId` for their state:
```typescript
// App.tsx
const [activeChatSessionId, setActiveChatSessionId] = useState<string>();

// ChatSessions.tsx
onSelectSession(sessionId: string)  // This is chatSessionId
```

NavTarget must use `chatSessionId` to avoid translation layers:
```typescript
// ✅ Correct - directly usable by App.tsx
{ kind: 'chatSession', chatSessionId: 'chat_abc123' }

// ❌ Wrong - requires lookup
{ kind: 'conversation', conversationId: 'conv_xyz789' }
```

---

## 3. Event Processing Model

### The "Latest Only" Problem

The original code only processed the latest event:
```typescript
// WRONG: Drops intermediate events
const latestEvent = events.filter(e => e.type === 'terminal.delta').pop();
```

This causes:
- Dropped tool calls/results
- Missing intermediate message chunks
- Broken activity status tracking

### Cursor-Based Solution

```typescript
// Per-session cursor tracks processed event index
const lastEventIndexRef = useRef<Record<string, number>>({});

useEffect(() => {
  const sessionId = activeBrainSession.session.id;
  const events = activeBrainSession.events;
  const lastIdx = lastEventIndexRef.current[sessionId] ?? 0;

  // Process ONLY new events since last cursor position
  const newEvents = events.slice(lastIdx);
  lastEventIndexRef.current[sessionId] = events.length;

  newEvents.forEach(event => {
    // Handle each event...
  });
}, [activeBrainSession?.events]);
```

**Benefits**:
- All events processed in order
- No dropped events during rapid streaming
- Deterministic replay possible

---

## 4. TTS Trigger Rule

### Completion ID Guard

Prevents double-triggering using a durable ID, not time-based:

```typescript
case 'chat.message.completed': {
  const eventMessageId = (event as any).payload?.message_id;
  const completionId = eventMessageId || `msg-${sessionId}-${lastIdx}`;

  // Guard: Skip if already spoken this exact message
  if (lastSpokenMessageRef.current[sessionId] === completionId) {
    return; // Skip - already spoken
  }

  // Proceed with TTS
  lastSpokenMessageRef.current[sessionId] = completionId;
  voiceService.speak(text, { autoPlay: true });
}
```

### Status Transitions

```typescript
// When TTS starts
activityCenter.setStatus('speaking');

// When TTS ends (in finally block)
activityCenter.onSpeakingEnd();  // Sets done, clears pill after delay
```

---

## 5. ActivityPill Deep-Linking

### How It Works

1. **ActivityPill click** → dispatches `navigateToTarget` event:
   ```typescript
   window.dispatchEvent(new CustomEvent('navigateToTarget', {
     detail: { kind: 'chatSession', chatSessionId: 'chat_abc123' }
   }));
   ```

2. **App.tsx listener** → handles navigation:
   ```typescript
   window.addEventListener('navigateToTarget', (e) => {
     const target = (e as CustomEvent<NavTarget>).detail;
     switch (target.kind) {
       case 'chatSession':
         setActiveChatSessionId(target.chatSessionId);
         setViewMode('chats');
         break;
       case 'brainSession':
         setConsoleOpen(true);
         setActiveSession(target.sessionId);
         break;
     }
   });
   ```

### State Flow

```
VoiceOrb transcript
    ↓
createConversation() → returns { conversationId, chatSessionId }
    ↓
activityCenter.startActivity({ navTarget: { kind: 'chatSession', chatSessionId } })
    ↓
User clicks ActivityPill
    ↓
dispatch navigateToTarget with chatSessionId
    ↓
App.tsx sets activeChatSessionId, switches to 'chats' view
```

---

## 6. Known Limitations

### Pre-existing Type Errors (Not In Scope)

The following type errors existed before this implementation and are NOT fixed:

| File | Error | Impact |
|------|-------|--------|
| `App.tsx` | `Cannot find module '../../types/capsule-spec'` | Build warning only |
| `App.tsx` | `Cannot find name 'canvasesByCapsuleId'` | Pre-existing |
| `BrainManagerWidget.tsx` | `Property 'activeSession' does not exist` | Pre-existing |
| `ConsoleDrawer.tsx` | Multiple pre-existing errors | Pre-existing |
| `VoiceOrb.tsx` | `SpeechRecognition` types | Browser API, needs lib.dom.d.ts |

**These errors do not affect runtime behavior** of the voice/chat UX features.

### Not Implemented

- Multi-turn TTS cancellation during playback (basic stop works)
- Voice service health checks in ActivityPill (uses browser fallback)
- Persistent activity timeline across page reloads

---

## 7. Running the System

### Prerequisites

```bash
# Kernel (brain sessions)
cd /Users/macbook/Desktop/a2rchitech-workspace/a2rchitech
cargo run -p a2rchitech-cli -- up  # Starts at localhost:3004

# Voice service (optional, uses browser fallback if unavailable)
# localhost:8001

# Shell
cd /Users/macbook/Desktop/a2rchitech-workspace/a2rchitech/apps/shell
npm run dev
```

### Verification Commands

```bash
# 1. Check kernel health
curl -s http://localhost:3004/health

# 2. Verify routing (look for /v1/sessions/:id/input in console)
# Open browser DevTools → Console
# Type in ChatInterface with activeSessionId
# Should see: "[ChatInterface] Sending to brain session: <session_id>"

# 3. Verify TTS (no repeated speech)
# Trigger completion event twice
# Console should show: "[ChatInterface] Skipping TTS - already spoken: <id>"

# 4. Check ActivityPill appears
# Click VoiceOrb, speak, submit
# ActivityPill should appear with status
```

### Dev-Only Invariants

Enable verbose logging:
```bash
# In Chrome DevTools Console:
localStorage.debug = '*'
```

Invariant violations log warnings:
```
[ChatInterface] Dev invariant violation: activeBrainSession missing session.id
[ActivityPill] Dev invariant violation: chatSession navTarget missing chatSessionId
[ConversationStore] Invariant violation: chatSessionId does not exist in ChatStorage
```

---

## File Reference

| File | Purpose |
|------|---------|
| `apps/shell/src/components/ChatInterface.tsx` | Chat UI, routing, TTS |
| `apps/shell/src/components/VoiceOrb.tsx` | Voice input (existing) |
| `apps/shell/src/components/ActivityPill.tsx` | Status pill UI |
| `apps/shell/src/components/ChatSessions.tsx` | Session list with brain/live icons |
| `apps/shell/src/App.tsx` | Navigation listener, voice processing |
| `apps/shell/src/runtime/ConversationStore.ts` | Conversation↔session mapping |
| `apps/shell/src/runtime/ActivityCenter.ts` | Activity lifecycle |
| `apps/shell/src/runtime/BrainContext.tsx` | Brain session management |
| `apps/shell/src/runtime/VoiceService.ts` | TTS integration |
| `apps/shell/src/styles/glass-chat.css` | Pulse animations |
| `docs/brain/voice_chat_ux.md` | This file |

---

## Change Log

### v1.0.0 (Current)

**User-visible behavior**:
- VoiceOrb creates ChatSession entries on Home view
- ActivityPill shows real-time progress: connecting → thinking → streaming → speaking → done
- Clicking ActivityPill deep-links to correct Chat tab and session
- TTS plays on assistant completion (with single-trigger guard)
- ChatSessions list shows 🧠 icon for brain-linked sessions and LIVE indicator for active target
- Stop button appears during TTS playback

**Developer-visible behavior**:
- Event cursor ensures ALL brain events are processed (no dropped events)
- ConversationStore bridges ChatStorage and BrainContext
- ActivityCenter tracks timeline of status transitions
- Dev-only invariants assert core routing invariant at runtime
- ActivityPill uses window CustomEvent for decoupled navigation

**Upgrade notes**:
- Requires brain kernel at `localhost:3004` for full functionality
- Voice service at `localhost:8001` optional (browser TTS fallback)
- No new environment variables required
- Existing `activeSessionId` state in BrainContext now determines routing
