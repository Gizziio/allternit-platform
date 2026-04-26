# Allternit Universal Plugin Architecture

## The Problem

You have **76 templates** in Allternit. Other LLM tools (Claude, Cursor, Codex, Copilot) **can't use them**.

## The Solution

**Universal Plugin SDK** - Package once, run anywhere.

```
┌─────────────────────────────────────────────────────────────────┐
│                    76 ALLTERNIT TEMPLATES                       │
│  ┌──────────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐   │
│  │ Market       │  │ Code     │  │ Image    │  │ Research │   │
│  │ Research     │  │ React    │  │ Product  │  │ Trends   │   │
│  └──────────────┘  └──────────┘  └──────────┘  └──────────┘   │
│                      ... 76 total ...                           │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼ Convert
┌─────────────────────────────────────────────────────────────────┐
│                    76 PLUGIN PACKAGES                           │
│  Each with: manifest.json + code + adapters                     │
└─────────────────────────────────────────────────────────────────┘
                              │
           ┌──────────────────┼──────────────────┐
           │                  │                  │
           ▼                  ▼                  ▼
┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐
│  MCP Adapter    │  │  HTTP Adapter   │  │  CLI Adapter    │
│  (Claude)       │  │  (Web/Universal)│  │  (Codex/Aider)  │
└─────────────────┘  └─────────────────┘  └─────────────────┘
           │                  │                  │
           ▼                  ▼                  ▼
┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐
│  VS Code        │  │  LangChain      │  │  Native         │
│  (Copilot)      │  │  (Python)       │  │  (Allternit)    │
└─────────────────┘  └─────────────────┘  └─────────────────┘
```

## Core Innovation: PluginHost Interface

Any platform implements this interface:

```typescript
interface PluginHost {
  llm:     { complete(), stream() }     // LLM access
  tools:   { execute(), has() }          // External tools
  ui:      { renderMarkdown(), renderCode(), renderImage() }  // Output
  storage: { get(), set() }              // State persistence
}
```

**Adapters map platform capabilities to PluginHost:**

| Platform | llm.complete() | tools.execute() | ui.renderMarkdown() |
|----------|---------------|-----------------|---------------------|
| Claude | Via MCP | Limited | Text only |
| Cursor | Local | Terminal | Text + basic |
| Copilot | Copilot API | VS Code APIs | Webview panels |
| Codex | OpenAI API | Shell exec | Terminal output |
| HTTP | Configurable | Microservices | JSON responses |

## Adapter Types

### 1. MCP Adapter (Claude, Cursor)
```typescript
// Single MCP tool handles ALL 76 plugins
{
  name: "allternit_plugin",
  inputSchema: {
    plugin: "market-research",  // Any of 76
    inputs: { ... }
  }
}
```

**Setup:** Add to `claude_desktop_config.json`

### 2. HTTP Adapter (Universal)
```bash
GET  /v1/plugins              # List 76 plugins
POST /v1/execute/:plugin      # Execute with streaming
WS   /v1/stream               # Real-time updates
```

**Setup:** `npx @allternit/plugin-sdk serve --port 3000`

### 3. CLI Adapter (Codex, Aider)
```bash
allternit-plugin run market-research --industry "AI"
allternit-plugin run code-react --component "Button"
```

**Setup:** `npm install -g @allternit/plugin-sdk`

### 4. VS Code Adapter (Copilot, Cody)
```typescript
// Registers as VS Code command
// Shows results in webview panel
// Integrates with Copilot chat
```

**Setup:** Install VS Code extension

### 5. LangChain Adapter (Python)
```python
from allternit_plugin_sdk import AllternitTool

tool = AllternitTool.from_id("market-research")
agent = initialize_agent([tool], llm)
```

**Setup:** `pip install allternit-plugin-sdk`

### 6. Native Adapter (Allternit)
```typescript
// Full access to Allternit platform
// All tools, panels, storage
```

## Graceful Degradation

When a platform lacks capabilities, plugins adapt:

```typescript
// Plugin code
async execute(params) {
  // Try primary approach
  if (this.host.tools.has('web_search')) {
    return await this.researchWithSearch(params);
  }
  
  // Fallback to LLM simulation
  this.host.logger.warn('Search not available, using LLM');
  return await this.simulateResearch(params);
}
```

| Capability | Claude | Cursor | Copilot | Codex |
|------------|--------|--------|---------|-------|
| web_search | ❌ | ✅ | ✅ | ⚠️ |
| browser_nav | ❌ | ❌ | ❌ | ❌ |
| file_system | ❌ | ✅ | ✅ | ⚠️ |
| panels | ❌ | ❌ | ✅ | ❌ |

**All plugins work on all platforms**, just with different capabilities.

## Distribution

### NPM Registry
```bash
npm install @allternit/plugin-market-research
```

### MCP Registry
```json
{
  "mcpServers": {
    "allternit": {
      "command": "npx",
      "args": ["@allternit/plugin-runtime"]
    }
  }
}
```

### Docker Hub
```bash
docker run -p 3000:3000 allternit/plugin-runtime
```

### GitHub Releases
```bash
# Download .allp package
allternit-plugin install ./market-research-v1.0.0.allp
```

## Conversion: Templates → Plugins

```bash
# One command converts all 76 templates
npx @allternit/convert-templates \
  --input TemplatePreviewCards.tsx \
  --output ./plugins

# Creates:
plugins/
├── market-research/
│   ├── manifest.json
│   ├── src/
│   │   └── index.ts
│   └── adapters/
│       ├── mcp.js
│       ├── http.js
│       └── cli.js
├── code-react/
├── image-product/
└── ... (76 total)
```

## Usage Examples

### Claude Desktop
```
User: Research the AI assistant market
Claude: I'll use the Allternit market-research plugin...
[Uses MCP to call plugin]
[Returns formatted report]
```

### Cursor
```javascript
// .cursorrules
When user asks for research, call http://localhost:3000/v1/execute/market-research
```

### Codex
```bash
codex> /run allternit-plugin run code-react --component "Button"
[Generates React Button component]
```

### Copilot
```
User: /allternit market-research industry="electric vehicles"
Copilot: [Opens webview panel with full report]
```

### Python/LangChain
```python
tool = AllternitTool.from_id("market-research")
result = await tool.call({"industry": "AI"})
```

### HTTP API
```bash
curl -X POST http://localhost:3000/v1/execute/market-research \
  -d '{"inputs": {"industry": "AI"}}'
```

## Key Files

```
allternit-plugin-sdk/
├── src/
│   ├── types.ts              # PluginHost interface
│   ├── index.ts              # SDK exports
│   └── adapters/
│       ├── mcp/              # Claude/Cursor
│       ├── http/             # Universal REST
│       ├── cli/              # Codex/Aider
│       ├── vscode/           # Copilot/Cody
│       └── langchain/        # Python
├── scripts/
│   └── convert-templates.ts  # 76 → plugins
├── docs/
│   ├── PLATFORMS.md          # Full compatibility matrix
│   ├── ARCHITECTURE.md       # Design details
│   └── USAGE.md              # Code examples
└── QUICKSTART.md
```

## Summary

| Question | Answer |
|----------|--------|
| **76 templates become...** | 76 plugin packages |
| **Work on Claude?** | ✅ Yes (MCP) |
| **Work on Cursor?** | ✅ Yes (MCP/HTTP) |
| **Work on Codex?** | ✅ Yes (CLI) |
| **Work on Copilot?** | ✅ Yes (VS Code extension) |
| **Work on LangChain?** | ✅ Yes (Tool class) |
| **Work on custom apps?** | ✅ Yes (HTTP/NPM) |
| **Same code everywhere?** | ✅ Yes (PluginHost interface) |
| **Fallback when limited?** | ✅ Yes (graceful degradation) |

**Result:** One plugin package runs on any LLM platform.
