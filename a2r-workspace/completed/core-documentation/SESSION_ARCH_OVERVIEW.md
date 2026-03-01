# A2rchitech | Session Architectural Overview (Jan 10, 2026)

This document outlines the core systems and structural upgrades implemented during this session to align the repository with the **Project Law** and the **Unified UI / Agentic OS** vision.

---

## 1. The Kernel "Brain" (Determinism & Reasoning)
We transitioned the Kernel from a simple command router to a deterministic reasoning engine.

*   **Directive Compiler (`directive_compiler.rs`)**: Translates raw user intent into structured, pattern-based directives (Zero-Shot, CoT) based on complexity.
*   **Pattern Registry (`patterns.rs`)**: Identifies the "Intent Class" (Discovery vs Execution) and abstracts successful runs into `CandidatePattern` artifacts for future reuse.
*   **Situation Resolver (`situation_resolver.rs`)**: Maps intents to canonical UI situations, deciding the appropriate transition (Push, Modal, Shared Element) and recommended actions.
*   **Context Manager (`context_manager.rs`)**: Implements **Dynamic Context Discovery (DCD)**. It packs the context window based on relevance and token budgets, emitting `ContextMap` artifacts for audit.

## 2. The Unified UI (Projected Surfaces)
We moved to a "Projected UI" model where the shell renders views based on data-driven schemas (`ViewSpecs`).

*   **WorkflowSlideDeck**: Hardware-accelerated navigation system in `app.ts` using hardware transforms for 60fps view transitions.
*   **ViewRegistry (`ViewRegistry.ts`)**: A canonical taxonomy of 15+ view types (Diff, Graph, Decision Log, Timeline, Record, Form, etc.).
*   **Navigation Stack**: Per-capsule memory of view history, enabling deep "Back" button functionality across nested workflows.
*   **Adaptive HUD**: UI now displays **Sandbox Badges** (Network/FS permissions) and **Confidence States** (e.g., "Fogged" UI for low-confidence AI suggestions).

## 3. The Sovereign Vault (Compounding Memory)
We implemented a permanent file-system store for knowledge that survives restarts.

*   **Persistent Intent Graph**: The `IntentGraphKernel` now saves/loads from `workspace/vault/graph.json`. Every intent is a node; every result is a causal edge.
*   **Vault Structure**:
    *   `/vault/sessions/`: Raw event traces.
    *   `/vault/learnings/`: High-value "Promoted" lessons in Markdown.
    *   `/vault/decisions/`: Audit trail of system state changes.
*   **Capture Mechanism**: A first-class intent (`capture learning on [x]`) that promotes transient journal activity into permanent knowledge artifacts.

## 4. The Journal (Causal Provenance)
*   **Causal Linking**: Every `JournalEvent` now tracks `parent_ids` and `root_id`.
*   **Visual Threading**: The UI renders child events with indentation and dashed borders to visualize the "provenance chain" of an agent's reasoning.

---

## 🛠 Active Backlog for Next Agent
1.  **Vault-Search**: Integrate the `/vault` into the `ContextManager` retrieval loop.
2.  **Assistant Identity**: Create the persistent `Assistant` entity in the Kernel.
3.  **Real Adapters**: Connect the `uti-browser` to a real headless Chrome instance.
