# ADR 0004: One Runtime Authority, Multiple Generated Transports

- Status: Accepted
- Date: 2026-07-15

## Decision

Create one supervised `allternit-computer` runtime authority for environments, sessions, resources, states, providers, policy dispatch, and events. REST, MCP, local IPC, CLI, SDK, and product UI are transports over that authority.

The Python gateway, TypeScript browser runtime, GUI gateway tools, and extension bridges migrate incrementally. No legacy service is removed until compatibility, stored-data migration, and rollback are proven.

## Consequences

- A session has one owner and consistent cancellation, cleanup, quotas, leases, and event ordering.
- Tool inventories and clients can be generated from canonical schemas.
- Existing port/service topology requires staged compatibility proxies.

