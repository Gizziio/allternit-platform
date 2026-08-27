# Developer Prompt Patterns

**Course:** ALABS-CORE-PROMPTS — Engineer Prompts for Agent Systems  
**Tier:** CORE

## Module Overview

This module covers prompt patterns specifically for software developers: code generation, debugging, refactoring, documentation, and code review. You will learn how to write prompts that produce maintainable code, accurate explanations, and useful technical documentation.

## Learning Objectives

- [ ] Apply 5 core developer prompt patterns: generation, explanation, refactoring, review, and documentation.
- [ ] Write prompts that produce typed, tested, and documented code.
- [ ] Use chain-of-thought prompting to debug complex issues.

## Lecture Guide

**Source:** FREE Prompt Engineering Masterclass + Prompt Engineering with Python

1. **Generation Pattern** — From spec to implementation.
2. **Explanation Pattern** — Understanding legacy or complex code.
3. **Refactoring Pattern** — Improving structure without changing behavior.
4. **Review Pattern** — Finding bugs, security issues, and style violations.
5. **Documentation Pattern** — Docstrings, READMEs, and architecture diagrams.
6. **Test Generation Pattern** — Unit, integration, and edge-case tests.
7. **Debug Pattern** — Error message → root cause → fix.
8. **Compare Pattern** — Evaluating multiple implementation options.
9. **Translate Pattern** — Porting code between languages or frameworks.
10. **Optimize Pattern** — Performance improvements with trade-off analysis.
11. **Dependency Pattern** — Evaluating and integrating libraries.
12. **API Design Pattern** — Designing interfaces before implementation.
13. **Schema Pattern** — Generating types, SQL, and validation rules.
14. **Commit Pattern** — Summarizing and explaining code changes.
15. **Teaching Pattern** — Explaining concepts to junior developers.

## Demo Outline (10 min)

1. Paste a complex regex into the chat. Use the explanation pattern to break it down.
2. Use the refactoring pattern: \"Extract this into a pure function with typed inputs.\"
3. Use the review pattern on a piece of code with a subtle bug. Show the AI catching it.

## Challenge (5 min)

> **The Full Cycle:** Pick a small feature (e.g., a password validator). Use exactly 5 prompts to: (1) generate the code, (2) explain it, (3) refactor it, (4) review it for security issues, (5) write tests for it. Submit the final code + test file.

## Allternit Connection

- **Internal system:** Allternit engineers maintain a shared library of developer prompt templates.
- **Reference repo/file:** \"prompts/dev-patterns/\" in agui-gateway.
- **Key difference from standard approach:** Allternit's review-pattern prompt explicitly asks the AI to check for three things: correctness, security, and project convention adherence.
