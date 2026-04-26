Deep research: TheAgentContextLab/OneContext (what it actually is)

1) What’s public in the repo vs what the product likely is

The GitHub repo you linked is mostly end-user documentation + assets, not the implementation. The README describes OneContext as an “agent self-managed context layer” and exposes a CLI install path via npm i -g onecontext-ai, which then installs a Python CLI underneath and provides onecontext | onecontext-ai | oc command aliases.  ￼

The documentation screenshots show a GUI workflow:
	•	“Add Context” (name a context)
	•	“New Session” (create a session with a working path)
	•	automatic session summary shown on the left
	•	shareable link generation
	•	Slack querying (“ask the context in Slack”)
	•	importing a shared session locally
	•	archiving sessions/contexts and restoring them  ￼

So: public repo = “how to use it”; the underlying product appears to be a desktop wrapper + persistence layer around CLI coding agents (Claude Code / Codex), with sharing + import.

2) Two similarly-named “OneContext” things exist (don’t conflate them)

There’s also an older “OneContext” ecosystem that’s RAG-as-a-service (contexts/knowledge bases/pipelines), with its own PyPI package named onecontext and docs at docs.onecontext.ai. That is a different product lineage than the 2026 “onecontext-ai” wrapper you’re looking at.  ￼

For Allternit: you care about AgentContextLab OneContext (2026), not “RAG OneContext (2023–2024).”

3) The theoretical core: “Git Context Controller” (GCC)

A paper by Junde Wu formalizes a mechanism called Git Context Controller (GCC): treat “context” like a version-controlled artifact with operations like COMMIT / BRANCH / MERGE / CONTEXT, stored as a persistent filesystem hierarchy (the paper uses a .GCC/ directory).  ￼

Key idea (first principles):
Long-horizon agent work fails because context is either:
	•	too large (expensive, slow, hits limits), or
	•	too compressed (loses critical details, can’t ground decisions)

GCC’s fix is not “bigger context,” it’s structured persistence + selective retrieval:
	•	checkpoint meaningfully (COMMIT),
	•	explore alternatives (BRANCH),
	•	reconcile (MERGE),
	•	retrieve at multiple resolutions (CONTEXT).  ￼

4) OneContext (product) looks like a practical packaging of GCC concepts

Even without source code, the user-facing flow matches GCC’s goals:
	•	sessions under a context (branch-like grouping)
	•	summaries shown automatically (multi-resolution “context”)
	•	share link (handoff)
	•	import old sessions (rehydrate context)
	•	Slack Q&A interface (thin client against a stored context)  ￼

There are also public posts/articles describing it as a persistent context layer across sessions/devices/agents, shareable by link.  ￼

⸻

How this maps to A://TERNIT (native implementation plan, not a clone)

A) What Allternit should steal (the primitives) vs what to ignore (the packaging)

Steal (core primitives):
	1.	Context as a first-class object (not “chat history”)
	2.	Versioned memory ops: commit/branch/merge/context
	3.	Multi-resolution retrieval: summary → structured state → traces
	4.	Handoff mechanism: “share context” as an artifact
	5.	Import/rehydrate: pull old trajectories into current work

Ignore (packaging choices):
	•	their desktop GUI assumptions
	•	their particular Slack integration shape
	•	their CLI wrapper choices (Node→Python routing)

Allternit should implement this as repo-native law-layer memory consistent with your SOT/WIH/Contracts model.

B) The clean Allternit-native design (fits your law layer + living files)

You already have the right direction: living files + observability + review loop + garbage collection. OneContext/GCC becomes your Context Control Plane.

1) Filesystem layout (Allternit)
Use a dedicated root (example):

.allternit/
  context/
    contexts/<context_id>/
      context.md              # high-level “what is this context”
      state.json              # canonical structured state (small)
      branches/<branch_id>/
        summary.md            # branch snapshot (rewritten)
        commits/<ts>-<hash>/
          commit.md           # human-readable delta summary
          traces.ndjson       # tool calls / events (append-only)
          artifacts/          # outputs produced
          patchset/           # optional diffs, pointers, links
      index.json              # fast lookup, timestamps, pointers
      share/
        bundles/<bundle_id>.tar.zst  # exportable share artifact

This matches GCC’s claim (“context as a versioned memory hierarchy”) while aligning with your repo-law preference for human-readable + machine-verifiable artifacts.  ￼

2) The 4 operations as tooling contracts (Allternit tools)
Define these as internal tools with typed schemas:
	•	ctx.commit(context_id, branch_id, message, evidence_refs[])
	•	ctx.branch(context_id, from_branch_id, new_branch_id, intent)
	•	ctx.merge(context_id, source_branch_id, target_branch_id, strategy)
	•	ctx.context(context_id, branch_id, query, resolution=summary|state|trace, time_range?)

This is exactly the GCC model, but enforced through Allternit’s tool registry + risk tiers (read-only vs write).  ￼

3) Multi-resolution retrieval (the real win)
When an agent boots (B0), it should not slurp history. It should load:
	•	context.md + branches/<active>/summary.md (cheap)
	•	selectively pull state.json if needed
	•	pull traces.ndjson only by query/time window

This is how you keep “context” lean while remaining groundable.

C) Where your “Three-layer memory” post fits (Clawdbot upgrade)

That post proposes:
	•	Layer 1: entity knowledge graph
	•	Layer 2: daily notes
	•	Layer 3: tacit MEMORY.md

Allternit can unify this with GCC by treating:
	•	Layer 2 (daily notes) as traces.ndjson (append-only timeline)
	•	Layer 1 (entities) as structured projections derived from traces (entities/*.json)
	•	Layer 3 (tacit) as stable operator prefs / policies in MEMORY.md / AGENTS.md

So the combined Allternit model becomes:

Event log (truth) → projections (entities/state) → summaries (branch/context snapshots)
This avoids “stale memory” without deleting history.

D) Sharing links (how to do it without their infra)

OneContext “share link” can be implemented in Allternit as:
	•	export a signed context bundle (tar.zst) containing summaries + selected traces + state
	•	upload to a storage backend you control (or user-provided S3/R2)
	•	generate a link that encodes: storage locator + bundle hash + optional decryption key

This gives you:
	•	reproducibility (hash)
	•	integrity (signature)
	•	portability (bundle)
	•	vendor-avoidance (BYO storage)

E) Garbage collection (your missing piece)

To keep compounding memory from turning into sludge:
	•	retain raw traces forever (cheap, compressed)
	•	aggressively rewrite summaries weekly or on major commits
	•	maintain an index of “active facts” vs “superseded”
	•	prune only derived artifacts (old embeddings, old projections), never the raw log

That matches both GCC’s “versioning” and the three-layer “superseding not deleting” principle.

⸻

Practical “Allternit next steps” checklist
	1.	Spec: /spec/ContextControl.md
	•	ops: commit/branch/merge/context
	•	file layout
	•	invariants: append-only traces, rewriteable summaries, hash-addressed artifacts
	2.	Tools: /spec/Contracts/context-tools.json (typed schemas)
	3.	Runtime hook: on every tool call / step, append to traces.ndjson
	4.	Synthesis job: weekly (or milestone-based) rewrite summary.md from traces + active state
	5.	Share/export: bundle + signer + verifier
	6.	UI: “Context view” as first-class: branches, commits, diff of summaries, replay traces

⸻

gizzi save allternit session (paste-ready Markdown)

# Allternit Session Summary — OneContext + GCC + Three-Layer Memory (2026-02-18)

## What Joe asked for
- Deep research + analysis of https://github.com/TheAgentContextLab/OneContext
- Then: “gizzi save allternit session” (produce a single MD summary mapping to A://TERNIT)

---

## Key findings (what OneContext is)
### Repo surface area
- TheAgentContextLab/OneContext repo is primarily docs + screenshots; it describes a product that:
  - Creates a named **Context**
  - Creates multiple **Sessions** under that context (with a working path)
  - Auto-shows **session summaries**
  - Generates a **shareable link**
  - Supports asking the context in **Slack**
  - Allows **importing** a shared session locally
  - Supports **archiving/restoring** sessions and contexts

### Install / CLI routing
- Install shown as: `npm i -g onecontext-ai`
- The npm wrapper installs a Python CLI and exposes aliases: `onecontext`, `onecontext-ai`, `oc`

### Naming collision
- There is an older “OneContext” ecosystem (RAG pipelines / knowledge bases) that uses a different PyPI package (`onecontext`) and different docs. Do not conflate with the 2026 AgentContextLab OneContext.

---

## The theoretical backbone (GCC)
- A paper by Junde Wu: **“Git Context Controller: Manage the Context of LLM-based Agents like Git”**
- Core concept: treat agent context like Git:
  - **COMMIT**: checkpoint progress
  - **BRANCH**: explore alternative plans
  - **MERGE**: reconcile divergent paths
  - **CONTEXT**: retrieve history at multiple resolutions
- Storage: persistent filesystem hierarchy (paper example uses a `.GCC/` directory)
- Goal: long-horizon agent work without context bloat or lossy compression

---

## Mapping to A://TERNIT (native implementation, not a clone)

### What to adopt (primitives)
1. Context as a first-class artifact (not chat history)
2. Versioned memory operations: commit/branch/merge/context
3. Multi-resolution retrieval: summaries → state → traces
4. Share/handoff as an exportable artifact
5. Import/rehydrate old trajectories into new sessions

### Allternit filesystem layout proposal

.allternit/
context/
contexts/<context_id>/
context.md
state.json
branches/<branch_id>/
summary.md
commits/-/
commit.md
traces.ndjson
artifacts/
patchset/
index.json
share/bundles/<bundle_id>.tar.zst

### Allternit tool contracts (Context Control Plane)
- ctx.commit(context_id, branch_id, message, evidence_refs[])
- ctx.branch(context_id, from_branch_id, new_branch_id, intent)
- ctx.merge(context_id, source_branch_id, target_branch_id, strategy)
- ctx.context(context_id, branch_id, query, resolution, time_range?)

### Multi-resolution retrieval rule
- On boot: load `context.md` + `branches/<active>/summary.md`
- Pull `state.json` only if needed
- Pull `traces.ndjson` only by query/time window

---

## Integrating the “Three-layer memory” idea
### Unification model
- Truth layer: append-only **event log** (`traces.ndjson`)  ← (Layer 2: daily notes)
- Projections: **entities/state** derived from traces        ← (Layer 1: knowledge graph)
- Snapshot: rewritten **summaries** weekly/milestone-based   ← (Layer 3: tacit + current state)

### Superseding policy (no deletion)
- Raw traces never deleted
- Facts in projections can be marked superseded with pointers to replacements
- Summaries rewritten from active projections

---

## Sharing links without vendor lock-in
- Export signed context bundles: `bundle.tar.zst` + hash + signature
- Store on BYO object storage (S3/R2/etc.)
- Generate a link encoding locator + hash (+ optional decryption key)

---

## Garbage collection (required for compounding memory)
- Keep raw traces forever (compressed)
- Rewrite summaries frequently
- Recompute projections incrementally
- Prune only derived artifacts (embeddings, old projections), not the raw log

---

## Immediate next steps
1. Spec: `/spec/ContextControl.md` (ops, layout, invariants)
2. Contracts: `/spec/Contracts/context-tools.json` (typed schemas)
3. Runtime: append tool-call/events to `traces.ndjson`
4. Synthesis: weekly job to rewrite `summary.md` + update projections
5. Export/share: bundle signer/verifier + BYO storage adaptor
6. UI: context browser (branches/commits/diffs/replay)

---

## Links captured
- OneContext repo: https://github.com/TheAgentContextLab/OneContext
- GCC paper: https://arxiv.org/abs/2508.00031

If you want, next turn I can convert that spec into your repo-law format: /SOT.md anchors + /spec/Baseline + /spec/Deltas + typed /spec/Contracts/* (WIH-ready).