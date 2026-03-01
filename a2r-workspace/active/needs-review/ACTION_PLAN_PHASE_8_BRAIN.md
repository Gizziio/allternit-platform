# Action Plan: Phase 8 Intelligence Injection (The "Brain")

## Goal
Connect the A2rchitech Kernel to a real LLM (Local or Cloud) to enable dynamic reasoning, tool selection, and intelligent response generation, replacing hardcoded heuristics.

## Phase 8 Tasks
1.  **LLM Gateway**:
    *   Create `services/kernel/src/llm/mod.rs` and `services/kernel/src/llm/gateway.rs`.
    *   Define `LLMGateway` trait with `complete(prompt, tools) -> ToolCall`.
    *   Implement `OpenAIAdapter` (compatible with OpenAI and Ollama).
2.  **Configuration**:
    *   Add `KERNEL_LLM_ENDPOINT` and `KERNEL_LLM_MODEL` environment variables.
    *   Load these in `main.rs`.
3.  **Intelligence Injection**:
    *   Refactor `IntentDispatcher` to use `LLMGateway`.
    *   Replace `select_framework` heuristic with `LLMGateway.classify_intent`.
    *   Replace `execute_tools` heuristic with `LLMGateway.plan_execution`.

## Affected Files
*   `services/kernel/src/llm/mod.rs` (New)
*   `services/kernel/src/llm/gateway.rs` (New)
*   `services/kernel/src/intent_dispatcher.rs` (Refactor)
*   `services/kernel/src/main.rs` (Wiring)
*   `services/kernel/Cargo.toml` (Add `reqwest`, `serde_json`)

## Verification
*   **Unit Test**: Mock `LLMGateway` returns a known tool call.
*   **Integration Test**: Kernel calls Ollama (if running) or mocks response to execute `search`.

## Breaking Changes
*   `IntentDispatcher` logic will fundamentally change from deterministic regex to probabilistic LLM reasoning.
