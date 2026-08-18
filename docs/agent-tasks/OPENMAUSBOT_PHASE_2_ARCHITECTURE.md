# OpenMausBot Packaged Bots — Phase 2 Architecture (Revised)

**Branch:** `ao/p1-openmausbot`
**Builds on:** Phase 1 (committed `22af3877d`)
**Status:** Design document v3 — product-aligned implementation plan

**Product decision update (2026-08-16):** Keep a durable, bot-level activity
history while partitioning work into bounded sessions. A bot does not own one
unbounded model context. It owns an ordered stream of session summaries,
messages, events, artifacts, and memory promotions. Each session/WIH has its own
context budget and lifecycle.

### Skeptical source audit

Later implementation notes referenced `BotHomeView.tsx` and
`useStartBotSession.ts` as current behavior. Those files are present in the
dirty shared checkout and `session/platform-polish`, but not in this clean
`ao/p1-openmausbot` worktree. Treat them as unmerged prototype evidence, not as
the production baseline. Wave 0 must reconcile their ownership, branch status,
tests, and intended landing path before building on them.

Verified prototype observations:

- `BotHomeView` groups multiple chat sessions and projects, but infers bot
  ownership from client metadata and even falls back to agent-name matching.
  That is migration compatibility, not a durable identity contract.
- `useStartBotSession` explicitly reuses the first matching bot chat session,
  conflicting with the bounded multi-session design.
- The general `HomeView` in this feature branch is a quick-launch/recent-session
  page and is not yet an operational bot roster.
- Workspace compiler/boot code recognizes canonical identity files, but UI edit
  round-trip, revision pinning, and runtime use of the exact selected revision
  remain acceptance work, not verified facts.
- Connector credential resolution is real, but the prototype returns decrypted
  secret material to the web client and stores resolved values in chat-session
  metadata. That must be removed before claiming production-safe connectors.

---

## Core Insight: This Is a Merge, Not a Build

Phase 2 is **not building bot infrastructure from scratch**. Allternit already has everything needed at the infrastructure layer:

| What we need | What Allternit already has | Location |
|---|---|---|
| Bot definition | `Agent` type (1065 lines) with character layers, trust tiers, harness, agent cards | `agent.types.ts` |
| Bot session | `WIH` (Work-In-Hand) with DAG reference, tools, resume cursor, write scope | `rails/` (Rust) + `.allternit/wih/` |
| Consensus loop | Ralph loop with iteration tracking, spawn requests, escalation | `rails/` Runner layer |
| Approval gates | `Gate` with policy enforcement, lease management, receipt verification | `rails/` Gate layer |
| Bot group chat | `Bus` (durable SQLite queue) + `AgentSwarm` with consensus threshold | `rails/` Bus + `agent-advanced.types.ts` |
| Bot-to-bot comms | Bus transports (tmux/socket) + swarm communication patterns | `rails/` Transport layer |
| Tool scoping | WIH tool allowlists + `ToolPolicy` with tiers | `.allternit/wih/*.json` |
| Agent workspace | Full WASM+HTTP workspace with boot, policy, context packs, session states | `agent-workspace/` |
| Session lifecycle | `SessionStatus`: idle → connecting → hydrating → **planning** → **executing** → **responding** → compacting → error | `agent-workspace/types.ts` |
| @ mention system | `use-mention-targets.ts` for plugins/connectors | `lib/mentions/` |
| Swarm-as-agent | `swarmToAgent()` bridge — swarms appear as @-mentionable agents | `swarm-as-agent.ts` |

**The gap is UX packaging, not infrastructure.**

---

## Design Principles

1. **Bots = Packaged Agents** — a bot is a curated `Agent` instance with a friendly UX wrapper. No new data type.
2. **Bot History = Durable Stream; Bot Session = Bounded WIH** — the bot owns a durable activity stream; each concrete task/conversation partition is a WIH with an independent context budget, summary, and lifecycle.
3. **Consensus = Ralph Loop** — the consensus loop is the Rails runner's iteration system. Surface it, don't rebuild it.
4. **Group Chat = Bus + Swarm** — bots coordinate via the Rails bus and swarm communication patterns.
5. **Rails → CommRails** — rename in the UI layer only. The Rust crate stays `allternit-agent-system-rails`.
6. **Agent PillTab → Bot Sessions** — rebrand the existing agent session views as bot sessions.
7. **Comprehensive config, good UX** — bot config exposes the full Agent type power but with a progressive disclosure UX.

---

## Architecture Overview

```
┌─────────────────────────── Allternit Shell ──────────────────────────────┐
│                                                                         │
│  ┌────────────┐   ┌──────────────────── ViewHost ─────────────────────┐ │
│  │ShellRail   │   │                                                   │ │
│  │            │   │  ┌──────────── BotSessionView ─────────────────┐  │ │
│  │ CommRails  │   │  │                                             │  │ │
│  │ Section    │   │  │  ┌─────────┐  ┌──────────────────────────┐  │  │ │
│  │            │   │  │  │Welcome  │  │ WIH Progress (Ralph Loop)│  │  │ │
│  │ Bot A ●    │───│  │  │Card     │  │ Plan→Exec→Review→Deliver │  │  │ │
│  │ Bot B ●    │   │  │  │(idle)   │  ├──────────────────────────┤  │  │ │
│  │ Bot C ◌    │   │  │  └─────────┘  │ Chat + Tool Calls       │  │  │ │
│  │            │   │  │                │ (ActivityChips)         │  │  │ │
│  │ Group Chats│   │  │                ├──────────────────────────┤  │  │ │
│  │ Research ✓ │   │  │                │ Gate Review Panel       │  │  │ │
│  │            │   │  │                │ (approve/deny/escalate) │  │  │ │
│  └────────────┘   │  │                ├──────────────────────────┤  │  │ │
│                   │  │                │ Deliverable Artifacts   │  │  │ │
│                   │  │                │ (.allternit/artifacts/) │  │  │ │
│                   │  │                └──────────────────────────┘  │  │ │
│                   │  └──────────────────────────────────────────────┘  │ │
│                   └───────────────────────────────────────────────────┘ │
│                                                                         │
│  ┌──────────────────── Rails/CommRails (Rust) ─────────────────────────┐ │
│  │ DAG │ WIH │ Gate │ Bus │ Runner (Ralph Loop) │ Ledger │ Vault     │ │
│  └─────────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 1. Bot = Packaged Agent (No New Type)

Instead of the Phase 1 `PackagedBot` interface, bots are **curated `Agent` instances** with a `category: 'bot'` marker and a `botProfile` extension.

### Extend `Agent` type in `agent.types.ts`:

```typescript
export interface Agent {
  // ... existing fields (1065 lines) ...
  
  // Phase 2: Bot packaging overlay
  isBot?: boolean;                    // Marks this agent as a packaged bot
  botProfile?: BotProfile;            // Bot-specific UX metadata
}

export interface BotProfile {
  /** Display name for the bot (may differ from agent.name for friendliness) */
  displayName?: string;
  /** Short tagline shown on the welcome card */
  tagline?: string;
  /** Welcome message when a new session starts */
  welcomeMessage?: string;
  /** Starter prompts the user can click */
  starterPrompts?: string[];
  /** Accent color for the bot's UI chrome */
  accentColor?: string;
  /** Mascot/avatar config (reuse existing CharacterLayerConfig.avatar) */
  mascotTemplate?: string;
  /** Whether this bot participates in group chats */
  groupChatEnabled?: boolean;
  /** Default WIH preset for new sessions */
  defaultPresetId?: string;
  /** Bot category for filtering in the hub */
  botCategory?: 'research' | 'code' | 'writing' | 'data' | 'sales' | 'design' | 'ops' | 'custom';
}
```

### Update `bots.manifest.ts` to create Agents:

```typescript
// Instead of PACKAGED_BOTS: PackagedBot[], export factory functions
// that create Agent instances with botProfile

export const BOT_TEMPLATES: BotTemplate[] = [
  {
    id: 'deep-researcher',
    template: {
      name: 'Deep Researcher',
      description: 'An exhaustive research assistant...',
      type: 'specialist',
      category: 'research',
      isBot: true,
      botProfile: {
        displayName: 'Deep Researcher',
        tagline: 'Find anything, cite everything',
        welcomeMessage: 'I\'m your research partner. What are we investigating?',
        starterPrompts: ['Research the current landscape of...', 'Compare these approaches...'],
        accentColor: '#8b5cf6',
        botCategory: 'research',
      },
      systemPrompt: '...',
      trustTier: 'standard',
      allowedSurfaces: ['chat'],
      characterLayer: { /* ... */ },
      agentCard: { /* ... */ },
    },
  },
  // ... more templates
];
```

---

## 2. Bot History and Session Model

The product should feel continuous without sending an unbounded transcript back
to the model. A bot owns one durable, append-only activity stream, partitioned
into bounded sessions. A session is backed by a WIH when it represents agent
work; lightweight conversational sessions may acquire a WIH when execution
begins.

This is intentionally different from the reference products' literal
one-thread-per-bot model. It keeps the useful continuity while avoiding context
bloat, degraded retrieval, and an endless human scroll.

### Canonical hierarchy

```text
Bot
  -> durable activity stream (ordered JSONL/event records)
     -> Session A (bounded context + summary + optional WIH)
     -> Session B (bounded context + summary + optional WIH)
     -> Routine run (linked execution session)
     -> Child-bot delegation (linked execution session)
     -> Memory promotion / artifact / approval event
```

### Storage contract

- The durable source of truth should be one server-owned event contract backed
  by the existing ledger plus transactional database projections. Wave 0 must
  decide which component owns append authority and document the recovery path;
  “SQLite/Postgres and JSONL are both canonical” is forbidden.
- JSONL is an export, local-recovery, and debugging representation, not a second
  competing database or synchronous dual-write target.
- JSONL export is generated from committed events. If local execution spools
  events before server acknowledgement, it uses an outbox with idempotent replay
  rather than directly maintaining a second journal.
- Every record carries stable event and tenant IDs, bot/session/project/run IDs
  where applicable, actor identity, event type and schema version, aggregate
  sequence, timestamp, causation/correlation IDs, idempotency key, and payload or
  content reference.
- Ordering is guaranteed per aggregate, not falsely claimed as one global total
  order. Clients must tolerate duplicates and reconnect gaps.
- Every session ends with a structured summary, decisions, open loops,
  artifacts, and memory-candidate references.
- Starting a new session loads the bot identity plus selected summaries and
  promoted memories, not the complete historical transcript.
- The UI supports chronological activity, session grouping, search, filters,
  collapse/expand, and deep links to an individual session.
- Large messages, artifacts, screenshots, recordings, and computer snapshots
  live in content-addressed blob/object storage with integrity hashes; event
  payloads hold references and redacted previews.
- Retention, legal hold, export, archive, and deletion semantics are explicit.
  Deleting a bot must define treatment of projections, blobs, credentials,
  child bots, shared projects, receipts, and immutable audit records.

### Minimum event envelope

```json
{
  "event_id": "evt_...",
  "tenant_id": "tenant_...",
  "aggregate_type": "bot",
  "aggregate_id": "bot_...",
  "aggregate_seq": 42,
  "bot_id": "bot_...",
  "session_id": "session_...",
  "project_id": null,
  "run_id": "run_...",
  "actor": { "type": "user", "id": "user_..." },
  "type": "message.created",
  "schema_version": 1,
  "occurred_at": "2026-08-16T00:00:00Z",
  "causation_id": "evt_...",
  "correlation_id": "corr_...",
  "idempotency_key": "...",
  "payload": {}
}
```

Event types are namespaced and versioned. Breaking payload changes produce a new
schema version plus deterministic upcasters. Projections store their last
applied aggregate sequence and rebuild deterministically.

### Context rules

1. Bot identity and policy are always loaded from canonical workspace files.
2. Current-session messages are loaded within the configured context budget.
3. Prior sessions enter context only through summaries, explicit user pinning,
   retrieval, or promoted memory.
4. Raw prior transcripts remain browsable but are not automatically injected.
5. Compaction writes a new summary event; it never destroys the raw event log.
6. Summaries are untrusted derived data: retain model, prompt/template version,
   source event range, token counts, and validation status.
7. Retrieval is tenant- and bot-scoped, permission-filtered, and logged. Content
   from connectors or other users cannot cross memory boundaries through search.
8. “Computer state” is a linked resource snapshot, not semantic memory. It has
   its own lifecycle, sensitivity, retention, and restore policy.

A bot session backed by Rails uses the existing WIH structure, which already has:
- `task_id` + `graph_id` → DAG reference
- `blocked_by` → dependency tracking  
- `preset` → tool/scope configuration
- `resume_cursor` → session continuation
- `outputs.required_artifacts` → deliverable expectations
- `write_scope` → what the bot can modify
- `tools.allowlist` → scoped tool access

### Bot Session View reads from WIH state:

```typescript
interface BotSessionViewState {
  botId: string;
  sessionId: string;

  // From WIH
  wih?: WIHRecord;
  dagNode?: DAGNode;
  
  // From Rails Runner
  loopProgress: LoopProgress;         // current iteration, spawn requests, escalation
  sessionStatus: SessionStatus;       // planning → executing → responding → etc.
  
  // From Agent Workspace
  contextSummary: ContextSummary;     // agent_name, role, focus, tasks, lessons
  artifacts: ArtifactRecord[];        // from .allternit/artifacts/<task_id>/
  
  // From Gate
  pendingApprovals: GateApproval[];   // lease requests, policy checks
  receipts: Receipt[];                // evidence from completed steps
}
```

### Required session APIs

- `GET /api/v1/bots/:botId/activity` — cursor-paginated unified activity.
- `GET /api/v1/bots/:botId/sessions` — session summaries and current status.
- `POST /api/v1/bots/:botId/sessions` — create a bounded session, optionally
  with a WIH atomically.
- `POST /api/v1/bots/:botId/sessions/:sessionId/compact` — seal summary and
  memory candidates.
- `GET /api/v1/bots/:botId/activity/export?format=jsonl` — durable portable
  export.

Every create/command endpoint requires tenant authorization, an idempotency key,
and an expected revision where concurrent mutation is possible. Pagination uses
opaque cursors. APIs must expose event-stream resume cursors and return a clear
resync response when retention has invalidated a cursor.

---

## 3. CommRails (Rails → CommRails Rename)

### UI layer rename only

The Rust crate `allternit-agent-system-rails` stays as-is. The rename is in the **UI surface layer**:

| Current UI Name | New Name | Where |
|---|---|---|
| `rail.config.tsx` sections | CommRails sections | `ui/shell/rail/` |
| ShellRail.tsx sessions section | CommRails panel | `ui/shell/ShellRail.tsx` |
| `ProjectRailSection` | `CommRailsProjectSection` | `ui/shell/rail/` |
| Rail config type `RailConfigSection` | `CommRailSection` | `rail.config.tsx` |

### CommRails Panel Structure:

```typescript
interface CommRailSection {
  id: string;
  title: string;
  icon?: Icon;
  type: 'bots' | 'groups' | 'sessions' | 'swarms';
  items: CommRailItem[];
  isDynamic?: boolean;
  collapsible?: boolean;
}

// Bots section: active bot sessions (from WIH state)
// Groups section: bot group chats (from Swarm + Bus)
// Sessions section: existing agent sessions (rebranded)
// Swarms section: active swarm orchestrations
```

---

## 4. Automation System = Goals / Routines / Loops (Production Ready)

Allternit already has a complete automation system with three entity types. This is the system CommRails should surface for bot session orchestration.

### Entity Types

```typescript
// From surfaces/ai.allternit.com/src/lib/agents/automation.types.ts

export type ScheduleType = 'cron' | 'interval' | 'once' | 'manual';
export type ExecutionDomain = 'local' | 'cloud';

export type GoalStatus = 'active' | 'completed' | 'paused' | 'archived';
export type GoalPriority = 'low' | 'medium' | 'high' | 'urgent';

export interface Goal {
  id: string;
  user_id: string;
  workspace_id?: string;
  agent_id?: string;
  title: string;
  description?: string;
  status: GoalStatus;
  priority: GoalPriority;
  target_date?: string;
  progress: number;  // 0-100
  metadata?: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface Routine {
  // ... all Goal fields plus:
  goal_id?: string;  // FK to goals
  gizzi_job_id?: string;
  name: string;
  schedule_type: ScheduleType;
  schedule_expression: string;  // cron expression or interval
  timezone?: string;
  execution_domain: ExecutionDomain;
  config: Record<string, unknown>;
  tags?: string[];
  max_runs?: number;
  timeout_seconds?: number;
  max_retries?: number;
}

export interface Loop {
  // ... all Routine fields plus:
  session_id?: string;  // session-scoped
  expires_at?: string;  // TTL
  // NOTE: Loop has NO timezone field
}
```

### Hierarchy

```
Goal (objective)
  ├── Routine (persistent scheduled job)
  ├── Routine
  └── Loop (session-scoped recurring job)
```

### REST API (Production)

All endpoints under `/api/v1/automation/`:

| Operation | Method | Path |
|---|---|---|
| List goals | GET | `/goals` |
| Create goal | POST | `/goals` |
| Get goal with children | GET | `/goals/:id/children` |
| List routines | GET | `/routines` |
| Create routine | POST | `/routines` |
| Run routine now | POST | `/routines/:id/run` |
| List routine runs | GET | `/routines/:id/runs` |
| List loops | GET | `/loops` |
| Create loop | POST | `/loops` |
| Run loop | POST | `/loops/:id/run` |

### Execution Engines

**GoalEngine** (`cmd/gizzi-code/src/runtime/automation/goal-engine.ts`):
- States: `planning` → `in_progress` → `paused`/`blocked`/`completed`/`cancelled`
- Budget enforcement (turn, token, wall-clock)
- Milestone and validation tracking
- Blocked audit (3 consecutive turns with same blocker)
- Queue support (auto-promote when active goal completes)

**RoutineEngine** (`cmd/gizzi-code/src/runtime/automation/routine-engine.ts`):
- Runs sequential shell steps
- Step states: `pending` → `running` → `done` | `failed`
- Overall: `running` → `completed` | `failed`

**LoopEngine** (`cmd/gizzi-code/src/runtime/automation/loop-engine.ts`):
- Spawns shell command in a loop
- Iterates up to `max_iterations`
- Checks `exit_condition` (exit_code_zero or text-match)
- States: `running` → `succeeded` | `max_iterations`

### UI Integration

Bot sessions should surface automation state:

```typescript
interface BotSessionAutomationState {
  // Goal this bot session is working toward
  activeGoal?: Goal;
  
  // Routines the bot has created or is running
  routines: Routine[];
  
  // Session-scoped loops
  loops: Loop[];
  
  // Recent routine runs
  recentRuns: RoutineRun[];
}
```

**CommRails Rail Section** should show:
- Active goals with progress bars
- Running routines with next-run time
- Active loops with iteration count
- "Create Routine" / "Create Loop" quick actions

**Bot Session View** should show:
- Current goal progress (if linked to a goal)
- Routine schedule (if this is a scheduled bot)
- Loop iteration progress (if running a loop)
- Automation controls (pause/resume/cancel)

---

## 5. Bot Group Chat = Bus + Swarm

### Existing infrastructure:

- **Rails Bus**: Durable SQLite queue (`bus send/poll/deliver`), tmux/socket transports
- **AgentSwarm**: `communication.pattern: 'broadcast' | 'direct' | 'mailbox' | 'shared-memory'`
- **Swarm roles**: leader, worker, critic, planner, specialist, observer
- **Consensus threshold**: `consensusThreshold: 0-1` for voting
- **swarm-as-agent**: Swarms already appear as @-mentionable agents

### Bot group chat UX:

```
┌──────────── Group: Research Team ─────────────────┐
│                                                    │
│  [Bot A: Deep Researcher]                          │
│  "I've found 12 papers on agent memory..."         │
│                                                    │
│  [Bot B: Data Analyst]                             │
│  "The top 3 approaches score as follows..."        │
│                                                    │
│  [Bot C: Writing Partner]                          │
│  "Here's a draft synthesizing both analyses..."    │
│                                                    │
│  [System] Swarm consensus: 0.85 (threshold: 0.7)  │
│  Leader (Deep Researcher) delegates summary to     │
│  Writing Partner                                   │
│                                                    │
│  ┌────────────────────────────────────┐            │
│  │ @mention bot... or type a message  │            │
│  └────────────────────────────────────┘            │
└────────────────────────────────────────────────────┘
```

### Creating a bot group:

```typescript
interface BotGroup {
  id: string;
  name: string;
  members: { botId: string; role: SwarmRole; weight: number }[];
  strategy: SwarmStrategy;
  consensusThreshold: number;
  communication: SwarmCommunication;
  // Maps directly to AgentSwarm
}
```

---

## 6. @ Mentions for Bots

### Extend `use-mention-targets.ts`:

```typescript
export type MentionTargetKind = 'plugin' | 'connector' | 'bot' | 'group' | 'skill';

export interface BotMentionTarget {
  kind: 'bot';
  id: string;
  name: string;
  description?: string;
  accentColor?: string;
  status: 'idle' | 'busy' | 'offline';
}

// Add to usePluginMentionTargets() → rename to useMentionTargets():
const bots = useAgentStore((s) => s.agents.filter(a => a.isBot));
const botTargets: BotMentionTarget[] = bots.map(b => ({
  kind: 'bot',
  id: b.id,
  name: b.botProfile?.displayName ?? b.name,
  description: b.description,
  accentColor: b.botProfile?.accentColor,
  status: b.teammateProfile?.status ?? 'idle',
}));
```

### `!` mention for tagging:

The `!` prefix in the composer triggers the existing tagging system:
- `!urgent` → marks message as high priority
- `!review` → triggers a Gate review step
- `!delegate` → creates a Bus message to the @-mentioned bot
- `!escalate` → triggers `RailsLoopIterationEscalated`

---

## 7. CommRails Rail Section in ShellRail

### Updated `rail.config.tsx`:

```typescript
export const COMMRAILS_CONFIG: CommRailSection[] = [
  {
    id: 'bots',
    title: 'Bots',
    icon: Robot,
    type: 'bots',
    isDynamic: true,
    collapsible: true,
    items: [], // Populated from WIH state where bot session is active
  },
  {
    id: 'groups',
    title: 'Group Chats',
    icon: UsersThree,
    type: 'groups',
    isDynamic: true,
    collapsible: true,
    items: [], // Populated from active swarms
  },
  {
    id: 'sessions',
    title: 'Sessions',
    icon: ChatTeardropText,
    type: 'sessions',
    isDynamic: true,
    defaultExpanded: true,
    collapsible: true,
    items: [], // Existing dynamic sessions
  },
];
```

### Bot rail item rendering:

```typescript
// Each bot in the rail shows:
// - Bot avatar (from characterLayer.avatar or mascotTemplate)
// - Bot name
// - Current WIH status indicator (idle/running/blocked/complete)
// - Unread badge (from Bus message count)
// - Right-click: Start Session, Add to Group, Settings, Archive
```

---

## 8. BotSessionView Component Tree

```
BotSessionView
├── BotHeader
│   ├── Bot avatar + name + status
│   ├── WIH progress indicator (from Ralph loop state)
│   ├── Gate status (leases held, pending approvals)
│   └── Actions: Settings, Group, Archive, Share
│
├── BotWelcomeCard (shown when idle / no WIH)
│   ├── Bot identity card (name, tagline, description)
│   ├── Character layer preview (voice, temperament, specialties)
│   ├── Starter prompts (clickable)
│   └── "Start Task" button → creates WIH
│
├── WIHProgressPanel (when session is active)
│   ├── Phase indicator: Plan → Execute → Review → Deliver
│   ├── Current iteration info (from LoopProgress)
│   ├── Active tool calls (activity chips)
│   └── Blocked-by dependencies (from DAG)
│
├── ChatThread (main conversation)
│   ├── Messages (user + bot + system events)
│   ├── Tool call renders (with expandable details)
│   ├── Gate review cards (inline approval UI)
│   ├── Escalation cards (bot asking for input)
│   └── Spawn notifications (sub-agent delegation)
│
├── GateReviewPanel (when approval needed)
│   ├── What the bot wants to do
│   ├── Policy context (why approval is needed)
│   ├── [Allow once] [Always allow] [Deny]
│   └── Lease/receipt details (expandable)
│
├── DeliverableArtifacts (collapsible panel)
│   ├── Artifact list from .allternit/artifacts/<task_id>/
│   ├── Preview (markdown, code, image)
│   ├── Download/export buttons
│   └── Receipt references (provenance trail)
│
└── BotComposer
    ├── Textarea with @ mention picker (bots, plugins, connectors)
    ├── ! tag picker (urgent, review, delegate, escalate)
    ├── / command picker (skills)
    ├── Send button
    └── Stop button (when executing)
```

---

## 9. Agent PillTab → Bot Sessions Rebrand

The existing agent session infrastructure maps directly:

| Current | Rebranded As | Notes |
|---|---|---|
| `AgentSessionMode` ('chat', 'cowork', 'code', 'browser', 'design') | Keep as-is | Modes stay; bots use these modes |
| `ChatModeAgentSession` | `BotSessionChat` | Add bot header + WIH progress |
| `AgentSessionLayout` | Keep | Reuse glass morphism + split pane |
| `ModeSession` | Keep | Reuse for bot session state |
| `chat-agent-session` ViewType | Add `bot-session` ViewType | Bot-specific wrapper |
| Agent pill tab in ShellRail | CommRails Bots section | Dynamic section with bot sessions |

---

## 10. Product Alignment Requirements

These requirements turn the reference-project comparison into explicit Allternit
work. A feature is not considered present merely because a type, route, or
component exists; it must work end to end from a supported surface.

### 10.1 Named bot roster and overview

The simple Bots home is the entry point. It shows every installed or created bot
with avatar, status, current activity, most recent session, next routine, pending
approval, computer state, and unread count. It must answer “what are my bots
doing?” without opening each bot.

Selecting a bot opens its richer packaged Bot Home rather than replacing the
existing dashboard. The Bot Home progressively exposes Sessions, Memory,
Routines, Apps, Computer, Tools, Children, Activity, and Settings.

Acceptance criteria:

- Search, filter, sort, pin, archive, and status filtering work against real data.
- Live state comes from canonical events, not mock timers or random status.
- A user can start a new bounded session directly from a roster card.
- Web, desktop, and mobile render the same bot identity and status semantics.
- Roster status is a server-owned projection with `observed_at` and freshness;
  clients never infer “working” from stale local sessions.
- Clicking a bot opens Bot Home. “Inbox,” “New task,” “New project,” and
  “Continue session” are explicit commands; no command accidentally reuses an
  arbitrary matching session.

The Inbox is a permanent channel, not a permanent model context. It rolls into
bounded backing sessions using the same summary/compaction policy. `@mention`
records participant and routing events in the current session; it does not
silently merge histories.

Projects are first-class server resources with ownership, membership, archival,
and deletion rules. A `project_id` metadata string in a local chat store is not
sufficient.

### 10.2 Canonical personality workspace

Agent Hub selections must write to the canonical personality workspace files,
and the runtime must read those same files. JSON configuration may index or cache
the values, but it cannot become a divergent source of truth.

Required mapping:

| Product field | Canonical artifact |
|---|---|
| Purpose and operating instructions | `AGENTS.md` / role document |
| Personality and voice | `SOUL.md` |
| Human relationship and preferences | `USER.md` |
| Hard bans, trust, and escalation | governance/policy document |
| Skills and tool access | skills manifest + tool policy |
| Scheduled behavior | `HEARTBEAT.md` plus automation records |
| Long-term learned facts | memory store, with provenance |

Acceptance criteria:

- Create, edit, import, and duplicate use one serializer/deserializer.
- Editing in Agent Hub updates files atomically and refreshes runtime context.
- Direct file edits are reflected back in the UI after reload.
- Character sliders either deterministically generate `SOUL.md` content or are
  removed; no decorative personality settings remain.
- Every workspace revision is immutable/addressed by hash, records its schema
  and generator version, and can be diffed or rolled back.
- Writes use compare-and-swap against the expected revision so simultaneous
  web/desktop edits cannot silently overwrite each other.
- A session pins the identity revision it loaded. Mid-run edits apply only at a
  declared rehydration boundary and emit an event.
- Markdown is parsed as data with bounded templates. Imported content cannot
  smuggle tool entitlements or override higher-priority governance policy.

`TOOLS.md` describes guidance; the server-side registry, lease, and policy
engine remain the authority for actual entitlement. `HEARTBEAT.md` may describe
intent, but automation records remain authoritative for scheduling.

### 10.3 Complete bot duplication

Duplication becomes a backend transaction with a preview and selectable scope:

- Always copy identity, model settings, personality, tools, skills, policies,
  and packaged-bot metadata.
- Optionally copy memory, routines, workspace documents, computer template or
  volume snapshot, and child-bot topology.
- Copy connector bindings by reference only after authorization; never duplicate
  raw secrets.
- Never copy active leases, pending approvals, running jobs, receipt identities,
  or session IDs.
- Emit a duplication receipt mapping source IDs to destination IDs.

### 10.4 Isolated memory with durable continuity

Each bot receives a memory namespace. Each session receives a subordinate scope.
Session compaction proposes memory candidates; policy or user review promotes
them into bot memory. Retrieval must record which memories entered a run and
why. Duplication and export must clearly distinguish raw history, summaries, and
promoted memory.

### 10.5 Routines and automation verification

Allternit's Goal/Routine/Loop system remains canonical. The gap is proof and
coherent bot ownership.

Acceptance criteria:

- Create, edit, pause, resume, run-now, retry, and delete work from Bot Home.
- Every routine is bound to a bot and creates a normal session/run in its
  activity stream.
- Next-run time, timezone, last result, retry state, and output are visible.
- Unattended actions apply the same connector, tool, and approval policy as chat.
- Local and cloud execution survive app restarts according to documented
  availability guarantees.
- The automated run pins the same bot/profile revision and records any intended
  override. “Latest configuration” is not resolved differently across workers.
- Misfires, daylight-saving transitions, duplicate delivery, overlapping runs,
  concurrency limits, cancellation, and scheduler failover have defined policy.
- Routine cloning defaults to disabled and requires reauthorization for actions
  with external side effects.

### 10.6 Connected applications verification

Do not assume connectors work because catalogs and binding types exist. Create a
provider conformance suite covering discovery, OAuth or credential setup,
binding to a bot, allowed-action enforcement, token refresh, revoke, tool
execution, approval, error recovery, and audit receipts.

**P0 security correction:** decrypted connector tokens and secrets must never be
returned to the browser, persisted in Zustand/chat session metadata, logged, or
included in bot context. The current prototype resolution flow does this and
must be replaced. The browser receives only connection health, capability IDs,
and opaque references. Connector calls execute in a trusted server/sidecar using
short-lived, audience-bound capability grants and server-side credential lookup.
Tool results pass through size limits, content sanitization, and secret
redaction before entering transcripts or events.

Initial golden-path providers: Gmail, Slack, GitHub, Notion, Calendar, and one
generic MCP connector. Bot Home must show connection health and the exact actions
the bot may take.

Certification also covers least-privilege scopes, account/tenant binding,
refresh-token rotation, webhook authenticity and replay protection, provider
rate limits, pagination, retries, idempotent writes, revoke propagation, and
provider outage behavior. A connector is read-only by default until individual
mutating actions are explicitly granted.

### 10.7 Dedicated computer and sandbox coherence

Adopt the clearest ideas from Rakazo and OpenMausBot while retaining Allternit's
provider architecture:

- One default computer attachment per bot, with optional additional computers.
- Local, Docker, OpenSandbox, Kubernetes, and supported cloud providers behind
  one lifecycle contract.
- Persistent browser profile and filesystem policy are explicit.
- Watch, take control, return control, restart, reset, snapshot, and destroy are
  standard actions.
- Computer status and screen preview live inside Bot Home and the active session.
- Direct-host execution carries a strong isolation warning and is unavailable in
  shared/multi-user deployments unless policy explicitly permits it.
- Browser use and full desktop control are separate capabilities with separate
  permissions.
- “This Mac” never activates as fallback when isolation provisioning fails.
- Computer attachment and execution lease are separate: one bot may own a
  durable computer, but only authorized runs hold control at a given time.
- Define concurrent-session arbitration, idle suspend, cost/budget ceilings,
  backup, encryption, region, data residency, credential isolation, and secure
  destruction.
- Snapshots are sensitive artifacts. They exclude ephemeral secrets where
  possible and have explicit encryption, access, retention, and restore tests.
- Host/desktop control requires OS-level permission onboarding, visible active
  control, emergency stop, and revocation that interrupts an in-flight run.

### 10.8 Child bots and subagents

Expose two distinct operations:

- **Create child bot:** persistent identity, memory, sessions, tools, computer,
  and roster presence; linked to its parent.
- **Run subagent:** temporary execution within a parent session; bounded scope,
  budget, tools, and lifetime; results fold back into the parent session.

Both paths must enforce leases and tool policy, emit spawn/completion receipts,
and appear in the activity stream. Tests must cover cancellation, failure,
orphan recovery, recursion limits, and budget propagation.

Promotion of a temporary subagent into a child bot is a reviewed clone/import
operation. It cannot inherit transient credentials, leases, hidden chain-of-
thought, or unrestricted parent permissions. Shared artifacts and memories are
copied or referenced according to an explicit ownership policy.

### 10.9 Cross-surface consistency

Define a shared Bot API/client contract consumed by web, desktop, and mobile.
Surface-specific layouts may differ; identity, sessions, status, memory,
routines, connector health, approvals, and computer lifecycle semantics may not.

Create a parity matrix for every capability with four states: supported,
read-only, intentionally unavailable, or gap. Desktop-only OS control and mobile
takeover limitations must be explicit rather than silently missing.

Offline desktop support is staged rather than assumed. Phase A provides cached
read-only history plus a transactional outbox for new user messages/commands.
Later phases may add offline edits only after conflict policy exists for bot
profile revisions, project membership, routine changes, and deletion. Do not
introduce a general bidirectional replica or CRDT without a concrete requirement.

### 10.10 Shipping and installation

Shipping is a product workstream, not a final packaging task:

- First-run setup detects runtimes, models, local computer permissions, sandbox
  providers, and connector prerequisites.
- Provide signed/notarized desktop artifacts, web deployment guidance, mobile
  distribution, update/rollback, data migration, backup/restore, and uninstall.
- Include starter bots that work with minimal setup and degrade honestly when a
  provider is unavailable.
- Add diagnostics export with secrets redacted.
- Maintain an upgrade compatibility contract for bot profiles, sessions,
  workspace files, memory, and computer state.
- Define required versus optional services. Optional voice, computer, connector,
  or model services fail independently and do not prevent the core app from
  launching.
- Installers verify signatures, provenance, architecture, disk prerequisites,
  ports, service health, and rollback compatibility. Updates use staged rollout
  and preserve a recoverable data snapshot before migration.
- Consumer mode requires no terminal. Developer/self-host mode may expose
  detailed diagnostics without weakening consumer defaults.

### 10.11 Privacy, tenancy, and lifecycle

- Every bot, event, memory, project, artifact, connector, routine, and computer
  is tenant-owned and authorization-checked server-side.
- Sharing a bot does not automatically share its private memory, history,
  credentials, computer, or child bots.
- Export/import has a versioned manifest, integrity hashes, collision handling,
  and a secret-free default.
- Retention and deletion cover derived indexes, embeddings, summaries, caches,
  offline replicas, backups, blobs, and provider webhooks—not only primary rows.
- Sensitive event payloads have field-level redaction and access classes;
  operational telemetry uses identifiers rather than message contents.

### 10.12 Reliability and observability

- Commands use idempotency keys and transactional outbox/inbox processing.
- Background workers expose queue lag, retries, dead letters, lease expiry,
  projection lag, event-stream disconnects, provider errors, and cost usage.
- User-visible state distinguishes queued, running, waiting, blocked, offline,
  stale, cancelled, failed, and completed; “idle” is not a catch-all.
- Recovery drills cover database restore, projection rebuild, blob loss,
  scheduler failover, connector revocation, computer-provider outage, and client
  reconnect after missed events.
- SLOs are defined for message acknowledgement, session start, routine dispatch,
  connector actions, approval delivery, and computer provisioning.

---

## 11. Initial UI File Manifest

This manifest covers the original Phase 2 UI slice. The v3 program intentionally
does not claim a final backend/mobile/desktop file list until Wave 0 completes
the reality audit and freezes the shared contracts.

### New Files (8)

| File | Description |
|---|---|
| `src/lib/bots/bot-profile.ts` | BotProfile type + bot template factory functions |
| `src/views/bots/BotSessionView.tsx` | Main bot session container (WIH-aware) |
| `src/views/bots/BotWelcomeCard.tsx` | Bot identity + starter prompts card |
| `src/views/bots/WIHProgressPanel.tsx` | Ralph loop phase indicator + tool activity |
| `src/views/bots/GateReviewPanel.tsx` | Approval gate UI (allow/deny/always) |
| `src/views/bots/BotGroupChatView.tsx` | Multi-bot group chat with swarm consensus |
| `src/views/bots/BotComposer.tsx` | Composer with @/!/ mention pickers |
| `src/views/bots/DeliverableArtifacts.tsx` | Artifact panel from .allternit/artifacts/ |

### Modified Files (12)

| File | Change |
|---|---|
| `agent.types.ts` | Add `isBot`, `BotProfile` to Agent interface |
| `bots.manifest.ts` | Convert to Agent template factories |
| `bots.types.ts` | Extend with BotProfile, remove PackagedBot duplication |
| `useBotSession.ts` | Wire to WIH creation via Rails CLI / API |
| `use-mention-targets.ts` | Add bot + group mention targets |
| `nav.types.ts` | Add `bot-session`, `bot-group` ViewTypes |
| `nav.policy.ts` | Add spawn policies for bot view types |
| `ViewRegistry.tsx` | Register BotSessionView, BotGroupChatView |
| `rail.config.tsx` | Add CommRails sections (bots, groups) |
| `ShellRail.tsx` | Wire CommRails dynamic sections |
| `session-metadata.ts` | Add 'bots' to readSurface |
| `AgentHubBotsTab.tsx` | Update to use Agent templates + create WIH on launch |

**Initial UI estimate: 8 new files, 12 modified files.** Wave 0 must replace
this estimate with workstream-specific manifests before implementation begins.

---

## 12. Implementation Program

Each wave ends with an end-to-end evidence report. Unit presence or static UI is
not sufficient for completion.

### Wave 0: Reality audit and contracts

1. Inventory every existing bot, session, automation, connector, memory,
   computer, child-agent, and surface path.
2. Mark each capability implemented, partial, disconnected, duplicated, or mock.
3. Freeze canonical `BotProfile`, `BotActivityEvent`, `BotSessionSummary`, and
   computer-provider contracts.
4. Decide migration and compatibility rules before changing persisted state.
5. Reconcile the uncommitted shared-checkout Bot Home/session prototype with the
   clean feature branch; identify authoritative owners and do not copy dirty
   files blindly.
6. Threat-model bot history, memory retrieval, connector execution, browser
   control, computer snapshots, duplication, sharing, and child-agent promotion.
7. Choose event append authority, projection model, blob store, tenant boundary,
   retention policy, and offline scope. Document failure and rebuild semantics.

Exit gate: reviewed contracts, source-of-truth map, parity baseline, and no
unresolved competing stores. The security review blocks implementation if
decrypted credentials can reach browser state or model context.

### Wave 1: Canonical bot and personality

1. Merge packaged bots into canonical Agents plus `BotProfile`.
2. Implement the workspace personality serializer/deserializer.
3. Make create/edit/import use it.
4. Implement complete duplication with receipts and selectable scopes.
5. Add revision hashes, compare-and-swap writes, migration/upcasting, diff, and
   rollback for personality workspaces.

Exit gate: two meaningfully different bots retain identity across restart; direct
workspace edits round-trip to UI; a duplicate passes a field-by-field audit.

### Wave 2: Durable activity and bounded sessions

1. Add bot activity and session APIs over the canonical ledger/event store.
2. Add session summaries, context selection, memory candidates, and JSONL export.
3. Build Bot Home session list plus unified activity timeline.
4. Wire each WIH, routine run, delegation, artifact, and approval to the stream.
5. Add idempotent append/outbox processing, versioned events, projection rebuild,
   tenant authorization, retention/deletion, and content-addressed blobs.
6. Implement Inbox as a durable channel over bounded sessions, not an unbounded
   transcript context.

Exit gate: a bot completes multiple sessions without transcript leakage, can
search its full history, and starts a new session from selected summaries only.

### Wave 3: Simple roster and progressive Bot Home

1. Build the live named-bot overview.
2. Build simple Bot Home defaults and preserve the existing packaged dashboard
   behind progressive disclosure.
3. Add inline questions, approvals, tool activity, artifacts, and session status.
4. Add responsive web/desktop/mobile layouts against the shared contract.

Exit gate: a new user can identify what every bot is doing and start or resume
work without entering Agent Studio.

### Wave 4: Automation and connectors

1. Bind goals, routines, and loops to bots and activity sessions.
2. Complete the automation lifecycle UI and restart/recovery semantics.
3. Replace client-side credential resolution with server-side scoped connector
   execution before enabling provider actions.
4. Run connector conformance against the golden providers.
5. Add Bot Home binding, health, action scopes, revoke, and approval UX.
6. Verify automation identity parity using a pinned bot/profile revision and the
   same server-side connector/tool policy as interactive work.

Exit gate: a scheduled Gmail/Calendar or GitHub task executes with the correct
bot identity, policy, persisted result, receipt, and recovery behavior.

### Wave 5: Computers and sandbox providers

1. Normalize provider lifecycle and capability discovery.
2. Attach a default computer to the bot and expose watch/takeover/reset.
3. Implement persistent browser/file policy and explicit browser-versus-desktop
   permissions.
4. Add provider conformance for local, Docker, OpenSandbox, and the selected
   cloud provider before expanding the matrix.

Exit gate: the same bot task can run against two providers with equivalent
lifecycle events, policy enforcement, and visible recovery.

### Wave 6: Child bots, subagents, and groups

1. Implement the persistent child-bot flow.
2. Implement bounded temporary subagents.
3. Normalize delegation events and parent result folding.
4. Add group chat only after single-parent delegation passes reliability tests.

Exit gate: persistence, cancellation, recursion, orphan recovery, budget, and
tool-scope tests pass for both child types.

### Wave 7: Parity, shipping, and installation

1. Close or explicitly classify every web/desktop/mobile parity gap.
2. Implement first-run diagnostics and permission onboarding.
3. Validate install, update, rollback, backup, restore, migration, and uninstall.
4. Ship starter bots and a redacted support bundle.
5. Run retention/deletion, offline outbox, backup/restore, projection rebuild,
   optional-service failure, and provider-outage drills.

Exit gate: clean-machine journeys pass for supported distribution targets and an
existing user can upgrade and roll back without losing bot state.

---

## 13. Open Questions

### Q1: WIH creation API
How should the frontend create a WIH? Options:
- **A)** Call `rails` CLI via HTTP API (`POST /api/rails/wih/create`)
- **B)** Write WIH JSON directly to `.allternit/wih/` via agent workspace API
- **C)** Extend `allternitAiSessionApi.createSession()` to also create a WIH
- **Recommendation:** Option C — extend the existing session API with an optional `wih` parameter. The backend creates both the session AND the WIH atomically.

### Q2: Ralph loop ↔ UI communication
How does the Rails runner's iteration state reach the React frontend?
- **A)** WebSocket from Rails runner → frontend
- **B)** SSE stream from Rails events → frontend fold
- **C)** Poll `.allternit/ledger/events/` via agent workspace API
- **Recommendation:** Option B — SSE. Allternit already has `subscribeSSE` in `mode-session-store.ts`. The Ralph loop events are already on the ledger. Add an SSE endpoint that filters for `RailsLoopIteration*` events.

### Q3: CommRails naming scope
Should "CommRails" be used everywhere in the UI, or just for the rail section?
- **Recommendation:** CommRails for the **entire orchestration surface** in the UI (rail, panels, commands). The Rust crate stays `allternit-agent-system-rails`. This creates a clean boundary: "Rails" = infrastructure, "CommRails" = user-facing orchestration.

### Q4: Bot persistence
Where do bot configurations live?
- **A)** In the Agent store (existing `useAgentStore`)
- **B)** Separate `useBotStore` (Phase 1 approach)
- **Recommendation:** Option A — bots ARE agents. The `isBot` flag + `botProfile` on the Agent type means the existing agent store handles everything. No store duplication.

### Q5: First supported cloud computer provider

Which cloud provider should join local, Docker, and OpenSandbox in the Wave 5
golden path? The provider is selected during Wave 0 based on current working
integration, lifecycle coverage, security posture, and distribution constraints.
The `HarnessConfig.mode: 'cloud'` type alone does not count as provider support.

### Q6: Event append authority and database strategy

Which service exclusively accepts canonical bot commands and appends events?
SQLite may remain the single-user/local backend and Postgres the hosted backend,
but they must implement one contract and conformance suite. JSONL remains an
export/spool format. Resolve this before introducing synchronization.

### Q7: Inbox rollover policy

The Inbox is permanent as a user-facing channel but its backing model contexts
are bounded. Wave 0 must choose rollover triggers (token budget, task boundary,
time, explicit user action), summary review behavior, and how a user reopens raw
history without reinjecting it.

### Q8: Canonical workspace vocabulary

Existing code references `VOICE.md` and `POLICY.md`, while proposed product
language also introduces `STYLE.md` and broader governance documents. Do not add
near-duplicate files. Inventory actual runtime readers, select one schema, and
migrate old workspaces with versioned adapters.

### Q9: Project ownership and sharing

Are projects private to one bot, owned by the user/workspace with many bot
participants, or both? Recommendation: projects are workspace-owned containers;
bots participate through explicit grants. This avoids duplicating project state
when tasks move between bots.

---

## 14. Comparison: Original Plan vs Product-Aligned Plan

| Aspect | Original Plan (v1) | Product-aligned plan (v3) |
|---|---|---|
| Bot type | New `PackagedBot` interface | Reuse `Agent` + `BotProfile` extension |
| Bot store | New `useBotStore` (Zustand) | Reuse `useAgentStore` (existing) |
| History | One conversation/session | Durable bot event stream partitioned into bounded sessions |
| Context | Implicit thread history | Current session + selected summaries + promoted memory |
| Personality | Metadata/config | Canonical workspace files with round-trip UI synchronization |
| Duplication | Not specified | Transactional, selectable scope, secret-safe, receipted |
| Credentials | Not specified | Server-side execution only; no decrypted values in browser/session state |
| Consensus loop | New client-side state machine | Ralph loop (Rails Runner) |
| Approval gates | New `ConsensusReviewGate` component | `GateReviewPanel` reading from Gate events |
| Session state | New `ConsensusPhase` enum | `SessionStatus` + `LoopProgress` (existing) |
| Deliverables | New `BotDeliverable` type | `.allternit/artifacts/` + `Receipt` records |
| Group chat | Not planned | Bus + Swarm (existing infrastructure) |
| @ mentions | Not planned | Extend `use-mention-targets.ts` |
| ! tags | Not planned | Extend existing tagging system |
| Rail section | New "Bots" section | CommRails: Bots + Groups + Sessions + Swarms |
| Bot home | Session-first view | Simple live overview plus progressively disclosed packaged Bot Home |
| Computers | Deferred cloud VM | Standard provider lifecycle with bot-owned computer UX |
| Verification | Component completion | End-to-end exit gates and provider conformance |
| Distribution | Not included | Installation, updates, migration, backup, rollback, and uninstall |
| Offline | Not included | Read cache + transactional outbox first; broader sync only with conflict policy |
| Lifecycle | Not included | Tenant authorization, retention, export, deletion, rebuild, and disaster recovery |
| Infrastructure | All client-side | Rails (Rust) + client-side UI |
| File estimate | 6 new / 10 modified | Wave 0 produces authoritative manifests; initial UI slice is 8 / 12 |

**Key difference:** v1 builds a parallel system. v3 merges into the existing
system while defining a coherent consumer product and requiring proof that every
claimed capability works end to end.
