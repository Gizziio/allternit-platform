# Plugin Architecture & Deterministic Execution

## Overview

Allternit's plugin system supports **deterministic execution** of plugins both inside the platform and externally by any agent with LLM access.

## Plugin Types

### 1. Built-in Plugins (14 total)
**Location:** `src/plugins/built-in/`

Our own TypeScript-based plugins:
- **Core Agent Modes** (10): image, video, slides, website, research, data, code, assets, swarms, flow
- **Office Extensions** (3): office-excel, office-word, office-powerpoint
- **Browser Extension** (1): chrome

**Execution:** Direct TypeScript execution via `plugin.execute()`

### 2. Vendor Plugins (16 bundled + 18 downloadable)
**Location:** `src/plugins/vendor/`

Third-party markdown-based plugins from Claude Desktop:
- **Bundled** (16): legal, engineering, data, design, sales, marketing, finance, etc.
- **Downloadable** (18): claude-artifacts, deep-research, git-assistant, etc.

**Execution:** Deterministic markdown execution via LLM with constraints

---

## Using Plugins in the Platform

### For Users (Chat Interface)

#### 1. Built-in Modes
Select from the mode selector or type:
```
/research What are the latest AI regulations?
/code Create a React counter component
/image A futuristic city at sunset
```

#### 2. Vendor Commands
Use slash commands with plugin:command syntax:
```
/legal:triage-nda <paste NDA text>
/engineering:review <paste code>
/sales:call-summary <paste transcript>
/marketing:seo-audit https://example.com
```

#### 3. Natural Language
The system auto-detects intent:
```
"Review this contract for risks" → Routes to /legal:review-contract
"Summarize this sales call" → Routes to /sales:call-summary
```

### For Developers

```typescript
import { pluginRuntime } from '@/lib/plugins/plugin-runtime';

// Execute any plugin
const result = await pluginRuntime.execute({
  input: "/legal:triage-nda",
  files: [ndaFile],
  context: { messages: [] }
});

// Check if deterministic
console.log(result.deterministic); // true for vendor plugins
console.log(result.auditLog); // Full action trace

// Execute specific command
const result = await pluginRuntime.execute({
  pluginId: 'legal',
  commandId: 'triage-nda',
  input: 'Analyze this NDA...',
});
```

---

## Using Plugins Outside the Platform

Any agent can use Allternit plugins through the **Portable Plugin Format**.

### Export a Plugin

```bash
# Download portable format
curl https://allternit.io/api/plugins/legal/export > legal-plugin.json
```

### Use in External Agents

```typescript
import { executePortablePlugin } from '@allternit/plugins';

// Load the portable plugin
const legalPlugin = JSON.parse(fs.readFileSync('legal-plugin.json'));

// Execute with any LLM
const result = await executePortablePlugin(
  legalPlugin,
  'triage-nda',           // command name
  { prompt: 'NDA text...' }, // inputs
  {
    llm: {
      complete: async ({ system, user }) => {
        // Use any LLM: OpenAI, Anthropic, local, etc.
        return openai.chat.completions.create({
          model: 'gpt-4',
          messages: [
            { role: 'system', content: system },
            { role: 'user', content: user }
          ],
          temperature: 0, // Deterministic
        });
      }
    }
  }
);

// Result includes audit trail
console.log(result.actions); // All steps taken
console.log(result.output);   // Classification result
```

### Python Usage

```python
import json
import requests

# Load portable plugin
with open('legal-plugin.json') as f:
    plugin = json.load(f)

# Build system prompt from plugin
system_prompt = f"""
# PLUGIN: {plugin['name']}
# COMMAND: triage-nda

{plugin['commands'][0]['markdown']}

## REFERENCE SKILLS
{chr(10).join(s['markdown'] for s in plugin['skills'])}
"""

# Execute with any LLM
response = requests.post('https://api.anthropic.com/v1/messages', json={
    'model': 'claude-3-5-sonnet',
    'system': system_prompt,
    'messages': [{'role': 'user', 'content': 'NDA text here...'}],
    'temperature': 0
})
```

---

## Deterministic Execution Guarantees

### What Makes It Deterministic?

1. **Fixed Instructions**: Markdown commands don't change between executions
2. **Temperature = 0**: LLM runs with no randomness
3. **Input Validation**: All inputs validated against schemas
4. **Action Logging**: Every step is recorded and auditable
5. **No External State**: Execution relies only on provided inputs

### Audit Trail

Every deterministic execution produces:

```typescript
{
  actions: [
    {
      id: "llm-123456",
      timestamp: 1712534400000,
      type: "generate",
      description: "Execute triage-nda with deterministic constraints",
      input: { /* inputs */ },
      output: { /* llm response */ },
      duration: 2340 // ms
    }
  ]
}
```

### Reproducibility

Same inputs → Same outputs → Same actions

```typescript
// Run 1
const result1 = await execute({ pluginId: 'legal', commandId: 'triage-nda', inputs: { nda: '...' } });

// Run 2 (same inputs)
const result2 = await execute({ pluginId: 'legal', commandId: 'triage-nda', inputs: { nda: '...' } });

// Results are identical
assert(result1.output === result2.output);
assert(JSON.stringify(result1.actions) === JSON.stringify(result2.actions));
```

---

## Plugin Capabilities

### Current Capabilities

| Capability | Built-in | Vendor | Description |
|------------|----------|--------|-------------|
| `execute` | ✅ | ✅ | Run plugin with inputs |
| `generate` | ✅ | ✅ | Generate content/code |
| `analyze` | ✅ | ✅ | Analyze documents/data |
| `file-read` | ✅ | ⚠️ | Read uploaded files |
| `file-write` | ✅ | ❌ | Write output files |
| `api-call` | ✅ | ❌ | Call external APIs |
| `mcp-tool` | ❌ | ✅ | Use MCP tools |

### Security Model

Vendor plugins run in a **constrained sandbox**:
- No direct file system access
- No network access (unless via MCP)
- All actions logged and auditable
- User confirmation required for destructive operations

---

## Marketplace Integration

### Installing Downloadable Plugins

```typescript
// Browse marketplace
const plugins = await pluginMarketplace.browse({ category: 'analyze' });

// Install
await pluginMarketplace.install('claude-deep-research');

// Enable
await pluginMarketplace.enable('claude-deep-research');
```

### Plugin Registry

All plugins are registered in:
- `src/lib/plugins/marketplace-integration.ts` (bundled)
- `src/plugins/vendor/vendored-plugins.ts` (downloadable)

---

## API Reference

### REST Endpoints

```
GET  /api/plugins                    # List all plugins
GET  /api/plugins/:id/export         # Export to portable format
POST /api/plugins/:id/execute        # Execute plugin (authenticated)
```

### TypeScript SDK

```typescript
import { 
  pluginRuntime, 
  executePortablePlugin,
  exportToPortableFormat 
} from '@allternit/plugins';

// Platform usage
const result = await pluginRuntime.execute({ input: '/legal:triage-nda' });

// External usage
const portable = await exportToPortableFormat('legal');
const result = await executePortablePlugin(portable, 'triage-nda', inputs, { llm });
```

---

## Summary

| Feature | In Platform | External |
|---------|-------------|----------|
| **Execution** | Via `pluginRuntime.execute()` | Via `executePortablePlugin()` |
| **Deterministic** | ✅ Yes | ✅ Yes |
| **Audit Trail** | ✅ Full logging | ✅ Action list |
| **LLM Required** | Uses platform LLM | Bring your own |
| **Format** | TypeScript or Markdown | Portable JSON |
| **Offline** | ✅ Vendor plugins work | ✅ Fully offline |

**Key Point**: Vendor plugins (markdown-based) are fully portable and deterministic. They can be used by any agent, anywhere, with any LLM, and produce the same results.
