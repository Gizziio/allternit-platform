# The Prompt Engineering Stack

**Course:** ALABS-CORE-PROMPTS — Engineer Prompts for Agent Systems  
**Tier:** CORE

## Module Overview

This module introduces the four-layer stack for systematic prompt engineering: Context, Constraints, Examples, and Evaluation. You will learn to design prompts as interfaces rather than messages, and to test them with the same rigor as application code.

## Learning Objectives

- [ ] Apply the four layers of the Prompt Engineering Stack to any task.
- [ ] Write a system prompt that includes role, task, format, and guardrails.
- [ ] Build a prompt test suite with at least 5 test cases covering normal and edge inputs.

## Lecture Guide

**Source:** ChatGPT Prompt Engineering (Free Course) + FREE Prompt Engineering Masterclass

1. **Context Layer** — Who the model is, what it knows, and what task it faces.
2. **Constraint Layer** — Output format, length limits, tone, and forbidden topics.
3. **Example Layer** — Few-shot and chain-of-thought examples.
4. **Evaluation Layer** — Automated scoring, regression tests, and red-teaming.
5. **Role Prompting** — Defining a persona to shape output style and expertise.
6. **Task Clarity** — Breaking complex requests into atomic instructions.
7. **Format Control** — JSON, Markdown tables, and enumerated lists.
8. **Tone Calibration** — Professional, casual, technical, or empathetic voices.
9. **Guardrails** — Preventing hallucinations, toxicity, and off-topic responses.
10. **Few-Shot Design** — Selecting representative examples.
11. **Chain-of-Thought** — Prompting the model to show its reasoning.
12. **Zero-Shot Techniques** — When and how to avoid examples.
13. **Prompt Templates** — Parameterized prompts for reusable components.
14. **A/B Testing Prompts** — Comparing variants on a held-out test set.
15. **Versioning Prompts** — Tracking changes and performance over time.

## Demo Outline (10 min)

1. Show a weak prompt for a classification task. Run it 3 times. Results vary.
2. Rewrite with the full stack: role + constraints + 3 examples + JSON format.
3. Run the test suite. Show improved consistency and accuracy.

## Challenge (5 min)

> **Stack Upgrade:** Pick a simple task (summarization, classification, or extraction). Write a v1 prompt in one sentence. Then write a v2 prompt using all four layers. Run 10 examples through both. The v2 prompt must score higher on consistency.

## Allternit Connection

- **Internal system:** agui-gateway stores prompts as YAML files with embedded test cases.
- **Reference repo/file:** \"prompts/support_classifier_v2.yaml\"
- **Key difference from standard approach:** Allternit treats prompt evaluation as a CI step. If a prompt change causes regression on the test suite, the deployment is blocked.
