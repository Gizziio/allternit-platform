# Bridge: Allternit's Cursor + Copilot Stack

**Course:** ALABS-CORE-COPILOT — Build AI-Assisted Software with Copilot & Cursor  
**Tier:** CORE

## Bridge Concept

Most tutorials teach Copilot and Cursor in isolation. At Allternit, they are part of a unified stack: Copilot for in-flight suggestions inside VS Code, Cursor for deep architectural edits and multi-file refactoring. This module exposes how we divide labor between the two tools, and how project-specific context (rules files, domain schemas) makes the difference between generic output and production-grade code.

We also cover the guardrails: when to let AI write tests, when to reject AI-generated imports, and how to maintain a single source of truth for conventions.

## Learning Objectives

- [ ] Design a split workflow: Copilot for micro-edits, Cursor for macro-refactors.
- [ ] Write a \".cursorrules\" file that encodes project conventions.
- [ ] Evaluate AI-generated code against three criteria: correctness, convention, and cardinality.

## Demo Outline (10 min)

1. **The Stack in Action:** Open agui-gateway. Show Copilot completing a TypeScript interface in real time.
2. **Cursor Macro-Refactor:** Use Cursor Composer to extract a duplicated validation pattern into a shared utility across 4 files.
3. **Guardrail Review:** Show a diff where AI suggested importing a deprecated internal package. Explain the rejection rule.

## Challenge (5 min)

> **Write Your .cursorrules:** For a project of your choice, write a 20-line .cursorrules file covering: naming conventions, forbidden imports, and test expectations. Use it for one feature and measure the quality of AI suggestions.

## Allternit Connection

- **Internal system:** agui-gateway uses tiered prompt files and strict import boundaries.
- **Reference repo/file:** \".cursorrules\" and \"docs/ARCHITECTURE.md\" in agui-gateway.
- **Key difference from standard approach:** Allternit never allows AI to introduce new external dependencies without human approval. This prevents dependency sprawl.
