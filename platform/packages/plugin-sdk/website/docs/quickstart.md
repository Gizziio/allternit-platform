# Quick Start

Get your first plugin running in 5 minutes.

## Installation

```bash
npm install -g @allternit/plugin-sdk
```

Verify installation:
```bash
allternit-plugin --version
# 1.0.0
```

## Create Your First Plugin

### Option 1: From Scratch

```bash
allternit-plugin create hello-world
cd hello-world
npm install
npm run build
```

### Option 2: From Template

```bash
allternit-plugin create my-analyzer --template market-research
cd my-analyzer
npm install
npm run build
```

## Run Your Plugin

```bash
# CLI mode
allternit-plugin run hello-world --input "Hello"

# Or with JSON input
allternit-plugin run hello-world --input '{"message":"Hello"}'
```

## Test in Claude Desktop

1. **Configure Claude Desktop** (`~/Library/Application Support/Claude/claude_desktop_config.json`):

```json
{
  "mcpServers": {
    "allternit": {
      "command": "npx",
      "args": ["-y", "@allternit/plugin-sdk", "serve", "--adapter", "mcp"],
      "env": {
        "PLUGINS_DIR": "/path/to/hello-world"
      }
    }
  }
}
```

2. **Restart Claude Desktop**

3. **Use your plugin**:
```
User: Run hello-world with message "Hello from Claude"
Claude: [Executes plugin] Hello from Claude
```

## Development Workflow

```bash
# 1. Create plugin
allternit-plugin create my-plugin

# 2. Edit code
vim src/index.ts

# 3. Build
npm run build

# 4. Test locally
allternit-plugin run --input "test"

# 5. Validate
allternit-plugin validate

# 6. Publish
npm publish --access public
```

## Example Plugin Code

```typescript
import { PluginHost, ExecutionResult } from '@allternit/plugin-sdk';
import manifest from '../manifest.json';

export { manifest };

export async function execute(
  host: PluginHost, 
  params: any
): Promise<ExecutionResult> {
  
  // Use LLM
  const analysis = await host.llm.complete(`
    Analyze this topic: ${params.topic}
    Provide key insights in markdown format.
  `);
  
  // Render UI
  host.ui.renderMarkdown(analysis);
  
  // Use tools if available
  if (host.tools.has('browser')) {
    const page = await host.tools.execute('browser', {
      url: `https://example.com/${params.topic}`
    });
    return { success: true, result: page };
  }
  
  // Fallback to LLM knowledge
  return { success: true, result: analysis };
}
```

## Platform-Specific Setup

### VS Code
```typescript
// In your VS Code extension
import { loadPlugin } from '@allternit/plugin-sdk/adapters/vscode';

const plugin = await loadPlugin('./hello-world');
const result = await plugin.run({ message: 'Hello' });
```

### HTTP API
```bash
# Start server
allternit-plugin serve --port 3000

# Call via HTTP
curl http://localhost:3000/v1/execute/hello-world \
  -X POST \
  -H 'Content-Type: application/json' \
  -d '{"message":"Hello"}'
```

### LangChain
```python
from allternit_plugin_sdk import load_plugin

tool = load_plugin('hello-world')
result = tool.run({"message": "Hello"})
```

## Next Steps

- **[Architecture](./architecture)** - Understand the design
- **[Platform Guides](./platforms/claude)** - Platform-specific setup
- **[CLI Reference](../CLI_GUIDE.md)** - All CLI commands
- **[Template Workflows](../TEMPLATE_WORKFLOWS.md)** - Working with templates
