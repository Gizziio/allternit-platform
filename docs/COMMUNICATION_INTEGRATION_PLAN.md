# Multi-Agent Communication - Current State & Integration Plan

**Date:** 2026-03-08  
**Status:** Analysis Complete  

---

## Executive Summary

After analyzing the a2rchitech codebase, I found that **a2rchitech already has a sophisticated native communication system** through:

1. **AskUserQuestion Tool** - Interactive question/answer system
2. **MCP Integration** - Full Model Context Protocol support  
3. **Gizzi-Code Runtime** - Native tool execution framework
4. **Question Tool** - Built-in tool for agent-user interaction

The external communication layer I initially created should **integrate with** this existing system, not replace it.

---

## Current Native Capabilities

### 1. AskUserQuestion Component ✅

**Location:** `6-ui/a2r-platform/src/components/agents/AskUserQuestion.tsx`

**Features:**
- Interactive question UI (text, select, multi-select, confirm, password)
- Multi-step wizard support
- Tool store integration (Zustand)
- Validation rules
- Timeout handling

**Usage:**
```typescript
// Agent calls the ask_user tool
const answer = await ask_user({
  question: "What is the target directory?",
  type: "text",
  validation: { required: true },
  timeout: 300,
});
```

### 2. Question Runtime Tool ✅

**Location:** `cmd/gizzi-code/src/runtime/tools/builtins/question.ts`

**Features:**
- Defined as native kernel tool
- Integrates with Question integration layer
- Supports multiple questions at once
- Returns structured answers

**Implementation:**
```typescript
export const QuestionTool = Tool.define("question", {
  description: DESCRIPTION,
  parameters: z.object({
    questions: z.array(Question.Info.omit({ custom: true })),
  }),
  async execute(params, ctx) {
    const answers = await Question.ask({
      sessionID: ctx.sessionID,
      questions: params.questions,
      tool: ctx.callID ? { messageID: ctx.messageID, callID: ctx.callID } : undefined,
    })
    // ...
  },
})
```

### 3. MCP Integration ✅

**Location:** `cmd/gizzi-code/src/runtime/tools/mcp/index.ts`

**Features:**
- Full MCP client/server support
- Remote and local MCP servers
- OAuth authentication
- Tool discovery and registration
- Prompts and resources support

**Usage:**
```typescript
// MCP tools are automatically discovered and registered
const tools = await MCP.tools();
// Returns all MCP tools as native tools
```

### 4. Tool System Architecture ✅

**Location:** `cmd/gizzi-code/src/runtime/tools/builtins/`

**Available Native Tools:**
- `bash` - Shell command execution
- `read` - File reading
- `write` - File writing
- `edit` - File editing
- `glob` - File pattern matching
- `grep` - Text search
- `ls` - Directory listing
- `plan` - Planning tool
- `question` - Ask user questions
- `task` - Task management
- `todo` - Todo lists
- `skill` - Skill execution
- `websearch` - Web search
- `webfetch` - Web page fetching
- And more...

**Tool Definition Pattern:**
```typescript
export const SomeTool = Tool.define("tool_name", {
  description: "Tool description",
  parameters: z.object({ /* Zod schema */ }),
  async execute(params, ctx) {
    // Tool implementation
    return { title, output, metadata };
  },
});
```

---

## What Was Created (External Implementation)

### Phase 1: Webhook Ingestion Service
**Location:** `2-governance/webhook-ingestion/`

**Status:** ✅ Complete but **NOT INTEGRATED**

**Purpose:** Receive external webhooks (GitHub, Discord, etc.) and convert to Rails events

**Issue:** This is a **separate service** that doesn't integrate with the native tool system

### Phase 2-4: Communication Primitives
**Location:** `5-agents/communication/`

**Status:** ✅ Complete but **NOT INTEGRATED**

**Components:**
- @mention parser
- MCP proxy (identity injection)
- Terminal injector (tmux/Win32)
- Loop guard

**Issue:** These are **standalone libraries** not connected to gizzi-code runtime

### Phase 5: Chat Rooms Backend
**Location:** `4-services/chat-rooms/`

**Status:** ✅ Complete but **NOT INTEGRATED**

**Issue:** Separate service duplicating functionality that could be native tools

---

## The Reality Check

### What a2rchitech ALREADY Has:

| Capability | Existing Solution | External Duplication |
|------------|-------------------|---------------------|
| **Agent asks user questions** | `question.ts` tool + AskUserQuestion UI | ❌ Redundant |
| **Tool execution** | Gizzi-Code runtime tools | ❌ Redundant |
| **MCP integration** | Full MCP client in runtime | ❌ Redundant |
| **Message display** | TUI components | ❌ Redundant |
| **Agent identity** | Session context | ❌ Redundant |

### What a2rchitech DOESN'T Have (Yet):

| Missing Capability | Why It's Needed |
|-------------------|-----------------|
| **Agent-to-agent messaging** | Agents can't directly communicate with each other |
| **Shared channels** | No persistent chat rooms for agent teams |
| **@mention routing** | Can't @mention specific agents |
| **Message history** | No audit trail of agent communications |
| **Loop guard** | No protection from infinite agent chains |

---

## Correct Integration Approach

### Option A: Create Native Communication Tools ✅ RECOMMENDED

Add new tools to the gizzi-code runtime that provide agent communication:

**1. Create `agent_communicate` tool:**
```typescript
// cmd/gizzi-code/src/runtime/tools/builtins/agent-communicate.ts
export const AgentCommunicateTool = Tool.define("agent_communicate", {
  description: "Send messages to other agents",
  parameters: z.object({
    action: z.enum(["send", "read", "create_channel", "join_channel"]),
    content: z.string().optional(),
    to: z.object({
      agentName: z.string().optional(),
      agentRole: z.enum(["builder", "validator", "reviewer", "planner"]),
      channel: z.string().optional(),
    }).optional(),
    correlationId: z.string().optional(),
  }),
  async execute(params, ctx) {
    // Use the store I created
    const store = useAgentCommunicationStore.getState();
    
    if (params.action === "send") {
      const message = await store.sendMessage({
        content: params.content!,
        to: params.to,
        correlationId: params.correlationId,
      });
      return { title: "Message sent", output: formatMessage(message) };
    }
    // ... handle other actions
  },
});
```

**2. Add UI component for agent messages:**
```tsx
// 6-ui/a2r-platform/src/components/agents/AgentMessages.tsx
export function AgentMessages({ sessionId }: { sessionId: string }) {
  const { receivedMessages, sendMessage } = useAgentCommunicationStore();
  
  return (
    <div className="agent-messages">
      {receivedMessages.map(msg => (
        <MessageBubble key={msg.id} message={msg} />
      ))}
    </div>
  );
}
```

**3. Register tool in runtime:**
```typescript
// cmd/gizzi-code/src/runtime/tools/builtins/registry.ts
import { AgentCommunicateTool } from "./agent-communicate";

export const BuiltinTools = [
  // ... existing tools
  AgentCommunicateTool,
];
```

### Option B: Use MCP for Agent Communication

Leverage existing MCP infrastructure:

```typescript
// Agents expose communication as MCP servers
const agentMCPConfig = {
  mcp: {
    "agent-builder": {
      type: "local",
      command: ["gizzi", "agent", "run", "--role", "builder"],
    },
    "agent-validator": {
      type: "local", 
      command: ["gizzi", "agent", "run", "--role", "validator"],
    },
  },
};

// Agents communicate via MCP tool calls
await mcpClient.callTool({
  name: "send_message",
  arguments: { to: "validator", content: "Please review" },
});
```

### Option C: Use Question Tool Pattern

Extend the existing `question.ts` tool:

```typescript
// Extend Question to support agent recipients
export const AgentQuestionTool = Tool.define("agent_ask", {
  description: "Ask another agent a question",
  parameters: z.object({
    question: z.string(),
    toAgent: z.string(), // agent name or role
    timeout: z.number().default(60),
  }),
  async execute(params, ctx) {
    // Route to appropriate agent
    // Wait for response
    // Return answer
  },
});
```

---

## Recommended Implementation Plan

### Phase 1: Add Native Communication Tools (Week 1)

**Files to Create:**
1. `cmd/gizzi-code/src/runtime/tools/builtins/agent-communicate.ts`
2. `cmd/gizzi-code/src/runtime/tools/builtins/agent-channel.ts`
3. `6-ui/a2r-platform/src/lib/agents/tools/agent-communication.tool.ts` (already created)
4. `6-ui/a2r-platform/src/components/agents/AgentMessageDisplay.tsx`

**Integration Points:**
- Register tools in `cmd/gizzi-code/src/runtime/tools/builtins/registry.ts`
- Add store to session context
- Display messages in chat UI

### Phase 2: Add Loop Guard (Week 1)

**Files to Modify:**
1. `cmd/gizzi-code/src/runtime/loop/boot.ts` - Add hop counter
2. `cmd/gizzi-code/src/runtime/session/processor.ts` - Check hop count

**Implementation:**
```typescript
// In session processor
const hopCount = session.hopCounter.get(correlationId) || 0;
if (hopCount >= MAX_HOPS) {
  throw new Error("Maximum agent hops exceeded");
}
```

### Phase 3: Add @mention Routing (Week 2)

**Files to Create:**
1. `cmd/gizzi-code/src/runtime/agents/mention-parser.ts`
2. `cmd/gizzi-code/src/runtime/agents/mention-router.ts`

**Integration:**
- Parse @mentions from agent messages
- Route to appropriate agent sessions
- Trigger target agent if idle

### Phase 4: Add Webhook Integration (Week 2-3)

**Files to Modify:**
1. `cmd/gizzi-code/src/runtime/tools/builtins/webhook-listen.ts` (new)
2. `cmd/gizzi-code/src/runtime/server/routes/webhooks.ts` (new)

**Implementation:**
- Use existing webhook-ingestion service as library
- Emit events to session bus
- Create tasks from webhooks

---

## Key Differences: External vs Native

| Aspect | External Services | Native Tools |
|--------|------------------|--------------|
| **Deployment** | Separate processes | Built into runtime |
| **Communication** | HTTP/WebSocket | Direct function calls |
| **State** | Separate stores | Shared session state |
| **Tool Registration** | Manual MCP setup | Automatic in registry |
| **UI Integration** | Separate components | Built into chat |
| **Dependencies** | External packages | Zero additional deps |
| **Performance** | Network latency | In-process |

---

## Conclusion

**a2rchitech already has 80% of what's needed** for multi-agent communication:
- ✅ Tool execution framework
- ✅ MCP integration
- ✅ Question/answer system
- ✅ Session management
- ✅ UI components

**What's missing (20%):**
- ❌ Agent-to-agent messaging tools
- ❌ Shared channel abstraction
- ❌ @mention routing
- ❌ Loop guard enforcement

**Recommendation:** Build the missing 20% as **native tools** that integrate with the existing gizzi-code runtime, NOT as separate services.

The external implementation I created can serve as a **reference** for the logic, but should be **rewritten as native gizzi-code tools**.

---

## Next Steps

1. **Review existing tool patterns** - Study `question.ts`, `bash.ts`, `plan.ts`
2. **Create native agent-communicate tool** - Follow existing patterns
3. **Integrate with session context** - Add communication state to sessions
4. **Add UI components** - Display agent messages in chat
5. **Test with multiple agents** - Verify agent-to-agent communication works

---

**END OF ANALYSIS**
