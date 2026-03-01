# A2rchitech Integration Chat Plan
## Unified Context, Memory, Retrieval & Agent OS Mapping

---

## 0. Purpose of This Document

This document is the **integration anchor** for the A2rchitech unification chat.

Its goals are to:
- Consolidate **Dynamic Context Discovery**, **Binary + int8 Retrieval**, and **LEANN**
- Define **where each concept lives** in the A2rchitech stack
- Prevent architectural drift
- Establish **hard defaults** so agents behave deterministically
- Serve as a reference for future research merges

This is not exploratory.  
This is **integration + policy**.

---

## 1. Core Problems Being Solved

### 1.1 Context Explosion
- Large prompts degrade reasoning
- Tool outputs exceed context limits
- Repeated summarization causes information loss

### 1.2 Retrieval Bottlenecks
- fp32 embeddings are memory-heavy
- GPU reliance is undesirable
- CPU vector search is bandwidth-bound

### 1.3 Agent Productivity Loss
- Latency compounds across agent loops
- Agents waste time rediscovering context
- Skills/tools scale linearly in prompts

---

## 2. High-Level Architectural Principle

> **Everything is a file.  
> Context is discovered, not preloaded.  
> Retrieval is tiered, not monolithic.**

---

## 3. A2rchitech Layer Mapping (Authoritative)

| Layer | Responsibility | Integrated Concepts |
|-----|---------------|---------------------|
| Kernel Layer | Persistence, memory, retrieval | ContextStore, Retrieval Gateway |
| Context Layer | Addressable artifacts | Context Files, Chat Raw, Summaries |
| Retrieval Layer | Semantic discovery | Binary + int8, LEANN (cold tier) |
| Agent Runtime | Tool use + reasoning | Progressive disclosure, syscalls |
| UI / Dynamic App Layer | Human interaction | Mini-apps, capsules |
| Policy Layer | Determinism & defaults | Retrieval profiles, budgets |

---

## 4. Context & Memory System (Dynamic Context Discovery)

### 4.1 ContextStore (Kernel Service)

All agent-accessible state is persisted as **ContextFiles**.

```
/ctx/
  chat/
    raw/
    summary/
  tools/
    mcp/
  term/
  docs/
  skills/
```

**Key rule:**  
No large artifact is ever injected into the prompt by default.

---

### 4.2 ContextFile Contract

```yaml
ContextFile:
  id: stable
  uri: /ctx/...
  type: chat_raw | summary | tool_output | terminal_log | doc | skill
  size_bytes: int
  token_estimate: int
  source: tool | agent | user | system
  tags: project, task, repo
```

---

### 4.3 Progressive Disclosure Syscalls

Agents interact with context via **file syscalls**, not memory dumps:

- ctx.list
- ctx.search
- ctx.peek
- ctx.tail
- ctx.read
- ctx.grep
- ctx.jq

---

## 5. Chat Memory Model (Lossless)

Each session maintains **two parallel artifacts**:

### 5.1 Raw Log (Never Lost)
```
/ctx/chat/raw/<session>.ndjson
```

### 5.2 Rolling Summary (Prompt-Safe)
```
/ctx/chat/summary/<session>_vN.md
```

---

## 6. Retrieval Architecture (Hard-Coded)

### 6.1 Unified Retrieval Gateway (Mandatory)

All semantic search routes through a single gateway.  
Direct vector DB access is **disallowed**.

---

## 7. Hot Retrieval Tier (Default)

### 7.1 Binary + int8 Two-Stage Retrieval

Pipeline:
1. Query → fp32 embedding
2. Quantize → binary
3. Binary index → candidates
4. int8 scalar rescoring
5. Optional cross-encoder rerank

---

## 8. Cold Retrieval Tier (Optional)

### 8.1 LEANN Policy

Use LEANN only if:
- ≥ ~50–100M chunks
- Rare queries
- Extreme storage constraints

---

## 9. Retrieval Profiles

| Profile | Pipeline |
|------|----------|
| FAST | Binary → int8 |
| ACCURATE | Binary → int8 → cross-encoder |
| COLD | LEANN |
| DEBUG | fp32 (restricted) |

---

## 10. Skills & Tool Discovery

Skills and MCP tools are stored as files and discovered on demand.

---

## 11. Terminal & Execution Logs

All terminal output is written to log files and accessed via grep/read.

---

## 12. Context Budget Manager

Rules:
- Always include goals + summary + pointers
- Never include full logs or large JSON
- ≤70% context for retrieval
- ≥30% reserved for reasoning

---

## 13. Hard Defaults

- Binary + int8 is default retrieval
- Progressive disclosure only
- Recovery always possible via files

---

## 14. Acceptance Criteria

- Prompt size bounded
- Retrieval latency scalable
- No information loss
- Deterministic agent behavior

---

## 15. Strategic Outcome

This architecture enables a scalable, CPU-first, agentic OS with long-lived memory.

---

## 16. Status

This document is the **integration baseline**.
