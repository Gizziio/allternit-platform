# Bridge: Allternit's agui-gateway Prompt Tiers

**Course:** ALABS-CORE-PROMPTS — Engineer Prompts for Agent Systems  
**Tier:** CORE

## Bridge Concept

Not all prompts are equal. A one-shot question needs a different contract than a long-running agent conversation. At Allternit, we use a tiered prompt system: Tier 1 (single-turn utilities), Tier 2 (multi-turn sessions), and Tier 3 (autonomous agent loops). Each tier adds more context-management machinery.

This module explains how agui-gateway stays coherent across long sessions. It is not one giant system prompt. It is a stack of prompts: a static base prompt, a dynamic context prompt (built from conversation history), and a task-specific prompt (injected per turn). Understanding this architecture lets you design prompts that scale from 1 turn to 100 turns without drift.

## Learning Objectives

- [ ] Design a tiered prompt architecture: base, context, and task layers.
- [ ] Implement a context-compaction strategy that preserves critical state while staying under token limits.
- [ ] Debug long-session drift by isolating which prompt tier is corrupting the agent's behavior.

## Demo Outline (10 min)

1. **The Tier Stack:** Show the three prompt files for a support agent. Base (never changes), Context (summarized history), Task (current intent).
2. **Drift Demo:** Run a 20-turn simulation with a monolithic prompt. Show how early instructions are forgotten. Run the same simulation with tiered prompts. Show retention.
3. **Compaction:** Show how the context tier is summarized when the token budget is exceeded. Explain what is kept and what is dropped.

## Challenge (5 min)

> **Build a Tiered Prompt:** For a conversation agent of your choice, write three separate prompt files (base, context, task) and a Python function that assembles them. Run a 10-turn conversation and verify that the base instructions are still respected at turn 10.

## Allternit Connection

- **Internal system:** agui-gateway's prompt assembler lives in \"services/prompt-engine/\".
- **Reference repo/file:** \"services/prompt-engine/tiered_assembler.py\"
- **Key difference from standard approach:** Allternit treats the context tier as a first-class data structure, not just a string. It is a list of events that can be filtered, ranked, and summarized independently.
