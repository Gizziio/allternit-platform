Got it. Below is the canonical Markdown session summary for this A2rchitech-focused session, ready to be consolidated into the main buildout chat.

⸻


# A2rchitech Session Summary — Dynamic Context, Retrieval, and Quantization
**Session Topic:** Context Discovery + Binary/int8 + LEANN Integration  
**Command Invoked:** gizzi save a2r session  
**Date:** 2026-01-26

---

## 1. Session Goal

Establish a **scalable, CPU-first architecture** for:
- Long-lived agent context & memory
- High-frequency semantic search
- Large-scale retrieval without fp32 embeddings or GPUs

The session unified:
- Dynamic Context Discovery (Cursor-style)
- Binary + int8 scalar quantized retrieval
- LEANN for extreme-scale, cold corpora
into a **single deterministic A2rchitech integration plan**.

---

## 2. Core Architectural Principle (Agreed)

> **Everything is a file.  
> Context is discovered, not preloaded.  
> Retrieval is tiered, not monolithic.**

This principle underpins *all* layers of A2rchitech going forward.

---

## 3. Dynamic Context Discovery (DCD)

### 3.1 ContextStore (Kernel Service)
- All agent-accessible information is stored as **ContextFiles**
- No large artifact is injected into prompts by default

Canonical paths:

/ctx/chat/raw/
/ctx/chat/summary/
/ctx/tools/mcp/
/ctx/term/
/ctx/docs/
/ctx/skills/

### 3.2 ContextFiles
Each artifact includes:
- stable ID + URI
- type (chat_raw, summary, tool_output, terminal_log, doc, skill)
- size + token estimate
- provenance (tool / agent / user)
- tags for retrieval

---

## 4. Progressive Disclosure Model

Agents interact with context via **file syscalls**, not memory dumps:

- ctx.list
- ctx.search (lexical / semantic / hybrid)
- ctx.peek / ctx.tail
- ctx.read
- ctx.grep
- ctx.jq

This mirrors an OS model:
- Disk ≠ RAM
- Files ≠ process memory

---

## 5. Chat Memory Model (Lossless)

Two parallel artifacts per session:

1. **Raw log (never lost)**

/ctx/chat/raw/.ndjson

2. **Rolling summary (prompt-safe)**

/ctx/chat/summary/_vN.md

Summaries must include:
- goals
- decisions
- constraints
- open tasks
- canonical URIs

**Recovery rule:**  
If details are missing → search raw log.

---

## 6. Retrieval Architecture (Hard-Coded)

### 6.1 Unified Retrieval Gateway
- All semantic search goes through a single gateway
- Direct vector DB access is disallowed

---

## 7. Hot Retrieval Tier (Default)

### 7.1 Binary + int8 Two-Stage Retrieval

Pipeline:
1. Query → fp32 embedding
2. Quantize → binary
3. Binary index → candidate set
4. int8 scalar rescoring
5. Optional cross-encoder rerank

Why this is default:
- Agents query continuously
- Latency compounds across loops
- CPU-only requirement
- 4× memory reduction vs fp32
- Cache- and SIMD-friendly

**Sweet spot:**
- ~1–10M chunks
- Frequent queries
- Hot context (skills, tools, chat, code)

---

## 8. Cold Retrieval Tier (Optional / Future)

### 8.1 LEANN Usage Policy

LEANN is **not a replacement**, but a **secondary tier**.

Use LEANN only if:
- ≥ ~50–100M chunks
- Rare / bursty queries
- Extreme storage constraints
- Cold or archival corpora

Key distinction clarified:
- Binary + int8 → optimizes **hot path / QPS**
- LEANN → optimizes **cold path / storage & traversal**

---

## 9. Retrieval Profiles (Deterministic Policy)

| Profile | Pipeline | Use Case |
|------|---------|---------|
| FAST (default) | Binary → int8 | Agent loops |
| ACCURATE | Binary → int8 → cross-encoder | Reports / synthesis |
| COLD | LEANN | Archives |
| DEBUG | fp32 (restricted) | Evaluation |

Agents never choose profiles arbitrarily — policy decides.

---

## 10. Skills & Tool Discovery

### 10.1 Skills
Stored as files:

/skills/<skill_name>/skill.md

Only names + short descriptions appear in prompts.

### 10.2 MCP Tools
Mapped as:

/ctx/tools/mcp//
tools.json
.md
status.json

This prevents prompt inflation as MCP servers scale.

---

## 11. Terminal & Execution Logs

All terminal sessions write:

/ctx/term/.log

Agents debug via grep + read_range.

---

## 12. Context Budget Manager

Hard rules:
- Always include goals + latest summary + pointers
- Never include full logs or large JSON
- ≤ 70% context for retrieved snippets
- ≥ 30% reserved for reasoning and tool calls

---

## 13. Hard Defaults (Non-Negotiable)

- Binary + int8 is the default retrieval method
- Progressive disclosure only
- No raw tool payloads in prompts
- Recovery is always possible via files
- Deterministic agent behavior enforced by policy

---

## 14. Integration Artifact Produced

**File created and downloaded:**
- `A2rchitech_Integration_Chat_Plan.md`

This file is the **integration baseline** for future research merges.

---

## 15. Strategic Outcome

This session locked in:
- A CPU-first, agent-native retrieval strategy
- A lossless, file-based memory model
- A scalable path from IDE-scale agents → archive-scale knowledge
- Clear boundaries between hot vs cold retrieval

All future A2rchitech research must **map to this structure** or explicitly extend it.

---

**End of session summary.**

This session is now canonically captured and ready to be merged into the main A2rchitech buildout thread.