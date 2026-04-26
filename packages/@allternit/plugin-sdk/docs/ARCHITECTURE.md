# Allternit Plugin SDK Architecture

## Overview

The Allternit Plugin SDK enables **universal plugin distribution** across any LLM platform.

```
┌─────────────────────────────────────────────────────────────────┐
│                        PLUGIN PACKAGE                           │
│  ┌──────────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐   │
│  │   Prompts    │  │  Tools   │  │ Handlers │  │  State   │   │
│  │   (76)       │  │          │  │          │  │          │   │
│  └──────────────┘  └──────────┘  └──────────┘  └──────────┘   │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                      UNIVERSAL RUNTIME                          │
│                                                                 │
│   ┌─────────────────────────────────────────────────────────┐   │
│   │                 PluginHost Interface                     │   │
│   │  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐   │   │
│   │  │    LLM   │ │  Tools   │ │    UI    │ │ Storage  │   │   │
│   │  └──────────┘ └──────────┘ └──────────┘ └──────────┘   │   │
│   └─────────────────────────────────────────────────────────┘   │
│                              │                                  │
└──────────────────────────────┼──────────────────────────────────┘
                               │
           ┌───────────────────┼───────────────────┐
           │                   │                   │
           ▼                   ▼                   ▼
┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐
│   MCP Adapter   │  │   HTTP Adapter  │  │  Native Adapter │
│   (Claude)      │  │   (Universal)   │  │   (Allternit)   │
└─────────────────┘  └─────────────────┘  └─────────────────┘
```

## Core Concepts

### 1. Plugin Manifest

The **contract** between plugin and host:

```json
{
  "id": "market-research",
  "requires": {
    "llm": { "capabilities": ["reasoning", "tool_use"] },
    "tools": ["web_search", "data_analysis"],
    "ui": { "renderers": ["markdown", "chart"] }
  },
  "provides": {
    "functions": [{ "name": "execute", "parameters": {...} }]
  }
}
```

### 2. PluginHost Interface

Platform-agnostic runtime capabilities:

```typescript
interface PluginHost {
  llm: LlmCapabilities;      // Complete prompts, stream responses
  tools: ToolRegistry;        // Execute external tools
  ui: UiCapabilities;         // Render output, collect input
  storage: StorageBackend;    // Persist state
}
```

### 3. Adapter Pattern

Each platform implements an **adapter** that maps PluginHost to native capabilities:

| Platform | Capabilities | Limitations |
|----------|--------------|-------------|
| **Allternit** | Full | None |
| **MCP** | LLM, basic tools | No panels, limited storage |
| **HTTP** | Configurable | Depends on implementation |

## Adapter Capabilities

### MCP Adapter

```typescript
// Maps to MCP tools/resources
McpHost {
  llm: { complete, stream }     // → Delegated to Claude
  tools: { execute }             // → MCP tool calls
  ui: { renderMarkdown }         // → Text responses only
  storage: { get, set }          // → In-memory only
}
```

**Best for**: Claude Desktop, any MCP client

### HTTP Adapter

```typescript
// Full REST API + WebSocket
HttpHost {
  llm: { complete, stream }     // → External API (OpenAI/Anthropic)
  tools: { execute }             // → Microservice calls
  ui: { render*, openPanel }     // → JSON responses, client renders
  storage: { get, set }          // → Redis/Database
}
```

**Best for**: Web apps, mobile, custom integrations

### Native Adapter

```typescript
// Full Allternit integration
NativeHost {
  llm: { complete, stream }     // → Allternit LLM
  tools: { execute }             // → Allternit tools
  ui: { render*, openPanel }     // → Allternit UI
  storage: { get, set }          // → Allternit storage
}
```

**Best for**: Allternit platform (full capabilities)

## Plugin Lifecycle

```
1. DISCOVERY
   Host scans for plugins or receives manifest

2. ACTIVATION
   Host selects adapter based on environment
   Adapter checks: canActivate() → true/false

3. INITIALIZATION
   Adapter creates PluginHost (mapped to platform)
   Plugin.initialize(host) → sets up state

4. EXECUTION
   Host calls plugin.execute(function, params, context)
   Plugin uses host.llm/tools/ui/storage
   Returns ExecutionResult

5. DESTRUCTION (optional)
   Plugin.destroy() → cleanup
   Adapter disconnects
```

## Universal Execution Flow

```typescript
// Same code runs everywhere
class MarketResearchPlugin extends BasePlugin {
  async execute(params, context) {
    // 1. Use LLM (any provider)
    const analysis = await this.host.llm.complete(
      `Research ${params.industry}...`
    );
    
    // 2. Use tools (if available)
    if (this.host.tools.has('web_search')) {
      const search = await this.host.tools.execute('web_search', {
        query: params.industry
      });
    }
    
    // 3. Render output (adapted to platform)
    this.host.ui.renderMarkdown(analysis);
    this.host.ui.renderChart(marketData);
    
    return { success: true, content: analysis };
  }
}
```

**On Allternit**: Full panels, interactive charts, persistent storage
**On MCP**: Markdown output, basic formatting, session-only storage
**On HTTP**: JSON response, client renders, configurable storage

## Graceful Degradation

When platform lacks capabilities:

```typescript
// Check before using
if (this.host.tools.has('web_search')) {
  // Use it
} else {
  // Fallback: ask LLM to simulate
  const result = await this.host.llm.complete(
    "Simulate web search results for..."
  );
}

// UI adapts
if (this.host.ui.panels) {
  this.host.ui.openPanel('Research', content);
} else {
  this.host.ui.renderMarkdown(content); // Inline
}
```

## Distribution Formats

### NPM Package
```bash
npm install @allternit/plugin-market-research
```

### MCP Config
```json
{
  "mcpServers": {
    "market-research": {
      "command": "npx",
      "args": ["@allternit/plugin-market-research"]
    }
  }
}
```

### HTTP Service
```bash
docker run -p 3000:3000 allternit/plugin-market-research
```

### Direct Import
```typescript
import plugin from './plugins/market-research';
const result = await plugin.execute('execute', { industry: 'AI' });
```

## Comparison Table

| Feature | Allternit | MCP (Claude) | HTTP | Self-Hosted |
|---------|-----------|--------------|------|-------------|
| Full LLM | ✅ | ✅ (host) | ✅ | ✅ |
| Web Search | ✅ | ⚠️ (if host has) | ✅ | ✅ |
| Code Execution | ✅ | ⚠️ | ✅ | ✅ |
| Browser Control | ✅ | ❌ | ✅ | ✅ |
| Image Generation | ✅ | ⚠️ | ✅ | ✅ |
| Side Panels | ✅ | ❌ | ⚠️ | ✅ |
| Persistent Storage | ✅ | ❌ | ✅ | ✅ |
| Streaming UI | ✅ | ❌ | ✅ | ✅ |
| Interactive Forms | ✅ | ❌ | ✅ | ✅ |

Legend: ✅ Full | ⚠️ Limited | ❌ None

## Migration Path

```
Template (76) → Plugin (76) → Multi-Platform

Step 1: Convert templates
  TemplatePreviewCards.tsx → 76 plugin packages

Step 2: Add adapters
  Each plugin gets: mcp/, http/, native/ adapters

Step 3: Publish
  npm, Docker, GitHub releases

Step 4: Use anywhere
  Claude Desktop, Cursor, Allternit, Custom apps
```
