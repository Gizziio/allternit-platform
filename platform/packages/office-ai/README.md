# @allternit/office-ai

Shared AI layer for the four vendored office editors (docs / sheets / slides /
pdf). Streams the Allternit platform's agent-chat endpoint and drives a real
multi-turn agent loop that executes the vendored skills' document tools.

## Pieces

- `src/stream.ts` — `streamOfficeAi`: `POST /api/agent-chat`, normalizes the
  SSE stream into `delta / tool-call / tool-result / done / error` chunks.
  Two wire dialects are accepted: the legacy `{chunk_type, chunk}` lines and
  the gateway's `{type: content_block_delta | content_block_start |
  tool_result | tool_error | error | finish, ...}` events emitted by
  `cmd/allternit-api/src/gizzi_chat_stream.rs`. System messages are sent as
  the request's top-level `systemPrompt` field (the gateway appends it to the
  runtime's system prompt); user/assistant turns are folded into the single
  `message` string the endpoint accepts.
- `src/loop.ts` — `OfficeAgentLoop`: interface-compatible with upstream
  GenOffice's `@genoffice/agent-core` `AgentLoop` (`run/cancel/reset/restore`,
  `busy`, `maxTurns`, `onText/onToolStart/onToolExecuted/onTurnEnd/onDone/
  onError`), which is what the vendored apps construct.

## Tool calling: why it is prompt-driven (finding + decision)

**Finding.** The `/api/agent-chat` bridge cannot carry tool definitions.
`chat_routes.rs` deserializes `{chatId, message, ...context}` and only
extracts `context.systemPrompt`; `gizzi_chat_stream.rs` then posts
`{parts: [{type: "text", text}], model, system?}` to the Gizzi runtime —
there is no `tools` field on the request and no native `tool_use` channel
back for client-side tools. (Gateway `content_block_start`/`tool_use` events
would describe Gizzi-side tools, not the office document tools.)

**Decision.** Mirror upstream GenOffice's `AgentLoop` (see
`genoffice-upstream/packages/agent-core/src/loop.ts`) but replace the native
tool channel with a text wire protocol:

1. When the skill ships `tools`, the loop appends a `# Tool calling protocol`
   section plus a tool catalog (name + description + JSON input schema) to
   the system prompt.
2. The model emits tool calls as fenced ```` ```tool_call ```` blocks containing
   `{"name": ..., "input": {...}}` inside its text reply (a ```` ```json ````
   block naming a known tool is accepted as a fallback).
3. The loop parses the blocks, hides them from the streamed text shown in the
   panel, executes each call through the vendored skill's `executeTool`,
   fires `onToolStart`/`onToolExecuted` with the real execution result
   (`{output, isError, summary, mutated, display}`), and appends the results
   to the conversation as a `[Tool results]` user message.
4. Repeat until the model answers in plain text or `maxTurns` (default 8;
   sheets passes 24) is hit — then one no-tools finalizing turn produces a
   partial answer and `onDone` reports `turnLimit: true`.

Unparseable tool blocks are fed back as error results; three in a row aborts
the run with `onError`. `cancel()` aborts the in-flight request and finishes
with `cancelled: true`; `reset()` drops history and invalidates stale async
continuations; `restore()` re-seeds history for reopened documents.

Native `tool-call` SSE chunks are also honored if a future gateway emits
them — the prompt protocol is the fallback, not a hard requirement.
