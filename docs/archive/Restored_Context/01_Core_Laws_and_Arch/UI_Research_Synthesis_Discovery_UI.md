# Allternit — Research Synthesis (Discovery-First Web + Memory + Skills)
*Purpose:* Ground the Allternit Dynamic Discovery UI in adjacent products and research patterns, and extract reusable primitives.

---

## 1) Category Map: Who Is Already Close?
Allternit sits at the intersection of **(A)** app-like browsing shells, **(B)** personal/enterprise memory systems, and **(C)** agentic web use/automation. The key differentiation is **discovery-first orchestration + capsule-native UI + compression-as-product**.

### A. App-like browsing shells (UI as “workspaces”)
**Arc (The Browser Company)**: “Spaces” segment browsing contexts; pinned tabs behave like persistent app/bookmark hybrids. This is the closest UI precedent for “capsules as miniapps,” but it is still browser-first.  
- Spaces: separate contexts with their own theme/icon/pinned/unpinned groupings.  
- Pinned tabs: persistent, app-like targets within a workspace.

**Takeaway for Allternit**
- Keep “context separation” as a first-class object (your Workspaces).
- Make persistence **explicit and visual** (Dock/Pin transitions), not hidden in tab bars.

### B. Memory systems (capture + recall)
**Rewind (and “life log” timeline tools):** A searchable timeline of your digital past (“ask what happened then replay”). This demonstrates a powerful mental model: time as an index + queryable recall, but it risks surveillance and noise.  
**Microsoft Recall (preview):** “Describe how you remember it” retrieval of past on-screen activity; sparked strong privacy concerns and emphasizes the need for opt-in + exclusions + local-first principles.  
**Perplexity Memory:** Stores structured preferences and “personal search” across conversations to personalize answers.

**Takeaway for Allternit**
- Do **not** store everything. Instead: store **events**, emit **artifacts**, and generate **distillates**.
- Default to **compression**, not accumulation (DistillateCapsules as the primary output of exploration).
- Provide strong **workspace policies**: allowlists, retention, local-first, audit replays.

### C. Agentic web use / automation (browsing as tool substrate)
**Playwright MCP (agent QA loops):** The experience becomes reliable only when the agent can (1) manage dev servers, (2) be nudged to use browser tools, (3) run with fewer approvals, (4) use subagents to manage context, and (5) run isolated for long sessions.  
**browser-use (open source):** A Playwright-based framework for “web automation for agents,” with emphasis on running tasks online, handling auth profiles, and scaling constraints (browser memory, parallelism, fingerprinting).

**Takeaway for Allternit**
- Treat “web use” as a **kernel service** (Web Use Kernel) producing auditable **ObserveCapsules**.
- “Subagents” should be a built-in pattern: keep raw traces out of the main context; return distilled evidence.
- Isolation is mandatory: sandboxed sessions and profiles prevent user disruption and reduce contamination.

---

## 2) Pattern Library: Transferable Primitives
These are the primitives that show up repeatedly across products, but Allternit can unify them into one coherent OS.

### 2.1 Workspaces / Context partitions
- Arc “Spaces” → Allternit “Workspaces”
- Each workspace defines policies and memory boundaries

### 2.2 Persistence objects
- Arc pinned tabs → Allternit Docked Capsules
- Persistence must be visible and reversible

### 2.3 Timeline recall
- Rewind timeline + Recall-style retrieval → Allternit ReplayCapsule
- Allternit adds: **thread edges** and **distillates**

### 2.4 Personalization memory
- Perplexity memory → Allternit Preference Memory layer
- Allternit adds: structured capture via capsule hooks + workspace governance

### 2.5 Evidence-driven automation
- Playwright MCP + browser-use → Allternit Agent Browse mode
- Allternit adds: evidence as UI objects (ObserveCapsules) and transitions that “explain” what happened

---

## 3) Gaps in the Market (Your Differentiation)
Allternit’s moat is not “AI browsing.” It is:
1. **Discovery-first UI**: user experiences intent and artifacts, not URLs and tabs.
2. **Compression-as-product**: the system’s default output is a DistillateCapsule.
3. **Capsule-native memory hooks**: capture happens through typed emissions, not silent surveillance.
4. **Visual skill forging**: Skill creation is an animated, explainable card pipeline.
5. **Auditable automation**: agent actions always return proofs (ObserveCapsules + ReplayCapsules).

---

## 4) Recommended Competitive Scan (Next Research Pulls)
If you want deeper research next, these are the most relevant “adjacent but not identical” lines:
- Enterprise “system of context” vendors (search + governance + agents)
- Personal knowledge graph tools (graph + linking + capture flows)
- Agentic automation frameworks (browser + desktop + tool protocols)
- Timeline/recall products (privacy models + UX patterns for search+replay)

---

## References (URLs in code block)
```text
Vibe Kanban — Playwright MCP autonomous QA article:
https://www.vibekanban.com/blog/does-playwright-mcp-unlock-autonomous-qa

Arc Help Center — Spaces (context partitions):
https://resources.arc.net/hc/en-us/articles/19228064149143-Spaces-Distinct-Browsing-Areas

Rewind — timeline UI + “ask what happened”:
https://rewind.sh/

Perplexity Help — Memory / Personal Search:
https://www.perplexity.ai/help-center/en/articles/10968016-memory

Perplexity Blog — “Introducing AI assistants with memory”:
https://www.perplexity.ai/hub/blog/introducing-ai-assistants-with-memory

WIRED — Microsoft Recall alternatives + privacy framing:
https://www.wired.com/story/microsoft-recall-alternatives

browser-use (GitHub):
https://github.com/browser-use/browser-use
```
