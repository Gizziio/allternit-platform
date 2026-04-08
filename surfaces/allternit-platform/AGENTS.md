# Allternit Agent Documentation

## Overview

Allternit is a unified AI platform with **deterministic plugin execution**. This guide covers everything agents need to know about using plugins.

---

## Plugin Architecture

### Three Types of Plugins

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         PLUGIN TYPES                                        │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  1. BUILT-IN (14 plugins)          2. VENDOR BUNDLED (16)       3. VENDOR  │
│     • TypeScript-based                • Markdown-based            DOWNLOAD  │
│     • Core agent modes                • From Claude Desktop       (18+)     │
│                                                                             │
│  📁 built-in/                      📁 vendor/claude-desktop/   📦 Registry  │
│  ├── image (FREE)                  ├── legal                   └── Ready   │
│  ├── video (BYOK)                  ├── engineering                 to      │
│  ├── slides                        ├── sales                     install   │
│  ├── website                       ├── marketing                           │
│  ├── research                      ├── finance                             │
│  ├── data                          ├── design                              │
│  ├── code                          └── ... 11 more                        │
│  ├── assets                                                               │
│  ├── swarms                                                               │
│  ├── flow                                                                 │
│  ├── office-excel                                                         │
│  ├── office-word                                                          │
│  ├── office-powerpoint                                                    │
│  └── chrome                                                               │
│                                                                           │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Built-in vs Vendor

| Aspect | Built-in | Vendor |
|--------|----------|--------|
| **Code** | TypeScript | Markdown (commands + skills) |
| **Execution** | Direct JS execution | LLM with deterministic constraints |
| **Offline** | ✅ Always works | ✅ Bundled ones work offline |
| **Deterministic** | Partial | ✅ Fully deterministic |
| **Portable** | ❌ Platform only | ✅ Exportable to any agent |

---

## Using Plugins In Platform

### Method 1: Mode Selector (Built-in)

Select from the 4-group mode selector in chat:

```
🟣 CREATE (Violet)    🔵 ANALYZE (Blue)    🟢 BUILD (Emerald)   🟡 AUTOMATE (Amber)
├── Image              ├── Research          ├── Code             ├── Swarms
├── Video              ├── Data              ├── Assets           ├── Flow
├── Slides             ├── Legal ⭐          ├── Engineering ⭐    ├── Operations ⭐
└── Website            ├── Sales ⭐          └── Chrome            └── Productivity ⭐
                       ├── Finance ⭐
                       ├── HR ⭐
                       └── Support ⭐

⭐ = Claude Desktop vendor plugins
```

**Usage:**
```
1. Click mode pill (e.g., "Analyze")
2. Select sub-mode (e.g., "Legal")
3. Type your request or upload file
```

### Method 2: Slash Commands (Vendor Plugins)

Use `/plugin:command` syntax for precise control:

```
/legal:triage-nda <paste NDA text>
/legal:review-contract <upload contract.pdf>

/engineering:review <paste code>
/engineering:debug <describe error>
/engineering:standup <paste git log>

/sales:call-summary <paste transcript>
/sales:pipeline-review

/marketing:seo-audit https://example.com
/marketing:campaign-plan "Q4 Product Launch"

/design:critique <upload mockup>
/design:accessibility https://example.com

/finance:variance-analysis <upload spreadsheet>
/finance:sox-testing

/hr:onboarding "Jane Smith" "Engineering"
/hr:comp-analysis "Software Engineer"
```

### Method 3: Natural Language (Auto-detection)

The system automatically routes to appropriate plugins:

```
User: "Review this contract for risks"
→ Routes to /legal:review-contract

User: "Summarize my sales call with Acme Corp"
→ Routes to /sales:call-summary

User: "Check if my website is accessible"
→ Routes to /design:accessibility

User: "Debug this React error"
→ Routes to /engineering:debug
```

---

## Deterministic Execution

### What Makes It Deterministic?

Vendor plugins execute with **guaranteed reproducibility**:

1. **Fixed Instructions**: Markdown files don't change
2. **Temperature = 0**: No randomness in LLM
3. **Input Validation**: All inputs checked against schemas
4. **Action Logging**: Every step recorded
5. **No External State**: Only uses provided inputs

### Example: NDA Triage

**Input:** Same NDA document
**Output:** Same classification every time

```typescript
// Run 1
const result1 = await execute({ 
  pluginId: 'legal', 
  commandId: 'triage-nda', 
  inputs: { nda: ndaText }
});
// → Classification: RED
// → Issues: Non-solicit, non-compete present

// Run 2 (identical input)
const result2 = await execute({ 
  pluginId: 'legal', 
  commandId: 'triage-nda', 
  inputs: { nda: ndaText }
});
// → Classification: RED (SAME)
// → Issues: Non-solicit, non-compete present (SAME)
```

### Audit Trail

Every execution produces a complete log:

```typescript
{
  actions: [
    {
      id: "action-123",
      timestamp: 1712534400000,
      type: "analyze",
      description: "Check for non-solicitation provisions",
      input: { section: "3" },
      output: { found: true, text: "..." },
      duration: 45
    },
    {
      id: "action-124",
      timestamp: 1712534400045,
      type: "classify",
      description: "Apply GREEN/YELLOW/RED rules",
      input: { criteria: [...] },
      output: { classification: "RED", reasons: [...] },
      duration: 120
    }
  ]
}
```

---

## Using Plugins Outside Platform

### Export Any Plugin

```bash
# Download portable format
curl https://allternit.io/api/plugins/legal/export > legal-plugin.json

# Plugin is now a JSON file with:
# - All commands (markdown)
# - All skills (markdown)
# - Metadata (version, author, capabilities)
```

### Use in Python

```python
import json
import anthropic

# Load exported plugin
with open('legal-plugin.json') as f:
    plugin = json.load(f)

# Build system prompt
system_prompt = f"""
# PLUGIN: {plugin['name']} v{plugin['version']}

{plugin['commands'][0]['markdown']}

## REFERENCE SKILLS
{chr(10).join(s['markdown'] for s in plugin['skills'])}

## DETERMINISTIC CONSTRAINTS
Execute with temperature=0. Log all actions.
"""

# Execute with any LLM
response = anthropic.Client().messages.create(
    model="claude-3-5-sonnet",
    system=system_prompt,
    messages=[{
        "role": "user", 
        "content": "NDA text here..."
    }],
    temperature=0  # REQUIRED for determinism
)
```

### Use in Node.js

```typescript
import { executePortablePlugin } from '@allternit/plugins';
import OpenAI from 'openai';

const openai = new OpenAI();

const legalPlugin = JSON.parse(
  fs.readFileSync('legal-plugin.json', 'utf-8')
);

const result = await executePortablePlugin(
  legalPlugin,           // Plugin definition
  'triage-nda',          // Command to run
  { prompt: ndaText },   // Inputs
  {
    llm: {
      complete: async ({ system, user }) => {
        const response = await openai.chat.completions.create({
          model: 'gpt-4',
          messages: [
            { role: 'system', content: system },
            { role: 'user', content: user }
          ],
          temperature: 0,  // REQUIRED
        });
        return { content: response.choices[0].message.content };
      }
    }
  }
);

// Same result as platform execution
console.log(result.output);
console.log(result.actions); // Audit trail
```

---

## Plugin Capabilities

### Available Capabilities

| Capability | Description | Example Plugins |
|------------|-------------|-----------------|
| `text-to-image` | Generate images from text | image |
| `text-to-video` | Generate videos from text | video |
| `code-generation` | Generate and execute code | code, engineering |
| `document-analysis` | Analyze legal/business docs | legal, sales |
| `web-search` | Search and synthesize | research |
| `data-analysis` | Analyze datasets | data, finance |
| `workflow-automation` | Create automated workflows | flow, operations |
| `multi-agent` | Coordinate multiple agents | swarms |

### MCP Tools (Model Context Protocol)

Many vendor plugins include MCP tools for extended capabilities:

```json
// .mcp.json in plugin folder
{
  "tools": [
    {
      "name": "search_precedents",
      "description": "Search legal precedent database"
    },
    {
      "name": "calculate_variance",
      "description": "Calculate financial variance"
    }
  ]
}
```

---

## Plugin Development

### Creating New Plugins

#### 1. Built-in Plugin (TypeScript)

```typescript
// src/plugins/built-in/my-plugin/plugin.ts
import type { ModePlugin, PluginInput, PluginOutput } from '@/lib/plugins/types';

export const myPlugin: ModePlugin = {
  id: 'my-plugin',
  name: 'My Plugin',
  version: '1.0.0',
  
  async initialize() {
    // Setup
  },
  
  async execute(input: PluginInput): Promise<PluginOutput> {
    // Process input
    return {
      success: true,
      content: 'Result...',
    };
  },
  
  async destroy() {
    // Cleanup
  }
};
```

#### 2. Vendor Plugin (Markdown)

```markdown
<!-- src/plugins/vendor/my-vendor-plugin/commands/my-command.md -->
---
description: What this command does
argument-hint: "<expected input>"
---

# /my-command

## Workflow
1. Step one
2. Step two

## Output Format
```
Result: ...
```
```

```markdown
<!-- src/plugins/vendor/my-vendor-plugin/skills/my-skill/SKILL.md -->
---
name: my-skill
description: Background capability
---

# My Skill

Instructions for the LLM...
```

---

## Best Practices

### For Platform Users

1. **Start with natural language** - Let the system route to the right plugin
2. **Use slash commands** when you know exactly what you need
3. **Check audit trails** for important decisions (legal, financial)
4. **Enable vendor plugins** in settings before first use

### For External Agents

1. **Always set temperature=0** for deterministic results
2. **Include full audit logging** in your implementation
3. **Validate inputs** against plugin schemas
4. **Cache results** for identical inputs to save tokens

### For Plugin Developers

1. **Document all inputs/outputs** clearly
2. **Provide examples** in command markdown
3. **Use deterministic language** (avoid "consider", "maybe")
4. **Include classification rules** (GREEN/YELLOW/RED for legal)
5. **Add MCP tools** for external integrations

---

## API Reference

### REST Endpoints

```
GET  /api/plugins                    # List all plugins
GET  /api/plugins/:id/export         # Export to portable format
GET  /api/plugins/:id/commands       # List available commands
```

### TypeScript SDK

```typescript
import { pluginRuntime } from '@/lib/plugins/plugin-runtime';

// Execute any plugin
const result = await pluginRuntime.execute({
  input: "/legal:triage-nda",
  files: [ndaFile]
});

// Check if deterministic
console.log(result.deterministic); // true | false
console.log(result.auditLog);      // Action[]

// List all executable plugins
const plugins = pluginRuntime.listExecutablePlugins();

// Export for external use
const portable = await pluginRuntime.exportPlugin('legal');
```

---

## Troubleshooting

### Plugin Not Found

```
Error: Plugin not found: legal
```

**Solution:**
- Check plugin is enabled in settings
- Verify plugin ID is correct
- For vendor plugins, ensure they're installed from marketplace

### Non-Deterministic Results

```
Different output for same input
```

**Solution:**
- Ensure `temperature=0` in LLM call
- Check no external state is being used
- Verify all inputs are included in prompt

### Command Not Executing

```
/unknown:command doesn't work
```

**Solution:**
- Check command exists: `pluginRuntime.getCommands('pluginId')`
- Verify format: `/plugin:command` (not `/plugin-command`)
- Check plugin is enabled

---

## Summary

| Feature | Built-in | Vendor Bundled | Vendor Downloadable |
|---------|----------|----------------|---------------------|
| Count | 14 | 16 | 18+ |
| Offline | ✅ | ✅ | After install |
| Deterministic | Partial | ✅ | ✅ |
| Portable | ❌ | ✅ Export | ✅ Export |
| Execution | TypeScript | Markdown+LLM | Markdown+LLM |
| Audit Trail | Basic | ✅ Full | ✅ Full |

**Key Takeaway:** All 34+ plugins can be used deterministically by any agent, inside or outside the platform.
