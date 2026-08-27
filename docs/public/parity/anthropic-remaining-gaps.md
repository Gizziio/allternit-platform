# Anthropic parity: remaining gaps and Allternit roadmap

This page maps the remaining Anthropic concepts that do not yet have a direct Allternit equivalent. Each item documents the current state and the planned path to parity.

## SDK languages beyond TypeScript and Python

Allternit currently provides first-class TypeScript and Python SDKs. Other languages can use any OpenAI-compatible client today; native SDKs for Go, Java, C#, PHP, and Ruby are on the roadmap and can be generated from the Allternit OpenAPI description. See [SDK language support](./anthropic-sdk-languages.md).

## Apple Foundation Models

Anthropic supports Apple MLX via its iOS/macOS SDKs. Allternit's local runtime already supports Ollama-compatible endpoints; an Apple MLX adapter is planned for the local inference stack.

## Advisor tool

Anthropic's Advisor tool provides repo-context coding advice. Allternit does not ship this exact tool, but the same capability can be built as a skill (`SKILL.md`) that reads repo context and calls the harness. A canonical `allternit/advisor` skill is planned.

## Strict tool use

Allternit already supports strict tool schemas. Register a tool with `strict: true` and the SDK closes the JSON Schema (`additionalProperties: false`) before execution. See [Strict Tool Use](../tools/strict-tool-use.md).

## Fine-grained tool streaming

Allternit streams tool-call deltas at the message level. Per-tool-call incremental JSON streaming (e.g., parsing partial function arguments as they arrive) is not yet implemented; it is planned for the Tool Belt dispatcher.

## Programmatic tool calling

Programmatic tool calling lets a model emit code that invokes tools directly inside a sandboxed execution context. Allternit's `code_execution` tool runs code in a subprocess/WebVM fallback; first-class programmatic tool invocation is planned as an extension of the sandbox executor.

## Tool context management

Allternit keeps tool results in the conversation `messages` array. Explicit context-token budgets, an active tool window, and clearing stale tool results are not yet exposed; they are planned for the session memory layer.

## Tool combinations

Composing tools through a DSL is not yet supported. Allternit's workflow engine will provide tool-composition primitives (sequence, parallel, condition, loop) in a future release.

## Dreams and Dreams API

Anthropic Dreams are memory-reconstruction replay sessions. Allternit has session memory and history stores; a `beta/dreams` job API for memory reconstruction is on the long-term roadmap.

## Prototype in Console

Anthropic Console provides an interactive agent prototyping UI. Allternit focuses on self-hosting and CLI-first workflows; a web-based prototyping console is a future surface, with the backend primitives (`/api/v1/agents`, `/beta/sessions`) already in place.

## Data residency

Region pinning and data-locality controls are not yet implemented. Allternit's BYOC/self-host model already lets users choose their infrastructure region; managed-cloud residency controls are planned.

## Workload identity federation (WIF) providers

Allternit supports API keys, service accounts, and external KMS keys. WIF for AWS, Azure, GCP, GitHub, Kubernetes, Okta, and SPIFFE is not yet implemented and is planned for the enterprise auth layer.

## App Attest

Apple App Attest verification is not implemented. It is planned for the mobile/API security layer.

## API and data retention

Automated retention policies and zero-data-residence (ZDR) arrangements are not yet implemented. Allternit's compliance API scaffold is in place; retention/deletion jobs are planned.
