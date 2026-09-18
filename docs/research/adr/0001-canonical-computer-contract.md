# ADR 0001: Canonical Computer Contract

- Status: Accepted
- Date: 2026-07-15

## Decision

All computer environments, sessions, observations, actions, outcomes, capabilities, and events use the provider-neutral contracts in `domains/computer-use/core/contracts/canonical.py`.

Every mutation identifies an immutable `base_state_id`. Element refs are valid only inside that state. Live mutations serialize by physical `resource_id` and require the state's epoch. Outcomes preserve `worked`, `didnt`, and `unknown`; delivery alone is not success.

Legacy adapters remain compatibility providers during migration. New product code may not introduce another direct action/result vocabulary.

## Consequences

- Browser, native, VM, container, and device providers become interchangeable at the agent boundary.
- Existing gateway, MCP, Rust, browser-runtime, and frontend shapes require adapters or generation from canonical schemas.
- Stale writes and ambiguous outcomes become explicit errors/results instead of hidden adapter behavior.

