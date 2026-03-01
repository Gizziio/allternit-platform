# A2rchitech Unified UI Chat — Mini-App: Data System Primitive (Ragic-Class)
*Version:* v0.1 (integration-ready)  
*Scope:* How a Ragic-like no-code relational DB + auto-UI layer maps into A2rchitech’s **Dynamic UI + Mini-App** architecture as a reusable service primitive for AgenticOS workflows.

---

## 0) Why this mini-app exists (first principles)
Agents and dynamic UIs need **deterministic, structured state** to operate reliably.

Most “workflow tools” fail for agents because:
- state is trapped in unstructured docs/chats
- schemas drift silently
- permissions are inconsistent
- there is no canonical queue/record model

A Ragic-class system solves one hard problem:
> Collapse **Schema + Data + Operational UI** into a human-editable, agent-readable substrate.

In A2rchitech terms, this is the **Structured Ops Surface** mini-app: a canonical database + generated views that the Dynamic UI shell can summon contextually.

---

## 1) Definition: “Ragic-Class Data System Primitive”
A **Ragic-class** component is:
- **Relational data model**: tables/entities + relations + constraints
- **Spreadsheet-like authoring**: non-engineers can evolve schema
- **Auto-generated UI**: forms, tables, dashboards, reports
- **Access control**: role/record permissions
- **Workflow logic**: validation, approvals, triggers
- **API surface**: query + CRUD + events

This is **not** the agent runtime.  
This is **data gravity** + **operational UI generation**.

---

## 2) Placement in the A2rchitech stack
### Correct role separation
- **Dynamic UI Shell** = OS-level renderer + navigation + context router  
- **Mini-App** = capability module that exposes views + actions + data contracts  
- **Agent Orchestrator** = plans + tool calls + policy enforcement  
- **Tool Gateway** = permissioned execution + audit + rate limits  
- **Data System Primitive (this mini-app)** = canonical structured state + auto-UI views

### Conceptual stack map
```
[ User / Operator / Agent Chat ]
          |
          v
[ A2rchitech Dynamic UI Shell ]
   - context router
   - view compositor
   - state hydration
          |
          v
[ Mini-App: Data System Primitive ]
   - schema registry
   - entity views (record/table/dashboard/wizard/approval)
   - actions (approve/assign/escalate/export/notify)
          |
          v
[ Storage / DB + Workflow Engine ]
   - relational store
   - permissions
   - triggers/events
          |
          v
[ Agent Orchestrator + Tool Gateway ]
   - reads state
   - writes updates
   - executes actions via policy
```

---

## 3) What the mini-app must provide to the Dynamic UI
### 3.1 View Primitives (the UI shell can “summon”)
The Dynamic UI shell should not hardcode app screens. It should request *a view* for a context.

**Primitive view types**
- **Record View**: single entity instance, with related records
- **Table View**: list/query results with filters + inline edit
- **Queue View**: work items with status + assignment
- **Dashboard View**: KPIs, alerts, aggregates
- **Wizard View**: guided record creation (multi-step)
- **Approval View**: signoff + comments + audit
- **Search View**: global/entity search with facets

### 3.2 Action Primitives (what users/agents can do)
- create/update/close/reopen
- assign/unassign
- approve/reject
- escalate
- export
- notify (webhook/email/slack/etc., routed via Tool Gateway)
- attach/link entities
- run validations / compute fields

---

## 4) Integration contract (non-negotiable)
To be composable, the mini-app must expose **three** contracts:

### 4.1 Schema API
- `list_entities() -> [EntityRef]`
- `get_entity_schema(entity_id) -> EntitySchema`
- `list_relations(entity_id) -> [Relation]`
- `get_permissions(principal, entity_id) -> PermissionSet`
- `get_views(entity_id) -> [ViewDescriptor]`
- `get_actions(view_id) -> [ActionDescriptor]`

### 4.2 Data API
- `query(entity_id, filter, sort, limit, cursor) -> QueryResult`
- `get(entity_id, record_id) -> Record`
- `create(entity_id, payload) -> Record`
- `update(entity_id, record_id, patch) -> Record`
- `delete(entity_id, record_id) -> Result` *(optional; heavily gated)*

### 4.3 UI Capability Descriptor (ViewSpec)
The mini-app returns a **ViewSpec** describing what the shell should render.

**ViewSpec includes**
- layout (sections, fields, widgets)
- data bindings (queries, relations)
- allowed actions (with policy tags)
- required permissions
- optional “agent hints” (what this view means in workflow terms)

---

## 5) Minimal ViewSpec JSON (reference)
> Use this as a canonical pattern. The exact schema can live under `/spec/Contracts/ViewSpec.json`.

```json
{
  "view_id": "workorders.queue.default",
  "type": "queue",
  "title": "Work Orders",
  "entity": "workorders",
  "query": {
    "filter": { "status": ["open","blocked"] },
    "sort": [{ "field": "priority", "dir": "desc" }],
    "limit": 50
  },
  "columns": [
    {"field":"id","label":"ID"},
    {"field":"site","label":"Site"},
    {"field":"priority","label":"Priority"},
    {"field":"assigned_to","label":"Assignee"},
    {"field":"status","label":"Status"}
  ],
  "actions": [
    {"id":"assign","label":"Assign","policy":"write:workorders"},
    {"id":"escalate","label":"Escalate","policy":"write:workorders"},
    {"id":"close","label":"Close","policy":"write:workorders"}
  ],
  "permissions_required": ["read:workorders"],
  "agent_hints": {
    "workflow_role": "queue",
    "next_best_action": ["assign","escalate","close"],
    "sla_field": "due_at"
  }
}
```

---

## 6) Repo mapping (monorepo placement)
**Recommended monorepo structure (conceptual)**
- `apps/`  
  - `apps/miniapp-data-system/` *(this mini-app; Ragic-class capability)*
- `shell/`
  - `shell/dynamic-ui/` *(renderer + context router + view compositor)*
- `services/`
  - `services/agent-orchestrator/` *(plans + tool selection)*
  - `services/tool-gateway/` *(policy enforcement + audit + connectors)*
  - `services/schema-registry/` *(optional: centralized schema index across mini-apps)*
- `spec/`
  - `spec/Contracts/ViewSpec.json`
  - `spec/Contracts/SchemaSpec.json`
  - `spec/ADRs/` *(decisions: embed vs integrate external, etc.)*

**Key rule:** Mini-apps must export **capabilities** (views + actions + data), not bespoke routes/pages.

---

## 7) Two implementation strategies
### Strategy A — Integrate external Ragic (fastest time-to-demo)
Use Ragic as a hosted DB+UI engine and treat it as the backing system.
- Pros: immediate CRUD UI, permissions, workflows, reporting
- Cons: dependency + product constraints + integration boundaries

**How it plugs in**
- `miniapp-data-system` becomes an adapter:
  - schema sync (Ragic forms → EntitySchema)
  - view export (Ragic views → ViewSpec)
  - actions map (Ragic workflows → ActionDescriptor)
  - data reads/writes (Ragic API → Data API)

### Strategy B — Build an internal Ragic-class primitive (max control)
Build the schema + view generator in-house.
- Pros: full control, native mini-app experience, unified policy model
- Cons: heavier build; more engineering time

**How it plugs in**
- The mini-app owns schema definitions (`SchemaSpec`)
- Generates ViewSpec automatically
- Stores data in your chosen DB (Postgres, SQLite, etc.)
- Emits events to Tool Gateway / Orchestrator

---

## 8) Runtime flows (how it works in the Dynamic UI)
### Flow 1: Human opens a context (“show me open work orders”)
1. Dynamic UI router identifies intent: `queue(workorders, open)`
2. Shell requests view:
   - `miniapp.get_view(context)`
3. Mini-app returns ViewSpec + initial data
4. Shell renders queue; user acts
5. Action triggers:
   - `tool-gateway.execute(action)` (policy checked)
6. Mini-app updates record + emits event

### Flow 2: Agent opens a context (auto-triage)
1. Agent queries:
   - `query(workorders where status=open and priority=high)`
2. Agent proposes action plan (assign/escalate)
3. Tool Gateway enforces permissions
4. Agent writes updates
5. Mini-app UI updates instantly for humans

### Flow 3: Dynamic UI composes multiple mini-apps
Example: “Site Health” composite view:
- Data System mini-app supplies asset + incident records
- Observability mini-app supplies metrics sparkline widgets
- Document mini-app supplies runbooks
- Shell composes into a single “situational dashboard”

---

## 9) Guardrails (must-have in AgenticOS)
### 9.1 Determinism + auditability
- All writes go through Tool Gateway
- Every action has:
  - policy tag
  - actor (human/agent)
  - timestamp
  - before/after diff
  - justification (optional but recommended)

### 9.2 Permissions are first-class
- Schema-level permissions (entity read/write)
- Record-level permissions (row security)
- Action-level permissions (approve/escalate, etc.)

### 9.3 Schema evolution safety
- Version schemas (semantic version or migration IDs)
- Keep a changelog of fields/relations
- Prevent “silent breaking changes” in ViewSpec contracts

---

## 10) What this enables across your ventures (reusability)
One mini-app, many schemas:
- **Terra Source**: sites, assets, work orders, maintenance schedules, inventory, compliance checks
- **DirtÉ Vegan**: vendors, SKUs, locations, staff shifts, QA, incidents, purchasing
- **Ëtrid ops**: contributor tracking, proposals, governance workflows, distribution schedules
- **LBRNO**: talent pipeline, deliverables, contracts, payments, content calendar

The **shell stays the same**. The **schemas differ**.

---

## 11) MVP build plan (lowest-friction)
### MVP Goal
Demonstrate a full AgenticOS loop:
- schema → views → queue → actions → agent writes → UI updates

### MVP Steps
1. Pick one domain: **Work Orders**
2. Create entity schemas:
   - workorders, sites, assets, people
3. Implement ViewSpec generation:
   - queue + record + dashboard
4. Implement Data API:
   - query/get/create/update
5. Integrate Tool Gateway for actions:
   - assign, escalate, close
6. Add Agent Orchestrator hook:
   - auto-triage high priority items
7. Demo inside Dynamic UI shell as a spawned mini-app

---

## 12) Acceptance criteria (integration-ready)
- [ ] Dynamic UI can request a ViewSpec by context
- [ ] Mini-app returns ViewSpec + data reliably
- [ ] Actions execute only via Tool Gateway policies
- [ ] Audit log records all writes (human + agent)
- [ ] Schema changes are versioned and do not break existing ViewSpecs silently
- [ ] Composite views can include data-system widgets alongside other mini-apps

---

## 13) Canonical naming (recommended)
- Mini-app name: `data-system`
- Capability: `structured_ops_surface`
- View namespace: `<domain>.<viewtype>.<variant>`
  - e.g., `workorders.queue.default`
- Action IDs: `domain.action`
  - e.g., `workorders.assign`, `workorders.close`

---

## 14) Key synthesis
Ragic-class systems are valuable because they provide:
- **Agent-readable reality (schemas + invariants)**
- **Human-operable surfaces (generated UI)**
- **Workflow enforcement (approvals + triggers)**

In A2rchitech:
> This becomes a **Mini-App Data Primitive** that the Dynamic UI shell can spawn as a URL-like mini-app, but backed by deterministic structured state and composable ViewSpecs.

---

## 15) Optional: How this ties to “Discovery-first browsing → mini apps”
If the shell already spawns “URL page mini apps” for browsing, the same mechanism can spawn:
- `miniapp://data-system/view/workorders.queue.default`
- `miniapp://data-system/record/workorders/WO-1042`
- `miniapp://data-system/dashboard/site/SITE-12`

Meaning: “web pages” and “data system views” become the same *spawnable primitive* in the unified UI.

---

**End of file**
