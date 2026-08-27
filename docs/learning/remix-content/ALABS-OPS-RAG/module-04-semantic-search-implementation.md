# Semantic Search Implementation

**Course:** ALABS-OPS-RAG — Build Private RAG & Document Intelligence  
**Tier:** OPS

## Module Overview

Semantic search is the retrieval engine of RAG. This module dives deep into embedding-based search: how to generate embeddings, index them efficiently, and query them at scale. You will implement semantic search with local vector stores and learn how to optimize recall and relevance.

## Learning Objectives

- [ ] Implement a semantic search pipeline with a local embedding model and vector store.
- [ ] Tune retrieval parameters: top-k, similarity threshold, and chunk size.
- [ ] Evaluate search quality with precision@k and mean reciprocal rank (MRR).

## Lecture Guide

**Source:** Chroma docs + FAISS docs + sentence-transformers documentation

1. **What is Semantic Search?** — Meaning-based retrieval vs. keyword matching.
2. **Embedding Models** — all-MiniLM, mpnet, and domain-specific encoders.
3. **Vector Stores** — Chroma, FAISS, Weaviate, and LanceDB compared.
4. **Indexing Documents** — From raw text to vector embeddings.
5. **Similarity Metrics** — Cosine, dot product, and Euclidean distance.
6. **Query Embeddings** — Converting questions into the same vector space.
7. **Top-K Retrieval** — Selecting the right number of chunks.
8. **Similarity Thresholds** — Filtering out irrelevant results.
9. **Metadata Filtering** — Combining vector search with structured filters.
10. **Hybrid Search** — Merging dense and sparse retrieval scores.
11. **Re-ranking** — Using a second model to improve result ordering.
12. **Chunk Size Impact** — How chunk length affects embedding quality.
13. **Multi-Query Retrieval** — Generating variations of the query for better recall.
14. **Index Updates** — Adding, deleting, and updating documents without rebuilding.
15. **Evaluation Datasets** — Creating ground-truth Q&A pairs for benchmarking.

## Demo Outline (10 min)

1. Index 50 PDF pages into Chroma with a local embedding model.
2. Query with a natural language question. Show the top-5 retrieved chunks.
3. Adjust the chunk size and re-index. Compare retrieval quality.
4. Add a metadata filter: only search documents tagged \"architecture.\"

## Challenge (5 min)

> **The Search Benchmark:** Create 10 question-answer pairs from a document you index. Test semantic search with two different chunk sizes (200 and 500 tokens). Score how many times the correct chunk appears in the top-3 results. Report which chunk size wins and why.

## Allternit Connection

- **Internal system:** mcp-apps-adapter uses Chroma for semantic search over internal docs.
- **Reference repo/file:** \"services/rag-indexer/semantic_search.py\"
- **Key difference from standard approach:** Allternit re-ranks initial semantic search results with a lightweight cross-encoder before sending the top chunks to the LLM. This improves answer quality with minimal latency cost.
