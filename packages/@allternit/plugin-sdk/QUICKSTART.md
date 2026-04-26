# Quick Start

## 1. Convert Your 76 Templates

```bash
cd /Users/macbook/Desktop/allternit-workspace/allternit/surfaces/allternit-platform

npx @allternit/convert-templates \
  --input src/components/chat/TemplatePreviewCards.tsx \
  --output ../../allternit-plugin-sdk/plugins
```

This creates 76 plugin packages in `plugins/` directory.

## 2. Run with MCP (Claude Desktop)

```bash
cd plugins/market-research
npx @allternit/plugin-sdk run --adapter mcp
```

Add to Claude Desktop config:
```json
{
  "mcpServers": {
    "allternit": {
      "command": "npx",
      "args": ["-y", "@allternit/plugin-sdk", "run", "--all", "--adapter", "mcp"]
    }
  }
}
```

## 3. Run as HTTP API

```bash
npx @allternit/plugin-sdk serve --port 3000

# Test
curl http://localhost:3000/v1/plugins/market-research/execute \
  -d '{"inputs": {"industry": "AI"}}'
```

## 4. Use in Allternit

```typescript
import { NativeAdapter } from '@allternit/plugin-sdk';
import plugin from './plugins/market-research';

const adapter = new NativeAdapter();
const instance = await adapter.initialize(plugin, { runtime });
await instance.start();
```

## Directory Structure

```
allternit-plugin-sdk/
├── src/
│   ├── types.ts              # Universal interfaces
│   ├── index.ts              # SDK exports
│   └── adapters/
│       ├── mcp/              # Claude/Cursor MCP
│       ├── http/             # REST API
│       └── native/           # Allternit native
├── scripts/
│   └── convert-templates.ts  # 76 templates → plugins
├── docs/
│   ├── ARCHITECTURE.md       # How it works
│   └── USAGE.md              # Detailed guide
└── plugins/                  # Generated plugins (76)
    ├── market-research/
    ├── code-react/
    └── ...
```

## Key Concepts

1. **Plugin Manifest** - Declares requirements & capabilities
2. **PluginHost Interface** - Universal runtime (LLM, Tools, UI, Storage)
3. **Adapters** - Maps PluginHost to each platform
4. **76 Templates** → **76 Plugins** → **Any Platform**

## Universal Usage

| Platform | How to Use |
|----------|-----------|
| Claude Desktop | MCP config |
| Cursor | HTTP API + `.cursorrules` |
| Kimi | HTTP API |
| Custom App | NPM package |
| Allternit | Native adapter |

## Next Steps

1. Read [ARCHITECTURE.md](./docs/ARCHITECTURE.md) for deep dive
2. Read [USAGE.md](./docs/USAGE.md) for detailed examples
3. Convert your templates: `npx @allternit/convert-templates`
4. Test with MCP: `npx @allternit/plugin-sdk run --adapter mcp`
