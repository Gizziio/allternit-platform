# Allternit Office Add-in — Plugin Build Plan

## Sources Forked From
| Source | License | What we take |
|---|---|---|
| `anthropics/financial-services-plugins` | Apache 2.0 | plugin.json schema, command format, skill structure |
| `tfriedel/claude-office-skills` | MIT | SKILL.md content for xlsx/pptx/docx (zero-error rules, financial conventions, redlining, html2pptx) |
| `DocuPilotAI/DocuPilot` | MIT | code-executor.ts, bridge-factory.ts, MCP tool definitions, system prompt per host |
| `menahishayan/MS-Office-AI` | MIT | Selection-change event listeners, live context |

## Architecture Decision
Use the **code-execution pattern** (agent generates Office.js code → frontend runs it) rather than pre-defined tool enumeration. Reasons:
- Office.js API surface is too large to enumerate (~300 Excel methods, ~150 Word, ~80 PPT)
- Code generation handles edge cases and composes complex operations
- Agent already knows Office.js API patterns
- Skills teach the agent what patterns to use, not what tools exist

## Plugin Package Structure
Each plugin is a self-contained directory following the official Anthropic plugin.json schema:
```
plugins/
  plugin-registry.json          ← Allternit platform registry entry
  excel/
    .claude-plugin/plugin.json  ← manifest
    system-prompt.md            ← deep Excel expert system prompt
    skills/                     ← 8 skill files (auto-loaded as agent context)
    commands/                   ← 7 slash commands (user-invocable)
    cookbooks/                  ← 4 example workflows
    tools/tool-definitions.ts   ← typed tool surface for agent
  powerpoint/                   ← same structure, 6 skills, 6 commands, 4 cookbooks
  word/                         ← same structure, 8 skills, 7 commands, 4 cookbooks
```

## Runtime Flow
```
Office.onReady()
  → detectHost() → getOfficeHost() → 'excel' | 'word' | 'powerpoint'
    → loadPlugin(host) → reads plugin.json + system-prompt.md + all skills/
      → builds agent context (system prompt + skill knowledge)
        → registers slash commands in task pane UI
          → user types or uses /command
            → agent generates Office.js code using skill patterns
              → code-executor runs it in Office
                → error recovery using host-specific hints
                  → result fed back to agent if error (retry loop)
```

## File Execution Plan

### Phase A — Manifests + System Prompts (6 files)
- plugins/plugin-registry.json
- plugins/excel/.claude-plugin/plugin.json
- plugins/powerpoint/.claude-plugin/plugin.json
- plugins/word/.claude-plugin/plugin.json
- plugins/excel/system-prompt.md
- plugins/powerpoint/system-prompt.md
- plugins/word/system-prompt.md

### Phase B — Excel Skills (8 files, parallel)
range-operations, formula-generation, table-operations, chart-creation,
cell-formatting, worksheet-management, financial-modeling, data-validation

### Phase C — Excel Commands + Cookbooks + Tools (12 files, parallel)
7 commands + 4 cookbooks + tool-definitions.ts

### Phase D — PowerPoint Skills (6 files, parallel)
slide-operations, shape-creation, text-formatting, design-system,
template-editing, content-strategy

### Phase E — PowerPoint Commands + Cookbooks + Tools (11 files)

### Phase F — Word Skills (8 files, parallel)
paragraph-operations, style-application, table-operations, content-controls,
search-replace, redlining, headers-footers, document-structure

### Phase G — Word Commands + Cookbooks + Tools (12 files)

### Phase H — Runtime Code (4 files)
- src/lib/code-executor.ts (forked from DocuPilot, adapted for Vite/browser)
- src/lib/plugin-loader.ts (loads plugin at runtime based on host)
- src/agent/useOfficeAgent.ts (updated to use plugin loader)
- src/taskpane/useOfficeSidepanelAdapter.ts (updated commands exposure)

### Phase I — Documentation (3 files)
- README.md (add-in surface)
- ARCHITECTURE.md (add-in surface)
- surfaces/extensions/README.md (extensions surface index)

## Total File Count
~70 files across phases A–I
