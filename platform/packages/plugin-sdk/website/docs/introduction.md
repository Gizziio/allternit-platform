# Introduction

## What is Allternit Plugin SDK?

The **Allternit Plugin SDK** is a universal runtime system that allows you to build plugins once and run them on any LLM platform.

### The Problem

You have 76 AI templates in Allternit. They work great in your platform. But:
- Claude Desktop users can't access them
- Cursor users can't use them
- Copilot users are left out
- Codex users have no access

**You have to rebuild for every platform.**

### The Solution

**One plugin package. Universal runtime. Any platform.**

```
Your 76 Templates → Plugin SDK → Claude, Cursor, Copilot, Codex, Any Tool
```

## Core Concepts

### 1. PluginHost Interface

Every platform implements the same interface:

```typescript
interface PluginHost {
  llm:     { complete(), stream() }      // AI model access
  tools:   { execute(), has() }          // External capabilities
  ui:      { renderMarkdown(), renderImage() }  // Output display
  storage: { get(), set() }              // State persistence
}
```

### 2. Universal Adapters

Adapters map platform capabilities to PluginHost:

| Platform | Adapter | Capabilities |
|----------|---------|--------------|
| Claude | MCP | LLM, limited tools |
| Cursor | MCP/HTTP | LLM, terminal, files |
| Copilot | VS Code | Full VS Code APIs |
| Codex | CLI | Shell, API calls |
| HTTP | REST | Configurable |

### 3. Graceful Degradation

When a platform lacks features, plugins adapt:

```typescript
if (this.host.tools.has('web_search')) {
  return await this.search(params);
} else {
  // Fallback to LLM simulation
  return await this.simulateSearch(params);
}
```

## Quick Example

### Before (Platform-Specific)

**Claude-only plugin:**
```python
# Only works in Claude
@claude.tool
def market_research(industry: str):
    # Claude-specific code
    pass
```

**Separate Cursor plugin:**
```typescript
// Only works in Cursor
export const cursorTool = {
  name: 'market-research',
  // Cursor-specific code
};
```

### After (Universal with SDK)

```typescript
// Works on Claude, Cursor, Copilot, Codex, and more
export default class MarketResearchPlugin extends BasePlugin {
  manifest = {
    id: 'market-research',
    provides: {
      functions: [{
        name: 'research',
        parameters: { industry: 'string' }
      }]
    }
  };

  async execute(name, params) {
    // Uses host.llm, host.tools, host.ui
    // Adapts to whatever platform is available
    const result = await this.host.llm.complete(
      `Research ${params.industry}`
    );
    this.host.ui.renderMarkdown(result);
    return { success: true, content: result };
  }
}
```

## Supported Platforms

### Fully Supported

- ✅ **Claude Desktop** (MCP)
- ✅ **Cursor** (MCP/HTTP)
- ✅ **GitHub Copilot** (VS Code extension)
- ✅ **OpenAI Codex** (CLI)
- ✅ **Sourcegraph Cody** (VS Code)
- ✅ **Continue.dev** (HTTP)
- ✅ **Aider** (CLI)
- ✅ **LangChain** (Python package)
- ✅ **Custom HTTP clients**

### Coming Soon

- 🚧 **ChatGPT** (Actions)
- 🚧 **Perplexity** (API pending)
- 🚧 **Gemini** (API pending)

## Architecture Overview

```
┌────────────────────────────────────────────────────────────┐
│                    76 ALLTERNIT PLUGINS                     │
└────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌────────────────────────────────────────────────────────────┐
│                   UNIVERSAL RUNTIME                        │
│  ┌──────────────────────────────────────────────────────┐  │
│  │              PluginHost Interface                     │  │
│  │  llm │ tools │ ui │ storage                          │  │
│  └──────────────────────────────────────────────────────┘  │
└────────────────────────────────────────────────────────────┘
                              │
           ┌──────────────────┼──────────────────┐
           │                  │                  │
           ▼                  ▼                  ▼
    ┌─────────────┐   ┌─────────────┐   ┌─────────────┐
    │ MCP Adapter │   │ HTTP Adapter│   │ CLI Adapter │
    │ (Claude)    │   │ (Universal) │   │ (Codex)     │
    └─────────────┘   └─────────────┘   └─────────────┘
```

## Next Steps

1. **[Quick Start](./quickstart.md)** - Get running in 5 minutes
2. **[Converting Templates](./converting-templates.md)** - Convert your 76 templates
3. **[Platform Guides](./platforms/)** - Setup for each platform
4. **[API Reference](./api-reference.md)** - Complete SDK reference
