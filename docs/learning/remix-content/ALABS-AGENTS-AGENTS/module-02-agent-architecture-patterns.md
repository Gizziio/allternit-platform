# Agent Architecture Patterns

**Course:** ALABS-AGENTS-AGENTS — Architect Multi-Agent Systems  
**Tier:** AGENTS

## Module Overview

This module introduces the foundational patterns for building agent systems: ReAct, Plan-and-Execute, Tool-Use, and Reflection. You will learn how to structure an agent's decision loop so it can reason about tasks, select tools, observe results, and adapt its plan.

## Learning Objectives

- [ ] Implement a basic ReAct loop (Reason → Act → Observe) in Python.
- [ ] Contrast Plan-and-Execute with reactive agent architectures.
- [ ] Design a tool registry that an LLM can query and invoke.

## Lecture Guide

**Source:** Original content + Anthropic/OpenAI agent documentation

1. **What is an Agent?** — Autonomous systems that perceive, decide, and act.
2. **The ReAct Pattern** — Interleaving reasoning and action.
3. **Plan-and-Execute** — Generating a plan upfront, then executing steps.
4. **Tool-Use Architecture** — Defining tools, schemas, and invocation protocols.
5. **Observation Loop** — How agents incorporate feedback from the environment.
6. **Memory Types** — Short-term working memory vs. long-term retrieval.
7. **Reflection Pattern** — Self-critique and error correction.
8. **Chain-of-Thought Agents** — Explicit reasoning before each action.
9. **State Machines** — Modeling agent behavior as transitions between states.
10. **Event-Driven Agents** — Reacting to external triggers asynchronously.
11. **Human-in-the-Loop** — When and how to pause for human approval.
12. **Failure Recovery** — Retry logic, fallback tools, and graceful degradation.
13. **Agent Observability** — Logging thoughts, actions, and outcomes.
14. **Security Boundaries** — Sandboxing tool execution.
15. **Testing Agents** — Simulated environments and evaluation frameworks.

## Demo Outline (10 min)

1. Build a minimal ReAct agent in Python with 2 tools: \"search_web\" and \"calculator\".
2. Give it a multi-step question. Walk through each reasoning → action → observation step.
3. Show how the agent recovers from a tool error by reasoning differently.

## Challenge (5 min)

> **The ReAct Agent:** Implement a ReAct loop for a simple task: \"Find the population of France, then calculate what percentage of the world population that is.\" Your agent must use at least two distinct tools and show its reasoning trace.

## Allternit Connection

- **Internal system:** agui-gateway's core loop is a ReAct variant with structured tool schemas.
- **Reference repo/file:** \"agents/core/react_loop.py\" (conceptual).
- **Key difference from standard approach:** Allternit agents are stateless between turns. All memory is externalized to a domain service, making agents horizontally scalable and replayable.
