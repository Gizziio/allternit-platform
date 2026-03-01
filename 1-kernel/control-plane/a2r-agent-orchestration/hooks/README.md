# Hooks System

The **Hooks System** provides event-driven lifecycle automation for the agent orchestration layer.

It allows you to register handlers for key events like:
- `SessionStart` / `SessionStop`
- `PreToolUse` (for policy checks)
- `PostToolUse` (for logging/observability)
- `AgentStart` / `AgentStop`

## Architecture

The `HookBus` sits between the Orchestrator and the execution layers. It supports:
1.  **Synchronous Handlers:** Blocking checks (e.g. Policy) that can prevent an action.
2.  **Asynchronous Events:** Fire-and-forget publication to the `EventBus` for audit/logging.