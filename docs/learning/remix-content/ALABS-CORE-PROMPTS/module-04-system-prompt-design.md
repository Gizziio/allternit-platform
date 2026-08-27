# System Prompt Design

**Course:** ALABS-CORE-PROMPTS — Engineer Prompts for Agent Systems  
**Tier:** CORE

## Module Overview

The system prompt is the most important prompt in any agent conversation. It sets the rules, defines the persona, and constrains behavior for every subsequent turn. This module teaches how to design system prompts that remain effective across long sessions and resist jailbreak attempts.

## Learning Objectives

- [ ] Write a system prompt with clear role, scope, and behavioral boundaries.
- [ ] Design multi-turn prompts that resist context drift and injection attacks.
- [ ] Test system prompt robustness with adversarial user inputs.

## Lecture Guide

**Source:** ChatGPT Prompt Engineering (Free Course) + Anthropic system prompt docs

1. **The System Prompt as Constitution** — Why it matters more than user prompts.
2. **Role Definition** — Specificity beats generality.
3. **Scope Boundaries** — What the agent should and should not do.
4. **Behavioral Rules** — Tone, formatting, and response length.
5. **Multi-Turn Consistency** — Preventing drift over 10+ turns.
6. **Context Injection** — How malicious users try to override system prompts.
7. **Defensive Prompting** — Explicit refusal rules and output validation.
8. **Tiered Instructions** — Primary, secondary, and fallback directives.
9. **Dynamic System Prompts** — Injecting runtime context safely.
10. **Persona Stability** — Keeping the agent in character.
11. **Tool Use Instructions** — When and how to invoke tools.
12. **Cite or Decline** — Requiring evidence for factual claims.
13. **Uncertainty Expression** — Teaching the agent to say \"I don't know.\"
14. **Prompt Compression** — Maintaining effectiveness within token limits.
15. **A/B Testing System Prompts** — Measuring task success rates.

## Demo Outline (10 min)

1. Show a generic system prompt: \"You are a helpful assistant.\" Result: inconsistent behavior.
2. Show a structured system prompt with role, scope, rules, and output format.
3. Launch a jailbreak attempt against both. Show how the structured prompt resists.

## Challenge (5 min)

> **The Support Bot Constitution:** Write a system prompt for a customer support agent. It must: (1) never share internal pricing, (2) always offer to escalate technical issues, (3) respond in under 3 sentences, (4) confirm the user's emotion before answering. Test it with 5 adversarial inputs.

## Allternit Connection

- **Internal system:** agui-gateway uses a tiered system prompt with domain-specific constitutions.
- **Reference repo/file:** \"prompts/system_prompt_v3.yaml\"
- **Key difference from standard approach:** Allternit system prompts include an explicit \"veto list\" of actions the agent is never allowed to take, regardless of user pressure.
