# Open-Source Cowork Research for Portability

> Research conducted: 2026-04-18
> Goal: Find patterns from open-source cowork solutions that solve Allternit's gaps

---

## Candidate Projects Analyzed

### 1. Eigent (eigent-ai/eigent) — Best Overall Match
**License:** Apache 2.0  
**Stack:** FastAPI + PostgreSQL + Docker + CAMEL-AI  
**Why it matters:** Explicitly marketed as "Open Source Cowork Desktop"

**Patterns to port:**
- **Multi-agent workforce architecture:** Root coordinator + specialized workers (developer, browser, document, multimodal) executing in parallel
- **Task queue with atomic claiming:** Agents poll a queue, claim tasks exclusively, execute, report results
- **200+ MCP tools integration:** Tools run as separate processes communicating via JSON-RPC
- **Human-in-the-loop approval gates:** Per-action risk scopes with explicit approve/deny
- **Audit trail:** Every agent action logged with reasoning, timestamp, result
- **Local-first stack:** FastAPI backend + local DB, all reasoning stays on machine

**What we can port to Allternit:**
- Task queue table + atomic claim pattern → `task_queue` in SQLite
- Agent worker polling loop → cron executor extension
- Approval gate pattern → extend existing `approval_requests` table
- Audit trail → extend existing `events` table (append-only ledger already exists!)

---

### 2. Relay (SeventeenLabs/relay) — Best for Approval/Compliance
**License:** Open source  
**Stack:** OpenClaw-based  
**Why it matters:** Explicitly built as "open-source Claude Cowork for OpenClaw"

**Patterns to port:**
- **Approval gates with risk scopes:** Every action classified by risk level; human must approve high-risk actions
- **Compliance-ready audit trail:** Exportable logs of every action, reasoning, timestamp
- **Self-hosted runtime:** All data stays on your infrastructure
- **Sub-agents / multi-agent:** Lead agent coordinates sub-agents for parallel work

**What we can port to Allternit:**
- Risk-scoped approval gates → extend existing approval system with `risk_level` field
- Exportable audit trail → use existing `events` append-only table
- Multi-agent coordination → agent task queue with parent/child relationships

---

### 3. OpenWork (different-ai/openwork) — Best for Local-First
**License:** Open source  
**Stack:** Local-first desktop app  
**Why it matters:** "Open-source alternative to Claude Cowork/Codex"

**Patterns to port:**
- **Local-first, cloud-ready:** SQLite locally, opt-in cloud sync
- **Composable architecture:** Desktop app + Slack/Telegram connector + server; use what fits
- **Skill plugins:** Installable modules for workflows
- **Auditable:** Show what happened, when, and why

**What we can port to Allternit:**
- Local-first with opt-in sync → keep Zustand localStorage as cache, API as source of truth
- Plugin skill system → extend existing marketplace plugin architecture
- Audit log → existing `events` table is already append-only

---

### 4. SuperAGI — Best for Agent Task Queue
**License:** Open source  
**Stack:** Python + LLM-agnostic  
**Why it matters:** Enterprise-grade agent orchestration with task queues

**Patterns to port:**
- **Task orchestration layer:** Pre-defined ReAct sequences for agent workflows
- **Event-driven architecture:** Agents communicate via events, not direct calls
- **Built-in telemetry, session logs, task-level reporting:** Compliance must-haves
- **Memory sharing between agents:** Vector DB (Pinecone/Weaviate) for long-term memory
- **Retry logic and failure logging:** Task manager handles failures gracefully

**What we can port to Allternit:**
- Task queue with retry logic → SQLite `task_queue` table with `retry_count`, `error` fields
- Event-driven agent communication → extend existing `events` table
- Session logs → existing `events` table + `attachments` table

---

### 5. MetaGPT — Best for Multi-Agent Role System
**License:** Open source  
**Stack:** Python  
**Why it matters:** Role-based multi-agent with publish/subscribe message bus

**Patterns to port:**
- **Role-based pipeline:** Product manager → Architect → Project manager → Engineer
- **Publish/subscribe message bus:** Agents communicate via events, decoupled
- **SOP-driven handoff:** Standard Operating Procedures define how agents hand off work
- **Code review between agents:** One agent reviews another's output

**What we can port to Allternit:**
- Role-based task assignment → `assignee_type` + `agent_role` fields on tasks
- Pub/sub message bus → existing `tokio::sync::broadcast` channel
- SOP handoff → task dependencies + status transitions

---

### 6. Plane / Focalboard — Best for Real-Time Task Board
**License:** MIT (Focalboard), Apache 2.0 (Plane)  
**Stack:** Go/React (Plane), Go/React (Focalboard)  
**Why it matters:** Production task boards with real-time sync

**Patterns to port:**
- **Real-time collaboration via WebSockets:** Team members see updates instantly
- **Comments with @mentions:** Rich commenting system
- **Activity feed:** Who changed what when
- **Custom properties:** Flexible task fields

**What we can port to Allternit:**
- Real-time updates via SSE (already have SSE infra!) → extend existing `run_ws.rs` pattern
- Comments table → `task_comments` in SQLite
- Activity feed → query `events` table

---

## Key Insight: Allternit Already Has 70% of the Infrastructure

| Needed Feature | Open-Source Solution | Allternit Already Has |
|----------------|---------------------|----------------------|
| Task board UI | Plane / Focalboard | ✅ `TasksView.tsx` (Kanban) |
| Scheduling algorithm | Taskdog (ported) | ✅ `IntelliScheduleEngine.ts` |
| Append-only event log | SuperAGI / Relay | ✅ `events` table |
| Approval gates | Relay / Eigent | ✅ `approval_requests` table |
| Run lifecycle API | Eigent | ✅ `/api/v1/runs` |
| Cron executor | SuperAGI | ✅ `cowork-executor.ts` |
| Auth middleware | Eigent | ✅ `auth/middleware.rs` |
| Permission enums | Eigent | ✅ `auth/permissions.rs` |
| SSE streaming | Focalboard (WS) | ✅ `run_ws.rs` (SSE) |
| Tenant isolation fields | Eigent | ✅ `tenant_id` in DB |
| **Task CRUD API** | Plane | ❌ **MISSING** |
| **Task comments** | Plane / Focalboard | ❌ **MISSING** |
| **Real-time task sync** | Plane / Focalboard | ❌ **MISSING** |
| **Agent task queue** | SuperAGI / MetaGPT | ❌ **MISSING** |
| **Tenant enforcement** | Eigent | ❌ **MISSING** |

---

## Portability Strategy

We don't need to port entire projects. We need to port **patterns** from these projects into Allternit's existing infrastructure:

1. **Task DB schema** → Inspired by Plane's `issues` table + Focalboard's `blocks` table
2. **Task API** → Inspired by Eigent's FastAPI patterns, but using Rust Axum (existing stack)
3. **Task queue** → Inspired by SuperAGI's orchestrator, but using existing SQLite + cron executor
4. **Real-time sync** → Inspired by Focalboard's WS, but using existing SSE (`run_ws.rs` pattern)
5. **Approval gates** → Inspired by Relay's risk scopes, but using existing `approval_requests` table
6. **Audit trail** → Already exists! Just need to emit events properly

The gap is **small and well-defined** — not a rewrite, just filling in the missing tables, routes, and wire-ups.
