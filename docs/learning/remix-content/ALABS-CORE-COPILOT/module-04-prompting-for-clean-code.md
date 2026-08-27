# Prompting for Clean Code

**Course:** ALABS-CORE-COPILOT — Build AI-Assisted Software with Copilot & Cursor  
**Tier:** CORE

## Module Overview

AI assistants are only as good as the prompts that steer them. This module teaches how to prompt for clean, maintainable code: explicit naming, single-responsibility functions, strong typing, and comprehensive error handling. You will learn to reject messy first drafts and iterate toward production quality.

## Learning Objectives

- [ ] Write prompts that explicitly request clean-code qualities.
- [ ] Iterate on AI-generated code using targeted follow-up prompts.
- [ ] Enforce type safety, error handling, and test coverage through prompting.

## Lecture Guide

**Source:** Master GitHub Copilot course + Clean Code principles

1. **The Prompt as Specification** — Why vague prompts produce vague code.
2. **Naming Conventions** — Prompting for descriptive variable and function names.
3. **Single Responsibility** — Breaking generated monoliths into focused functions.
4. **Type-Driven Development** — Asking the AI to define types before implementation.
5. **Error Handling** — Prompting for exhaustive error paths and custom exceptions.
6. **Immutability** — Preferring const, pure functions, and avoiding mutation.
7. **Comment Quality** — Explaining *why*, not *what*.
8. **Test-Driven Prompting** — Generating tests first, then implementation.
9. **Refactoring Prompts** — \"Make this function shorter and more readable.\"
10. **Pattern Consistency** — Matching the style of existing codebase.
11. **Security Awareness** — Prompting for input validation and sanitization.
12. **Performance Constraints** — Asking for Big-O analysis and optimizations.
13. **Dependency Discipline** — Minimizing imports and avoiding bloat.
14. **Documentation Strings** — Generating JSDoc, docstrings, and OpenAPI specs.
15. **Review Prompts** — Using AI to critique its own output.

## Demo Outline (10 min)

1. Show a vague prompt: \"Write a function to process users.\" Result: messy, 40-line monolith.
2. Rewrite with clean-code constraints: typed inputs, error handling, single responsibility. Result: 3 clean functions.
3. Ask the AI to write tests for the new functions. Review for missing edge cases.

## Challenge (5 min)

> **The Clean-Up Round:** Take a messy AI-generated function. In exactly 3 follow-up prompts, transform it into clean code that passes your project's linting and has full type coverage.

## Allternit Connection

- **Internal system:** Allternit's \".cursorrules\" file encodes clean-code expectations for AI assistants.
- **Reference repo/file:** \"docs/clean-code-prompt-patterns.md\" (internal).
- **Key difference from standard approach:** Allternit requires every AI-generated function to include at least one error-handling branch. Happy-path-only code is rejected in review.
