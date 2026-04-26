# Cursor Workflows

**Course:** ALABS-CORE-COPILOT — Build AI-Assisted Software with Copilot & Cursor  
**Tier:** CORE

## Module Overview

Cursor is an AI-native code editor that goes beyond autocomplete. This module covers Cursor's unique features: Composer for multi-file edits, codebase-wide queries, and agentic code generation. You will learn how to use Cursor for architectural changes, not just line-by-line completion.

## Learning Objectives

- [ ] Use Cursor Composer to refactor across multiple files in a single prompt.
- [ ] Query the entire codebase with natural language to find patterns and dependencies.
- [ ] Evaluate when Cursor's agentic mode is appropriate vs. when it is too risky.

## Lecture Guide

**Source:** Master GitHub Copilot course (Cursor section) + Cursor documentation

1. **Cursor vs. VS Code+Copilot** — What makes Cursor different.
2. **Composer Basics** — Writing prompts that span multiple files.
3. **Codebase Queries** — Finding functions, types, and patterns with natural language.
4. **Agentic Mode** — Letting Cursor plan and execute a multi-step edit.
5. **Context Pinning** — Keeping specific files in context for better suggestions.
6. **Terminal Integration** — Running commands and debugging from within Cursor.
7. **Diff Review** — Inspecting and accepting/rejecting multi-file changes.
8. **Image-to-Code** — Generating UI components from screenshots.
9. **Documentation Generation** — Creating architecture docs from code exploration.
10. **Refactoring Patterns** — Renaming, extracting services, and migrating APIs.
11. **Error Fixing** — Pasting compiler errors into chat for targeted fixes.
12. **Custom Rules** — Teaching Cursor your project's conventions.
13. **Model Selection** — Claude, GPT-4, and o1 inside Cursor.
14. **Privacy Settings** — What gets sent to the cloud and how to limit it.
15. **Team Workflows** — Sharing prompts and review practices.

## Demo Outline (10 min)

1. Open a project. Use Composer to: \"Extract all validation logic from these three routes into a single middleware file.\"
2. Review the diff. Show how Cursor updated imports and call sites.
3. Use codebase query: \"Where do we handle OAuth token refresh?\"

## Challenge (5 min)

> **The Cross-File Refactor:** Pick a duplicated pattern in your codebase. Use Cursor Composer to consolidate it into one location. Review every changed file and fix any broken references.

## Allternit Connection

- **Internal system:** agui-gateway was heavily refactored using Cursor Composer.
- **Reference repo/file:** See migration commits tagged \"cursor-refactor\" in agui-gateway.
- **Key difference from standard approach:** Allternit never accepts a Composer diff without file-by-file review. The AI can propose architecture changes; the human approves them line by line.
