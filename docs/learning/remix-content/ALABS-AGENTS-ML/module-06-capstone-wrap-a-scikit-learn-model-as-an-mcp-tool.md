# Capstone: Wrap a Scikit-Learn Model as an MCP Tool

**Course:** ALABS-AGENTS-ML — ML as Agent Tools  
**Tier:** AGENTS

## Bridge Concept

The capstone is a full integration: you will train a scikit-learn model on a tabular dataset, wrap it as an MCP tool, and demonstrate an LLM agent delegating a numerical task to it. The deliverable is not just the model, but the *interface* that makes the model usable by an agent ecosystem.

This tests three skills: ML engineering (training and validation), API design (the MCP tool contract), and agent orchestration (prompting the LLM to use the tool correctly).

## Learning Objectives

- [ ] Train, validate, and serialize a scikit-learn model on a real dataset.
- [ ] Design and implement an MCP tool with strict input validation and human-readable error messages.
- [ ] Build an agent prompt that reliably routes structured-data questions to the ML tool instead of guessing.

## Demo Outline (10 min)

1. **Training Pipeline:** Load a dataset, engineer features, train a model, evaluate with cross-validation.
2. **MCP Integration:** Start the MCP server. Show the tool description as the LLM sees it.
3. **Agent Delegation:** Ask the LLM a business question that requires the model. Watch it call the tool, interpret the result, and explain the answer in natural language.

## Challenge (Capstone — 60 min)

> **Build:** An end-to-end ML-as-Tool system:
> - A trained scikit-learn model on a public dataset of your choice.
> - An MCP tool server that exposes the model with a clear schema.
> - A simple agent (CLI or notebook) that receives natural-language questions and delegates numerical tasks to the tool.
> - Documentation of the feature schema and expected input ranges.
>
> **Deliverable:** A GitHub repo link + a 2-minute demo of the agent successfully delegating a task.

## Allternit Connection

- **Internal system:** mcp-apps-adapter's forecasting and classification tools follow this exact pattern.
- **Reference repo/file:** \"examples/sklearn_mcp_tool/\" in mcp-apps-adapter.
- **Key difference from standard approach:** Allternit requires every ML tool to return a confidence score or uncertainty estimate. The agent uses this to decide whether to trust the prediction or ask for more data.
