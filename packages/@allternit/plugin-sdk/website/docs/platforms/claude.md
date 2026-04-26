# Claude Desktop Setup

## Overview

Run your Allternit plugins in Claude Desktop using the Model Context Protocol (MCP).

## Quick Setup (2 minutes)

### 1. Install the SDK

```bash
npm install -g @allternit/plugin-sdk
```

### 2. Create Claude Config

Edit `claude_desktop_config.json`:

**macOS:**
```bash
# Find config
~/Library/Application\ Support/Claude/claude_desktop_config.json
```

**Windows:**
```bash
# Find config
%APPDATA%\Claude\claude_desktop_config.json
```

**Config:**
```json
{
  "mcpServers": {
    "allternit": {
      "command": "npx",
      "args": ["-y", "@allternit/plugin-sdk", "serve", "--adapter", "mcp"],
      "env": {
        "NODE_ENV": "production"
      }
    }
  }
}
```

### 3. Restart Claude Desktop

Quit and reopen Claude. You'll see the hammer icon 🔨 if plugins loaded successfully.

## Usage

### Basic

```
User: Research the AI code assistant market

Claude: I'll use the Allternit market-research plugin for this.

[Claude calls the plugin via MCP]

Here's what I found...
```

### With Parameters

```
User: Use the image-product plugin to generate a photo of wireless headphones

Claude: [Calls plugin with appropriate parameters]

Here's the generated image...
```

### Explicit Plugin Call

```
User: Run allternit plugin "code-react" with component "DataTable"

Claude: [Executes code-react plugin]

Here's your DataTable component...
```

## Capabilities

| Feature | Support | Notes |
|---------|---------|-------|
| LLM | ✅ Full | Uses Claude |
| Tools | ⚠️ Limited | What Claude exposes |
| UI | ⚠️ Text only | Markdown, no panels |
| Storage | ❌ None | Per-session only |
| Images | ⚠️ Via resources | Shows in chat |
| Streaming | ✅ Yes | Real-time output |

## Troubleshooting

### "MCP server not found"

```bash
# Test the server manually
npx @allternit/plugin-sdk serve --adapter mcp

# Should output: "MCP server running"
```

### "Tool not available"

Some plugins require tools Claude doesn't expose (browser, filesystem). Plugins will use LLM fallback automatically.

### Check server logs

```bash
# View Claude logs
# macOS:
tail -f ~/Library/Logs/Claude/mcp*.log

# Windows:
type %APPDATA%\Claude\logs\mcp*.log
```

### Restart server

```bash
# Kill any running MCP servers
pkill -f "allternit-plugin-sdk"

# Restart Claude
```

## Advanced: Custom Plugin Directory

To load your converted 76 plugins:

```json
{
  "mcpServers": {
    "allternit": {
      "command": "npx",
      "args": [
        "-y", "@allternit/plugin-sdk",
        "serve",
        "--adapter", "mcp",
        "--plugins-dir", "/path/to/your/76-plugins"
      ]
    }
  }
}
```

## Tips

1. **Be explicit**: Say "Use allternit plugin X" for best results
2. **Check the hammer**: If 🔨 is missing, MCP didn't load
3. **Start simple**: Test with basic plugins first
4. **Watch limits**: Complex plugins may hit context limits
