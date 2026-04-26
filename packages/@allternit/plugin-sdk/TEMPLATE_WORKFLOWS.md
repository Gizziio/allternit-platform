# Template Workflows Guide

## Two Ways to Use Templates

### Workflow A: Template → Plugin (Ready-to-Use)
**Your existing 76 templates become installable plugins instantly.**

```bash
# Install a template as a plugin
npm install -g @allternit/market-research-plugin

# Use it immediately
allternit-plugin run market-research --topic "AI assistants"

# Or in Claude Desktop
# "Run the market-research plugin on AI assistants"
```

**Use case:** Users who want ready-made tools without coding.

---

### Workflow B: Template → Scaffold New Plugin
**Use templates as starting points for custom plugins.**

```bash
# Create new plugin from template
allternit-plugin create my-analyzer --template market-research

# This scaffolds:
# my-analyzer/
#   src/
#     index.ts          # Plugin logic (from template)
#     manifest.ts       # Based on template structure
#   package.json
#   tsconfig.json
#   README.md

# Customize it
cd my-analyzer
# Edit src/index.ts to add your logic
npm run build
npm publish
```

**Use case:** Developers who want to build on existing patterns.

---

### Workflow C: Create From Scratch
**Start completely fresh.**

```bash
# Create blank plugin
allternit-plugin create my-plugin

# Interactive prompts:
# ? Plugin name: my-plugin
# ? Description: Does cool things
# ? Category: analyze
# ? Adapters: mcp, http, cli

# Edit the generated files
# src/index.ts has TODOs for you to fill in
```

**Use case:** Building something completely custom.

---

## Command Reference

### `allternit-plugin create`

```bash
# From scratch (interactive)
allternit-plugin create my-plugin

# From template
allternit-plugin create my-plugin --template market-research

# Specific options
allternit-plugin create my-plugin \
  --template market-research \
  --adapters mcp,cli \
  --category analyze
```

### `allternit-plugin convert`

```bash
# Convert template files to plugin
allternit-plugin convert \
  --input ./templates/MarketResearchCard.tsx \
  --output ./plugins/market-research-plugin

# Batch convert (your 76 templates)
allternit-plugin convert-all \
  --input ./templates \
  --output ./plugins
```

### `allternit-plugin run`

```bash
# Run a converted template plugin
allternit-plugin run market-research --topic "AI"

# Run from local path
allternit-plugin run ./plugins/market-research --topic "AI"

# With stdin
allternit-plugin run market-research < input.json
```

---

## Template → Plugin Mapping

| Template Type | Becomes Plugin | Use Case |
|--------------|----------------|----------|
| `MarketResearchCard.tsx` | `@allternit/market-research-plugin` | Market analysis |
| `CodeReviewCard.tsx` | `@allternit/code-review-plugin` | PR reviews |
| `ImageGenCard.tsx` | `@allternit/image-gen-plugin` | Generate images |
| `DataTableCard.tsx` | `@allternit/data-table-plugin` | Data visualization |

---

## File Structure

### After Convert (Workflow A)
```
market-research-plugin/
├── src/
│   ├── index.ts          # Template logic wrapped as plugin
│   └── manifest.ts       # Auto-generated from template
├── package.json          # Published as @allternit/market-research-plugin
└── README.md
```

### After Create --template (Workflow B)
```
my-analyzer/
├── src/
│   ├── index.ts          # Template as starting point
│   └── manifest.ts       # Template + your customizations
├── package.json          # Your private or public package
└── README.md
```

### After Create (Workflow C)
```
my-plugin/
├── src/
│   ├── index.ts          # Skeleton with TODOs
│   └── manifest.ts       # Basic structure
├── package.json
└── README.md
```

---

## Publishing Strategy

### Official Templates (Workflow A)
```bash
# Published by Allternit
npm publish --access public
# → @allternit/market-research-plugin
# → @allternit/code-review-plugin
# etc.
```

### Community/User Plugins (Workflow B)
```bash
# Published by users
npm publish --access public
# → @mycompany/custom-research-plugin
# → @user/specialized-analyzer
```

### Private Plugins (Workflow C)
```bash
# Internal use
npm publish --access restricted
# → @myorg/internal-tools
```

---

## Usage in Different Platforms

### Claude Desktop (MCP)
```json
{
  "mcpServers": {
    "allternit": {
      "command": "npx",
      "args": ["-y", "@allternit/plugin-sdk", "serve", "--adapter", "mcp"],
      "env": {
        "PLUGINS": "market-research,code-review,image-gen"
      }
    }
  }
}
```

Then:
```
User: Run market-research on electric vehicles
Claude: [Executes plugin] Here are the findings...
```

### VS Code Extension
```typescript
// In extension.ts
import { loadPlugin } from '@allternit/plugin-sdk/adapters/vscode';

const plugin = await loadPlugin('@allternit/market-research-plugin');
const result = await plugin.run({ topic: "AI" });
```

### CLI/Codex
```bash
allternit-plugin run market-research --topic "electric vehicles"
```

### HTTP API
```bash
curl http://localhost:3000/plugins/market-research/run \
  -X POST \
  -d '{"topic": "electric vehicles"}'
```

---

## Migration Path

### For Existing Template Users

1. **Immediate** (no change needed):
   ```bash
   # Templates work as-is via plugin wrapper
   npm install -g @allternit/plugin-sdk
   allternit-plugin serve --adapter mcp
   ```

2. **Better** (converted plugins):
   ```bash
   # Install converted templates as plugins
   npm install -g @allternit/market-research-plugin
   ```

3. **Best** (customize templates):
   ```bash
   # Create your own based on template
   allternit-plugin create my-research --template market-research
   # Customize and publish
   ```

---

## Summary

| Workflow | Command | Output | Audience |
|----------|---------|--------|----------|
| **A: Convert** | `convert-all.sh` | 76 ready-to-use plugins | End users |
| **B: Scaffold** | `create --template X` | Custom plugin from template | Developers |
| **C: Fresh** | `create` | Blank plugin | Advanced developers |

All three work together:
- **You** convert 76 templates → publish to NPM
- **Users** install and run them directly
- **Developers** scaffold from templates to customize
- **Power users** create from scratch
