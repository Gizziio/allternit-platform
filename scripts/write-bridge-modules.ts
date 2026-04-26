import fs from 'fs/promises';
import path from 'path';

const BASE_DIR = '/Users/macbook/Desktop/allternit-workspace/allternit/remix-content';

interface BridgeModule {
  courseCode: string;
  fileName: string;
  title: string;
  content: string;
}

const modules: BridgeModule[] = [
  // ========== ALABS-CORE-COPILOT ==========
  {
    courseCode: 'ALABS-CORE-COPILOT',
    fileName: 'module-01-the-problem-manual-coding-is-the-bottleneck.md',
    title: 'The Problem: Manual Coding is the Bottleneck',
    content: `# The Problem: Manual Coding is the Bottleneck

**Course:** ALABS-CORE-COPILOT — Build AI-Assisted Software with Copilot & Cursor  
**Tier:** CORE

## Bridge Concept

For decades, the speed of software development was limited by human typing speed, context-switching, and working memory. Compilers execute in milliseconds; humans reason in minutes. AI coding assistants flip this bottleneck: now the constraint is not writing code, but *directing* code.

In this module, we examine why manual coding has become the bottleneck in modern development pipelines, and how AI assistants (GitHub Copilot, Cursor, Claude Code) function as infrastructure rather than toys. We introduce the mental model shift from "I write every line" to "I orchestrate an intelligent compiler."

## Learning Objectives

- [ ] Articulate the economic and velocity cost of 100% hand-written code.
- [ ] Distinguish between AI assistants as "autocomplete" vs. "infrastructure."
- [ ] Identify the three failure modes of vibe coding: drift, hallucination, and context collapse.

## Demo Outline (10 min)

1. **The Bottleneck Map:** Show a typical feature request → hand-coding → review cycle (45 min). Replay with AI-assisted flow (8 min). Highlight where time is actually saved.
2. **Infrastructure Framing:** Open a repo (e.g., mcp-apps-adapter). Demonstrate how Copilot suggests domain-aware patterns because the codebase has conventions.
3. **Failure Mode #1 — Drift:** Show what happens when you let Copilot write 200 lines without review. The code "works" but violates project conventions.

## Challenge (5 min)

> **The 10-Line Rule:** Take a feature request. Write the first 10 lines manually, then use Copilot/Cursor to complete the rest. Stop every 20 lines to review. Document one drift you caught.

## Allternit Connection

- **Internal system:** agui-gateway and mcp-apps-adapter are maintained with Cursor + Copilot.
- **Reference repo/file:** See \\\".cursorrules\\\" in agui-gateway for project-specific conventions.
- **Key difference from standard approach:** Allternit enforces a \\\"human-in-the-loop at commit boundaries\\\" rule. AI writes drafts; humans own the commit.
`,
  },
  {
    courseCode: 'ALABS-CORE-COPILOT',
    fileName: 'module-06-bridge-allternit-s-cursor-copilot-stack.md',
    title: 'Bridge: Allternit\'s Cursor + Copilot Stack',
    content: `# Bridge: Allternit's Cursor + Copilot Stack

**Course:** ALABS-CORE-COPILOT — Build AI-Assisted Software with Copilot & Cursor  
**Tier:** CORE

## Bridge Concept

Most tutorials teach Copilot and Cursor in isolation. At Allternit, they are part of a unified stack: Copilot for in-flight suggestions inside VS Code, Cursor for deep architectural edits and multi-file refactoring. This module exposes how we divide labor between the two tools, and how project-specific context (rules files, domain schemas) makes the difference between generic output and production-grade code.

We also cover the guardrails: when to let AI write tests, when to reject AI-generated imports, and how to maintain a single source of truth for conventions.

## Learning Objectives

- [ ] Design a split workflow: Copilot for micro-edits, Cursor for macro-refactors.
- [ ] Write a \\\".cursorrules\\\" file that encodes project conventions.
- [ ] Evaluate AI-generated code against three criteria: correctness, convention, and cardinality.

## Demo Outline (10 min)

1. **The Stack in Action:** Open agui-gateway. Show Copilot completing a TypeScript interface in real time.
2. **Cursor Macro-Refactor:** Use Cursor Composer to extract a duplicated validation pattern into a shared utility across 4 files.
3. **Guardrail Review:** Show a diff where AI suggested importing a deprecated internal package. Explain the rejection rule.

## Challenge (5 min)

> **Write Your .cursorrules:** For a project of your choice, write a 20-line .cursorrules file covering: naming conventions, forbidden imports, and test expectations. Use it for one feature and measure the quality of AI suggestions.

## Allternit Connection

- **Internal system:** agui-gateway uses tiered prompt files and strict import boundaries.
- **Reference repo/file:** \\\".cursorrules\\\" and \\\"docs/ARCHITECTURE.md\\\" in agui-gateway.
- **Key difference from standard approach:** Allternit never allows AI to introduce new external dependencies without human approval. This prevents dependency sprawl.
`,
  },
  {
    courseCode: 'ALABS-CORE-COPILOT',
    fileName: 'module-07-capstone-build-an-mcp-server-with-cursor.md',
    title: 'Capstone: Build an MCP Server with Cursor',
    content: `# Capstone: Build an MCP Server with Cursor

**Course:** ALABS-CORE-COPILOT — Build AI-Assisted Software with Copilot & Cursor  
**Tier:** CORE

## Bridge Concept

The capstone tests whether you can direct an AI assistant to build a real, deployable artifact from a natural-language spec. You will build a TypeScript MCP (Model Context Protocol) server using Cursor as your primary coding interface. The server must expose at least one tool, one resource, and one prompt template. The twist: you cannot type more than 20% of the total lines manually.

This is not a test of Cursor's capabilities. It is a test of *your* ability to specify, review, and iterate.

## Learning Objectives

- [ ] Translate a natural-language spec into a typed MCP server implementation via AI assistance.
- [ ] Debug AI-generated code using compiler errors and runtime logs.
- [ ] Document the server for a downstream consumer (another AI agent or a human developer).

## Demo Outline (10 min)

1. **Spec → Prompt:** Start with a one-paragraph spec: \\\"A server that exposes a 'search_notes' tool, a 'note_summary' resource, and a 'summarize_tone' prompt.\\\"
2. **Cursor Session:** Show the Composer chat evolving the server across 3 iterations.
3. **Validation:** Run the server with the MCP Inspector. Fix one type mismatch the AI introduced.

## Challenge (Capstone — 60 min)

> **Build:** Create an MCP server in TypeScript that:
> - Implements at least one Tool, one Resource, and one Prompt.
> - Uses Cursor for >80% of the code generation.
> - Includes a README with setup and usage instructions.
> - Passes \\\"mcp-inspector\\\" validation without runtime errors.
>
> **Deliverable:** A GitHub repo link + a 1-page reflection on what you had to correct manually.

## Allternit Connection

- **Internal system:** mcp-apps-adapter is the reference implementation.
- **Reference repo/file:** github.com/allternit/mcp-apps-adapter
- **Key difference from standard approach:** Allternit's MCP servers are stateless and schema-strict. Every input is validated with Zod before processing.
`,
  },

  // ========== ALABS-OPS-RAG ==========
  {
    courseCode: 'ALABS-OPS-RAG',
    fileName: 'module-01-the-problem-cloud-rag-leaks-data.md',
    title: 'The Problem: Cloud RAG Leaks Data',
    content: `# The Problem: Cloud RAG Leaks Data

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

> **The Zero-Network Test:** Set up a RAG pipeline that loads a local PDF, embeds it with a local model, and answers questions without any outbound HTTP requests. Use a network sniffer (e.g., Little Snitch or \\\"lsof -i\\\") to verify.

## Allternit Connection

- **Internal system:** mcp-apps-adapter runs a local RAG index over internal markdown docs.
- **Reference repo/file:** \\\"services/rag-indexer/\\\" in mcp-apps-adapter.
- **Key difference from standard approach:** Allternit never embeds customer data into third-party APIs. The embedding model and vector store are both self-hosted.
`,
  },
  {
    courseCode: 'ALABS-OPS-RAG',
    fileName: 'module-05-agentic-rag.md',
    title: 'Agentic RAG',
    content: `# Agentic RAG

**Course:** ALABS-OPS-RAG — Build Private RAG & Document Intelligence  
**Tier:** OPS

## Bridge Concept

Standard RAG is a single-pass pattern: embed query → retrieve chunks → generate answer. It fails on multi-hop questions (\\\"Compare the Q3 revenue figures from the 2023 and 2024 reports\\\"), temporal reasoning, and contradictory sources.

Agentic RAG treats retrieval as a *tool* that an agent can call multiple times. The agent can reformulate queries, verify facts across documents, and decide when it has enough evidence. This module introduces the shift from naive RAG to agentic RAG, with a focus on local implementation patterns.

## Learning Objectives

- [ ] Contrast single-pass RAG with multi-step agentic RAG on a multi-hop question.
- [ ] Implement a ReAct-style loop where the agent decides whether to retrieve, reason, or respond.
- [ ] Design a citation scheme that ties every claim back to a specific document chunk.

## Demo Outline (10 min)

1. **The Failure Mode:** Ask a naive local RAG pipeline a multi-hop question. Watch it hallucinate a blended answer.
2. **Agentic Loop:** Show an agent that issues Query #1 (\\\"2023 Q3 revenue\\\"), Query #2 (\\\"2024 Q3 revenue\\\"), then compares.
3. **Citation Trace:** Walk through the agent's reasoning log and map each claim to a retrieved chunk.

## Challenge (5 min)

> **Multi-Hop Question:** Pick two PDFs with overlapping topics. Ask: \\\"What changed between Document A and Document B on topic X?\\\" Implement an agentic RAG loop that answers correctly and cites both sources.

## Allternit Connection

- **Internal system:** agui-gateway uses agentic RAG for long-context support threads.
- **Reference repo/file:** \\\"services/rag-indexer/agentic_query.py\\\"
- **Key difference from standard approach:** Allternit's RAG agent has a strict \\\"no answer without citation\\\" policy. If no chunk supports the claim, the agent responds with \\\"I don't have sufficient evidence.\\\"
`,
  },
  {
    courseCode: 'ALABS-OPS-RAG',
    fileName: 'module-06-bridge-allternit-s-mcp-apps-adapter-rag.md',
    title: 'Bridge: Allternit\'s mcp-apps-adapter RAG',
    content: `# Bridge: Allternit's mcp-apps-adapter RAG

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
2. **Query Walkthrough:** Send an MCP tool call to \\\"query_docs\\\" and inspect the JSON response.
3. **Failure Case:** Show a stale-index query returning an outdated architecture decision. Explain the re-indexing trigger.

## Challenge (5 min)

> **Expose RAG as MCP:** Take your local RAG pipeline from the previous modules and wrap it as an MCP tool with a typed input schema (query, top_k, source_filter) and a structured output schema (answer, citations[].source, citations[].chunk_id).

## Allternit Connection

- **Internal system:** mcp-apps-adapter exposes \\\"query_internal_docs\\\" as an MCP tool.
- **Reference repo/file:** \\\"tools/rag_query.py\\\" in mcp-apps-adapter.
- **Key difference from standard approach:** Allternit separates the *indexer* (batch job) from the *querier* (real-time MCP tool). They share a contract but scale independently.
`,
  },
  {
    courseCode: 'ALABS-OPS-RAG',
    fileName: 'module-07-capstone-offline-document-qa-agent.md',
    title: 'Capstone: Offline Document-QA Agent',
    content: `# Capstone: Offline Document-QA Agent

**Course:** ALABS-OPS-RAG — Build Private RAG & Document Intelligence  
**Tier:** OPS

## Bridge Concept

The capstone asks you to build a complete document-QA system that runs entirely offline on a single laptop. It must ingest PDFs, answer questions with inline citations, and survive a network-disconnect test. This is the exact profile of Allternit's field-deployment RAG: consultants need to query sensitive docs on airplanes, in client basements, or in jurisdictions with strict data-residency laws.

## Learning Objectives

- [ ] Assemble a full-stack offline RAG pipeline: PDF parser → chunker → local embedder → local LLM.
- [ ] Implement citation rendering so every claim is traceable to a source page/paragraph.
- [ ] Package the system so a non-technical user can run it with a single command.

## Demo Outline (10 min)

1. **End-to-End Run:** Drop a PDF into a folder, run the ingest script, then ask a question.
2. **Citation Inspection:** Show how the answer maps back to specific PDF pages.
3. **Disconnect Test:** Turn off Wi-Fi. Re-run the query. Confirm zero network activity.

## Challenge (Capstone — 60 min)

> **Build:** Create an offline Document-QA agent that:
> - Accepts a directory of PDFs as input.
> - Runs a local ingest pipeline (no cloud APIs).
> - Answers natural-language questions with citations.
> - Includes a simple CLI or web UI.
> - Passes the zero-network test.
>
> **Deliverable:** A GitHub repo link + a 2-minute screen recording of the offline test.

## Allternit Connection

- **Internal system:** mcp-apps-adapter has an offline mode for field deployments.
- **Reference repo/file:** \\\"scripts/offline_rag_demo.py\\\"
- **Key difference from standard approach:** Allternit's offline RAG uses quantized 7B models and aggressive caching. One model load serves hundreds of queries without reinitialization.
`,
  },

  // ========== ALABS-OPS-VISION ==========
  {
    courseCode: 'ALABS-OPS-VISION',
    fileName: 'module-01-the-problem-llms-are-blind.md',
    title: 'The Problem: LLMs Are Blind',
    content: `# The Problem: LLMs Are Blind

**Course:** ALABS-OPS-VISION — Computer Vision for AI Systems  
**Tier:** OPS

## Bridge Concept

Large language models can reason about text with near-human fluency, but they have no eyes. They cannot see a dashboard, a form field, or a physical object unless someone converts that visual information into text or tokens. This creates a hard boundary: any agent that needs to interact with GUIs, mobile apps, robots, or the physical world must have a vision layer.

This module establishes the problem space. We look at how computer vision bridges the gap between pixels and language, and why OpenCV remains the foundational tool for this translation layer. We also introduce the modern agentic vision stack: screen capture → region-of-interest extraction → captioning or OCR → LLM reasoning → action.

## Learning Objectives

- [ ] Explain why multimodal LLMs still require structured vision preprocessing for reliable automation.
- [ ] Map the vision-to-agent pipeline: capture → preprocess → encode → reason → act.
- [ ] Evaluate when to use classical CV (OpenCV) vs. end-to-end vision models (CLIP, GPT-4V).

## Demo Outline (10 min)

1. **The Blindness Test:** Ask a text-only LLM to describe a complex dashboard screenshot. It fails. Then feed it an OpenCV-extracted region-of-interest + OCR text. It succeeds.
2. **Pipeline Diagram:** Draw the full computer-use agent loop with OpenCV at the capture/preprocess stage.
3. **Latency Comparison:** Show the cost of sending a raw 4K screenshot to a cloud vision API vs. preprocessing locally with OpenCV and sending only the relevant crop.

## Challenge (5 min)

> **Screen Capture + Crop:** Write a Python script that captures your screen, uses OpenCV to draw a bounding box around a specific UI element (e.g., a button or text field), and saves only that crop. Do not send it to any API.

## Allternit Connection

- **Internal system:** agui-gateway uses a vision preprocessor for GUI automation tasks.
- **Reference repo/file:** \\\"services/vision-preprocessor/\\\" (conceptual; not yet public).
- **Key difference from standard approach:** Allternit preprocesses vision inputs locally with OpenCV before sending minimal, structured context to the LLM. This preserves privacy and reduces token costs by 90%+.
`,
  },
  {
    courseCode: 'ALABS-OPS-VISION',
    fileName: 'module-05-bridge-connecting-opencv-to-agent-systems.md',
    title: 'Bridge: Connecting OpenCV to Agent Systems',
    content: `# Bridge: Connecting OpenCV to Agent Systems

**Course:** ALABS-OPS-VISION — Computer Vision for AI Systems  
**Tier:** OPS

## Bridge Concept

OpenCV is 25 years old. It was built for robotics and surveillance, not LLM agents. But its speed, maturity, and zero-cost license make it the perfect preprocessing layer for modern agent systems. The bridge challenge is connecting OpenCV's pixel-centric world (matrices, contours, keypoints) to an LLM's token-centric world (text, JSON, structured descriptions).

This module shows how to build that bridge. We cover screen-state extraction, OCR integration, object localization, and the structured formats (JSON, Markdown tables) that let an LLM act on visual information. We also look at how Anthropic's computer-use SDK and OpenAI's Operator use similar patterns under the hood.

## Learning Objectives

- [ ] Extract structured state from a GUI screenshot using OpenCV + pytesseract.
- [ ] Format visual findings as a JSON object an LLM can consume.
- [ ] Implement a feedback loop where the LLM's action triggers a new screen capture.

## Demo Outline (10 min)

1. **Screen-State Parser:** Capture a web form. Use OpenCV to find text fields and buttons, then OCR to read labels. Output a JSON schema: { fields: [{label, bbox, type}], buttons: [{label, bbox}] }.
2. **LLM Action:** Feed the JSON to an LLM. Ask it to fill out the form. Parse its response into click/type coordinates.
3. **Feedback Loop:** Execute the action, capture the new screen state, and verify the form was filled correctly.

## Challenge (5 min)

> **The Login Bot:** Build a script that captures a login screen, uses OpenCV + OCR to locate the username field, password field, and submit button, and outputs a step-by-step action plan in JSON. (Do not actually enter credentials.)

## Allternit Connection

- **Internal system:** Allternit's workflow engine uses OpenCV to detect UI state changes before triggering downstream actions.
- **Reference repo/file:** \\\"agents/computer-use/screen_parser.py\\\" (conceptual).
- **Key difference from standard approach:** Allternit never sends full screenshots to cloud APIs. Vision is local-first; only structured, anonymized state descriptions leave the machine.
`,
  },
  {
    courseCode: 'ALABS-OPS-VISION',
    fileName: 'module-06-capstone-build-a-screen-state-analyzer-for-llm-agents.md',
    title: 'Capstone: Build a Screen-State Analyzer for LLM Agents',
    content: `# Capstone: Build a Screen-State Analyzer for LLM Agents

**Course:** ALABS-OPS-VISION — Computer Vision for AI Systems  
**Tier:** OPS

## Bridge Concept

The capstone integrates everything: you will build a screen-state analyzer that captures a region of the screen, preprocesses it with OpenCV, extracts meaningful structure, and feeds that structure to an LLM agent as context. The agent must then answer a question about the UI or propose an action.

Because we have no downloaded vision course, this capstone leans heavily on original content and free OpenCV documentation. The goal is not to train a neural network from scratch; it is to build the *plumbing* that connects classical computer vision to modern agent systems.

## Learning Objectives

- [ ] Build an end-to-end pipeline: screenshot → OpenCV preprocessing → structured JSON → LLM reasoning.
- [ ] Handle real-world noise: varying resolutions, dark mode, overlapping elements.
- [ ] Document the interface contract between the vision layer and the agent layer.

## Demo Outline (10 min)

1. **The Analyzer:** Show the screen-state analyzer running on a real application (e.g., a settings page).
2. **Noisy Input:** Run it on the same page in light mode and dark mode. Show how thresholding adapts.
3. **Agent Query:** Ask the LLM: \\\"How do I enable two-factor authentication?\\\" The agent uses the structured screen state to answer without ever seeing the raw screenshot.

## Challenge (Capstone — 60 min)

> **Build:** Create a screen-state analyzer that:
> - Captures a user-defined screen region.
> - Uses OpenCV to detect text regions and interactive elements.
> - Outputs a structured JSON description of the UI.
> - Accepts a natural-language question and passes the JSON + question to an LLM.
> - Returns the LLM's answer and any proposed actions.
>
> **Deliverable:** A GitHub repo link + a demo video showing the analyzer on two different applications.

## Allternit Connection

- **Internal system:** agui-gateway's GUI automation module uses a similar analyzer for click-and-type workflows.
- **Reference repo/file:** OpenCV official docs: docs.opencv.org (free resource).
- **Key difference from standard approach:** Allternit's analyzer is model-agnostic. It works with local LLMs, cloud LLMs, or even rule-based agents because the interface is pure structured JSON.
`,
  },

  // ========== ALABS-AGENTS-ML ==========
  {
    courseCode: 'ALABS-AGENTS-ML',
    fileName: 'module-01-the-problem-agents-are-bad-at-structured-data-math.md',
    title: 'The Problem: Agents Are Bad at Structured Data Math',
    content: `# The Problem: Agents Are Bad at Structured Data Math

**Course:** ALABS-AGENTS-ML — ML as Agent Tools  
**Tier:** AGENTS

## Bridge Concept

LLMs excel at language, pattern recognition, and reasoning under uncertainty. But they are notoriously unreliable at structured-data math: regression, time-series forecasting, classification on tabular data, and optimization. Ask GPT-4 to predict next-quarter sales from a CSV, and it will hallucinate trends, misread column names, and produce overconfident nonsense.

This module reframes the relationship: LLMs are the *orchestrator*; ML models are the *specialist tools*. When an agent encounters a numerical reasoning task, it should delegate to a scikit-learn model, not try to compute the answer in-context. We introduce the architectural pattern of "ML-as-MCP-tool."

## Learning Objectives

- [ ] Identify three structured-data tasks where LLMs fail and ML models succeed.
- [ ] Contrast in-context regression (LLM guessing coefficients) with trained-model regression (scikit-learn).
- [ ] Explain why model versioning, feature schemas, and training pipelines are non-negotiable in agent systems.

## Demo Outline (10 min)

1. **The Failure:** Give an LLM a small CSV and ask for a linear regression prediction. Show the wild variance across three prompts.
2. **The Tool:** Train a scikit-learn LinearRegression on the same CSV. Expose it as a function tool. Show consistent, correct predictions.
3. **The Orchestrator:** Build a simple agent that decides "text question → LLM" vs. "numerical prediction → ML tool."

## Challenge (5 min)

> **The CSV Oracle:** Take a public dataset (e.g., California housing). Train a regression model. Write a prompt that makes an LLM refuse to do the math itself and instead call your model. Measure accuracy improvement.

## Allternit Connection

- **Internal system:** agui-gateway delegates numerical forecasting to scikit-learn models wrapped as MCP tools.
- **Reference repo/file:** \\\"tools/ml_forecast.py\\\" in mcp-apps-adapter.
- **Key difference from standard approach:** Allternit never allows the LLM to see raw training data. The model is the interface; the data stays in the training pipeline.
`,
  },
  {
    courseCode: 'ALABS-AGENTS-ML',
    fileName: 'module-05-bridge-wrapping-ml-models-as-mcp-tools.md',
    title: 'Bridge: Wrapping ML Models as MCP Tools',
    content: `# Bridge: Wrapping ML Models as MCP Tools

**Course:** ALABS-AGENTS-ML — ML as Agent Tools  
**Tier:** AGENTS

## Bridge Concept

An ML model sitting on disk is useless to an agent. The agent speaks JSON, not pickle files. The bridge is the wrapper: a lightweight service that loads the model, validates inputs against the training feature schema, runs inference, and returns a structured result any agent can consume.

This module shows how to wrap scikit-learn models as MCP tools. We cover schema enforcement, error handling (what happens when the agent sends a categorical value it has never seen?), and versioning (how do you update the model without breaking the agent contract?).

## Learning Objectives

- [ ] Design a typed input/output schema for an ML model exposed as an MCP tool.
- [ ] Implement schema validation that rejects out-of-distribution inputs before inference.
- [ ] Version an ML model and its wrapper independently from the agent codebase.

## Demo Outline (10 min)

1. **The Wrapper:** Show a FastAPI/MCP server that loads a RandomForestClassifier and exposes a \\\"predict_customer_churn\\\" tool.
2. **Schema Enforcement:** Send a valid request → get a prediction. Send an invalid request (missing column, wrong type) → get a descriptive error the LLM can act on.
3. **Version Swap:** Swap the model file for v2. Restart the server. Show the agent still works because the interface contract is unchanged.

## Challenge (5 min)

> **Wrap Your Model:** Take the model you trained in the previous module. Wrap it as an MCP tool with a JSONSchema input and a structured output. Test it from an LLM agent context.

## Allternit Connection

- **Internal system:** mcp-apps-adapter hosts multiple ML tool endpoints.
- **Reference repo/file:** \\\"tools/ml_wrapper_template.py\\\" in mcp-apps-adapter.
- **Key difference from standard approach:** Allternit decouples the *model artifact* from the *tool contract*. The same wrapper can serve a RandomForest today and a GradientBoosting tomorrow without changing the agent's prompt.
`,
  },
  {
    courseCode: 'ALABS-AGENTS-ML',
    fileName: 'module-06-capstone-wrap-a-scikit-learn-model-as-an-mcp-tool.md',
    title: 'Capstone: Wrap a Scikit-Learn Model as an MCP Tool',
    content: `# Capstone: Wrap a Scikit-Learn Model as an MCP Tool

**Course:** ALABS-AGENTS-ML — ML as Agent Tools  
**Tier:** AGENTS

## Bridge Concept

The capstone is a full integration: you will train a scikit-learn model on a tabular dataset, wrap it as an MCP tool, and demonstrate an LLM agent delegating a numerical task to it. The deliverable is not just the model, but the *interface* that makes the model usable by an agent ecosystem.

This tests three skills: ML engineering (training and validation), API design (the MCP tool contract), and agent orchestration (prompting the LLM to use the tool correctly).

## Learning Objectives

- [ ] Train, validate, and serialize a scikit-learn model on a real dataset.
- [ ] Design and implement an MCP tool with strict input validation and human-readable error messages.
- [ ] Build an agent prompt that reliably routes structured-data questions to the ML tool instead of guessing.

## Demo Outline (10 min)

1. **Training Pipeline:** Load a dataset, engineer features, train a model, evaluate with cross-validation.
2. **MCP Integration:** Start the MCP server. Show the tool description as the LLM sees it.
3. **Agent Delegation:** Ask the LLM a business question that requires the model. Watch it call the tool, interpret the result, and explain the answer in natural language.

## Challenge (Capstone — 60 min)

> **Build:** An end-to-end ML-as-Tool system:
> - A trained scikit-learn model on a public dataset of your choice.
> - An MCP tool server that exposes the model with a clear schema.
> - A simple agent (CLI or notebook) that receives natural-language questions and delegates numerical tasks to the tool.
> - Documentation of the feature schema and expected input ranges.
>
> **Deliverable:** A GitHub repo link + a 2-minute demo of the agent successfully delegating a task.

## Allternit Connection

- **Internal system:** mcp-apps-adapter's forecasting and classification tools follow this exact pattern.
- **Reference repo/file:** \\\"examples/sklearn_mcp_tool/\\\" in mcp-apps-adapter.
- **Key difference from standard approach:** Allternit requires every ML tool to return a confidence score or uncertainty estimate. The agent uses this to decide whether to trust the prediction or ask for more data.
`,
  },

  // ========== ALABS-AGENTS-AGENTS ==========
  {
    courseCode: 'ALABS-AGENTS-AGENTS',
    fileName: 'module-01-the-problem-one-llm-can-t-do-everything.md',
    title: 'The Problem: One LLM Can\'t Do Everything',
    content: `# The Problem: One LLM Can't Do Everything

**Course:** ALABS-AGENTS-AGENTS — Architect Multi-Agent Systems  
**Tier:** AGENTS

## Bridge Concept

A single LLM is a generalist. It can write code, summarize text, answer trivia, and role-play. But it is not an expert at everything simultaneously. Ask the same model to do deep research, write secure code, and edit a video script, and you will get mediocrity across all three. The solution is specialization: multiple agents, each with a focused role, coordinated by an orchestrator.

This module introduces multi-agent architecture as the natural evolution from prompt engineering to system design. We cover the core tension: autonomy vs. control. The more freedom you give an agent, the more unpredictable it becomes. The more you constrain it, the less useful it is.

## Learning Objectives

- [ ] Identify three tasks where a single LLM fails and a multi-agent system succeeds.
- [ ] Compare central orchestration (one router, many workers) with peer-to-peer agent communication.
- [ ] Define the boundaries of an agent's responsibility using a role card: goal, tools, inputs, outputs, and veto conditions.

## Demo Outline (10 min)

1. **The Generalist Failure:** Ask one LLM to research, outline, and write a technical blog post in a single prompt. The result is shallow and structurally weak.
2. **The Specialist Success:** Split the task into three agents: Researcher, Outliner, Writer. Show how the final output improves.
3. **The Handoff:** Demonstrate the contract between agents. The Researcher outputs a JSON bibliography; the Writer must cite every claim from that bibliography.

## Challenge (5 min)

> **Role Card Design:** Pick a real-world task (e.g., customer support ticket triage). Write role cards for two agents. Define exactly what each agent owns, what it delegates, and when it must stop and ask a human.

## Allternit Connection

- **Internal system:** agui-gateway uses a tiered agent system: Router → Specialist → Validator.
- **Reference repo/file:** \\\"docs/agent-architecture.md\\\" in agui-gateway.
- **Key difference from standard approach:** Allternit agents do not share a monolithic context window. Each agent receives only the information it needs, reducing hallucination and cost.
`,
  },
  {
    courseCode: 'ALABS-AGENTS-AGENTS',
    fileName: 'module-06-bridge-allternit-s-agent-swarm-communication.md',
    title: 'Bridge: Allternit\'s Agent Swarm Communication',
    content: `# Bridge: Allternit's Agent Swarm Communication

**Course:** ALABS-AGENTS-AGENTS — Architect Multi-Agent Systems  
**Tier:** AGENTS

## Bridge Concept

Multi-agent systems fail when agents talk past each other. Without a shared protocol, one agent's "summary" is another agent's noise. At Allternit, we solve this with a communication domain service: a lightweight message bus that enforces schemas on inter-agent messages.

This module explains Allternit's agent swarm architecture. Agents do not call each other directly. They publish events to a domain bus. Other agents subscribe to relevant event types. This decouples agents so they can be developed, deployed, and scaled independently. It also creates an audit trail: every decision is traceable to the events that triggered it.

## Learning Objectives

- [ ] Diagram an event-driven agent architecture with a central domain bus.
- [ ] Define three event schemas that agents use to coordinate a complex task.
- [ ] Explain how an event bus enables agent independence, replay, and scaling.

## Demo Outline (10 min)

1. **The Bus Architecture:** Show three agents running as separate processes. They communicate through a Redis/NATS topic, not direct HTTP calls.
2. **Event Trace:** Walk through a complete workflow. Show the event log: AgentA published ResearchComplete, AgentB subscribed and published OutlineApproved, AgentC subscribed and wrote the draft.
3. **Replay:** Replay the same event log with a newer version of AgentC. Show that the output improves without changing AgentA or AgentB.

## Challenge (5 min)

> **Build a Mini Bus:** Implement a simple in-memory event bus (or use Redis). Create two agents: a Producer that publishes structured events, and a Consumer that acts on them. Run 10 tasks through the bus and verify the Consumer receives every event in order.

## Allternit Connection

- **Internal system:** The communication domain service is the backbone of Allternit's multi-agent workflows.
- **Reference repo/file:** \\\"services/communication-domain/\\\" in the Allternit monorepo.
- **Key difference from standard approach:** Allternit agents are stateless. All state lives in the event log. This means any agent can be restarted, scaled, or replaced without losing context.
`,
  },
  {
    courseCode: 'ALABS-AGENTS-AGENTS',
    fileName: 'module-07-capstone-design-a-3-agent-collaborative-blog-writing-system.md',
    title: 'Capstone: Design a 3-Agent Collaborative Blog-Writing System',
    content: `# Capstone: Design a 3-Agent Collaborative Blog-Writing System

**Course:** ALABS-AGENTS-AGENTS — Architect Multi-Agent Systems  
**Tier:** AGENTS

## Bridge Concept

The capstone is a full multi-agent system design. You will build three agents that collaborate to write a technical blog post:
1. **Research Agent:** Gathers facts and sources.
2. **Outline Agent:** Structures the post into sections.
3. **Writer Agent:** Produces the final prose, constrained by the outline and citations.

The challenge is not the prose quality. It is the *coordination*: how do agents hand off work? How do they handle disagreements? How do you prevent the Writer from ignoring the Researcher's sources? Your solution will be evaluated on architecture, not eloquence.

## Learning Objectives

- [ ] Design a multi-agent system with explicit handoff contracts between roles.
- [ ] Implement a lightweight orchestrator or event bus that coordinates the agents.
- [ ] Debug coordination failures: loops, dropped context, and conflicting instructions.

## Demo Outline (10 min)

1. **System Overview:** Introduce the three agents and the orchestrator. Show the state machine: Research → Outline → Draft → Review.
2. **A Successful Run:** Give the system a topic. Walk through the event log or chat history showing clean handoffs.
3. **Debugging a Failure:** Show what happens when the Writer hallucinates a source. Trace the failure back to a missing validation step.

## Challenge (Capstone — 60 min)

> **Build:** A 3-agent blog-writing system with:
> - Three distinct agents, each with a clear role card.
> - An orchestration mechanism (event bus, state machine, or prompt chaining).
> - A validation step that checks the final draft against the original sources.
> - A written architecture doc explaining your handoff contracts and failure modes.
>
> **Deliverable:** A GitHub repo link + the architecture doc + a sample blog post generated by the system.

## Allternit Connection

- **Internal system:** agui-gateway uses a similar 3-agent pattern for long-form content generation.
- **Reference repo/file:** \\\"examples/multi_agent_blog_pipeline/\\\" (conceptual).
- **Key difference from standard approach:** Allternit never lets an agent write the final output without a Validator agent checking facts against sources. The Writer can be creative; the Validator must be skeptical.
`,
  },
];

async function main() {
  for (const mod of modules) {
    const dir = path.join(BASE_DIR, mod.courseCode);
    const filePath = path.join(dir, mod.fileName);
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(filePath, mod.content);
    console.log(`Wrote ${mod.courseCode}/${mod.fileName} (${Buffer.byteLength(mod.content)} bytes)`);
  }
}

main().catch(console.error);
