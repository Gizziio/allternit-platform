# Allternit Docs MCP Server

MCP server providing documentation lookup tools for the Allternit platform.

## Tools

- **search_docs** — Search documentation by keyword
- **read_doc** — Read full content of a specific doc page
- **list_docs** — List all available docs by category
- **get_api_reference** — Look up API endpoint documentation

## Configuration

Add to your MCP server directory or `.allternit/mcp-servers.json`:

```json
{
  "allternit-docs": {
    "command": "node",
    "args": ["tools/mcp-servers/docs-mcp-server/dist/index.js"],
    "env": {
      "ALLTERNIT_DOCS_ROOT": "docs/public"
    }
  }
}
```

## Environment Variables

- `ALLTERNIT_DOCS_ROOT` — Path to the documentation directory (defaults to `docs/public` relative to repo root)
