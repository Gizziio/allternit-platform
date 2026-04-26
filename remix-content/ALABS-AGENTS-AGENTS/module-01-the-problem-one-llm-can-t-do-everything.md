# The Problem: One LLM Can't Do Everything

**Course:** ALABS-AGENTS-AGENTS — Architect Multi-Agent Systems  
**Tier:** AGENTS

## Bridge Concept

A single LLM is a generalist. It can write code, summarize text, answer trivia, and role-play. But it is not an expert at everything simultaneously. Ask the same model to do deep research, write secure code, and edit a video script, and you will get mediocrity across all three. The solution is specialization: multiple agents, each with a focused role, coordinated by an orchestrator.

This module introduces multi-agent architecture as the natural evolution from prompt engineering to system design. We cover the core tension: autonomy vs. control. The more freedom you give an agent, the more unpredictable it becomes. The more you constrain it, the less useful it is.

## Learning Objectives

- [ ] Identify three tasks where a single LLM fails and a multi-agent system succeeds.
- [ ] Compare central orchestration (one router, many workers) with peer-to-peer agent communication.
- [ ] Define the boundaries of an agent's responsibility using a role card: goal, tools, inputs, outputs, and veto conditions.

## Demo Outline (10 min)

1. **The Generalist Failure:** Ask one LLM to research, outline, and write a technical blog post in a single prompt. The result is shallow and structurally weak.
2. **The Specialist Success:** Split the task into three agents: Researcher, Outliner, Writer. Show how the final output improves.
3. **The Handoff:** Demonstrate the contract between agents. The Researcher outputs a JSON bibliography; the Writer must cite every claim from that bibliography.

## Challenge (5 min)

> **Role Card Design:** Pick a real-world task (e.g., customer support ticket triage). Write role cards for two agents. Define exactly what each agent owns, what it delegates, and when it must stop and ask a human.

## Allternit Connection

- **Internal system:** agui-gateway uses a tiered agent system: Router → Specialist → Validator.
- **Reference repo/file:** \"docs/agent-architecture.md\" in agui-gateway.
- **Key difference from standard approach:** Allternit agents do not share a monolithic context window. Each agent receives only the information it needs, reducing hallucination and cost.
