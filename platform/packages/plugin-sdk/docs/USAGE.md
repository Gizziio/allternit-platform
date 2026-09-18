# Allternit Plugin SDK - Usage Guide

## Quick Start

### 1. Install SDK

```bash
npm install @allternit/plugin-sdk
```

### 2. Create a Plugin

```typescript
// plugins/market-research/index.ts
import { BasePlugin, ExecutionResult } from '@allternit/plugin-sdk';

export default class MarketResearchPlugin extends BasePlugin {
  manifest = {
    id: 'market-research',
    name: 'Market Research',
    version: '1.0.0',
    runtime: 'allternit-plugin-v1',
    description: 'Deep industry analysis with competitive intelligence',
    category: 'analyze',
    requires: {
      llm: { capabilities: ['reasoning', 'tool_use'] },
      tools: ['web_search'],
      ui: { renderers: ['markdown', 'chart'] },
    },
    provides: {
      functions: [{
        name: 'research',
        description: 'Research any market',
        parameters: {
          type: 'object',
          properties: {
            industry: { type: 'string', description: 'Industry to research' },
            depth: { type: 'string', enum: ['summary', 'detailed'], default: 'detailed' },
          },
          required: ['industry'],
        },
        returns: {
          type: 'object',
          properties: {
            content: { type: 'string', format: 'markdown' },
            marketSize: { type: 'number' },
          },
        },
      }],
    },
    adapters: {
      mcp: './adapters/mcp.js',
      http: './adapters/http.js',
      allternit: './adapters/native.js',
    },
  };

  async execute(functionName: string, params: any): Promise<ExecutionResult> {
    if (functionName !== 'research') {
      return { success: false, error: { code: 'UNKNOWN', message: 'Unknown function', retryable: false } };
    }

    // 1. Use LLM
    const prompt = `Research the ${params.industry} market. Depth: ${params.depth}.`;
    const analysis = await this.host.llm.complete(prompt);

    // 2. Use tools (if available)
    let searchResults;
    if (this.host.tools.has('web_search')) {
      const result = await this.host.tools.execute('web_search', {
        query: `${params.industry} market size 2024`,
      });
      searchResults = result.data;
    }

    // 3. Render output
    this.host.ui.renderMarkdown(analysis);
    
    if (searchResults) {
      this.host.ui.renderChart('bar', {
        labels: ['2022', '2023', '2024'],
        datasets: [{ label: 'Market Size ($B)', data: [10, 15, 25] }],
      });
    }

    return {
      success: true,
      content: analysis,
      data: { marketSize: 25 },
    };
  }
}
```

### 3. Run with MCP (Claude Desktop)

```json
// claude_desktop_config.json
{
  "mcpServers": {
    "market-research": {
      "command": "npx",
      "args": ["tsx", "/path/to/plugins/market-research/index.ts"],
      "env": {
        "ADAPTER": "mcp"
      }
    }
  }
}
```

**Usage in Claude:**
```
Use market-research to analyze the electric vehicle industry
```

### 4. Run as HTTP Service

```typescript
// server.ts
import { HttpAdapter } from '@allternit/plugin-sdk';
import MarketResearchPlugin from './plugins/market-research';

const plugin = new MarketResearchPlugin();
const adapter = new HttpAdapter();

const instance = await adapter.initialize(plugin, {
  port: 3000,
  enableWebSocket: true,
});

await instance.start();
console.log('Plugin API running on http://localhost:3000');
```

**Test:**
```bash
curl -X POST http://localhost:3000/v1/execute/research \
  -H "Content-Type: application/json" \
  -d '{"inputs": {"industry": "AI assistants", "depth": "detailed"}}'
```

### 5. Run Natively in Allternit

```typescript
// In Allternit runtime
import { NativeAdapter } from '@allternit/plugin-sdk';
import MarketResearchPlugin from './plugins/market-research';

const plugin = new MarketResearchPlugin();
const adapter = new NativeAdapter();

const instance = await adapter.initialize(plugin, {
  runtime: allternitRuntime, // Provided by Allternit
});

await instance.start();
```

## Converting Existing Templates

```bash
# Convert all 76 templates
npx @allternit/convert-templates \
  --input src/components/chat/TemplatePreviewCards.tsx \
  --output ./plugins

# Result:
# plugins/
#   market-research/
#   competitor-intel/
#   code-react/
#   ... (76 plugins)
```

## Platform-Specific Usage

### Claude Desktop

```json
{
  "mcpServers": {
    "allternit-plugins": {
      "command": "npx",
      "args": ["-y", "@allternit/plugin-runtime", "serve", "--all"],
      "env": {
        "ALLTERNIT_PLUGINS": "market-research,code-react,image-product"
      }
    }
  }
}
```

### Cursor

```bash
# Start HTTP server
npx @allternit/plugin-runtime serve --port 3000

# In .cursorrules:
# You have access to Allternit plugins via http://localhost:3000
# Available: market-research, code-react, image-product
```

### Generic HTTP Client

```python
import requests

# Call any plugin
response = requests.post(
    'http://localhost:3000/v1/execute/market-research',
    json={'inputs': {'industry': 'AI'}}
)

print(response.json()['content'])
```

### React App

```typescript
import { usePlugin } from '@allternit/plugin-sdk/react';

function MarketResearchComponent() {
  const { execute, loading, result } = usePlugin({
    endpoint: 'http://localhost:3000',
    plugin: 'market-research',
  });

  const handleResearch = async () => {
    await execute('research', { industry: 'EVs' });
  };

  return (
    <div>
      <button onClick={handleResearch} disabled={loading}>
        Research EV Market
      </button>
      {result && <Markdown content={result.content} />}
    </div>
  );
}
```

## Advanced Patterns

### Multi-Step Workflows

```typescript
async execute(functionName, params) {
  // Step 1: Research
  this.host.ui.progress(20, 'Researching...');
  const research = await this.research(params.topic);
  
  // Step 2: Analyze
  this.host.ui.progress(50, 'Analyzing...');
  const analysis = await this.analyze(research);
  
  // Step 3: Generate deliverable
  this.host.ui.progress(80, 'Creating report...');
  const report = await this.generateReport(analysis);
  
  this.host.ui.progress(100, 'Complete');
  
  return { success: true, content: report };
}
```

### Conditional Capabilities

```typescript
async execute(functionName, params) {
  const hasBrowser = this.host.tools.has('browser_navigate');
  const hasSearch = this.host.tools.has('web_search');
  
  if (hasBrowser && hasSearch) {
    // Full research with browsing
    return await this.deepResearch(params);
  } else if (hasSearch) {
    // Search-only research
    return await this.searchResearch(params);
  } else {
    // LLM-only simulation
    return await this.simulatedResearch(params);
  }
}
```

### Persistent State

```typescript
async onInit() {
  // Load previous state
  const state = await this.host.storage.get('plugin_state');
  this.cache = state || {};
}

async execute(functionName, params) {
  // Use cache
  const cacheKey = JSON.stringify(params);
  if (this.cache[cacheKey]) {
    return this.cache[cacheKey];
  }
  
  // Compute and cache
  const result = await this.compute(params);
  this.cache[cacheKey] = result;
  
  // Persist
  await this.host.storage.set('plugin_state', this.cache);
  
  return result;
}
```

### Streaming Output

```typescript
async execute(functionName, params) {
  const chunks: string[] = [];
  
  await this.host.llm.stream(
    params.prompt,
    (chunk) => {
      chunks.push(chunk);
      // Real-time update
      this.host.ui.progress(chunks.length, 'Generating...');
    }
  );
  
  return {
    success: true,
    content: chunks.join(''),
  };
}
```

## Testing Plugins

```typescript
// test/plugin.test.ts
import { describe, it, expect } from 'vitest';
import MarketResearchPlugin from '../plugins/market-research';
import { MockPluginHost } from '@allternit/plugin-sdk/testing';

describe('MarketResearchPlugin', () => {
  it('should research a market', async () => {
    const plugin = new MarketResearchPlugin();
    const host = new MockPluginHost();
    
    await plugin.initialize(host);
    
    const result = await plugin.execute('research', {
      industry: 'Test Industry',
    });
    
    expect(result.success).toBe(true);
    expect(result.content).toContain('Test Industry');
  });
});
```

## Deployment

### Docker

```dockerfile
FROM node:20
WORKDIR /app
COPY package.json .
RUN npm install
COPY plugins ./plugins
EXPOSE 3000
CMD ["npx", "@allternit/plugin-runtime", "serve", "--port", "3000"]
```

### Vercel

```typescript
// api/plugin.ts
import { HttpAdapter } from '@allternit/plugin-sdk';
import plugin from '../plugins/market-research';

const adapter = new HttpAdapter();
const instance = await adapter.initialize(plugin);

export default instance.getHandler();
```

### Self-Hosted

```bash
# PM2
pm2 start npx --name allternit-plugins -- @allternit/plugin-runtime serve

# systemd
systemctl enable allternit-plugins
systemctl start allternit-plugins
```

## Troubleshooting

### Plugin not loading
```bash
# Check manifest
npx @allternit/plugin-runtime validate ./plugins/my-plugin

# Test locally
npx @allternit/plugin-runtime run ./plugins/my-plugin --adapter mcp
```

### Tool not available
```typescript
// Check before using
if (!this.host.tools.has('web_search')) {
  this.host.logger.warn('web_search not available, using fallback');
  // Use LLM fallback
}
```

### Debug mode
```bash
DEBUG=allternit:* npx @allternit/plugin-runtime serve
```
