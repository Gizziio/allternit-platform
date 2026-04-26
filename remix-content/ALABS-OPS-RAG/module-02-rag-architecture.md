# RAG Architecture

**Course:** ALABS-OPS-RAG — Build Private RAG & Document Intelligence  
**Tier:** OPS

## Module Overview

Retrieval-Augmented Generation (RAG) is the dominant pattern for grounding LLMs in private knowledge. This module covers the RAG pipeline architecture: document ingestion, chunking, embedding, vector storage, retrieval, and generation. We focus on local-first implementations using open-source tools.

## Learning Objectives

- [ ] Diagram the complete RAG pipeline and explain each stage's purpose.
- [ ] Implement document chunking strategies that preserve semantic boundaries.
- [ ] Compare dense retrieval (embeddings) with sparse retrieval (BM25, keywords).

## Lecture Guide

**Source:** LLMWare documentation + local-first RAG tutorials

1. **What is RAG?** — Combining retrieval with language generation.
2. **Document Ingestion** — PDFs, Markdown, HTML, and structured files.
3. **Preprocessing** — Cleaning text, removing boilerplate, and normalization.
4. **Chunking Strategies** — Fixed-size, semantic, and hierarchical chunking.
5. **Chunk Overlap** — Balancing context loss with redundancy.
6. **Embedding Models** — Sentence transformers and local embedding options.
7. **Vector Databases** — Chroma, FAISS, Weaviate, and LanceDB.
8. **Dense Retrieval** — Similarity search in embedding space.
9. **Sparse Retrieval** — Keyword-based methods and hybrid search.
10. **Re-ranking** — Improving retrieval quality with cross-encoders.
11. **Context Injection** — Formatting retrieved chunks for the LLM prompt.
12. **Generation Parameters** — Temperature, max tokens, and system prompts.
13. **Citation** — Mapping generated claims back to source chunks.
14. **Evaluation** — Measuring retrieval accuracy and answer relevance.
15. **Scaling Considerations** — Indexing millions of documents locally.

## Demo Outline (10 min)

1. Load a PDF with a local Python script.
2. Chunk it, embed it with a local sentence-transformer model, and store in Chroma.
3. Ask a question. Retrieve top-3 chunks and generate an answer using a local LLM.
4. Show the citations mapping the answer back to PDF pages.

## Challenge (5 min)

> **The Local Indexer:** Build a script that takes a folder of text files, chunks them, embeds them with a local model, and stores them in a FAISS index. Query the index and print the top-3 most relevant chunks for a given question.

## Allternit Connection

- **Internal system:** mcp-apps-adapter hosts a local RAG index over internal documentation.
- **Reference repo/file:** \"services/rag-indexer/local_pipeline.py\"
- **Key difference from standard approach:** Allternit uses a hybrid retrieval strategy: dense embeddings for semantic similarity, plus BM25 for exact keyword matching. This improves recall on technical terms and product names.
