# Swarm C — Tools / Search / MCP / ACI — Phase 1 Map

Master handoff: `/Users/joe/Desktop/allternit-parity-handoff.md`

## Scope

1. **Production web search adapters** — Extend `NativeWebTools.web_search` to support configurable provider backends:
   - `tavily` — use `TAVILY_API_KEY`.
   - `perplexity` — use `PERPLEXITY_API_KEY`.
   - `bing` — use `BING_SEARCH_API_KEY`.
   Keep the existing DuckDuckGo fallback when no provider key is configured. Add offline tests using injected fetch.

2. **Text editor tool** — Add an Anthropic-compatible `text_editor_20250124` tool to the Tool Belt with commands: `view`, `str_replace`, `create`, `insert`, `undo.`. Operate on paths within the active workspace.

3. **Computer-use schema alignment** — Align the existing Allternit computer-use tool input schema with Anthropic's `computer_20250124` spec (action types, coordinate format, screenshot result shape). If no computer-use file exists in the SDK, create it under `sdk/allternit-sdk/src/ai-runtime/tools/computer-use.ts`.

## Known starting files
- `sdk/allternit-sdk/src/ai-runtime/tools/web.ts`
- `sdk/allternit-sdk/src/ai-runtime/tools/registry.ts`
- `sdk/allternit-sdk/src/ai-runtime/__tests__/tool-belt.test.ts`
- `sdk/allternit-sdk/src/ai-runtime/tools/types.ts`

## Constraints
- Do NOT start Phase 2 work.
- Do NOT run builds, dev servers, or tests that require external services.
- Match existing repo idioms.
- Work only in `/Users/joe/Desktop/allternit-parity-p1-swarm-c`.
