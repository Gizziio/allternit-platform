
# Unified Context, Memory, Retrieval, and Inference Architecture
## A2rchitech Canonical Integration Specification (Final)

---

## 0. Purpose of This Document (Authoritative)

This document is the **single integration anchor** for the A2rchitech unified architecture.

All future Markdown files, research notes, specs, and experiments must:
- Map explicitly to this document
- Extend it without contradiction
- Declare which layer they modify
- Respect the hard defaults defined here

This document unifies:
- Dynamic Context Discovery
- File-based Agent Memory
- Binary + int8 Retrieval
- LEANN (cold tier)
- RLM (semantic agent memory)
- Context Compilation
- KV Cache Externalization
- Inference-time State Reuse

This is **integration + policy**, not exploration.

---

## 1. Core Problems Being Solved

### 1.1 Context Explosion
- Large prompts degrade reasoning quality
- Tool outputs exceed usable context limits
- Repeated summarization causes irreversible loss

### 1.2 Retrieval Bottlenecks
- fp32 embeddings are memory-heavy
- GPU dependence is undesirable
- CPU vector search becomes bandwidth-bound

### 1.3 Inference Inefficiency
- Prefix recomputation dominates latency
- Long-context inference is memory-movement bound
- Agent loops repeatedly replay identical prefixes

### 1.4 Agent Productivity Loss
- Latency compounds across loops
- Agents rediscover known state
- Skills and tools inflate prompts linearly

---

## 2. Foundational Architectural Principle

> **Everything is a file.  
> Context is discovered, not preloaded.  
> Retrieval is tiered, not monolithic.  
> Inference is state replay, not recomputation.**

---

## 3. Authoritative Layer Model (No Overlap)

| Layer | Responsibility | Concepts |
|-----|---------------|---------|
| Kernel Layer | Persistence + state services | ContextStore, Retrieval Gateway, KV Services |
| Context Layer | Addressable artifacts | ContextFiles, Chat Raw, Summaries |
| Retrieval Layer | Semantic discovery | Binary + int8 (hot), LEANN (cold) |
| Agent Runtime | Reasoning + tools | RLM, progressive disclosure, syscalls |
| Context Compiler | Semantic → tokens | Deterministic compilation |
| Execution Layer | Inference acceleration | KV cache, prefix reuse, paging |
| Policy Layer | Determinism & budgets | Retrieval profiles, context budgets |
| UI / Dynamic App Layer | Human interaction | Capsules, mini-apps |

Each layer has **one job**.  
No layer leaks abstractions upward.

---

## 4. Context & Memory System (Dynamic Context Discovery)

### 4.1 ContextStore (Kernel Service)

All agent-accessible state exists as **files**, never implicit memory.

/ctx/
- chat/
- raw/
- summary/
- tools/
- mcp/
- term/
- docs/
- skills/

**Hard Rule:**  
No large artifact is injected into a prompt by default.

---

## 18. Status

This document is the **canonical baseline**.

All future Markdown files must:
- Reference this document
- Declare affected layers
- Extend without contradiction

End of specification.
