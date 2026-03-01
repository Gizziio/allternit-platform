# A2rchitech Memory Structure (Quick Explainer)

## The problem
Vector search retrieves *similar text*, not *true, time-consistent state*. At scale, this causes contradiction blending and hallucinated “memory.”

## The solution
Treat memory like an operating system:

### 1) RAM (Short-term)
**Checkpointing**: every agent step saves state.
- replay
- resume
- debug

### 2) Disk (Truth ledger)
**Resources (immutable raw)** → **Items (atomic facts)**
- raw data is stored first and never edited
- facts are extracted from raw and always cite sources
- every fact is time-stamped and has a status (active/superseded/disputed)

### 3) Views (Living summaries)
**Category summaries** are compact “what’s true now” markdown views.
- derived from Items
- overwritten on conflict
- always lists which items it is based on

### 4) Web (Precision graph)
**Context graph** stores entity relations with time-bounded edges.
- conflict resolution archives old edges and activates new ones
- retrieval can traverse relations precisely

## Retrieval (how answers stay truthful)
1. Load relevant category summaries.
2. If sufficient, answer.
3. If not, pull atomic items.
4. If still not enough, pull raw resources.

Ranking is time-aware:
- relevance score × time decay
- mutable facts (job/location/current project) prioritize recency

## Maintenance (why it doesn’t rot)
Nightly:
- dedupe
- merge
- promote hot items

Weekly:
- re-summarize
- prune stale items

Monthly:
- rebuild embeddings
- reweight graph edges
- archive dead nodes

## Two cutting-edge upgrades
1. **Context decision trees** (tree-structured memory selection)
   - pick branch → drill down

2. **RLM layer** (reinforced memory manager)
   - learns ADD/UPDATE/DELETE/ARCHIVE policies from outcomes and user corrections

## Non-negotiable guardrail
If retrieval cannot find grounded evidence, the agent must not pretend it remembers.
