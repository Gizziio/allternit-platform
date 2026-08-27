# Swarm C — Phase 8 Task

**Worktree:** `/Users/joe/Desktop/allternit-parity-p2-swarm-c`  
**Branch:** `ao/p8-c`  
**Base:** `parity/swarm-sprint`

## Goal
Complete the MCP client/server connector for model-facing tool attachment.

## Deliverables

1. **MCP client attachment to Tool Belt**
   - Extend the existing MCP crates/client to expose an `attachMcpServer(config)` method in the SDK.
   - The method should connect via stdio or HTTP, list tools, and register them as Tool Belt tools with the same JSON schema.
   - Add a test that attaches a mock MCP server and invokes a tool.

2. **MCP server directory**
   - Add support for `~/.allternit/mcp-servers.json` to define remote/third-party MCP servers.
   - Load these at SDK init and attach them automatically if enabled.

3. **Server-side MCP dispatcher**
   - In `cmd/allternit-api`, complete the MCP server routes so tool calls can be dispatched to attached MCP servers with proper tunnel auth.

## Validation
- `cargo check -p allternit-api` — pass
- `cargo test -p allternit-api --lib` — pass
- `bun test sdk/allternit-sdk/src/ai-runtime/__tests__/tool-belt.test.ts` — pass

## Commit
Commit on `ao/p8-c` with message: `feat(p8): Swarm C MCP connector completion and server directory`.
