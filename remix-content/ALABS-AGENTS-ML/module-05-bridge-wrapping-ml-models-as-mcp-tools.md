# Bridge: Wrapping ML Models as MCP Tools

**Course:** ALABS-AGENTS-ML — ML as Agent Tools  
**Tier:** AGENTS

## Bridge Concept

An ML model sitting on disk is useless to an agent. The agent speaks JSON, not pickle files. The bridge is the wrapper: a lightweight service that loads the model, validates inputs against the training feature schema, runs inference, and returns a structured result any agent can consume.

This module shows how to wrap scikit-learn models as MCP tools. We cover schema enforcement, error handling (what happens when the agent sends a categorical value it has never seen?), and versioning (how do you update the model without breaking the agent contract?).

## Learning Objectives

- [ ] Design a typed input/output schema for an ML model exposed as an MCP tool.
- [ ] Implement schema validation that rejects out-of-distribution inputs before inference.
- [ ] Version an ML model and its wrapper independently from the agent codebase.

## Demo Outline (10 min)

1. **The Wrapper:** Show a FastAPI/MCP server that loads a RandomForestClassifier and exposes a \"predict_customer_churn\" tool.
2. **Schema Enforcement:** Send a valid request → get a prediction. Send an invalid request (missing column, wrong type) → get a descriptive error the LLM can act on.
3. **Version Swap:** Swap the model file for v2. Restart the server. Show the agent still works because the interface contract is unchanged.

## Challenge (5 min)

> **Wrap Your Model:** Take the model you trained in the previous module. Wrap it as an MCP tool with a JSONSchema input and a structured output. Test it from an LLM agent context.

## Allternit Connection

- **Internal system:** mcp-apps-adapter hosts multiple ML tool endpoints.
- **Reference repo/file:** \"tools/ml_wrapper_template.py\" in mcp-apps-adapter.
- **Key difference from standard approach:** Allternit decouples the *model artifact* from the *tool contract*. The same wrapper can serve a RandomForest today and a GradientBoosting tomorrow without changing the agent's prompt.
