# 0006. Platform Cockpit & Visualizer Integration

Date: 2026-02-04

## Status
Accepted

## Context
The A2R platform requires high observability for agent actions. Users need to see not just the final result, but the reasoning process, the tool execution timeline, and the underlying workflow graph.

## Decision
Implement a "Cockpit" interface in the platform layer:
1.  **DAGCanvas**: SVG-based visualization of the active agent workflow.
2.  **RunReplay**: A timeline-based interface for replaying and auditing tool executions.
3.  **PromotionDashboard**: A governance UI for reviewing and approving agent-proposed code changes.

## Consequences
- **User Trust**: Clear visualization of agent steps reduces the "black box" effect.
- **Auditability**: Timeline replay allows for deep inspection of failed runs.
- **Consistency**: Centralized cockpit ensures all agents use the same reporting primitives.

