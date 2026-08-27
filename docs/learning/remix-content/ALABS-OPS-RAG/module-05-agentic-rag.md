# Agentic RAG

**Course:** ALABS-OPS-RAG — Build Private RAG & Document Intelligence  
**Tier:** OPS

## Bridge Concept

Standard RAG is a single-pass pattern: embed query → retrieve chunks → generate answer. It fails on multi-hop questions (\"Compare the Q3 revenue figures from the 2023 and 2024 reports\"), temporal reasoning, and contradictory sources.

Agentic RAG treats retrieval as a *tool* that an agent can call multiple times. The agent can reformulate queries, verify facts across documents, and decide when it has enough evidence. This module introduces the shift from naive RAG to agentic RAG, with a focus on local implementation patterns.

## Learning Objectives

- [ ] Contrast single-pass RAG with multi-step agentic RAG on a multi-hop question.
- [ ] Implement a ReAct-style loop where the agent decides whether to retrieve, reason, or respond.
- [ ] Design a citation scheme that ties every claim back to a specific document chunk.

## Demo Outline (10 min)

1. **The Failure Mode:** Ask a naive local RAG pipeline a multi-hop question. Watch it hallucinate a blended answer.
2. **Agentic Loop:** Show an agent that issues Query #1 (\"2023 Q3 revenue\"), Query #2 (\"2024 Q3 revenue\"), then compares.
3. **Citation Trace:** Walk through the agent's reasoning log and map each claim to a retrieved chunk.

## Challenge (5 min)

> **Multi-Hop Question:** Pick two PDFs with overlapping topics. Ask: \"What changed between Document A and Document B on topic X?\" Implement an agentic RAG loop that answers correctly and cites both sources.

## Allternit Connection

- **Internal system:** agui-gateway uses agentic RAG for long-context support threads.
- **Reference repo/file:** \"services/rag-indexer/agentic_query.py\"
- **Key difference from standard approach:** Allternit's RAG agent has a strict \"no answer without citation\" policy. If no chunk supports the claim, the agent responds with \"I don't have sufficient evidence.\"
