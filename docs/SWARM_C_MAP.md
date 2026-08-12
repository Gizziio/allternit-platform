# Swarm C — Tools / Search / MCP — Map

This is the context map for Swarm C — Tools / Search / MCP. The master handoff checklist is at:
`/Users/joe/Desktop/allternit-parity-handoff.md`

## Scope for Phase 0
- Add native `web_search` tool (cached/indexed/live modes) to the Tool Belt.
- Add native `web_fetch` tool for URL content extraction.
- Add tool namespace support and strict-mode JSON Schema validation scaffolding.
- Wire MCP server attachment into the Tool Belt so model-facing tools can come from MCP.

## Known starting files
- `domains/kernel/drivers/allternit-providers/`
- `cmd/allternit-api/src/llm_gateway/`
- `mcp/`

## Constraints
- Do NOT start Phase 1 work yet.
- Do NOT run builds, dev servers, or tests that require external services.
- Match existing repo idioms (naming, module structure, error handling).
- Do NOT mutate the canonical repo; work only in `/Users/joe/Desktop/allternit-parity-swarm-c`.
