# Code-Generation Agents

**Course:** ALABS-AGENTS-AGENTS — Architect Multi-Agent Systems  
**Tier:** AGENTS

## Module Overview

Code-generation agents are specialized agents that write, review, and refactor software. This module covers how to build agents that generate code from natural language specs, iterate based on compiler feedback, and maintain project conventions. We draw from the "How I Made My Own ChatGPT Coder" course and extend it with production-grade guardrails.

## Learning Objectives

- [ ] Build a code-generation agent that writes code from a natural-language spec.
[ ] Implement a feedback loop where compiler/test errors are fed back to the agent for self-correction.
[ ] Enforce project conventions by injecting style rules and lint output into the agent's context.

## Lecture Guide

**Source:** How I Made My Own ChatGPT Coder That Codes ANYTHING! + original content

1. **Spec-to-Code Pipeline** — From user story to implementation.
2. **Context Window Management** — Feeding relevant files to the code agent.
3. **Iterative Generation** — Generating drafts, reviewing, and refining.
4. **Compiler Feedback Loop** — Passing build errors back as observations.
5. **Test-Driven Generation** — Writing tests first, then generating passing code.
6. **Code Review Agents** — A second agent that critiques the first agent's output.
7. **Refactoring Agents** — Restructuring code without changing behavior.
8. **Multi-File Changes** — Planning and executing edits across a codebase.
9. **Documentation Generation** — Keeping code and docs in sync.
10. **Security Guardrails** — Preventing injection of unsafe patterns.
11. **Dependency Management** — Evaluating and adding libraries safely.
12. **Version Control Integration** — Generating commits and pull requests.
13. **Human Review Gates** — When the agent must stop and ask for approval.
14. **Code Style Enforcement** — Integrating linters and formatters.
15. **Evaluation Metrics** — Pass rate, correctness, and maintainability scores.

## Demo Outline (10 min)

1. Give the agent a spec: \"Write a FastAPI endpoint that accepts a JSON payload, validates it with Pydantic, and stores it in a SQLite database.\"
2. Run the generated code. It fails with a missing import.
3. Feed the error back. The agent fixes it.
4. Run tests. One test fails. The agent updates the implementation.

## Challenge (5 min)

> **The Self-Healing Coder:** Build a loop that: (1) sends a spec to an LLM, (2) writes the code to a file, (3) runs a linter, (4) if errors exist, feeds them back to the LLM, (5) repeats until the linter passes or 3 attempts are exhausted.

## Allternit Connection

- **Internal system:** Allternit's internal code-generation agent uses a validator agent for pre-commit review.
- **Reference repo/file:** \"agents/coder/spec_to_code.py\" (conceptual).
- **Key difference from standard approach:** Allternit never auto-commits AI-generated code. The generation agent produces a branch; a human or validator agent must approve the pull request.
