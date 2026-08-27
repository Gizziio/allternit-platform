# Capstone: Build an MCP Server with Cursor

**Course:** ALABS-CORE-COPILOT — Build AI-Assisted Software with Copilot & Cursor  
**Tier:** CORE

## Bridge Concept

The capstone tests whether you can direct an AI assistant to build a real, deployable artifact from a natural-language spec. You will build a TypeScript MCP (Model Context Protocol) server using Cursor as your primary coding interface. The server must expose at least one tool, one resource, and one prompt template. The twist: you cannot type more than 20% of the total lines manually.

This is not a test of Cursor's capabilities. It is a test of *your* ability to specify, review, and iterate.

## Learning Objectives

- [ ] Translate a natural-language spec into a typed MCP server implementation via AI assistance.
- [ ] Debug AI-generated code using compiler errors and runtime logs.
- [ ] Document the server for a downstream consumer (another AI agent or a human developer).

## Demo Outline (10 min)

1. **Spec → Prompt:** Start with a one-paragraph spec: \"A server that exposes a 'search_notes' tool, a 'note_summary' resource, and a 'summarize_tone' prompt.\"
2. **Cursor Session:** Show the Composer chat evolving the server across 3 iterations.
3. **Validation:** Run the server with the MCP Inspector. Fix one type mismatch the AI introduced.

## Challenge (Capstone — 60 min)

> **Build:** Create an MCP server in TypeScript that:
> - Implements at least one Tool, one Resource, and one Prompt.
> - Uses Cursor for >80% of the code generation.
> - Includes a README with setup and usage instructions.
> - Passes \"mcp-inspector\" validation without runtime errors.
>
> **Deliverable:** A GitHub repo link + a 1-page reflection on what you had to correct manually.

## Allternit Connection

- **Internal system:** mcp-apps-adapter is the reference implementation.
- **Reference repo/file:** github.com/allternit/mcp-apps-adapter
- **Key difference from standard approach:** Allternit's MCP servers are stateless and schema-strict. Every input is validated with Zod before processing.
