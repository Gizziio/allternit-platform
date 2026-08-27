# Tool-Using Agents

**Course:** ALABS-AGENTS-AGENTS — Architect Multi-Agent Systems  
**Tier:** AGENTS

## Module Overview

The defining capability of modern agents is tool use. This module covers how to design, register, and invoke tools from an LLM agent. You will learn the Model Context Protocol (MCP), function calling APIs, and how to build agents that extend their capabilities by calling external services.

## Learning Objectives

- [ ] Define tool schemas using JSON Schema or MCP format.
- [ ] Implement an agent that dynamically selects and invokes tools based on user queries.
- [ ] Handle tool errors and format tool outputs for LLM consumption.

## Lecture Guide

**Source:** Build Custom GPT with ChatGPT: Step by Step Free Guide + Anthropic MCP docs

1. **Why Tools Matter** — Extending LLMs beyond their training data.
2. **Function Calling APIs** — OpenAI, Anthropic, and Gemini tool interfaces.
3. **JSON Schema for Tools** — Defining inputs, outputs, and descriptions.
4. **Tool Descriptions** — Writing clear docs so the LLM chooses correctly.
5. **The Tool Registry** — A dynamic catalog of available capabilities.
6. **Invocation Patterns** — Synchronous vs. async tool execution.
7. **Result Formatting** — Converting tool output into LLM-readable context.
8. **Error Handling** — What happens when a tool fails or returns garbage.
9. **Authentication** — Managing API keys and permissions for tool calls.
10. **MCP Deep Dive** — The emerging standard for agent-tool communication.
11. **Local Tools** — Running code, file system access, and database queries.
12. **Remote Tools** — HTTP APIs, SaaS integrations, and microservices.
13. **Tool Chaining** — Using the output of one tool as input to another.
14. **Tool Selection Bias** — Preventing the agent from over-relying on one tool.
15. **Observability** — Tracing which tools were called and why.

## Demo Outline (10 min)

1. Define three tools: get_weather, calculate, and search_news.
2. Build an agent that receives a question and emits a tool call JSON.
3. Execute the tool, feed the result back, and generate the final answer.
4. Show an error case: the weather API is down. The agent falls back to a generic response.

## Challenge (5 min)

> **The MCP Tool:** Implement a simple MCP server with one tool: \"get_current_time\". Then build a Python client that asks an LLM a question requiring the current time, extracts the tool call, invokes your MCP server, and returns the answer.

## Allternit Connection

- **Internal system:** mcp-apps-adapter is Allternit's central tool registry exposing 20+ MCP tools.
- **Reference repo/file:** github.com/allternit/mcp-apps-adapter
- **Key difference from standard approach:** Allternit tools are self-describing and versioned. The agent receives not just a name, but a full contract including examples, error schemas, and rate limits.
