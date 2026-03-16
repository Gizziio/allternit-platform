# Connector Research: ChatGPT + Button & Claude MCP

## ChatGPT Approach: App Directory

### How It Works
1. **+ Button Menu**: Opens a dropdown with options including "More" for apps
2. **App Directory**: Browseable catalog of third-party integrations
3. **Connection Flow**:
   - User clicks "Connect" on an app
   - OAuth authorization flow
   - App appears as available tool
4. **Invocation**:
   - Type @AppName in prompt
   - Or click + → More → Select app

### Key Features
- **Pre-built connectors**: Gmail, Notion, Slack, GitHub, etc.
- **OAuth-based auth**: User grants permissions
- **Deep research**: Can search across multiple connected apps
- **Write actions**: Can create/update data with confirmation
- **Sync capability**: Index content for faster responses

### UI Pattern
```
[+] button click
    ├── Add files or photos
    ├── Web search
    ├── More (expands to show connected apps)
    │       ├── @Spotify
    │       ├── @Notion
    │       └── @GitHub
    └── Connect apps (opens App Directory)
```

## Claude Approach: MCP (Model Context Protocol)

### How It Works
1. **MCP Servers**: External processes that expose tools/resources
2. **Configuration**: JSON config file listing MCP servers
3. **Two types**:
   - **Local (stdio)**: Runs as subprocess (npx commands)
   - **Remote (HTTP)**: Connects to hosted MCP servers
4. **Discovery**: Claude auto-discovers tools from connected MCP servers

### Key Features
- **Open protocol**: Anyone can build MCP servers
- **Stdio transport**: Local CLI tools become AI-accessible
- **HTTP transport**: Connect to remote services
- **Tool permissions**: Per-conversation enable/disable
- **claude_desktop_config.json**:
```json
{
  "mcpServers": {
    "github": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-github"],
      "env": { "GITHUB_PERSONAL_ACCESS_TOKEN": "..." }
    },
    "slack": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-slack"],
      "env": { "SLACK_BOT_TOKEN": "..." }
    }
  }
}
```

### UI Pattern
```
[+] button or hammer icon
    ├── Tools/Connectors toggle
    ├── List of available MCP servers
    │       ├── github (12 tools)
    │       ├── slack (8 tools)
    │       └── notion (5 tools)
    └── Add custom connector (configures MCP server)
```

## Recommended Implementation for A2R

### Hybrid Approach
Combine ChatGPT's UX simplicity with Claude's MCP power:

1. **Surface Discovery**: Auto-discover running local apps (VS Code, Cursor, etc.)
2. **+ Button Menu**:
   - Standard options (files, web)
   - Connected surfaces (IDE, Browser, Terminal)
   - "Connect Surface" option
3. **Connection Methods**:
   - Native Messaging (Chrome extension)
   - Local WebSocket (VS Code extension)
   - MCP Protocol (universal)
4. **Configuration**: Similar to MCP but A2R-specific

### A2R Surface Config
```json
{
  "surfaces": {
    "vscode": {
      "type": "native_messaging",
      "extension_id": "a2r.vscode-extension",
      "capabilities": ["read_file", "write_file", "run_command"]
    },
    "chrome": {
      "type": "native_messaging",
      "extension_id": "a2r.chrome-extension",
      "capabilities": ["get_page", "click", "fill_form"]
    },
    "local_terminal": {
      "type": "mcp",
      "command": "npx",
      "args": ["@a2r/mcp-terminal"]
    }
  }
}
```

## Implementation Plan

### Phase 1: Basic + Menu
- Add "Connectors" option to + menu
- Show connected surfaces
- "Connect New Surface" opens discovery

### Phase 2: Surface Discovery
- Auto-scan for VS Code, Cursor, Chrome
- Native messaging handshake
- WebSocket connection setup

### Phase 3: MCP Support
- Add MCP client capability
- Load MCP servers from config
- Surface tools in UI

### Phase 4: Full Integration
- @ mentions to invoke surfaces
- Context from connected apps
- Two-way sync capability
