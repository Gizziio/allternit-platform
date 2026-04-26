# Allternit Universal Plugin SDK

**Write once. Run on any LLM platform.**

The Universal Plugin SDK lets you build plugins that work on Claude Desktop, VS Code, OpenAI Codex, Cursor, LangChain, and more—all from a single codebase.

---

## 🚀 Quick Start

```bash
# Install the SDK
npm install -g @allternit/plugin-sdk

# Create a plugin
allternit-plugin create my-plugin
cd my-plugin
npm install
npm run build

# Run it
allternit-plugin run --input "Hello world"
```

---

## 🌍 Three Ways to Work with Templates

### 1. **Template → Plugin** (Instant Use)
Your 76 templates become ready-to-use plugins. Users install and run immediately.

```bash
# Convert all templates
./scripts/convert-all.sh

# Publish to NPM
npm publish --access public

# Users install
npm install -g @allternit/market-research-plugin

# And use
allternit-plugin run market-research --topic "AI"
```

### 2. **Template → Scaffold** (Customize)
Use templates as starting points for custom plugins.

```bash
# Create from template
allternit-plugin create my-research --template market-research

# Customize the generated code
cd my-research
vim src/index.ts  # Adapt template logic

# Publish your version
npm publish
```

### 3. **From Scratch** (Build New)
Create completely custom plugins.

```bash
# Blank plugin with TODOs
allternit-plugin create my-tool

# Edit and implement
cd my-tool
vim src/index.ts  # Fill in your logic
```

---

## 📦 Platform Support

| Platform | Adapter | Status |
|----------|---------|--------|
| Claude Desktop | MCP | ✅ Ready |
| VS Code | Extension | ✅ Ready |
| OpenAI Codex | CLI | ✅ Ready |
| Cursor | MCP | ✅ Ready |
| LangChain | Python | ✅ Ready |
| HTTP API | REST | ✅ Ready |

---

## 🏗️ Architecture

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

**Key concept:** Write your plugin once using the `PluginHost` interface. The SDK adapts it to each platform automatically.

---

## 📝 Example Plugin

```typescript
import { PluginHost } from '@allternit/plugin-sdk';

export async function run(host: PluginHost, params: any) {
  // Works everywhere: Claude, VS Code, Codex...
  
  // 1. Use LLM
  const result = await host.llm.complete(
    `Analyze: ${params.topic}`
  );
  
  // 2. Render UI (adapts to platform)
  host.ui.renderMarkdown(result);
  
  // 3. Graceful degradation
  if (host.tools.has('browser')) {
    // Use browser if available
    return host.tools.execute('browser', { url: params.url });
  }
  
  // Fallback to LLM knowledge
  return host.llm.complete(`Research: ${params.url}`);
}
```

---

## 📚 Documentation

| Document | Description |
|----------|-------------|
| [`QUICKSTART.md`](docs/QUICKSTART.md) | 5-minute setup guide |
| [`CLI_GUIDE.md`](CLI_GUIDE.md) | Complete CLI reference |
| [`TEMPLATE_WORKFLOWS.md`](TEMPLATE_WORKFLOWS.md) | Template usage patterns |
| [`PROJECT_STATUS.md`](PROJECT_STATUS.md) | Current status & checklist |
| [`NEXT_STEPS.md`](NEXT_STEPS.md) | Publishing guide |
| [`website/`](website/) | Full documentation site |

---

## 🛠️ CLI Commands

```bash
# Create plugins
allternit-plugin create my-plugin                    # From scratch
allternit-plugin create my-plugin -t market-research # From template

# Convert templates
allternit-plugin convert -i template.tsx -o ./plugin    # Single
allternit-plugin convert-all -i ./templates -o ./out    # Batch

# Run plugins
allternit-plugin run my-plugin --input "test"
allternit-plugin serve --port 3000

# Validate & package
allternit-plugin validate ./my-plugin
allternit-plugin package ./my-plugin
```

---

## 📂 Project Structure

```
allternit-plugin-sdk/
├── src/                    # SDK source
│   ├── adapters/           # 6 platform adapters
│   │   ├── mcp/            # Claude/Cursor
│   │   ├── http/           # REST API
│   │   ├── cli/            # Terminal/Codex
│   │   ├── vscode/         # VS Code extension
│   │   ├── langchain/      # Python/LangChain
│   │   └── native/         # Allternit native
│   └── types.ts            # Core interfaces
├── bin/                    # CLI entry point
├── docs/                   # Markdown documentation
├── website/                # Docusaurus site
├── scripts/                # Conversion scripts
└── dist/                   # Compiled output
```

---

## 🎯 Use Cases

### For Template Library Owners
```bash
# Convert 76 templates → 76 plugins
./scripts/convert-all.sh

# Publish to NPM
for d in allternit-plugins/*/; do
  (cd "$d" && npm publish --access public)
done
```

### For Plugin Developers
```bash
# Scaffold from template
allternit-plugin create my-tool --template code-review

# Customize
vim src/index.ts

# Test
allternit-plugin run --input "test"

# Publish
npm publish
```

### For End Users
```bash
# Install and use
npm install -g @allternit/market-research-plugin
allternit-plugin run market-research --topic "EVs"
```

---

## 🔧 Platform-Specific Setup

### Claude Desktop
```json
{
  "mcpServers": {
    "allternit": {
      "command": "npx",
      "args": ["-y", "@allternit/plugin-sdk", "serve", "--adapter", "mcp"]
    }
  }
}
```

### VS Code
```typescript
import { loadPlugin } from '@allternit/plugin-sdk/adapters/vscode';
const plugin = await loadPlugin('@allternit/market-research-plugin');
```

### HTTP API
```bash
curl http://localhost:3000/v1/execute/market-research \
  -d '{"topic": "AI"}'
```

---

## 📦 Publishing

1. **Create NPM Organization**
   ```bash
   # Go to https://www.npmjs.com/org/create
   # Name: allternit
   ```

2. **Add GitHub Secret**
   ```bash
   npm token create
   # Add to: https://github.com/allternit/plugin-sdk/settings/secrets
   # Name: NPM_TOKEN
   ```

3. **Publish**
   ```bash
   git tag v1.0.0
   git push origin v1.0.0
   # GitHub Actions auto-publishes
   ```

See [`NEXT_STEPS.md`](NEXT_STEPS.md) for detailed instructions.

---

## 🤝 Contributing

```bash
# Clone
git clone https://github.com/allternit/plugin-sdk.git
cd plugin-sdk

# Install
npm install

# Build
npm run build

# Test
npm test
```

---

## 📄 License

MIT © Allternit

---

## 🔗 Links

- [Documentation](https://plugins.allternit.com) (deploy after setup)
- [NPM Package](https://www.npmjs.com/package/@allternit/plugin-sdk)
- [GitHub](https://github.com/allternit/plugin-sdk)
- [Issues](https://github.com/allternit/plugin-sdk/issues)
