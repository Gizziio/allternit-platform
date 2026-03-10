# Multi-Agent Communication Layer Analysis & Integration Proposal

**Date:** 2026-03-08  
**Status:** Research Complete → Implementation Proposal  
**Scope:** Augmenting a2rchitech Agent System Rails with proven communication patterns

---

## Executive Summary

After analyzing 5 multi-agent systems (IDE Agent Kit, Sabbatic, Elphame, agentchattr, The Agency), I've identified **high-value patterns** that can augment a2rchitech's existing Agent System Rails without violating the control-plane/execution-plane separation.

**Key Finding:** a2rchitech already has superior governance (Rails, gates, leases, receipts). The external projects excel at **agent-to-agent coordination ergonomics** and **human-agent unified interfaces**.

**Recommendation:** Implement a **Communication Augmentation Layer** that:
1. Adds @mention-based agent routing (from agentchattr)
2. Provides webhook-based bot integration (from IDE Agent Kit, Elphame)
3. Implements shared chat rooms for human-agent collaboration (from Sabbatic, Elphame)
4. Leverages The Agency's specialist agent profiles for role-based prompts

---

## 1. Project Analysis Summary

### 1.1 IDE Agent Kit (thinkoffapp/ide-agent-kit)
**Purpose:** Multi-agent coordination for IDE-based AI assistants  
**Architecture:** Message delivery layer (not autoresponder)  
**Key Innovations:**
- ✅ **Receipt-first architecture** (append-only JSONL with trace IDs)
- ✅ **Multi-IDE, multi-machine coordination** (Claude Code, Codex, Gemini on separate machines)
- ✅ **Three delivery paths:** Webhooks (primary), Room polling (realtime), tmux runner (fallback)
- ✅ **OpenClaw gateway bridge** (WebSocket-based agent fleet management)
- ✅ **ACP extension** (Agent Client Protocol for multi-agent task orchestration)
- ✅ **Zero dependencies** (Node.js 18+ only)

**Communication Mechanisms:**
```
GitHub Webhooks → Normalized JSONL Queue → tmux Nudge → IDE Agent
Ant Farm Rooms → Poller (8-10s) → Auto-ack → tmux trigger
OpenClaw CLI → Gateway health → Agent sessions → Exec approvals
```

**Relevance to a2rchitech:**
- ⭐ **HIGH** - Receipt model aligns perfectly with Rails receipts
- ⭐ **HIGH** - Webhook normalization could feed into Rails ledger
- ⚠️ **MEDIUM** - tmux injection is Runner-specific (not Rails concern)

---

### 1.2 Sabbatic (blackopsrepl/sabbatic)
**Purpose:** Web-based chat with bot/AI agent capabilities (Campfire fork)  
**Architecture:** Ruby on Rails, single-tenant, Docker deployment  
**Key Innovations:**
- ✅ **Human-agent unified chat** (agents as first-class participants)
- ✅ **Simple webhook API** (bots receive messages via HTTP POST)
- ✅ **Bot key authentication** (unique API key per bot)
- ✅ **File attachment support** (bots can post images/files)
- ✅ **Multiple rooms with access controls**

**Communication Mechanisms:**
```bash
# Bot receives messages via webhook
POST https://your-domain.com/webhook
{ "room_id": 1, "user": "Alice", "message": "@botname help" }

# Bot posts messages via REST API
curl -d 'Response!' https://your-domain.com/rooms/1/BOT_KEY/messages
```

**Relevance to a2rchitech:**
- ⭐ **HIGH** - Human-agent chat rooms could be Rails "mail" projection
- ⭐ **MEDIUM** - Webhook model could trigger Rails WorkRequestCreated
- ⚠️ **LOW** - Full chat app is separate from Rails (could be UI layer)

---

### 1.3 Elphame (blackopsrepl/elphame)
**Purpose:** Anonymous imageboard with AI agent participation  
**Architecture:** Rails 8.1, SQLite, Hotwire, MCP-compatible API  
**Key Innovations:**
- ✅ **Push-based bot notifications** (HTTP webhooks on @mention, no polling)
- ✅ **Auto-reply via plain text response** (webhook returns text → auto-posts)
- ✅ **Three-way identity coexistence** (anonymous, registered, bot)
- ✅ **MCP-compatible skill document** (/skill endpoint for agent discovery)
- ✅ **Star ratings + labels** (community curation)

**Communication Mechanisms:**
```json
// Bot registration
POST /join
{ "name": "MyBot", "webhook_url": "https://example.com/webhook" }
→ { "bot_key": "42-AbCdEfGh...", "realms": [...] }

// Webhook push on @mention
POST https://myserver.com/webhook
{
  "user": { "id": 5, "name": "Alice" },
  "discussion": { "id": 42, "subject": "Brainstorming" },
  "post": { "content": "Hey @MyBot, thoughts?" }
}

// Auto-reply (plain text response)
HTTP/1.1 200 OK
Content-Type: text/plain
That's interesting! Consider...
```

**Relevance to a2rchitech:**
- ⭐ **HIGH** - Push notifications superior to polling (could augment Rails mail)
- ⭐ **HIGH** - MCP compatibility aligns with a2rchitech agent discovery
- ⭐ **MEDIUM** - Imageboard model could inspire UI for agent collaboration

---

### 1.4 agentchattr (bcurts/agentchattr)
**Purpose:** Local chat server for AI agent coordination  
**Architecture:** FastAPI + WebSocket + MCP proxy  
**Key Innovations:**
- ✅ **@mention trigger flow** (auto-wakes target agent via terminal injection)
- ✅ **Per-instance MCP proxy** (injects sender identity transparently)
- ✅ **Loop guard** (prevents runaway agent chains, human passthrough)
- ✅ **Multi-instance support** (claude, claude-2, claude-3 auto-registration)
- ✅ **Structured sessions** (Code Review, Debate, Design Critique templates)
- ✅ **Agent roles** (Planner, Builder, Reviewer, Researcher)

**Communication Mechanisms:**
```
User: "@claude what's status?"
  → Server detects @mention
  → Wrapper injects "mcp read #general" into Claude's terminal
  → Claude reads, responds
  → If Claude @mentions @codex, same happens
  → Loop guard pauses after N hops
```

**MCP Tools (11 total):**
- `chat_send`, `chat_read`, `chat_resync`, `chat_join`, `chat_who`
- `chat_rules`, `chat_channels`, `chat_set_hat`, `chat_claim`
- `chat_summary`, `chat_propose_job`

**Relevance to a2rchitech:**
- ⭐ **CRITICAL** - @mention routing could be Rails gate + Runner trigger
- ⭐ **CRITICAL** - MCP proxy model aligns with a2rchitech tool execution
- ⭐ **HIGH** - Loop guard prevents infinite agent loops (policy control)
- ⭐ **HIGH** - Agent roles match Rails WIH roles (builder, validator, planner)

---

### 1.5 The Agency (msitarzewski/agency-agents)
**Purpose:** 61 specialized AI agent personalities across 9 divisions  
**Architecture:** Prompt collection (Claude Code integration)  
**Key Innovations:**
- ✅ **Specialist agents** (Frontend Developer, Security Auditor, UX Researcher)
- ✅ **Personality-driven** (distinct voice, communication style)
- ✅ **Deliverable-focused** (real code, processes, measurable outcomes)
- ✅ **Multi-agent orchestration** (Agents Orchestrator in Specialized division)
- ✅ **Division-based collaboration** (Engineering, Design, Marketing, etc.)

**Example Multi-Agent Scenario:**
```
Nexus Spatial Discovery Exercise:
8 agents (Product Trend Researcher, Backend Architect, Brand Guardian,
Growth Hacker, Support Responder, UX Researcher, Project Shepherd,
XR Interface Architect) → unified product plan
```

**Relevance to a2rchitech:**
- ⭐ **HIGH** - Agent profiles could populate Rails registry
- ⭐ **MEDIUM** - Division model could inspire DAG node organization
- ⭐ **MEDIUM** - Personality prompts could be Rails prompt packs

---

## 2. a2rchitech Current State Analysis

### 2.1 Existing Agent System Rails

**Control Plane (Rails):**
```
Ledger (append-only truth)
  ↓
Leases (write authority)
  ↓
Gates (policy + validation)
  ↓
Receipts (evidence store)
  ↓
Mail (bounded coordination)
```

**Execution Plane (Runner):**
```
Context Packs (policy injection)
  ↓
Worker Orchestration (builder, validator, planner)
  ↓
Ralph Loop (fix cycles)
  ↓
Tool Execution (via IO Service)
```

**Event Taxonomy (from Rails spec):**
- `PromptCreated`, `PromptDeltaAppended`, `PromptLinkedToWork`
- `DagCreated`, `DagNodeCreated`, `DagNodeStatusChanged`
- `WIHCreated`, `WIHPickedUp`, `WIHOpenSigned`, `WIHClosedSigned`
- `LeaseRequested`, `LeaseGranted`, `LeaseReleased`
- `ReceiptWritten`, `RunStarted`, `RunEnded`
- `ThreadCreated`, `MessageSent`, `ReviewRequested`, `ReviewDecision`

**Mail System (bounded coordination):**
```bash
a2r mail thread ensure --topic dag:<dag_id>
a2r mail send <thread_id> --body <file>
a2r mail request-review <thread_id> --wih <wih_id>
```

### 2.2 Gaps Identified

| Gap | Impact | External Solution |
|-----|--------|-------------------|
| **No @mention routing** | Agents can't directly ping each other | agentchattr |
| **No push notifications** | Requires polling for messages | Elphame |
| **No shared chat rooms** | Human-agent collaboration is CLI-only | Sabbatic, Elphame |
| **No specialist profiles** | Generic agent prompts | The Agency |
| **No webhook ingestion** | External events require manual trigger | IDE Agent Kit |
| **No loop guard** | Ralph loop could run indefinitely | agentchattr |

---

## 3. Integration Proposal: Communication Augmentation Layer

### 3.1 Design Principles

1. **Respect Rails Authority:** All state changes flow through Rails ledger/gates
2. **Augment, Don't Replace:** Add ergonomics on top of existing primitives
3. **Runner-Implemented, Rails-Gated:** Communication logic in Runner, policy in Rails
4. **Receipt-First:** Every message produces a Rails receipt

### 3.2 Proposed Components

#### Component 1: @mention Router (Rails Gate + Runner Trigger)

**Purpose:** Enable agents to directly communicate via @mentions

**Architecture:**
```
User/Agent: "@builder fix this bug"
    ↓
Rails Gate (PreToolUse)
    ↓
  Check: Is @builder a valid agent role?
  Check: Does sender have lease for this thread?
  Check: Rate limit (max 5 @mentions/min)
    ↓
  Emit: `AgentMentioned` receipt
  Emit: `WorkRequestCreated` (if builder is idle)
    ↓
Runner: Detects receipt → injects "mcp read #general" into builder terminal
```

**Event Schema:**
```json
{
  "type": "AgentMentioned",
  "event_id": "evt_{uuid}",
  "ts": "RFC3339",
  "actor": "agent:builder:run_123",
  "scope": {
    "dag_id": "dag_456",
    "node_id": "n_789",
    "thread_id": "thr_abc"
  },
  "payload": {
    "mentioned_role": "builder",
    "message": "@builder fix this bug",
    "correlation_id": "corr_{uuid}"
  },
  "provenance": {
    "parent_event_id": "evt_prev"
  }
}
```

**Rails CLI Extension:**
```bash
# New command: mention agent
a2r mention @builder --thread dag:123 --message "Fix this bug"

# Emits:
# - AgentMentioned
# - WorkRequestCreated (if builder idle)
# - MessageSent (to thread)
```

**Runner Implementation:**
```typescript
// 5-agents/communication/mention-router.ts
class MentionRouter {
  async handleMention(event: AgentMentioned) {
    // 1. Parse @mention from message
    const mentions = parseMentions(event.payload.message);
    
    // 2. For each mention, check agent availability
    for (const mention of mentions) {
      const agent = await this.registry.getAgentByRole(mention.role);
      
      // 3. Inject into agent terminal (via MCP proxy)
      if (agent && agent.status === 'idle') {
        await this.mcpProxy.inject(agent.sessionId, `mcp read #${event.scope.thread_id}`);
      }
      
      // 4. Emit receipt
      await rails.receipts.record({
        kind: 'agent_mentioned',
        payload: { agent_id: agent.id, thread_id: event.scope.thread_id }
      });
    }
  }
}
```

---

#### Component 2: Webhook Ingestion Service (Rails + Runner Bridge)

**Purpose:** Accept external events (GitHub, Discord, etc.) and convert to Rails work requests

**Architecture:**
```
GitHub Webhook → Rails Webhook Ingestion → Normalize → Emit Events
                                              ↓
                                    `ExternalEventReceived`
                                    `WorkRequestCreated` (if action required)
                                              ↓
                                    Runner: Claims work → Executes
```

**Rails Extension:**
```typescript
// 2-governance/webhook-ingestion/src/main.ts
interface WebhookPayload {
  source: 'github' | 'discord' | 'antfarm' | 'moltbook';
  event_type: string;
  raw_payload: Record<string, any>;
  hmac_signature?: string;
}

class WebhookIngestion {
  async ingest(webhook: WebhookPayload) {
    // 1. Verify HMAC (if configured)
    if (webhook.hmac_signature) {
      const valid = await this.verifySignature(webhook);
      if (!valid) throw new Error('Invalid signature');
    }
    
    // 2. Normalize to Rails schema
    const normalized = this.normalize(webhook);
    
    // 3. Emit events
    await this.ledger.append({
      type: 'ExternalEventReceived',
      payload: normalized
    });
    
    // 4. Create work request if action required
    if (this.requiresAction(normalized)) {
      await this.ledger.append({
        type: 'WorkRequestCreated',
        payload: {
          role: this.inferRole(normalized),
          execution_mode: 'PLAN_ONLY',
          required_gates: ['policy_check'],
          lease_scope: { allowed_tools: ['github_comment', 'bash'] }
        }
      });
    }
  }
}
```

**IDE Agent Kit Inspiration:**
```javascript
// From ide-agent-kit/src/webhook-server.mjs
// Normalized JSONL schema (adopt for Rails)
{
  "id": "evt_gh_123",
  "source": "github",
  "type": "pull_request.opened",
  "ts": 1709856000000,
  "data": {
    "repo": "a2rchitech/platform",
    "pr_number": 42,
    "author": "alice",
    "title": "Fix memory leak"
  },
  "trace_id": "trace_{uuid}",
  "idempotency_key": "ik_{sha256}"
}
```

**Rails CLI Extension:**
```bash
# Start webhook server
a2r webhook serve --port 8787 --secret $WEBHOOK_SECRET

# List configured webhooks
a2r webhook list

# Trigger webhook manually (for testing)
a2r webhook trigger --source github --type pull_request.opened --payload @payload.json
```

---

#### Component 3: Shared Chat Rooms (Rails Mail Projection + UI)

**Purpose:** Enable human-agent collaboration in shared chat interface

**Architecture:**
```
Rails Mail (bounded coordination)
    ↓
Projection: Chat Rooms (derived view)
    ↓
UI: Sabbatic/Elphame-inspired interface
    ↓
Agents: Participate via MCP tools
```

**Rails Mail Extension:**
```typescript
// Current Rails mail is thread-based, extend to rooms
interface ChatRoom {
  room_id: "room_{uuid}";
  name: "feature-admin-planning"; // From IDE Agent Kit
  members: string[]; // agent roles + user IDs
  access_control: 'public' | 'private' | 'invite-only';
  created_at: "RFC3339";
}

interface RoomMessage {
  message_id: "msg_{uuid}";
  room_id: "room_{uuid}";
  actor: "user:alice" | "agent:builder:run_123";
  content: string;
  attachments?: string[]; // vault refs
  mentions?: string[]; // @builder, @validator
  ts: "RFC3339";
}
```

**Event Schema:**
```json
{
  "type": "ChatRoomCreated",
  "event_id": "evt_{uuid}",
  "payload": {
    "room_id": "room_{uuid}",
    "name": "feature-admin-planning",
    "creator": "user:alice",
    "initial_members": ["user:alice", "role:builder", "role:validator"]
  }
}

{
  "type": "RoomMessageSent",
  "event_id": "evt_{uuid}",
  "payload": {
    "message_id": "msg_{uuid}",
    "room_id": "room_{uuid}",
    "actor": "agent:builder:run_123",
    "content": "I've implemented the fix. @validator please review.",
    "mentions": ["validator"]
  }
}
```

**MCP Tools (from agentchattr, adapted for Rails):**
```typescript
// Runner provides these MCP tools to agents
{
  "chat_send": {
    "description": "Send message to room",
    "parameters": { room_id: string, content: string, mentions?: string[] }
  },
  "chat_read": {
    "description": "Read messages from room",
    "parameters": { room_id: string, since?: string, limit?: number }
  },
  "chat_join": {
    "description": "Join room",
    "parameters": { room_id: string }
  },
  "chat_who": {
    "description": "List room participants",
    "parameters": { room_id: string }
  }
}
```

**UI Inspiration (Sabbatic + Elphame):**
- Multiple rooms with access controls
- File attachments with previews
- @mentions with push notifications
- Star ratings (from Elphame) for message quality
- Bot status indicators (online/offline/active)

---

#### Component 4: Specialist Agent Profiles (Rails Registry + Prompt Packs)

**Purpose:** Populate Rails registry with specialized agent personalities

**Architecture:**
```
The Agency (61 agents) → Rails Registry (agent definitions)
                      → Prompt Packs (5-agents/packs/)
                      → WIH Role Assignment
```

**Rails Registry Extension:**
```typescript
// 4-services/registry/registry-server/src/agents.ts
interface SpecialistAgent {
  agent_id: "agent_{uuid}";
  name: "Frontend Developer"; // From The Agency
  division: "engineering";
  identity: {
    personality: "Direct, code-focused, opinionated about best practices";
    communication_style: "Concise, example-driven";
    voice: "I default to implementing first, asking questions later";
  };
  mission: "Build accessible, performant, maintainable UIs";
  critical_rules: [
    "Never commit untested code",
    "Always include TypeScript types",
    "Default to mobile-first responsive design"
  ];
  technical_deliverables: [
    "Component code with tests",
    "Storybook stories",
    "Accessibility audit report"
  ];
  success_metrics: [
    "Lighthouse score > 90",
    "Zero TypeScript errors",
    "WCAG 2.1 AA compliance"
  ];
  prompt_pack_id: "pack_frontend_dev_v1";
}
```

**Prompt Pack (5-agents/packs/):**
```markdown
# Frontend Developer Prompt Pack

## Identity
You are a Frontend Developer specialist. Your voice is direct and code-focused.

## Critical Rules
1. Never commit untested code
2. Always include TypeScript types
3. Default to mobile-first responsive design

## Workflow
1. Understand requirements
2. Implement component
3. Write tests
4. Document with Storybook
5. Run accessibility audit

## Success Metrics
- Lighthouse score > 90
- Zero TypeScript errors
- WCAG 2.1 AA compliance
```

**Rails CLI Extension:**
```bash
# Import agent profiles from The Agency
a2r registry import-agents --source ./agency-agents/

# List specialist agents
a2r registry list-agents --division engineering

# Assign agent to WIH
a2r wih pickup <node_id> --agent frontend-developer
```

---

#### Component 5: Loop Guard (Rails Policy + Runner Enforcement)

**Purpose:** Prevent runaway agent-to-agent chains

**Architecture:**
```
agentchattr Loop Guard → Rails Policy Gate
                      → Runner Enforcement
```

**Rails Policy Extension:**
```typescript
// 2-governance/policy/src/loop-guard.ts
interface LoopGuardPolicy {
  max_agent_hops: number; // Default: 4
  human_passthrough: boolean; // Always allow human @mentions
  cooldown_seconds: number; // Prevent rapid-fire triggers
}

class LoopGuard {
  async check(event: AgentMentioned) {
    // 1. Count agent hops in correlation chain
    const chain = await this.getCorrelationChain(event.correlation_id);
    const agentHops = chain.filter(e => e.actor.startsWith('agent:')).length;
    
    // 2. Check against policy
    if (agentHops >= this.policy.max_agent_hops) {
      return {
        allowed: false,
        reason: `Max agent hops (${this.policy.max_agent_hops}) exceeded`,
        escalation: 'user'
      };
    }
    
    // 3. Check cooldown
    const lastMention = await this.getLastMention(event.actor);
    if (lastMention && Date.now() - lastMention.ts < this.policy.cooldown_seconds * 1000) {
      return {
        allowed: false,
        reason: `Agent in cooldown (${this.policy.cooldown_seconds}s)`,
      };
    }
    
    return { allowed: true };
  }
}
```

**Runner Enforcement:**
```typescript
// 5-agents/communication/loop-guard.ts
class RunnerLoopGuard {
  async beforeInject(mention: AgentMentioned) {
    const result = await rails.gate.check({
      gate: 'loop_guard',
      event: mention
    });
    
    if (!result.allowed) {
      // Emit receipt
      await rails.receipts.record({
        kind: 'loop_guard_blocked',
        payload: { reason: result.reason, escalation: result.escalation }
      });
      
      // Escalate to user
      if (result.escalation === 'user') {
        await rails.ledger.append({
          type: 'WorkIterationEscalated',
          payload: { to: 'user', reason: result.reason }
        });
      }
      
      throw new Error(`Loop guard blocked: ${result.reason}`);
    }
  }
}
```

---

### 3.3 Implementation Roadmap

#### Phase 1: Foundation (Week 1-2)
- [ ] **1.1** Extend Rails event taxonomy with `AgentMentioned`, `ExternalEventReceived`, `ChatRoomCreated`, `RoomMessageSent`
- [ ] **1.2** Implement @mention parser (regex: `/\B@([A-Za-z][A-Za-z0-9_-]*)/`)
- [ ] **1.3** Add Rails CLI commands: `a2r mention`, `a2r webhook serve`, `a2r room create`
- [ ] **1.4** Extend Rails registry schema for specialist agents

#### Phase 2: Runner Integration (Week 3-4)
- [ ] **2.1** Implement MentionRouter in Runner
- [ ] **2.2** Add MCP proxy for @mention terminal injection
- [ ] **2.3** Implement WebhookIngestion service
- [ ] **2.4** Add LoopGuard policy check

#### Phase 3: UI Layer (Week 5-6)
- [ ] **3.1** Build chat room UI (inspired by Sabbatic/Elphame)
- [ ] **3.2** Add @mention autocomplete
- [ ] **3.3** Implement push notifications (Elphame webhook model)
- [ ] **3.4** Add file attachment support

#### Phase 4: Specialist Agents (Week 7-8)
- [ ] **4.1** Import The Agency profiles into Rails registry
- [ ] **4.2** Create prompt packs for each specialist
- [ ] **4.3** Test multi-agent orchestration scenarios
- [ ] **4.4** Document agent collaboration patterns

---

## 4. Risk Analysis

### 4.1 Architectural Risks

| Risk | Impact | Mitigation |
|------|--------|------------|
| **Rails authority drift** | Runner writes canonical state | Enforce via gates, audit receipts |
| **Event taxonomy bloat** | Too many event types | Strict versioning, deprecation policy |
| **Loop guard false positives** | Blocks valid agent chains | Configurable thresholds, human override |
| **Webhook security** | Unauthorized event injection | HMAC verification, allowlist sources |

### 4.2 Performance Risks

| Risk | Impact | Mitigation |
|------|--------|------------|
| **@mention latency** | Slow agent wake-up | Optimize MCP proxy, use tmux injection |
| **Webhook flood** | Ledger spam | Rate limiting, deduplication via idempotency keys |
| **Room projection lag** | Stale chat UI | Incremental projections, rebuild on demand |

---

## 5. Success Metrics

### 5.1 Quantitative
- **Agent response time:** < 5 seconds from @mention to action
- **Webhook latency:** < 2 seconds from external event to work request
- **Loop guard effectiveness:** 0 runaway agent chains in production
- **Multi-agent success rate:** > 90% of multi-agent tasks complete without escalation

### 5.2 Qualitative
- **Developer experience:** Agents feel like collaborative teammates
- **Human-agent collaboration:** Seamless chat-based workflow
- **Agent specialization:** Clear division of labor between specialists
- **System stability:** No governance violations or receipt drift

---

## 6. Conclusion

The analyzed projects provide **proven patterns** for multi-agent communication that complement a2rchitech's strong governance foundation:

1. **IDE Agent Kit** → Receipt-first, multi-machine coordination
2. **Sabbatic** → Human-agent unified chat rooms
3. **Elphame** → Push-based bot notifications, MCP compatibility
4. **agentchattr** → @mention routing, loop guard, MCP proxy
5. **The Agency** → Specialist agent profiles and personalities

By implementing the **Communication Augmentation Layer** as proposed, a2rchitech can achieve:
- ✅ Direct agent-to-agent communication via @mentions
- ✅ External event integration via webhooks
- ✅ Human-agent collaboration in shared chat rooms
- ✅ Specialist agent roles with distinct personalities
- ✅ Safe multi-agent orchestration with loop guards

**Next Step:** Begin Phase 1 implementation (Rails event taxonomy extension).

---

## Appendix A: Event Schema Reference

### A.1 New Event Types

```json
// AgentMentioned
{
  "type": "AgentMentioned",
  "event_id": "evt_{uuid}",
  "ts": "RFC3339",
  "actor": "agent:builder:run_123",
  "scope": { "dag_id": "dag_456", "node_id": "n_789", "thread_id": "thr_abc" },
  "payload": {
    "mentioned_role": "builder",
    "message": "@builder fix this",
    "correlation_id": "corr_{uuid}"
  }
}

// ExternalEventReceived
{
  "type": "ExternalEventReceived",
  "event_id": "evt_{uuid}",
  "ts": "RFC3339",
  "actor": "system:webhook",
  "payload": {
    "source": "github",
    "event_type": "pull_request.opened",
    "normalized_data": { "repo": "...", "pr_number": 42 },
    "idempotency_key": "ik_{sha256}"
  }
}

// ChatRoomCreated
{
  "type": "ChatRoomCreated",
  "event_id": "evt_{uuid}",
  "payload": {
    "room_id": "room_{uuid}",
    "name": "feature-admin-planning",
    "creator": "user:alice",
    "initial_members": ["user:alice", "role:builder", "role:validator"]
  }
}

// RoomMessageSent
{
  "type": "RoomMessageSent",
  "event_id": "evt_{uuid}",
  "payload": {
    "message_id": "msg_{uuid}",
    "room_id": "room_{uuid}",
    "actor": "agent:builder:run_123",
    "content": "Fix implemented",
    "mentions": ["validator"]
  }
}
```

---

## Appendix B: CLI Command Reference

```bash
# Mention an agent
a2r mention @builder --thread dag:123 --message "Fix this bug"

# Start webhook server
a2r webhook serve --port 8787 --secret $WEBHOOK_SECRET

# List webhooks
a2r webhook list

# Trigger webhook manually
a2r webhook trigger --source github --type pull_request.opened --payload @payload.json

# Create chat room
a2r room create --name feature-admin-planning --members user:alice,role:builder

# Join room
a2r room join room_{uuid}

# Send message to room
a2r room send room_{uuid} --message "Hello @builder" --attach file.png

# List specialist agents
a2r registry list-agents --division engineering

# Import agent profiles
a2r registry import-agents --source ./agency-agents/
```

---

## Appendix C: File Structure Proposal

```
a2rchitech/
├── 2-governance/
│   └── webhook-ingestion/
│       ├── src/
│       │   ├── main.ts
│       │   ├── normalizer.ts
│       │   └── signature-verifier.ts
│       └── README.md
├── 5-agents/
│   ├── communication/
│   │   ├── mention-router.ts
│   │   ├── loop-guard.ts
│   │   └── mcp-proxy.ts
│   └── packs/
│       ├── frontend-developer.md
│       ├── security-auditor.md
│       └── ... (61 specialists from The Agency)
├── 6-ui/
│   └── chat-rooms/
│       ├── src/
│       │   ├── components/
│       │   │   ├── RoomList.tsx
│       │   │   ├── MessageThread.tsx
│       │   │   └── MentionAutocomplete.tsx
│       │   └── hooks/
│       │       └── usePushNotifications.ts
│       └── README.md
└── docs/
    └── MULTI_AGENT_COMMUNICATION.md
```

---

**END OF PROPOSAL**
