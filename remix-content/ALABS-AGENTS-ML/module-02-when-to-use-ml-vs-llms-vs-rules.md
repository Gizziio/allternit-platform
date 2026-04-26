# When to Use ML vs. LLMs vs. Rules

**Course:** ALABS-AGENTS-ML — ML as Agent Tools  
**Tier:** AGENTS

## Module Overview

Not every problem needs a neural network. This module teaches the decision framework for choosing between deterministic rules, traditional ML models, and LLMs. You will learn when each approach is appropriate based on data size, interpretability requirements, latency constraints, and cost.

## Learning Objectives

- [ ] Apply a decision matrix to select rules, ML, or LLMs for a given task.
- [ ] Explain why LLMs are poor at precise numerical reasoning on structured data.
- [ ] Identify scenarios where a hybrid approach (rules + ML + LLM) outperforms any single method.

## Lecture Guide

**Source:** Machine Learning Fundamentals [Python] + Machine Learning with Python

1. **The Three Tools** — Rules, ML, and LLMs: strengths and weaknesses.
2. **Rules-Based Systems** — When logic is explicit and unchanging.
3. **ML Systems** — When patterns exist but are too complex to encode manually.
4. **LLM Systems** — When flexibility, language understanding, and reasoning matter.
5. **Data Size Considerations** — Rules need none, ML needs hundreds+, LLMs need context.
6. **Interpretability** — Explaining decisions: rules > ML > LLMs.
7. **Latency & Cost** — Inference speed and API pricing comparison.
8. **Accuracy & Precision** — When exact answers matter vs. good-enough approximations.
9. **Maintenance Overhead** — Updating rules, retraining models, and prompting.
10. **Hybrid Architectures** — Using each tool for what it does best.
11. **Fallback Patterns** — LLM tries first, rule validates; or vice versa.
12. **Tabular Data** — Why ML dominates structured datasets.
13. **Text & Unstructured Data** — Why LLMs dominate documents and conversations.
14. **Edge Cases** — Handling outliers with rules and exceptions.
15. **Production Trade-offs** — Scalability, monitoring, and error recovery.

## Demo Outline (10 min)

1. Present a task: \"Flag fraudulent transactions.\" Show how rules, ML, and LLM each approach it.
2. Build a simple decision tree: transaction amount > $10K AND location != home → flag.
3. Contrast with an ML model trained on historical fraud data. Compare precision and interpretability.

## Challenge (5 min)

> **The Decision Matrix:** Pick three real-world tasks. Fill out a matrix scoring each on: data availability, interpretability need, latency budget, and flexibility requirement. Recommend rules, ML, or LLM for each. Defend your choices.

## Allternit Connection

- **Internal system:** agui-gateway uses a routing layer that selects rules, ML, or LLM based on query type.
- **Reference repo/file:** \"services/intent-router/decision_matrix.yaml\"
- **Key difference from standard approach:** Allternit never uses an LLM for financial calculations or compliance decisions. Those are handled by audited rules and ML models with explainable outputs.
