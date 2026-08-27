# Python + OpenAI API Patterns

**Course:** ALABS-CORE-PROMPTS — Engineer Prompts for Agent Systems  
**Tier:** CORE

## Module Overview

This module covers the practical implementation of prompt engineering in Python. You will learn how to call the OpenAI API programmatically, manage message history, handle streaming responses, and build reusable prompt classes that can be tested and versioned.

## Learning Objectives

- [ ] Make structured API calls to OpenAI (and compatible APIs) from Python.
- [ ] Implement conversation memory and context window management.
- [ ] Parse streaming responses and handle API errors gracefully.

## Lecture Guide

**Source:** Prompt Engineering with Python and ChatGPT API (Free Course)

1. **API Setup** — Keys, endpoints, and client libraries (openai, httpx).
2. **Basic Completion** — The chat.completions.create interface.
3. **Message Roles** — System, user, assistant, and function/tool messages.
4. **Temperature & Sampling** — Controlling creativity and determinism.
5. **Structured Output** — JSON mode and function calling.
6. **Streaming** — Processing token-by-token responses.
7. **Error Handling** — Retries, rate limits, and timeouts.
8. **Conversation Memory** — Sliding window and summarization strategies.
9. **Token Counting** — Estimating costs and staying within limits.
10. **Batch Processing** — Running prompts over datasets efficiently.
11. **Prompt Chaining** — Feeding output of one call into the next.
12. **Local LLM APIs** — Using Ollama, LM Studio, and vLLM.
13. **Embedding APIs** — Generating vectors for semantic search.
14. **Evaluation Loops** — Scoring outputs and iterating on prompts.
15. **Production Patterns** — Async clients, connection pooling, and caching.

## Demo Outline (10 min)

1. Write a Python script that sends a structured classification prompt to the API.
2. Show JSON-mode output parsing with Pydantic validation.
3. Add streaming and print tokens as they arrive.

## Challenge (5 min)

> **The Conversation Agent:** Build a Python CLI chatbot that maintains a conversation history, summarizes old context when token limits approach, and always responds with a JSON object containing {response, sentiment, follow_up_suggested}.

## Allternit Connection

- **Internal system:** agui-gateway's Python services use async OpenAI clients with structured output.
- **Reference repo/file:** \"services/prompt-engine/openai_client.py\"
- **Key difference from standard approach:** Allternit never sends raw user input directly to the API. Every message passes through a sanitization and validation layer first.
