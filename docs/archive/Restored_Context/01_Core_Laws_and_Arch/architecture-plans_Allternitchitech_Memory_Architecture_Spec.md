# Allternit Memory Architecture Spec (v1)

**Goal:** build agents that retain *truthful* long-term knowledge at scale (10k+ sessions / user) without hallucinated “memory synthesis”.

This document is a *system spec* (guardrails + infrastructure + modular interfaces) derived from the provided “never forget” architecture and upgraded with production patterns and research-backed extensions.

---

## 0) Non-negotiable principles

### P0.1 Source-of-truth is immutable
All raw inputs are saved first and never edited. Everything else (facts, summaries, graphs) must be traceable back to immutable raw sources.

### P0.2 Memory is a **process**, not a dump
Memory is not “store and retrieve similar text”. It is:
- **write policy** (what is allowed to become memory)
- **structured representation** (facts + time + confidence)
- **conflict resolution** (update vs coexist vs archive)
- **maintenance** (decay + consolidation + re-index)

### P0.3 The system must never *pretend* it remembers
If the system cannot retrieve grounded evidence, it must:
- say it does not know
- ask for the missing detail
- or provide a range of hypotheses **explicitly labeled as hypotheses**

### P0.4 Time is first-class
Memory stores must encode:
- `valid_from`, `valid_to`
- `observed_at`
- `updated_at`
- and an explicit **status** (active / superseded / disputed / archived)

Embeddings do not encode time. Your memory infrastructure must.

---

## 1) The target architecture (overview)

Allternit memory is a **four-plane system**:

1. **Short-term continuity (Checkpointing / RAM)**
   - deterministic state snapshots per step
2. **Truth ledger (Resources + Items)**
   - immutable raw logs + extracted atomic facts linked back to sources
3. **Living context views (Category summaries + Profiles)**
   - updated narratives that overwrite outdated truths
4. **Precision web (Context-Graph + Indexes)**
   - entity/relationship store with temporal edges + conflict rules

Plus two cross-cutting layers:

5. **RLM layer (Reinforced Learning Memory / policy training)**
   - learn better write/update/delete choices over time
6. **Context decision trees (hierarchical retrieval & plan context)**
   - tree-structured memory selection and plan anchoring

Research anchors for these directions:
- MemGPT / Letta (virtual context management, paging) 
- LoCoMo (very long-term memory eval)
- MemoryBank (long-term memory update and forgetting)
- MemTree (dynamic tree memory representation)
- RAP (retrieval-augmented planning from prior experience)
- A-MEM (agentic, Zettelkasten-style linking + evolution)
- ReCAP (dynamic context tree for long-horizon planning)

---

## 2) Data model (canonical)

### 2.1 Resource (immutable)
**Purpose:** store raw truth.

```json
{
  "resource_id": "res_...",
  "user_id": "u_...",
  "session_id": "s_...",
  "type": "chat|upload|tool_result|event",
  "mime": "text/plain|application/json|...",
  "body": "...raw content...",
  "created_at": "2026-01-19T...Z",
  "hash": "sha256:...",
  "metadata": {
    "channel": "chat",
    "agent_id": "agent_...",
    "tool": null,
    "tags": ["raw"]
  }
}
```

**Rules:**
- write once
- store hash
- support full-text search
- support retention/archival tiers (cold storage)

### 2.2 MemoryItem (atomic fact)
**Purpose:** a unit of memory with time + provenance.

```json
{
  "item_id": "itm_...",
  "user_id": "u_...",
  "subject": "user",
  "predicate": "prefers_language",
  "object": "python",
  "content": "User prefers Python",

  "category": "work_preferences",
  "confidence": 0.86,
  "status": "active|superseded|disputed|archived",

  "observed_at": "2026-01-19T...Z",
  "valid_from": "2026-01-19T...Z",
  "valid_to": null,

  "source": {
    "resource_id": "res_...",
    "span": {"start": 120, "end": 178}
  },

  "keys": {
    "entity_ids": ["ent_user"],
    "keywords": ["python", "preference"],
    "tags": ["preference", "stable?"]
  },

  "embedding": {
    "model": "text-embedding-...",
    "vector": "<stored externally>",
    "updated_at": "2026-01-19T...Z"
  }
}
```

**Rules:**
- always linked to a Resource
- must carry a *status*
- must be time-bounded when appropriate

### 2.3 CategorySummary (living narrative)
**Purpose:** token-efficient “what’s true now” view.

```json
{
  "user_id": "u_...",
  "category": "work_preferences",
  "markdown": "...",
  "updated_at": "...",
  "sources": ["itm_...", "itm_..."],
  "version": 12
}
```

**Rules:**
- derived artifact (never authoritative)
- must list backing item_ids

### 2.4 ContextGraph (precision)
**Purpose:** explicit relational memory.

Nodes:
```json
{ "id": "ent_openai", "type": "Org", "name": "OpenAI" }
```

Edges:
```json
{
  "id": "edge_...",
  "subject": "ent_user",
  "predicate": "employed_at",
  "object": "ent_openai",
  "status": "active|archived|disputed",
  "valid_from": "...",
  "valid_to": null,
  "confidence": 0.9,
  "source_item_id": "itm_..."
}
```

**Rules:**
- graph is *derived* from Items but optimized for traversal
- conflict rules operate here (see §5)

---

## 3) Guardrails: write policy (anti-junk)

### 3.1 Memory write eligibility
Only write to memory when at least one is true:
- Stable preference / constraint (diet, language, tool, timezone)
- Durable identity / profile (role, org, project, responsibilities)
- Persistent relationship (team members, vendors)
- Long-running goal / commitment (deadlines, recurring plans)
- Critical operational context (account setup, environment constraints)

Never write:
- ephemeral chit-chat
- speculative thoughts unless explicitly labeled as speculation and time-bounded
- LLM-generated guesses

### 3.2 Memory “truth” contract
Every memory-bearing response must be built from retrieved evidence.

If query asks for past info and retrieval fails:
- respond: “not found in memory”
- optionally propose *questions to ask the user* to re-ground

### 3.3 Write permissions
Memory writes must be executed by a dedicated **Memory Writer** capability with:
- JSON-schema enforced output
- content validation
- rate limits
- audit logs

---

## 4) Short-term memory: Checkpointing (solved problem)

### 4.1 Why
Checkpointing provides:
- determinism / replay
- crash recovery
- debugging

### 4.2 Contract
Allternit agent runtime must checkpoint after every “super-step”:
- user input ingested
- tool calls
- model output
- state updates

### 4.3 Implementation pattern (Python-style reference)
(Use the same idea in TS/Rust if needed; persistence backend is Postgres.)

```python
# pseudocode
class Checkpointer:
    def save(self, thread_id: str, step: int, state: dict):
        ...

    def load_latest(self, thread_id: str) -> dict:
        ...

    def list_steps(self, thread_id: str) -> list[int]:
        ...
```

Use a stable identity:
- `thread_id = user_id + agent_id + workspace_id`

---

## 5) Long-term memory A: file-based (Resources → Items → Categories)

### 5.1 Write path: Active memorization (batched)

This is the architecture in your pasted text, made explicit for Allternit.

#### Stage 1 — resource ingestion
Store raw content first.

#### Stage 2 — extraction
Extract atomic items with schema enforcement.

#### Stage 3 — batching
Group items by category (single write per category per transaction).

#### Stage 4 — evolve category summaries
Rewrite existing summaries with overwrites on conflict.

### 5.2 Canonical code (directly aligned with the paste)

```python
import json

class FileBasedMemory:
    def memorize(self, conversation_text, user_id):
        # Stage 1: Resource Ingestion (Source of Truth)
        resource_id = self.save_resource(user_id, conversation_text)

        # Stage 2: Extraction
        items = self.extract_items(conversation_text)

        # Stage 3: Batching
        updates_by_category = {}
        for item in items:
            cat = self.classify_item(item)
            if cat not in updates_by_category:
                updates_by_category[cat] = []
            updates_by_category[cat].append(item['content'])

            # Link item to resource for traceability
            self.save_item(user_id, category=cat, item=item, source_resource_id=resource_id)

        # Stage 4: Evolve Summaries
        for category, new_memories in updates_by_category.items():
            existing_summary = self.load_category(user_id, category)
            updated_summary = self.evolve_summary(
                existing=existing_summary,
                new_memories=new_memories
            )
            self.save_category(user_id, category, updated_summary)

    def extract_items(self, text):
        """Use LLM to extract atomic facts"""
        prompt = f"""Extract discrete facts from this conversation.
        Focus on preferences, behaviors, and important details.
        Conversation: {text}
        Return as JSON list of items."""
        return llm.invoke(prompt)

    def evolve_summary(self, existing, new_memories):
        memory_list_text = "\n".join([f"- {m}" for m in new_memories])

        prompt = f"""You are a Memory Synchronization Specialist.

        Topic Scope: User Profile

        ## Original Profile
        {existing if existing else "No existing profile."}

        ## New Memory Items to Integrate
        {memory_list_text}

        # Task
        1. Update: If new items conflict with the Original Profile, overwrite the old facts.
        2. Add: If items are new, append them logically.
        3. Output: Return ONLY the updated markdown profile."""

        return llm.invoke(prompt)

    # Helper stubs
    def save_resource(self, user_id, text): pass
    def save_item(self, user_id, category, item, source_resource_id): pass
    def save_category(self, user_id, category, content): pass
    def load_category(self, user_id, category): return ""
    def classify_item(self, item): return "general"
```

### 5.3 Read path: Tiered retrieval (token efficient)

```python
class FileBasedRetrieval:
    def retrieve(self, query, user_id):
        # Stage 1: Category selection
        all_categories = self.list_categories(user_id)
        relevant_categories = self.select_relevant_categories(query, all_categories)

        summaries = {cat: self.load_category(user_id, cat)
                     for cat in relevant_categories}

        # Stage 2: Sufficiency check
        if self.is_sufficient(query, summaries):
            return summaries

        # Stage 3: Drill-down query
        search_query = self.generate_search_query(query, summaries)

        # Level 1: Atomic items
        items = self.search_items(user_id, search_query)
        if items:
            return items

        # Level 2: Raw resources
        return self.search_resources(user_id, search_query)

    def select_relevant_categories(self, query, categories):
        prompt = f"""Query: {query}
        Available Categories: {', '.join(categories)}

        Return a JSON list of the categories that are most relevant to this query."""
        return llm.invoke(prompt)

    def is_sufficient(self, query, summaries):
        prompt = f"""Query: {query}
        Summaries: {summaries}
        Can you answer the query comprehensively with just these summaries? YES/NO"""
        return 'YES' in llm.invoke(prompt)
```

---

## 6) Long-term memory B: Context-Graph + vector discovery

### 6.1 Why
File summaries are coherent but weak on complex relationships.
Graph memory gives:
- precise queries (who/what/where/when)
- explicit temporal updates
- conflict resolution without hallucinated synthesis

### 6.2 Hybrid retrieval
At inference time, run:
- vector search for “discovery” (candidate memories)
- graph traversal for “precision” (entity-linked truth)
- merge results via a context compiler

### 6.3 Conflict resolution (canonical)
When new item contradicts existing active graph edge:
- archive old edge by setting `valid_to = observed_at` and status `archived`
- create new edge `active`
- add `dispute` edges if confidence is low

Example:
- old: employed_at(Google) active
- new: employed_at(OpenAI) active
→ Google edge archived, OpenAI edge active.

---

## 7) Memory maintenance: decay + consolidation + re-index

### 7.1 Why
Without maintenance:
- retrieval becomes noisy
- contradictions multiply
- costs and latency blow up

### 7.2 Canonical cron jobs (from the paste)

```python
class MemoryMaintenance:
    def run_nightly_consolidation(self, user_id):
        recent_memories = self.get_memories_since(user_id, hours=24)
        duplicates = self.find_duplicates(recent_memories)

        for group in duplicates:
            merged = self.merge_memories(group)
            self.replace_memories(group, merged)

        hot_memories = self.get_high_access_memories(user_id)
        for memory in hot_memories:
            self.increase_priority(memory)

    def run_weekly_summarization(self, user_id):
        old_memories = self.get_memories_older_than(user_id, days=30)
        categories = self.group_by_category(old_memories)

        for category, memories in categories.items():
            summary = self.create_summary(memories)
            self.archive_old_items(memories)
            self.save_summary(user_id, category, summary)

        stale = self.get_memories_not_accessed(user_id, days=90)
        self.archive_memories(stale)

    def run_monthly_reindex(self, user_id):
        all_memories = self.get_all_memories(user_id)
        for memory in all_memories:
            new_embedding = self.generate_embedding(memory.text)
            memory.embedding = new_embedding

        if self.using_graph:
            self.graph.reweight_edges_by_access()

        dead_nodes = self.graph.find_unused_nodes(days=180)
        self.graph.archive_nodes(dead_nodes)
```

### 7.3 Add two production upgrades

**A) Schema migration support**
- item schema versioning + migrators

**B) Model migration support**
- embedding rebuild pipelines by model version

---

## 8) Inference-time retrieval & injection (anti-hallucination)

The pasted retrieval logic is correct structurally; two upgrades are mandatory:

### 8.1 Upgrade 1 — “truth gating”
Candidates must be filtered by:
- provenance exists (resource_id)
- status is active OR explicitly requested historical
- conflict status (disputed)

### 8.2 Upgrade 2 — “time-aware ranking”
Use:
- semantic relevance score
- time-decay factor
- **recency override for mutable predicates** (employment, location, current project)

### 8.3 Canonical code (from the paste)

```python
class MemoryRetrieval:
    def retrieve_for_inference(self, user_message, user_id, max_tokens=2000):
        search_query = self.generate_query(user_message)

        candidates = self.vector_store.search(
            query=search_query,
            user_id=user_id,
            top_k=20
        )

        relevant = []
        for candidate in candidates:
            score = self.calculate_relevance(candidate, user_message)
            if score > 0.7:
                relevant.append((score, candidate))

        ranked = []
        for score, memory in relevant:
            age_days = (now() - memory.timestamp).days
            time_decay = 1.0 / (1.0 + (age_days / 30))
            final_score = score * time_decay
            ranked.append((final_score, memory))

        ranked.sort(reverse=True, key=lambda x: x[0])

        selected_memories = []
        token_count = 0
        for score, memory in ranked:
            memory_tokens = self.count_tokens(memory.text)
            if token_count + memory_tokens > max_tokens:
                break
            selected_memories.append({
                'text': memory.text,
                'timestamp': memory.timestamp,
                'confidence': score
            })
            token_count += memory_tokens

        return self.format_memory_context(selected_memories)

    def format_memory_context(self, memories):
        context = "=== RELEVANT MEMORIES ===\n\n"
        for mem in memories:
            context += f"[{mem['timestamp']}] (confidence: {mem['confidence']:.2f})\n"
            context += f"{mem['text']}\n\n"
        context += "=== END MEMORIES ===\n"
        return context
```

---

## 9) Cutting-edge upgrades (modular, plug-and-play)

### 9.1 Virtual context manager (MemGPT/Letta pattern)
A “memory OS” layer that:
- decides what goes in-context vs out-of-context
- pages memory into the prompt via explicit tools

This becomes Allternit’s **Context Compiler**.

### 9.2 Context decision trees (hierarchical memory)
Use a tree-structured memory organization and selection:
- memory nodes hold aggregated summaries + embeddings
- retrieval picks a branch, then drills down

This aligns with **MemTree** (dynamic tree memory representation) and with dynamic context trees for planning (ReCAP).

### 9.3 RLM layer (reinforced memory actions)
Problem: heuristic ADD/UPDATE/DELETE policies become brittle.

Solution: treat memory operations as actions and learn a policy:
- action space: `ADD`, `UPDATE`, `DELETE`, `ARCHIVE`, `NOOP`
- reward: downstream answer correctness + user corrections + benchmark tasks

Research directions include reinforcement-trained “memory managers” that optimize memory operations over long horizons.

### 9.4 Retrieval-augmented planning (RAP)
Store prior “episodes” (context → plan → outcome) and retrieve them to improve planning and tool-use, not just Q/A.

### 9.5 Agentic memory linking (A-MEM)
Add a Zettelkasten-like linking pass:
- create structured notes for items
- generate links to other items
- evolve old notes when new info arrives

---

## 10) Modular interfaces (Allternit implementation contracts)

### 10.1 Storage adapters
- `ResourceStore` (immutable blob store + index)
- `ItemStore` (postgres + vector index)
- `SummaryStore` (markdown + versions)
- `GraphStore` (neo4j/pggraph/arangodb)

### 10.2 Core services
- `MemoryWriter` (write policy + extraction + conflict resolution)
- `MemoryRetriever` (tiered retrieval + time-aware ranking + truth gating)
- `ContextCompiler` (prompt assembly + paging + token budget)
- `MaintenanceScheduler` (nightly/weekly/monthly jobs)

### 10.3 Evaluation harness
- run LoCoMo-style tests on your agents
- track metrics: factual consistency, temporal consistency, correction rate

---

## 11) Audit checklist for the current Allternit codebase

This is the concrete checklist to map “what exists” → “what must be added”.

### 11.1 Inventory
- Where are raw conversations stored?
- Are they immutable and hashed?
- What is the checkpointing implementation and keying strategy?
- Is there already a vector store? Which one?
- Is there any graph memory? If yes, is it temporal?

### 11.2 Write path validation
- Does anything write “memory” without schema + provenance?
- Are categories defined?
- Is batching implemented?
- Is conflict resolution implemented?

### 11.3 Retrieval validation
- Is retrieval time-aware?
- Is retrieval truth-gated (must have sources)?
- Is there a sufficiency check before drilling down?
- Is there a “don’t know” fallback?

### 11.4 Maintenance
- Any cron/scheduler?
- Deduplication? compression? re-embed? archival?

### 11.5 Observability
- memory write logs
- retrieval traces (why selected)
- user correction capture

---

## 12) Reference implementations you can reuse (build vs buy)

### Option A — adopt a memory-first framework
- Letta / MemGPT-style memory OS (virtual context management)

### Option B — integrate a memory layer service
- Mem0 (open-source “memory layer” with graph memory options)
- Zep (open-source memory + graph + episode extraction)

### Option C — build in-house (recommended for Allternit)
Use this spec as your contract layer, and keep adapters pluggable.

---

## 13) Minimal build order (no-dead-ends)

1. Resources + ItemStore with strict provenance
2. Checkpointer end-to-end (replayable sessions)
3. Category summaries + tiered retrieval
4. Time-aware conflict resolution
5. Maintenance scheduler
6. GraphStore + hybrid retrieval
7. Context decision tree memory
8. RLM layer training loop

---

## Appendix: Research & external anchors (for engineering decisions)

- MemGPT (LLM as OS; virtual memory paging)
- Letta MemGPT docs (practical memory OS)
- LoCoMo (very long-term conversational memory benchmark)
- Generative Agents (memory stream, reflection, planning)
- MemoryBank (memory updating + forgetting curve inspired)
- MemTree (dynamic tree-structured memory)
- RAP (retrieval-augmented planning)
- ReCAP (dynamic context tree for long-horizon planning)
- A-MEM (agentic memory linking and evolution)
- Survey on memory mechanisms of LLM agents (broad map)
