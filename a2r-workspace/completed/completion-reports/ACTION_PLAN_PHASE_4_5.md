# Action Plan: Phase 4 & 5 Implementation

## Goal
Implement the Assistantization (Phase 4) and Proactivity (Phase 5) layers of the A2rchitech Kernel. This includes the Assistant Identity, Agent Templates, Goal/Task DAGs, State Engine, and Scheduler.

## Phase 4: Assistantization
1.  **Assistant Identity Kernel**:
    *   Create `services/kernel/src/assistant.rs`.
    *   Define `AssistantIdentity` (Persona, Preferences) in `types.rs`.
    *   Implement `AssistantManager` to manage the singleton assistant instance.
2.  **Agent Templates**:
    *   Define `AgentSpec` and `RunProfile` in `types.rs` (matching `Architecture/UNIFIED/RUNTIME/Kernel.md`).
    *   Create `services/kernel/src/agent_registry.rs` to store and retrieve templates.
    *   Register default roles: "Researcher", "Builder".
3.  **Goals & Projects**:
    *   Enhance `IntentGraphKernel` in `services/kernel/src/intent_graph.rs` to support Goal -> Task decomposition helper methods.

## Phase 5: Proactivity
1.  **State Engine**:
    *   Create `services/kernel/src/state_engine.rs`.
    *   Implement logic to compare `JournalLedger` (current state) vs `IntentGraphKernel` (desired state/Goals).
    *   Generate `Suggestion` objects when deltas are found.
2.  **Scheduler**:
    *   Create `services/kernel/src/scheduler.rs`.
    *   Implement a basic event loop (tokio::spawn) to trigger periodic tasks (e.g., "Daily Summary").
3.  **Proactive Suggestions API**:
    *   Expose `GET /v1/suggestions` in `main.rs`.

## Affected Files
*   `services/kernel/src/types.rs` (New structs)
*   `services/kernel/src/main.rs` (Wiring new services, new routes)
*   `services/kernel/src/intent_graph.rs` (Enhancements)
*   `services/kernel/src/assistant.rs` (New)
*   `services/kernel/src/agent_registry.rs` (New)
*   `services/kernel/src/state_engine.rs` (New)
*   `services/kernel/src/scheduler.rs` (New)

## Breaking Changes
*   None. New functionality is additive.

## Verification
*   Unit tests for `StateEngine` logic.
*   Unit tests for `AgentRegistry` lookups.
*   Manual verification via `curl` to new endpoints.
