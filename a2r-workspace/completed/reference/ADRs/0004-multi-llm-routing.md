# 0004. Multi-LLM Routing & Provider Plugin Architecture

Date: 2026-02-04

## Status
Accepted

## Context
A2Rchitech must be model-agnostic and cost-aware. Direct integration with specific LLM APIs makes the system brittle and prevents dynamic optimization (e.g., routing a simple task to a cheaper model).

## Decision
Implement a policy-based Routing layer and a standardized Provider Plugin interface:
1.  **RouterAdapter**: A central switch that selects models based on intent, capability, and budget.
2.  **ProviderPlugin**: A standard interface (`generate`, `stream`) that all model adapters (Anthropic, OpenAI, etc.) must implement.
3.  **Audit Receipts**: Every routing decision generates a signed receipt for traceability.

## Consequences
- **Extensibility**: Adding a new model provider requires only a single plugin implementation.
- **Cost Optimization**: The system can automatically choose the most efficient model for a given task.
- **Traceability**: Audit logs explain *why* a specific model was chosen.

