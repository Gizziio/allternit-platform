# P1-C: ORCHESTRATION LOOP (ReAct)
## The Brain: Connecting Intent to Tools via LLM

**Target**: Enable dynamic multi-step reasoning.
**Goal**: "Research quantum computing and write a note" should trigger:
1. `web.search("quantum computing")`
2. `note.create(...)`
...automatically, driven by an LLM.

---

## 📋 PLAN OVERVIEW

| PR | Scope | Source | Goal |
|---|---|---|---|
| **PR #17: P1-C1** | OpenAI Adapter | `crates/providers` | Implement `LLMProvider` trait for OpenAI. |
| **PR #18: P1-C2** | ReAct Orchestrator | `services/kernel` | Implement Thought-Action-Observation loop. |
| **PR #19: P1-C3** | Dispatcher Wiring | `services/kernel` | Route intents to Orchestrator. |

---

## 📦 PR #17: P1-C1 — OPENAI ADAPTER

**Purpose**: Talk to the AI.

#### Task C1-1: OpenAI Implementation
**Location**: `crates/providers/src/adapters/openai.rs`
**Details**:
- `struct OpenAIProvider { api_key: String }`
- `impl Provider for OpenAIProvider`
- `complete(prompt) -> String`

#### Task C1-2: Provider Factory
**Location**: `crates/providers/src/lib.rs`
**Details**:
- Simple factory to create provider based on env var `LLM_PROVIDER` (default "openai").

---

## 📦 PR #18: P1-C2 — REACT ORCHESTRATOR

**Purpose**: The reasoning loop.

#### Task C2-1: Orchestrator Struct
**Location**: `services/kernel/src/orchestrator.rs`
**Details**:
- Input: `goal`, `tools`
- Loop:
  - Construct prompt (System + History + Tools)
  - Call LLM
  - Parse `Action: <tool>(<args>)`
  - Execute Tool via `ToolGateway`
  - Append Observation
- Output: Final Answer

---

## 📦 PR #19: P1-C3 — WIRING

**Purpose**: Connect the Shell to the Brain.

#### Task C3-1: Update Dispatcher
**Location**: `services/kernel/src/intent_dispatcher.rs`
**Details**:
- If `fwk_search` or `fwk_note` is selected, use Orchestrator to fulfill the intent dynamically.
- Stream "Thinking..." events to Journal.

---

## 🎯 ACCEPTANCE: INTELLIGENT AGENT DEMO

1. **User** types `research rust lang and save a summary`.
2. **Agent** searches web.
3. **Agent** writes file.
4. **Journal** shows the reasoning chain.
