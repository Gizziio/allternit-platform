# OpenAI Agent Nodes

**Course:** ALABS-OPS-N8N — Orchestrate Agents & Automations with n8n  
**Tier:** OPS

## Module Overview

This module explores how n8n integrates with AI agents using OpenAI and LangChain nodes. You will build workflows where LLMs classify text, summarize content, extract entities, and make decisions that drive branching logic.

## Learning Objectives

- [ ] Configure the OpenAI node for chat completions with system and user prompts.
- [ ] Use LLM output to control workflow branching (classification, extraction, scoring).
- [ ] Implement a basic agent loop with memory using LangChain nodes in n8n.

## Lecture Guide

**Source:** Build AI Agents with n8n: Free Hands-On Training + AI Agent N8N Masterclass

1. **OpenAI Node Basics** — API key setup, model selection, temperature, and max tokens.
2. **Prompt Engineering in n8n** — Constructing dynamic prompts from workflow data.
3. **Classification Workflows** — Using LLM output to route items into categories.
4. **Summarization Pipelines** — Feeding long documents to GPT and parsing summaries.
5. **Entity Extraction** — Structured JSON output from unstructured text.
6. **Sentiment Analysis** — Scoring customer feedback and triggering alerts.
7. **Question Answering** — Retrieval-augmented responses with context injection.
8. **LangChain Agent Node** — Tool-calling agents inside n8n workflows.
9. **Memory & Context** — Maintaining conversation state across workflow executions.
10. **Function Calling** — Defining JSON schemas for structured LLM responses.
11. **Multi-Step Reasoning** — Chaining multiple LLM calls for complex tasks.
12. **Cost Tracking** — Estimating token usage and API spend per workflow run.
13. **Retry & Fallback** — Handling OpenAI rate limits and model downtime.
14. **Local LLM Alternative** — Connecting to Ollama or LM Studio from n8n.
15. **Security Best Practices** — Prompt injection prevention and output validation.

## Demo Outline (10 min)

1. Build an email classifier: Gmail trigger → OpenAI node (classify as urgent/standard/spam) → route to Slack or archive.
2. Show structured output using function calling to get JSON.
3. Add a validation step: if the JSON is malformed, retry with a stricter prompt.

## Challenge (5 min)

> **The Ticket Tagger:** Build a workflow that receives support emails, asks GPT to assign priority (1-4) and department, and routes to the correct Slack channel based on the response.

## Allternit Connection

- **Internal system:** agui-gateway uses n8n for lightweight NLP tasks before handing off to domain agents.
- **Reference repo/file:** \"workflows/email_classifier_v2.json\"
- **Key difference from standard approach:** Allternit always validates LLM JSON output against a Zod schema before using it for routing. Malformed outputs are sent to a human review queue.
