# The Problem: Cloud RAG Leaks Data

**Course:** ALABS-OPS-RAG — Build Private RAG & Document Intelligence  
**Tier:** OPS

## Bridge Concept

Retrieval-Augmented Generation (RAG) is the dominant pattern for grounding LLMs in private knowledge. But most tutorials assume you will send your documents to OpenAI, Pinecone, or another cloud API. For enterprise contracts, health records, legal discovery, or internal strategy docs, that is a data-leak incident waiting to happen.

This module reframes RAG as a *local-first* architecture. We compare cloud RAG stacks (OpenAI + Pinecone) with local stacks (llama.cpp + Chroma/FAISS) and quantify the privacy, latency, and cost trade-offs. The core insight: you do not need a cloud GPU farm to run high-quality RAG on a laptop.

## Learning Objectives

- [ ] Identify the 3 leak vectors in cloud RAG: embedding API, vector DB, and generation API.
- [ ] Compare latency and cost curves for local vs. cloud RAG at 1K, 10K, and 100K document scale.
- [ ] Select a local model size (3B, 7B, 13B) based on hardware constraints and accuracy requirements.

## Demo Outline (10 min)

1. **Leak Vector Map:** Draw the data flow for a typical cloud RAG query. Highlight where the raw document text is exposed.
2. **Local Stack:** Show a working RAG pipeline on a laptop using llamafile (or ollama) + Chroma. Query a sensitive PDF and confirm zero network calls.
3. **Accuracy Benchmark:** Run the same question against cloud and local RAG. Compare answer quality and response time.

## Challenge (5 min)

> **The Zero-Network Test:** Set up a RAG pipeline that loads a local PDF, embeds it with a local model, and answers questions without any outbound HTTP requests. Use a network sniffer (e.g., Little Snitch or \"lsof -i\") to verify.

## Allternit Connection

- **Internal system:** mcp-apps-adapter runs a local RAG index over internal markdown docs.
- **Reference repo/file:** \"services/rag-indexer/\" in mcp-apps-adapter.
- **Key difference from standard approach:** Allternit never embeds customer data into third-party APIs. The embedding model and vector store are both self-hosted.
