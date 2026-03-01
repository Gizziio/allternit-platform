---
a2r_session: true
topic: Cognitive-Triggered Recall via PreToolUse (Semantic Memory Injection)
date: 2026-02-04
timezone: -0600
participants:
  - Joe Dirte
  - Gizzi
sources:
  - User-provided tweet + 3 screenshots (memory injection + PreToolUse diagram)
session_type: Architecture / Agent Runtime Primitive
---

# A2R Session Summary — Cognitive-Triggered Recall via PreToolUse

## 0) What happened in this session
You provided a tweet + screenshots describing a Claude Code hook pattern: **semantic memory injection not only at UserPromptSubmit, but also at PreToolUse**, using the **latest thinking block** right before each tool call to retrieve relevant memories and inject them synchronously.

I analyzed the mechanism and translated it into an A2rchitech-grade primitive: **Cognitive-Triggered Recall (CTR)**.

---

## 1) Core claim from the source material
### Problem
Relying on **UserPromptSubmit-only** semantic memory injection causes **workflow drift**:
- Long tool-driven workflows move far away from the original prompt.
- The memories injected at prompt-start become less relevant as execution progresses.
- This increases error loops, wasted tool calls, and delayed convergence.

### Proposed solution
Add a **PreToolUse hook** that:
1. Extracts ~last 1500 chars of the most recent *thinking block / reasoning chunk* in the active transcript
2. Embeds that text
3. Vector-searches a memory DB
4. Injects top-k memories into `additionalContext`
5. Claude proceeds with the tool call with refreshed, on-topic context

Claimed latency: sub-500ms and “self-correcting workflow” behavior.

---

## 2) Evidence shown in the screenshots (artifacts)
### Artifact A — Similarity threshold behavior (screenshot)
- Recalled memories showing similarity bands roughly:
  - **0.70+**: consistently actionable/helpful
  - **0.64–0.70**: often tangential/noisy
- Repetition problem:
  - same 3–4 memories injected repeatedly across tool calls
  - dedup “already seen in this session” would help

### Artifact B — Example of mid-stream correction (screenshot)
- A recalled memory warns about path expansion in settings (`~` / `$HOME`) not being reliable; recommendation: use full absolute Git Bash paths.
- Agent uses that recall to proactively fix settings and references.

### Artifact C — ASCII flow diagram (screenshot)
A pipeline sketch:
- PreToolUse fires before each read-only tool
- Extract thinking tail → hash check for same query
- If new → query recall daemon → top hits (>= threshold) → inject additionalContext
- If duplicate → skip (no-op)

---

## 3) Gizzi’s translation into A2rchitech primitives
### Name
**CTR — Cognitive-Triggered Recall**

### What CTR is (first principles)
- The best retrieval query is not the user prompt.
- The best retrieval query is the agent’s **current intent + hypothesis + next action** (i.e., its live cognitive state).
- The most reliable capture of that state is the reasoning block immediately before a tool call.

### Why it matters
CTR turns static memory into a **feedback controller**:
- drift begins → it appears in the reasoning → retrieval happens right before action → corrective priors appear → tool use is redirected earlier

---

## 4) Proposed integration points in your stack
CTR is a runtime primitive that belongs adjacent to:
- WIH enforcement
- tool registry / tool gating
- acceptance-test loops
- planner→implementer handoffs
- error-driven remediation

Suggested triggers beyond PreToolUse:
- PostToolUse on error
- loop boundary checkpoints
- acceptance test failures
- spec drift detection events
- role handoffs (Planner → Implementer → Tester)

---

## 5) Policy and quality controls implied by this session
### Similarity thresholding
- Default retrieval threshold: **~0.72** (based on screenshot behavior)
- Raise thresholds for riskier actions (write/destructive tools)

### Dedup + anti-spam
- “Already seen in session” suppression
- Hash the query payload (thinking tail + tool + file + WIH) to avoid repeats
- Cap injected memories (e.g., 3 max)
- Add novelty bias (prefer unseen clusters)

### Tool-specific retrieval profiles
- Different thresholds and memory types depending on tool category:
  - Read tools can accept broader recall
  - Write tools should require higher confidence and tighter filtering

---

## 6) What we *did not* implement in this session
- No code changes were made.
- No A2rchitech spec file was generated yet.
- No hook schema was finalized (inputs/outputs/metadata envelope).

This session was architecture validation + system design mapping.

---

## 7) Action items queued from this session
1. **Spec module draft**
   - `/spec/Memory/CognitiveTriggeredRecall.md`
   - define triggers, query construction, similarity rules, dedup policy, safety gating, injection format

2. **Hook contract**
   - Standardize “ReasoningTailCapture”:
     - source: latest thinking block tail
     - length: 1500–2500 chars configurable
     - include: tool name, file path, WIH id, error snippet if present

3. **Memory taxonomy**
   - Tag memories by type (LAW / GOTCHA / BUG / PATH / ENV / BUILD / UI / SECURITY)
   - Let retrieval prefer certain tags by tool + WIH

4. **Session-level recall cache**
   - prevent “same 3 memories 10 times” behavior
   - TTL-based suppression

---

## 8) Open questions to resolve later
- Best reasoning capture method in A2rchitech runtime (thinking blocks equivalent?)
- Where CTR memory lives (vector DB vs knowledge graph vs hybrid)
- How to represent “negative memories” (warnings, failure cases) vs “positive patterns”
- Whether injection should be raw memory snippets vs compressed, policy-shaped guidance
- How CTR interacts with repo law + spec deltas (when memory conflicts with spec)

---

## 9) Session takeaway (one line)
CTR via PreToolUse is a high-leverage upgrade: **retrieve based on live cognition, not the initial prompt**, with dedup and thresholds to avoid recall spam.
 earlier in session 

 This is… genuinely sharp systems engineering.

What the author is doing is closing the temporal gap in retrieval-augmented cognition.

Most agent memory systems are:

Prompt → inject memories → run long workflow → drift → mistakes → rediscover → fix late.

They’re pointing out something fundamental:

❖ Memory injection at prompt time is too early for tool-driven workflows.

Once the agent starts reasoning, exploring files, hypothesizing bugs, running commands, etc., the state of the problem changes. The initial embedding no longer matches the live working set.

What they did instead:

⸻

1. What the PreToolUse Hook Is Actually Doing

They exploit a structural fact about Claude Code:

Before every tool call:
	•	Claude writes a thinking block
	•	Then selects a tool
	•	Then the PreToolUse hook fires
	•	Hooks are synchronous

So they:
	1.	Grab the last ~1500 chars of the thinking block
	2.	Embed that text
	3.	Query vector DB
	4.	Retrieve top-k semantic memories
	5.	Inject them via additionalContext
	6.	Claude proceeds with the tool — now mid-course corrected

That gives:

continuous retrieval aligned with live cognition, not stale prompts.

This is the same architectural jump as:
	•	stateless RAG → streaming RAG
	•	offline planning → online replanning
	•	batch retrieval → event-driven retrieval

⸻

2. Why This Is So Effective

The key insight is this line:

Thinking blocks are filled with meaning & intent.

Exactly.

Those blocks contain:
	•	hypotheses (“this bug is probably env var expansion”)
	•	causal reasoning
	•	next actions
	•	uncertainty
	•	debug strategies
	•	partial models of the system

Embedding that is vastly better than embedding:

“Fix my build pipeline.”

Because now the vector query becomes:

“windows bash tilde expansion hook path fork bug settings.json”

Which retrieves:
	•	previous path bugs
	•	env var expansion gotchas
	•	fork linkage rules
	•	registry reload requirements

You’re essentially giving the agent:

episodic recall triggered by cognition state.

That is very close to how humans correct themselves while acting.

⸻

3. The Threshold Observations Are Important

They observed:
	•	0.70+ similarity → actionable
	•	0.64–0.70 → noise
	•	repeated injection of the same memory → diminishing returns

That implies:

You need:
	•	per-session deduplication
	•	“already seen” suppression
	•	decay curves
	•	adaptive thresholds by tool type
	•	novelty bias
	•	recency weighting

Otherwise you get:

retrieval spam.

This maps exactly to what you’re already designing in A2rchitech: law layers, tool registries, WIH gating, enforcement loops.

⸻

4. This Is Directly Relevant to Gizzi / A2rchitech

You are literally building:
	•	MCP orchestrators
	•	agent shells
	•	deterministic front matter
	•	boot layers
	•	context packs
	•	repo law enforcement
	•	tool gates
	•	live code audit agents
	•	trading agents
	•	research loops

This technique slots in cleanly as:

⸻

✦ A2rchitech Primitive: Cognitive-Triggered Recall (CTR)

You should treat this as a first-class system primitive:

When an agent:
	•	switches tools
	•	enters a new WIH
	•	hits an error
	•	changes hypothesis
	•	restarts loops
	•	fails acceptance tests

→ embed the current reasoning state
→ query memory graph
→ inject only novel, high-confidence hits.

⸻

5. How I’d Formalize This In Your Stack

For Gizzi / A2rchitech:

Trigger Points
	•	PreToolUse
	•	PostToolUse (error only)
	•	Loop boundary
	•	AcceptanceTest fail
	•	Planner → Implementer handoff
	•	Repo scan phase start
	•	Trading setup evaluation
	•	Spec delta detection

⸻

Memory Query Inputs

Instead of only:
	•	user prompt

Also:
	•	reasoning block
	•	current file path
	•	tool name
	•	WIH front matter
	•	failing test output
	•	error trace
	•	branch name
	•	ADR ID
	•	spec section

Hash these to avoid duplicate queries.

⸻

Injection Policy
	•	min similarity default: 0.72
	•	raise to 0.80 for destructive tools
	•	novelty filter: unseen this session
	•	max 3 memories
	•	suppress same cluster twice in N minutes
	•	summarize cluster before injecting

⸻

6. Why This Is “Self-Correcting”

What’s happening architecturally:

You’ve added a feedback controller.

The agent deviates → reasoning reflects deviation → retrieval triggers → corrective prior appears → course correct before executing.

That’s:

Model-Predictive Control for cognition.

You’re no longer hoping the agent remembers.

You’re forcing state alignment.

⸻

7. Strategic Take

This is not a toy hack.

This is the same category as:
	•	Ralph loops
	•	reflection passes
	•	self-critique
	•	execution gating
	•	law enforcement layers
	•	spec-driven CI

Except it’s cheaper and faster because:
	•	embeddings are tiny
	•	queries are cheap
	•	hook latency is sub-500ms
	•	saves minutes of agent wandering

⸻

8. What I’d Add Beyond Their Implementation

They’ve got:

✔ PreToolUse recall
✔ thinking-block embeddings
✔ similarity thresholds
✔ vector DB
✔ dedup ideas

You should add:
	•	memory type tagging (BUG, GOTCHA, LAW, PATH, OS, ENV)
	•	tool-specific retrieval profiles
	•	repo-scoped memory namespaces
	•	cross-agent shared episodic pool
	•	eviction policies
	•	negative memories (“this failed”)
	•	drift detectors
	•	contradiction alerts
	•	automatic ADR creation when memory repeatedly saves the day

⸻

Final verdict:

This is absolutely a breakthrough pattern for long-running agents.

For A2rchitech, it belongs in your core runtime loop, right next to:
	•	WIH enforcement
	•	spec loading
	•	law validation
	•	tool gating
	•	acceptance tests
	•	orchestrator routing

If you want, next we can:

👉 formalize this as an A2rchitech spec module:

with:
	•	lifecycle diagrams
	•	hook API
	•	scoring formulas
	•	dedup logic
	•	thresholds
	•	eviction policy
	•	safety gating
	•	integration points with MCP + repo law
