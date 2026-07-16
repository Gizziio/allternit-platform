# ADR 0002: Cua Driver as the Initial Packaged Native Provider

- Status: Accepted for prototype and parity evaluation
- Date: 2026-07-15

## Decision

Integrate Cua Driver behind an Allternit native-provider adapter for macOS, Windows, and Linux. Allternit retains policy, approvals, state/epoch enforcement, outcomes, receipts, and trajectories above the provider.

The existing Allternit accessibility and pyautogui adapters remain compatibility providers until the real application matrix proves replacement parity. Pyautogui may never advertise strict-background capability.

## Consequences

- Cua-specific tool names and transport objects do not enter product or planner code.
- Driver installation, signing identity, permissions, version negotiation, telemetry configuration, and rollback become supported lifecycle responsibilities.
- Each driver result must disclose its real grounding and delivery route.

