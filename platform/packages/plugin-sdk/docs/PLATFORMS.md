# Platform Support Matrix

The Allternit Plugin SDK supports **any LLM tool or platform** through adapters.

## Adapter Overview

| Adapter | Use Case | Integration Method |
|---------|----------|-------------------|
| **Native** | Allternit platform | Direct integration |
| **MCP** | Claude Desktop, Cursor | `claude_desktop_config.json` |
| **HTTP** | Web apps, custom tools | REST API + WebSocket |
| **CLI** | Codex, Aider, terminal tools | Command line |
| **VS Code** | Copilot, Cody, Continue | VS Code extension |
| **LangChain** | Python chains, agents | `AllternitTool` class |

---

## Detailed Platform Support

### ✅ Claude Desktop (Anthropic)

**Method:** MCP (Model Context Protocol)

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

**Capabilities:**
- ✅ LLM access (Claude)
- ⚠️ Tools (via MCP, limited)
- ⚠️ UI (text only)
- ❌ Panels
- ❌ Persistent storage

**Usage:**
```
Use allternit with plugin "market-research" and inputs {"industry": "AI"}
```

---

### ✅ Cursor

**Methods:** 
1. MCP (same as Claude)
2. HTTP API + `.cursorrules`

**Option 1: MCP**
Same config as Claude Desktop.

**Option 2: HTTP + Rules**
```bash
# Start server
npx @allternit/plugin-sdk serve --port 3000
```

```markdown
# .cursorrules

## Allternit Plugins

You have access to Allternit plugins via http://localhost:3000

Available plugins:
- market-research: Industry analysis
- code-react: React components
- image-product: Product photography

When the user asks for research, code, or images, use the appropriate plugin.
```

**Capabilities:**
- ✅ LLM access
- ✅ Terminal execution
- ✅ File system
- ⚠️ UI (basic rendering)

---

### ✅ OpenAI Codex

**Method:** CLI Adapter

```bash
# Install globally
npm install -g @allternit/plugin-sdk

# Use in Codex
allternit-plugin run code-react --component "Button" --props "variant,onClick"
```

**Or via pipe:**
```bash
cat requirements.md | allternit-plugin run market-research --stdin > report.md
```

**Capabilities:**
- ✅ LLM via API (OpenAI)
- ⚠️ Tools (CLI execution)
- ❌ UI (text only)
- ⚠️ Storage (memory only)

---

### ✅ GitHub Copilot (VS Code)

**Method:** VS Code Extension Adapter

```typescript
// extension.ts
import { VSCodeAdapter } from '@allternit/plugin-sdk';
import marketResearchPlugin from './plugins/market-research';

const adapter = new VSCodeAdapter();
const instance = await adapter.initialize(marketResearchPlugin, {
  vscode,
  context: extensionContext,
  copilotIntegration: true,
});

await instance.start();
// Registers: /allternit market-research industry="AI"
```

**Capabilities:**
- ✅ Copilot LLM
- ✅ VS Code APIs (files, terminal, webviews)
- ✅ Side panels
- ✅ Persistent storage

---

### ✅ Sourcegraph Cody

**Method:** VS Code Extension (same as Copilot)

Cody runs in VS Code, so use the VS Code adapter with Cody's LLM.

---

### ✅ Continue.dev

**Method:** 
1. MCP (if supported)
2. HTTP API
3. Custom config

```json
// config.json
{
  "contextProviders": [
    {
      "name": "allternit",
      "params": {
        "url": "http://localhost:3000"
      }
    }
  ]
}
```

---

### ✅ Aider

**Method:** CLI Adapter

```bash
# In Aider chat
/run allternit-plugin run code-react --description "Create a modal component"

# Or
!allternit-plugin run image-product --prompt "professional headshot"
```

---

### ✅ Any Python/LangChain App

**Method:** LangChain Adapter

```python
from langchain.agents import initialize_agent, Tool
from allternit_plugin_sdk import AllternitTool
import asyncio

# Load plugin
market_research = AllternitTool.from_id("market-research")
await market_research.initialize()

# Use in agent
tools = [
    Tool(
        name="market_research",
        func=market_research.call,
        description="Research any market or industry"
    )
]

agent = initialize_agent(tools, llm, agent="zero-shot-react-description")
agent.run("Research the electric vehicle market")
```

---

### ✅ Custom Web Apps

**Method:** HTTP Adapter

```javascript
// React app
import { usePlugin } from '@allternit/plugin-sdk/react';

function App() {
  const { execute, loading, result } = usePlugin({
    endpoint: 'http://localhost:3000',
    plugin: 'market-research',
  });

  return (
    <button onClick={() => execute('research', { industry: 'AI' })}>
      Research AI Market
    </button>
  );
}
```

---

### ✅ Mobile Apps

**Method:** HTTP Adapter

```swift
// iOS
let result = try await URLSession.shared
    .executePlugin(
        endpoint: "https://api.allternit.com",
        plugin: "market-research",
        inputs: ["industry": "AI"]
    )
```

---

### ✅ ChatGPT (OpenAI)

**Method:** Actions (Function Calling)

```yaml
# openapi.yaml for ChatGPT Action
openapi: 3.0.0
info:
  title: Allternit Plugins
  description: Access 76 Allternit plugins
paths:
  /v1/execute/{plugin}:
    post:
      operationId: runPlugin
      parameters:
        - name: plugin
          in: path
          required: true
          schema:
            type: string
            enum: [market-research, code-react, image-product]
      requestBody:
        content:
          application/json:
            schema:
              type: object
              properties:
                inputs:
                  type: object
```

**Limitations:**
- Requires plugin owner to publish to ChatGPT store
- OpenAI approval needed

---

### ⚠️ Perplexity

**Method:** HTTP API (if they add plugin support)

Currently no plugin system, but could use HTTP adapter if they expose APIs.

---

### ✅ Self-Hosted / On-Premise

**Method:** Any adapter

```bash
# Docker
docker run -p 3000:3000 allternit/plugin-runtime

# Kubernetes
kubectl apply -f allternit-plugins.yaml

# Private cloud
npx @allternit/plugin-sdk serve --port 8080 --auth required
```

---

## Platform Comparison

| Feature | Claude | Cursor | Copilot | Codex | HTTP API | LangChain |
|---------|--------|--------|---------|-------|----------|-----------|
| **LLM Access** | ✅ (Claude) | ✅ (Various) | ✅ (Copilot) | ✅ (OpenAI) | ✅ (Configurable) | ✅ (Your LLM) |
| **Web Search** | ⚠️ | ✅ | ✅ | ⚠️ | ✅ | ✅ |
| **Code Execution** | ❌ | ✅ | ✅ | ⚠️ | ✅ | ✅ |
| **File System** | ❌ | ✅ | ✅ | ⚠️ | ✅ | ✅ |
| **Browser Control** | ❌ | ❌ | ❌ | ❌ | ✅ | ✅ |
| **Side Panels** | ❌ | ❌ | ✅ | ❌ | ✅ | ⚠️ |
| **Persistent Storage** | ❌ | ⚠️ | ✅ | ❌ | ✅ | ✅ |
| **Streaming Output** | ⚠️ | ✅ | ✅ | ⚠️ | ✅ | ✅ |
| **Image Generation** | ❌ | ⚠️ | ⚠️ | ❌ | ✅ | ⚠️ |
| **Easy Setup** | ✅ | ✅ | ⚠️ | ✅ | ⚠️ | ⚠️ |

**Legend:**
- ✅ Full support
- ⚠️ Limited / Platform dependent
- ❌ Not available

---

## Choosing an Adapter

### For End Users

| If you use... | Choose... | Setup Time |
|---------------|-----------|------------|
| Claude Desktop | MCP | 2 min |
| Cursor | MCP or HTTP | 2 min |
| VS Code + Copilot | VS Code Extension | 10 min |
| Terminal (Codex, Aider) | CLI | 1 min |
| Custom app | HTTP API | 30 min |

### For Developers

| If you're building... | Choose... |
|----------------------|-----------|
| VS Code extension | VS Code Adapter |
| Python app / Agent | LangChain Adapter |
| Web app | HTTP Adapter |
| CLI tool | CLI Adapter |
| Allternit platform | Native Adapter |

---

## Fallback Strategy

When a platform doesn't support a capability:

```typescript
// In your plugin code
async execute(params) {
  // Try to use tool
  if (this.host.tools.has('web_search')) {
    const results = await this.host.tools.execute('web_search', params);
    return this.analyze(results);
  }
  
  // Fallback: LLM simulation
  this.host.logger.warn('web_search not available, using LLM fallback');
  const simulated = await this.host.llm.complete(
    `Simulate web search results for: ${params.query}`
  );
  return this.analyze(simulated);
}
```

---

## Request New Platform Support

Don't see your platform? Open an issue with:
1. Platform name and URL
2. Extension/plugin API (if any)
3. LLM access method
4. Example use case

We'll create an adapter for it.
