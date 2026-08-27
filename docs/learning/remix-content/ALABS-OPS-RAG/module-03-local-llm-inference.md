# Local LLM Inference

**Course:** ALABS-OPS-RAG — Build Private RAG & Document Intelligence  
**Tier:** OPS

## Module Overview

Cloud LLMs are powerful but come with privacy risks and latency costs. This module covers how to run language models entirely on local hardware: llama.cpp, Ollama, LM Studio, and llamafile. You will learn model selection, quantization trade-offs, and how to serve a local API that replaces OpenAI in your RAG pipeline.

## Learning Objectives

- [ ] Run a 7B parameter model locally with acceptable inference speed.
- [ ] Explain quantization (Q4_K_M, Q5_K_M, Q8_0) and its impact on quality vs. speed.
- [ ] Expose a local LLM via an OpenAI-compatible API for drop-in replacement.

## Lecture Guide

**Source:** Ollama docs + LM Studio guides + local LLM community resources

1. **Why Local?** — Privacy, cost, latency, and offline access.
2. **Hardware Requirements** — RAM, GPU, and disk space for local models.
3. **Model Families** — Llama, Mistral, Qwen, and Phi.
4. **Quantization Explained** — 4-bit, 5-bit, and 8-bit compression.
5. **Ollama** — The easiest way to run local models.
6. **llama.cpp** — The engine under most local inference tools.
7. **LM Studio** — GUI-based local model management.
8. **llamafile** — Single-file executable models.
9. **OpenAI-Compatible APIs** — Using /v1/chat/completions locally.
10. **Context Windows** — How much text a local model can process.
11. **Inference Speed** — Tokens per second on CPU vs. GPU vs. Apple Silicon.
12. **Model Selection** — Matching model size to hardware constraints.
13. **Fine-Tuning vs. RAG** — When to train and when to retrieve.
14. **Multi-Model Setups** — Using small models for routing and large models for generation.
15. **Production Deployment** — Dockerizing local inference servers.

## Demo Outline (10 min)

1. Install Ollama and pull a 7B model (e.g., llama3.1 or mistral).
2. Run inference locally. Measure tokens/second.
3. Show the OpenAI-compatible endpoint: curl http://localhost:11434/v1/chat/completions
4. Swap the OpenAI client in a Python script for the local endpoint. Run a RAG query with zero cloud calls.

## Challenge (5 min)

> **The Offline Swap:** Take any Python script that uses the OpenAI API. Modify it to call a local Ollama endpoint instead. Run it successfully with Wi-Fi disabled.

## Allternit Connection

- **Internal system:** Allternit's field deployments use local LLMs for fully offline RAG.
- **Reference repo/file:** \"infra/docker/ollama/\" in the DevOps repo.
- **Key difference from standard approach:** Allternit maintains a curated model registry. Only models that pass accuracy benchmarks on internal tasks are approved for production use.
