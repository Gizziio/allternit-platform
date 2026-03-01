# Intent Graph Kernel (IGK) — Formal Spec for a2rchitech

## 0. Definition

**Intent Graph Kernel (IGK)** is the minimal, canonical substrate that:
- captures raw intent from any channel,
- compiles it into durable, queryable state,
- preserves provenance and traceability,
- supports temporal + contextual projections,
- and enables policy-governed commits by humans and/or agents.

IGK is **not** a task tracker. It is a **state-coherence engine** for an agentic system.

---

## 1. Core Guarantees (Invariants)

1. **Single Reality (No Forking):** Each real-world “thing” exists once as a node; all schedules and plans are views.
2. **Append-Only Provenance:** All state changes are recorded as events with actor + source references.
3. **Traceability:** Any derived summary/plan/action must cite back to source objects (messages, docs, observations).
4. **Policy-Gated Mutation:** Mutations require explicit capability/policy; AI proposes, policy commits.
5. **Graph-Native Semantics:** Dependencies, relations, rollups, and context inheritance are first-class.
6. **Temporal Projections:** “Now/Next/Later” are computed overlays, not object duplication.
7. **Context Windows:** Every agent/tool call is executed against an explicit, minimal context slice.

---

## 2. Data Model (Entities)

### 2.1 Node (Atomic unit of durable state)

`Node` represents an intent-bearing entity (goal, task, request, decision, plan, artifact, memory anchor).

**Fields**
- `node_id` (ULID/UUID)
- `type` (enum): `Intent | Task | Goal | Decision | Plan | Project | Initiative | Artifact | Memory | Observation | Capability`
- `title` (string)
- `body` (rich text / markdown)
- `status` (enum, type-specific; e.g., `Proposed | Active | Blocked | Done | Archived`)
- `priority` (int or enum)
- `owner` (principal_id nullable)
- `team` / `workspace` (tenant scope)
- `labels` (list)
- `created_at`, `updated_at`
- `source_refs` (list of `SourceRef`)
- `attributes` (jsonb: arbitrary typed fields, e.g. customer tier, revenue, SLA class)

### 2.2 Edge (Relations between nodes)

Edges define graph structure.

**Fields**
- `edge_id`
- `from_node_id`
- `to_node_id`
- `type` (enum):
  - `DependsOn`
  - `Blocks`
  - `Related`
  - `DuplicateOf`
  - `PartOf` (rollup)
  - `Implements`
  - `References`
  - `DerivedFrom` (for summaries/plans)
  - `ContextFor` (explicit context wiring)
- `weight` (optional numeric)
- `metadata` (jsonb)

### 2.3 Event (Immutable change log)

Every change is an event. Nodes are materialized state derived from events.

**Fields**
- `event_id`
- `ts`
- `actor` (principal_id or agent_id)
- `action` (enum): `CreateNode | UpdateNode | CreateEdge | DeleteEdge | AttachSource | Summarize | Propose | Commit | ExecuteTool`
- `target` (node_id/edge_id)
- `before` (jsonb optional)
- `after` (jsonb optional)
- `source_refs` (list)
- `policy_decision` (policy_id, allow/deny, rationale)

### 2.4 SourceRef (Provenance)

Represents the “why” behind state.

**Fields**
- `source_id`
- `kind` (enum): `ChatMessage | Slack | Email | Ticket | Doc | WebPage | File | Sensor | AgentOutput`
- `locator` (uri-like string; internal IDs allowed)
- `excerpt` (short, optional)
- `hash` (optional integrity)
- `created_at`

### 2.5 Projection (View) — computed overlays

Projections define how to view the same nodes through a lens.

- **TemporalProjection:** `Now | Next | Later | Scheduled`
- **ObjectiveProjection:** rollups by initiatives/projects
- **ContextProjection:** minimal context slice for agent/tool execution
- **UIProjection:** how dynamic UI renders nodes for a user/session

**Stored as**
- `ProjectionDef { projection_id, scope, query_json, display_json }`

---

## 3. State Machine (Lifecycle)

### 3.1 Intake → Canonicalization

1. **Capture:** store raw input as `SourceRef` + `Observation` node.
2. **Classify:** propose mapping to `Intent/Task/Goal/Decision` types.
3. **Normalize:** create/merge nodes, attach labels/owners, link dependencies.
4. **Commit:** policy/human approves mutations.
5. **Evolve:** future changes append events; state updates are materialized views.

### 3.2 AI Role Boundaries

AI/agents may:
- propose nodes/edges
- summarize and cite
- suggest priorities, dependencies, next actions

AI/agents may not:
- delete provenance
- commit destructive mutations without policy approval
- create “silent” state not traceable to sources

---

## 4. Query & Execution APIs (Logical)

### 4.1 Graph Query (GraphQL or equivalent)

Minimum operations:
- `getNode(node_id)`
- `searchNodes(query, filters)`
- `getSubgraph(root_node_id, depth, edge_types)`
- `getProjections(projection_id)`

### 4.2 Mutation (Policy-Gated)

- `proposeCreateNode(input)` → proposal
- `commitCreateNode(proposal_id)` → event + node materialization
- same for edges/updates

### 4.3 Event Stream

- `subscribe(events, filters)` (websocket)
- `webhook(events, filters)` (push integration)

Payload includes `previous` + `after` to support deterministic downstream sync.

---

## 5. Temporal Scheduling (Optional Module)

Instead of duplicating nodes into “cycles,” represent time as overlays:

- `ScheduleRef { node_id, start_ts, end_ts, cadence_id, confidence }`
- `Cadence { cadence_id, duration, recurrence_rule }`

A node can have:
- 0 schedules (unscheduled)
- 1 schedule (planned)
- many schedules (scenarios), but only one “active” schedule per policy

---

## 6. Context Windows (Dynamic Context Interface)

Every agent/tool call is executed with an explicit context slice:

`ContextSlice`
- `slice_id`
- `root_node_ids`
- `included_edges`
- `included_sources`
- `token_budget`
- `ranking_method` (recency, dependency distance, relevance score, user focus)

Context slices are themselves nodes/events so the system can learn what worked.

---

## 7. Storage & Materialization (Implementation Notes)

- **Primary store:** Postgres (nodes, edges, events, projections), JSONB for flexible attributes.
- **Search:** hybrid (FTS + vector index) over node bodies + sources.
- **Materialization:** event-sourced or “events + current state” dual tables.
- **Integrity:** enforce invariants (no orphan edges, tenant isolation, provenance required for AI-derived nodes).

---

## 8. Minimal MVP Acceptance Criteria

1. Can ingest a message and create an `Observation` node with `SourceRef`.
2. Can propose a structured `Intent` node and link it to its source.
3. Can commit changes through a policy gate.
4. Can create dependency edges and query the subgraph.
5. Can generate a temporal “Now/Next/Later” view without duplicating nodes.
6. Can generate a summary node that cites specific sources.
7. Can generate a context slice for an agent/tool call and log the outcome.

---

## 9. Why IGK is the “Linear Layer,” Generalized

Linear demonstrates **state coherence** for team execution.
IGK generalizes that to:
- agents and tools,
- dynamic UI projection,
- context discovery,
- memory persistence,
- multi-channel intake,
- and policy-governed autonomy.
