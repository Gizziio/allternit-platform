# Operator Pack Specification — System Law

## 1. Architectural Invariants
- **No Split Brain**: There is exactly one active Brain Daemon per workspace.
- **Journal as SSOT**: The Journal Ledger is the absolute Single Source of Truth for system state and evolution.
- **Policy Enforcement**: All actions, whether triggered by CLI, TUI, or UI, must pass through the Kernel Policy Gate.
- **Stateless Clients**: Clients (CLI/TUI/UI) are renderers of state, not owners of it.

## 2. Interaction Model
1. **Intent**: Operator sends intent (Text/Command).
2. **Dispatch**: Kernel classifies intent and selects framework.
3. **Capsule Spawn**: A new CapsuleInstance is created.
4. **Execution**: Tools run, Journal entries are written.
5. **Synthesis**: State is updated, A2UI payload is emitted.
6. **Observation**: Clients update via the SSE stream.

## 3. Daemon Responsibility
The `a2d` daemon is responsible for:
- Persisting the Journal.
- Managing the lifecycle of Capsules.
- Brokering Tool calls.
- Serving the OpenAPI compliant API.
- Emitting real-time SSE events.
