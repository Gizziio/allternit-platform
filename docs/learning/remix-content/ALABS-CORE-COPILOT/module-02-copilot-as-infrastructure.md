# Copilot as Infrastructure

**Course:** ALABS-CORE-COPILOT — Build AI-Assisted Software with Copilot & Cursor  
**Tier:** CORE

## Module Overview

This module treats GitHub Copilot not as a fancy autocomplete, but as a development infrastructure layer. You will learn how to configure Copilot for maximum relevance, use context commands effectively, and maintain code quality when a machine is writing half your lines.

## Learning Objectives

- [ ] Configure Copilot settings (suggestion frequency, inline chat, commit messages).
- [ ] Use context commands (@workspace, @terminal, @vscode) to improve suggestion quality.
- [ ] Review AI-generated code for correctness, security, and project conventions.

## Lecture Guide

**Source:** Master GitHub Copilot – From Basics to Advanced AI Coding

1. **Copilot Setup** — Installation, authentication, and IDE integration.
2. **Suggestion Mechanics** — How Copilot uses file context and neighboring tabs.
3. **Inline Chat** — Asking questions and requesting changes without leaving the editor.
4. **Context Commands** — @workspace for repo-wide context, @terminal for shell help.
5. **Code Completion** — Accepting, rejecting, and cycling through suggestions.
6. **Comment-to-Code** — Writing descriptive comments to guide generation.
7. **Test Generation** — Using Copilot to generate unit tests and edge cases.
8. **Documentation Assist** — Generating docstrings and README sections.
9. **Refactoring** — Prompting Copilot to rename, extract, or restructure code.
10. **Multi-Language Support** — Python, TypeScript, Rust, and shell scripts.
11. **GitHub Copilot Chat** — The sidebar chat interface for complex queries.
12. **Commit Message Generation** — Summarizing diffs into conventional commits.
13. **Pull Request Summaries** — Drafting descriptions and review comments.
14. **Security Scanning** — Spotting vulnerabilities in generated code.
15. **Advanced Context** — Copilot agent mode and multi-file reasoning.

## Demo Outline (10 min)

1. Open a TypeScript repo. Show how Copilot completes a function signature based on imports.
2. Use @workspace to ask: \"Where is the authentication middleware defined?\"
3. Generate a unit test for a new function and review it for missing edge cases.

## Challenge (5 min)

> **The Convention Check:** Write a function using only Copilot suggestions. Then run your project's linter. Fix every violation Copilot introduced. Document the top 3 convention failures.

## Allternit Connection

- **Internal system:** Allternit engineers use Copilot for ~60% of boilerplate code.
- **Reference repo/file:** \"docs/copilot-conventions.md\" (internal).
- **Key difference from standard approach:** Allternit requires every AI-generated test to be manually validated against the actual function behavior. Copilot's tests are a starting point, not the final suite.
