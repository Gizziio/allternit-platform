# The Problem: Agents Are Bad at Structured Data Math

**Course:** ALABS-AGENTS-ML — ML as Agent Tools  
**Tier:** AGENTS

## Bridge Concept

LLMs excel at language, pattern recognition, and reasoning under uncertainty. But they are notoriously unreliable at structured-data math: regression, time-series forecasting, classification on tabular data, and optimization. Ask GPT-4 to predict next-quarter sales from a CSV, and it will hallucinate trends, misread column names, and produce overconfident nonsense.

This module reframes the relationship: LLMs are the *orchestrator*; ML models are the *specialist tools*. When an agent encounters a numerical reasoning task, it should delegate to a scikit-learn model, not try to compute the answer in-context. We introduce the architectural pattern of "ML-as-MCP-tool."

## Learning Objectives

- [ ] Identify three structured-data tasks where LLMs fail and ML models succeed.
- [ ] Contrast in-context regression (LLM guessing coefficients) with trained-model regression (scikit-learn).
- [ ] Explain why model versioning, feature schemas, and training pipelines are non-negotiable in agent systems.

## Demo Outline (10 min)

1. **The Failure:** Give an LLM a small CSV and ask for a linear regression prediction. Show the wild variance across three prompts.
2. **The Tool:** Train a scikit-learn LinearRegression on the same CSV. Expose it as a function tool. Show consistent, correct predictions.
3. **The Orchestrator:** Build a simple agent that decides "text question → LLM" vs. "numerical prediction → ML tool."

## Challenge (5 min)

> **The CSV Oracle:** Take a public dataset (e.g., California housing). Train a regression model. Write a prompt that makes an LLM refuse to do the math itself and instead call your model. Measure accuracy improvement.

## Allternit Connection

- **Internal system:** agui-gateway delegates numerical forecasting to scikit-learn models wrapped as MCP tools.
- **Reference repo/file:** \"tools/ml_forecast.py\" in mcp-apps-adapter.
- **Key difference from standard approach:** Allternit never allows the LLM to see raw training data. The model is the interface; the data stays in the training pipeline.
