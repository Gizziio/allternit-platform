# Bridge: Allternit's Agent Swarm Communication

**Course:** ALABS-AGENTS-AGENTS — Architect Multi-Agent Systems  
**Tier:** AGENTS

## Bridge Concept

Multi-agent systems fail when agents talk past each other. Without a shared protocol, one agent's "summary" is another agent's noise. At Allternit, we solve this with a communication domain service: a lightweight message bus that enforces schemas on inter-agent messages.

This module explains Allternit's agent swarm architecture. Agents do not call each other directly. They publish events to a domain bus. Other agents subscribe to relevant event types. This decouples agents so they can be developed, deployed, and scaled independently. It also creates an audit trail: every decision is traceable to the events that triggered it.

## Learning Objectives

- [ ] Diagram an event-driven agent architecture with a central domain bus.
- [ ] Define three event schemas that agents use to coordinate a complex task.
- [ ] Explain how an event bus enables agent independence, replay, and scaling.

## Demo Outline (10 min)

1. **The Bus Architecture:** Show three agents running as separate processes. They communicate through a Redis/NATS topic, not direct HTTP calls.
2. **Event Trace:** Walk through a complete workflow. Show the event log: AgentA published ResearchComplete, AgentB subscribed and published OutlineApproved, AgentC subscribed and wrote the draft.
3. **Replay:** Replay the same event log with a newer version of AgentC. Show that the output improves without changing AgentA or AgentB.

## Challenge (5 min)

> **Build a Mini Bus:** Implement a simple in-memory event bus (or use Redis). Create two agents: a Producer that publishes structured events, and a Consumer that acts on them. Run 10 tasks through the bus and verify the Consumer receives every event in order.

## Allternit Connection

- **Internal system:** The communication domain service is the backbone of Allternit's multi-agent workflows.
- **Reference repo/file:** \"services/communication-domain/\" in the Allternit monorepo.
- **Key difference from standard approach:** Allternit agents are stateless. All state lives in the event log. This means any agent can be restarted, scaled, or replaced without losing context.
