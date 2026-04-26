# The Problem: Manual Coding is the Bottleneck

**Course:** ALABS-CORE-COPILOT — Build AI-Assisted Software with Copilot & Cursor  
**Tier:** CORE

## Bridge Concept

For decades, the speed of software development was limited by human typing speed, context-switching, and working memory. Compilers execute in milliseconds; humans reason in minutes. AI coding assistants flip this bottleneck: now the constraint is not writing code, but *directing* code.

In this module, we examine why manual coding has become the bottleneck in modern development pipelines, and how AI assistants (GitHub Copilot, Cursor, Claude Code) function as infrastructure rather than toys. We introduce the mental model shift from "I write every line" to "I orchestrate an intelligent compiler."

## Learning Objectives

- [ ] Articulate the economic and velocity cost of 100% hand-written code.
- [ ] Distinguish between AI assistants as "autocomplete" vs. "infrastructure."
- [ ] Identify the three failure modes of vibe coding: drift, hallucination, and context collapse.

## Demo Outline (10 min)

1. **The Bottleneck Map:** Show a typical feature request → hand-coding → review cycle (45 min). Replay with AI-assisted flow (8 min). Highlight where time is actually saved.
2. **Infrastructure Framing:** Open a repo (e.g., mcp-apps-adapter). Demonstrate how Copilot suggests domain-aware patterns because the codebase has conventions.
3. **Failure Mode #1 — Drift:** Show what happens when you let Copilot write 200 lines without review. The code "works" but violates project conventions.

## Challenge (5 min)

> **The 10-Line Rule:** Take a feature request. Write the first 10 lines manually, then use Copilot/Cursor to complete the rest. Stop every 20 lines to review. Document one drift you caught.

## Allternit Connection

- **Internal system:** agui-gateway and mcp-apps-adapter are maintained with Cursor + Copilot.
- **Reference repo/file:** See \".cursorrules\" in agui-gateway for project-specific conventions.
- **Key difference from standard approach:** Allternit enforces a \"human-in-the-loop at commit boundaries\" rule. AI writes drafts; humans own the commit.
