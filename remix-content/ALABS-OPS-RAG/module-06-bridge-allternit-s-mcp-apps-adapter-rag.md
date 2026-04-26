# Bridge: Allternit's mcp-apps-adapter RAG

**Course:** ALABS-OPS-RAG — Build Private RAG & Document Intelligence  
**Tier:** OPS

## Bridge Concept

At Allternit, RAG is not a standalone chatbot. It is a capability exposed through the mcp-apps-adapter as an MCP tool. Any agent in the ecosystem—agui-gateway, a CLI bot, or a workflow node—can query the RAG index without knowing how it is implemented.

This module pulls back the curtain on Allternit's internal RAG architecture: how documents are ingested, how the embedding pipeline is versioned, and how query results are formatted as structured MCP responses. We also cover the failure modes we have seen in production: stale indexes, chunk boundary issues, and hallucinated citations.

## Learning Objectives

- [ ] Diagram the data flow from document ingestion to MCP tool response.
- [ ] Explain why Allternit versions its embedding model alongside its code.
- [ ] Diagnose three production RAG failures and their fixes.

## Demo Outline (10 min)

1. **Architecture Diagram:** Walk through the pipeline: Markdown docs → chunker → local embedding model → Chroma DB → MCP tool.
2. **Query Walkthrough:** Send an MCP tool call to \"query_docs\" and inspect the JSON response.
3. **Failure Case:** Show a stale-index query returning an outdated architecture decision. Explain the re-indexing trigger.

## Challenge (5 min)

> **Expose RAG as MCP:** Take your local RAG pipeline from the previous modules and wrap it as an MCP tool with a typed input schema (query, top_k, source_filter) and a structured output schema (answer, citations[].source, citations[].chunk_id).

## Allternit Connection

- **Internal system:** mcp-apps-adapter exposes \"query_internal_docs\" as an MCP tool.
- **Reference repo/file:** \"tools/rag_query.py\" in mcp-apps-adapter.
- **Key difference from standard approach:** Allternit separates the *indexer* (batch job) from the *querier* (real-time MCP tool). They share a contract but scale independently.
