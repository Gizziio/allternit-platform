# Introduction

The **Allternit Universal Plugin SDK** allows you to write plugins once and run them on any LLM platform.

## The Problem

Building plugins for AI platforms is fragmented:
- **Claude Desktop** uses MCP (Model Context Protocol)
- **VS Code** uses extension APIs
- **OpenAI Codex** uses CLI tools
- **Cursor** has its own format
- **LangChain** uses Python tools

Each platform requires a different implementation, leading to duplicated effort and platform lock-in.

## The Solution

Write once, run everywhere.

```typescript
import { PluginHost } from '@allternit/plugin-sdk';

export async function run(host: PluginHost, params: any) {
  // This code runs on Claude, VS Code, Codex, Cursor...
  const result = await host.llm.complete(`Analyze: ${params.topic}`);
  host.ui.renderMarkdown(result);
  return result;
}
```

## Supported Platforms

| Platform | Adapter | Status |
|----------|---------|--------|
| Claude Desktop | MCP | ✅ Ready |
| VS Code | Extension API | ✅ Ready |
| OpenAI Codex | CLI | ✅ Ready |
| Cursor | MCP | ✅ Ready |
| LangChain | Python Tools | ✅ Ready |
| HTTP/REST | Universal API | ✅ Ready |

## Key Features

### 🌐 Universal Format
One plugin works across all platforms. No rewrites needed.

### 🛡️ Graceful Degradation
Plugins adapt to available capabilities:
- Missing browser tool? LLM provides research via knowledge
- No file system? Use in-memory storage
- Limited UI? Fall back to text output

### ⚡ Quick Development
```bash
# Create plugin
allternit-plugin create my-plugin

# Build
npm run build

# Test
allternit-plugin run --input "test"
```

## Architecture

```
Your Plugin (single codebase)
    ↓
Universal Plugin SDK
    ↓
┌─────────┬──────────┬─────────┬─────────┐
│ MCP     │ HTTP     │ CLI     │ VS Code │
│ Adapter │ Adapter  │ Adapter │ Adapter │
└────┬────┴────┬─────┴────┬────┴────┬────┘
     ↓         ↓          ↓         ↓
  Claude    Browser   Terminal   VS Code
  Desktop   App       (Codex)    Extension
```

## Next Steps

- **[Quick Start](./quickstart)** - Get up and running in 5 minutes
- **[Architecture](./architecture)** - Understand the system design
- **[CLI Guide](../CLI_GUIDE.md)** - Complete command reference
- **[Template Workflows](../TEMPLATE_WORKFLOWS.md)** - Working with templates
