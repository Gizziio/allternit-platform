# Extending Assistants with Tools

**Course:** ALABS-CORE-COPILOT — Build AI-Assisted Software with Copilot & Cursor  
**Tier:** CORE

## Module Overview

AI coding assistants are not limited to the IDE. They can be extended with custom tools: linters, test runners, documentation generators, and domain-specific validators. This module covers how to augment Copilot and Cursor with tool integrations that enforce project standards automatically.

## Learning Objectives

- [ ] Configure VS Code tasks and extensions to augment Copilot's context.
- [ ] Build a simple CLI tool that an AI assistant can invoke via terminal integration.
- [ ] Design a tool schema so the AI knows when and how to use your custom tooling.

## Lecture Guide

**Source:** Master GitHub Copilot course + MCP/tool documentation

1. **Tool-Augmented Coding** — Moving beyond autocomplete to agentic assistance.
2. **VS Code Extensions** — Enhancing Copilot with custom extensions and tasks.
3. **Terminal Integration** — Running build, test, and lint commands from chat.
4. **Custom Scripts** — Writing small utilities that the AI can call.
5. **MCP Introduction** — The Model Context Protocol for tool standardization.
6. **Tool Schemas** — Defining inputs, outputs, and error states for AI tools.
7. **Context Enrichment** — Feeding build errors and test results back into the AI.
8. **Code Review Bots** — Using AI tools to pre-review pull requests.
9. **Documentation Tools** — Auto-generating architecture diagrams and API docs.
10. **Security Scanners** — Integrating SAST tools into the coding loop.
11. **Test Orchestration** — Running targeted tests based on changed files.
12. **Refactoring Tools** — Automated migration scripts for large codebases.
13. **Package Managers** — Using AI to update dependencies safely.
14. **Database Migrations** — Generating and reviewing schema changes.
15. **Deployment Hooks** — Connecting CI/CD status back to the editor.

## Demo Outline (10 min)

1. Show a custom VS Code task that runs a project-specific linter.
2. Ask Cursor to fix lint errors by running the task and interpreting the output.
3. Introduce a simple MCP server concept: a tool that queries internal API docs.

## Challenge (5 min)

> **The Custom Tool:** Write a small Node.js or Python script that validates your project's import rules. Run it from the terminal inside Cursor/Copilot Chat. Ask the AI to fix any violations it finds.

## Allternit Connection

- **Internal system:** mcp-apps-adapter exposes internal tools to agui-gateway and Cursor.
- **Reference repo/file:** \"tools/project_lint.py\" in mcp-apps-adapter.
- **Key difference from standard approach:** Allternit treats every custom tool as an MCP server. This means any agent—Cursor, Claude Code, or agui-gateway—can invoke it with the same interface.
