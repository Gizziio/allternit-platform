# Allternit Glossary

This page defines terms used across the Allternit platform, documentation, and APIs.

## A

**ACI (Allternit Computer Interface)** — The platform's computer-use capability. Replaces the earlier "Allternit Operator" name. ACI lets agents observe and control a desktop environment through screenshot and input primitives.

**Agent** — A configured entity that can hold conversations, use tools, manage memory, and execute tasks on behalf of a user or organization.

**Alias (model alias)** — A policy-driven shortcut such as `smart`, `fast`, or `code` that resolves to a concrete model at request time based on routing rules and provider health.

**Allowlist (model)** — A per-virtual-key list of models that the key is permitted to call.

## B

**Batch** — A collection of chat-completion requests submitted asynchronously through `POST /v1/batches`, processed by the background `BatchWorker`, and retrieved via results endpoint.

**BYOC (Bring Your Own Cloud)** — The self-hosting model where customers run the Allternit control plane and runtime on their own infrastructure while managing their own provider keys and data.

## C

**Citation** — A reference to a source document or passage returned by a model. Allternit normalizes provider-specific citation formats into an OpenAI-compatible annotation shape.

**Clerk** — The external identity provider used for user authentication, organization membership, and JWT issuance.

**Context window** — The maximum number of tokens a model can accept in a single request, including system prompt, transcript, and tool results.

## D

**DLP (Data Loss Prevention)** — The gateway middleware that scans outgoing requests for secrets, PII, and prompt-injection patterns.

**DAG (Directed Acyclic Graph)** — The Rails execution abstraction used for multi-step workflows and cowork runs.

## E

**Eval** — A structured evaluation run that scores model outputs against reference data using built-in metrics or LLM-as-judge rubrics.

**External key** — A provider API key (OpenAI, Anthropic, AWS, etc.) stored in Allternit and mapped to a connector or workspace.

## F

**Fallback chain** — An ordered list of models used when the primary model refuses, errors, or is unavailable. Managed by `llm_gateway::failover`.

## G

**Gizzi** — The underlying TypeScript runtime that executes agent sessions, manages provider adapters, and implements the tool loop. `gizzi-code` is the unified CLI brand.

**Gateway (LLM gateway)** — The Rust OpenAI-compatible API surface (`/v1/*`) that handles auth, rate limits, DLP, budgets, routing, and provider forwarding.

## I

**Inference hook** — A pre- or post-request HTTP callback that can mutate or abort a request for custom policy enforcement.

## M

**Memory** — Persistent session context stored via the `memory` tool and `/api/v1/memory/session` endpoints.

**MCP (Model Context Protocol)** — A protocol for attaching external tool servers to the Allternit Tool Belt.

**Metric** — A built-in scorer such as `exact_match`, `token_overlap`, `rouge_l`, `cosine_similarity`, or `consistency`.

## P

**Policy alias** — See **Alias**.

**Prompt leak** — A scenario where user text contains fragments of the system prompt. Detected by `/api/v1/admin/prompt-leak-checks`.

## R

**Rails** — The internal work-engine that schedules and tracks DAG-based jobs and handoffs.

**Region** — A deployment region published by `GET /regions` with egress IP ranges for firewall allow-listing.

**Routing decision** — The record produced by the router when selecting a model, including benchmark scores and fallback chain.

## S

**Skill** — A packaged capability described by a `SKILL.md` file and loaded from the skill registry (`~/.allternit/skills/`).

**Stream chunk** — A server-sent event delivered during `stream: true` chat completions, such as `content_block_delta`, `thinking_delta`, or `tool_calls` deltas.

## T

**Tool Belt** — The registry of native and MCP-attached tools available to agents.

## V

**Vault** — An encrypted store for sensitive credentials scoped to organizations and access policies.

**Virtual key** — An Allternit-managed API key (`ak-…`) used for the `/v1` LLM gateway surface.

## W

**Workspace** — An organizational container for agents, sessions, files, and other resources.
