# Action Plan: Phase 8 Gap Filling (Intelligence Execution)

## Gaps Identified
1.  **Heuristic Execution**: `IntentDispatcher::execute_tools` still uses regex (`starts_with("search")`) instead of LLM planning.
2.  **Tool Definitions**: The `Tool` trait lacks a schema definition method (`definition()`), so the LLM doesn't know what tools are available or how to use them.
3.  **Provider Parity**: Anthropic and Gemini adapters lack tool calling support.

## Tasks

### 1. Upgrade Tool System
*   **Modify `Tool` Trait**: Add `fn definition(&self) -> ToolDefinition`.
*   **Update Tools**: Implement `definition()` for `WebSearchTool`, `NoteTool`, `FsWriteTool`, `ShellExecTool`, `ScreenCaptureTool`.
*   **ToolExecutor**: Add method `get_definitions()` to return schemas for all registered tools.

### 2. Intelligent Execution Loop
*   **Refactor `IntentDispatcher::execute_tools`**:
    *   Get active provider.
    *   Get tool definitions from executor.
    *   Call `provider.complete()` with prompt + tools.
    *   Parse response:
        *   If it contains tool calls (JSON), execute them.
        *   If it's text, return the text.

### 3. Provider Enhancements (Best Effort)
*   **Anthropic**: Add `tools` parameter support to `AnthropicAdapter` (Claude 3 supports tool use).
*   **Gemini**: Add `tools` parameter support (Function calling).

## Affected Files
*   `services/kernel/src/tool_executor.rs`
*   `services/kernel/src/embodiment/desktop.rs`
*   `services/kernel/src/intent_dispatcher.rs`
*   `services/kernel/src/llm/gateway.rs`

## Verification
*   Run `a2 run "create a note about rust"` and ensure it calls `note.create` via LLM, not regex.
