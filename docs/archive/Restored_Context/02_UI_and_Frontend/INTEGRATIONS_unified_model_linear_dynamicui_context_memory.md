# Unified Model — Linear Core Pattern × Dynamic UI × Context & Memory (Dia-style)

## 0. Thesis

Allternit’s unified architecture should be built around **state coherence**, not UI.
Linear is proof that the competitive advantage is:
- low-friction intent intake,
- canonical durable state,
- graph-native execution,
- temporal projections,
- and traceable compression (summaries with citations).

Dynamic UI, context discovery, and memory systems become **projections** over the same coherent substrate.

---

## 1. The Shared Core: Persistent Intent Graph

Everything is a node in a shared graph:
- intent/tasks/goals/decisions/plans
- tools/capabilities/agents
- memory anchors and observations
- artifacts (docs, specs, code deltas)
- user sessions / focus objects

This graph is maintained by the **Intent Graph Kernel (IGK)**.

**Key rule:** objects exist once; views are lenses.

---

## 2. The Three Projection Planes

### 2.1 Dynamic UI Plane (Experience Projection)

Dynamic UI is a **renderer** that:
- selects the right nodes for the current moment,
- chooses a modality (card, mini-app, timeline, checklist, canvas),
- and supports action → event commits back into IGK.

UI is downstream of graph state.

**UI primitives**
- `Card` (single node)
- `Stack` (node set)
- `MiniApp` (bounded workflow over a node subset)
- `Lens` (saved projection)
- `Action` (policy-gated mutation proposal)

### 2.2 Context Discovery Plane (Cognitive Projection)

Context discovery generates **ContextSlices**:
- minimal, relevant context window for a task/agent call
- derived from graph distance, recency, relevance, and user focus
- includes only necessary sources and linked nodes

### 2.3 Memory Plane (Persistence Projection)

Memory is a **persistence/recall layer** over the same graph:
- long-term anchors (stable nodes)
- episodic traces (events)
- semantic indices (search + vectors)
- compression artifacts (summaries, decisions) with citations

“Dia-style” memory is modeled as:
- `Memory` nodes + `DerivedFrom` edges
- retention policies and decay functions
- retrieval policies controlling what can enter ContextSlices

---

## 3. Unified Intake → Canonicalization → Projection Loop

### 3.1 Intake (Entropy Capture)

Inputs arrive from:
- chat
- Slack/email
- web browsing outputs
- tools
- documents
- agent suggestions

All inputs first become:
- `SourceRef` + `Observation` node

### 3.2 Canonicalization (Entropy Collapse)

Canonicalization compiles observations into:
- `Intent/Task/Goal/Decision` nodes
- dependencies and rollups
- ownership/status/priority
- traceability links

AI can propose; policies/humans commit.

### 3.3 Projection (Dynamic Experience)

From the same substrate, generate:
- **Now/Next/Later** temporal lens
- **Blocked** lens (dependency cut)
- **Objective** lens (initiative/project rollups)
- **Agent** lens (assignment/responsibility)
- **UI** lens (which mini-app should render this state)

---

## 4. Concrete Unification: Linear Concepts → Unified Model

- **Issues** → `Task` nodes
- **Projects/Initiatives** → objective aggregates via `PartOf` edges
- **Cycles** → temporal overlays, not duplication
- **Triage/Asks** → intake pipeline producing `Observation` nodes
- **Insights** → telemetry queries over events and transitions

---

## 5. Minimal Unified Diagram (Mermaid)

```mermaid
flowchart TB
  subgraph Intake[Multi-Channel Intake]
    A1[Chat] --> B[Observation Node + SourceRef]
    A2[Email/Slack] --> B
    A3[Web/Docs/Tools] --> B
  end

  subgraph Kernel[Intent Graph Kernel (IGK)]
    B --> C[Canonicalization: Propose Nodes/Edges]
    C --> D[Policy Gate: Commit Events]
    D --> E[(Persistent Graph: Nodes + Edges + Events)]
  end

  subgraph Projections[Projection Planes]
    E --> P1[Dynamic UI Projection]
    E --> P2[Context Slice Generator]
    E --> P3[Memory Projection]
  end

  P2 --> X[Agent/Tool Execution]
  X --> D
  P1 --> D
```

---

## 6. Implementation Sequence (Unified)

1. **Build IGK** (nodes, edges, events, sources, policy-gated commits)
2. **Add ContextSlices** (graph + semantic retrieval; explicit slices logged)
3. **Add Dynamic UI projection** (mini-app capsules; actions commit to IGK)
4. **Add memory retention policies** (anchors, summaries with citations, decay)
5. **Add telemetry** (throughput, blockage density, agent/tool performance)

---

## 7. Non-Negotiables (Unified Guardrails)

- Nothing enters durable state without provenance.
- AI summarizes and proposes; policies commit.
- Time is a view, not duplication.
- Context is explicit and minimal.
- UI is downstream of the graph, not a separate universe.

---

## 8. Result

This unified model yields an allternit system that:
- compiles intent into coherent state,
- projects that state into dynamic UI experiences,
- generates minimal context windows for agent execution,
- and persists memory as traceable, queryable structure.
