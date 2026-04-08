# Architecture: Allternit Office Add-in

## Overview

The Allternit Office Add-in is a single-bundle Microsoft Office task pane add-in that runs in Excel, PowerPoint, and Word. It shares the Allternit platform's design system and adapter pattern with the existing Chrome extension (`allternit-extension`), while adding Office-specific bridges and a per-host plugin system.

---

## Directory Structure

```
surfaces/extensions/allternit-office-addin/
├── manifest.xml                    ← Office manifest (all 3 hosts in one file)
├── package.json                    ← @allternit/office
├── vite.config.ts                  ← Vite + HTTPS (office-addin-dev-certs)
├── PLAN.md                         ← Full build plan with phases A–I
│
├── src/
│   ├── taskpane/
│   │   ├── index.html              ← Office.js CDN script tag lives here
│   │   ├── main.tsx                ← Office.onReady() → ReactDOM.createRoot
│   │   ├── App.tsx                 ← Shell wiring: adapter + ExtensionSidepanelShell
│   │   ├── useOfficeSidepanelAdapter.ts  ← Adapter: agent + bridge → shell interface
│   │   ├── styles.css              ← Sand palette (mirrors platform theme.css)
│   │   └── components/
│   │       └── OfficeConfigPanel.tsx  ← API key, base URL, model, advanced settings
│   │
│   ├── agent/
│   │   └── useOfficeAgent.ts       ← Fetch-based streaming agent, plugin-aware system prompt
│   │
│   ├── lib/
│   │   ├── bridge-factory.ts       ← Routes to ExcelBridge | WordBridge | PowerPointBridge
│   │   ├── host-detector.ts        ← Detects Excel/Word/PowerPoint from Office.context
│   │   ├── code-executor.ts        ← Extracts & executes Office.js code from AI responses
│   │   ├── plugin-loader.ts        ← Loads per-host plugin config + system prompt builder
│   │   ├── storage.ts              ← OfficeRuntime.storage with localStorage fallback
│   │   └── utils.ts                ← cn() helper
│   │
│   └── components/ui/              ← shadcn/Radix: button, input, switch
│
└── plugins/
    ├── plugin-registry.json        ← Central registry: all 3 plugins
    ├── excel/
    │   ├── .claude-plugin/plugin.json
    │   ├── system-prompt.md
    │   ├── skills/   (8 files)
    │   ├── commands/ (7 files)
    │   ├── cookbooks/(4 files)
    │   └── tools/tool-definitions.ts
    ├── powerpoint/
    │   ├── .claude-plugin/plugin.json
    │   ├── system-prompt.md
    │   ├── skills/   (6 files)
    │   ├── commands/ (6 files)
    │   ├── cookbooks/(4 files)
    │   └── tools/tool-definitions.ts
    └── word/
        ├── .claude-plugin/plugin.json
        ├── system-prompt.md
        ├── skills/   (8 files)
        ├── commands/ (7 files)
        ├── cookbooks/(4 files)
        └── tools/tool-definitions.ts
```

---

## Key Architectural Decisions

### 1. Single Manifest, Three Hosts

`manifest.xml` lists all three hosts in the `<Hosts>` block:
```xml
<Host Name="Workbook"/>       <!-- Excel -->
<Host Name="Presentation"/>   <!-- PowerPoint -->
<Host Name="Document"/>       <!-- Word -->
```
One add-in installation, one bundle, three contexts.

### 2. Bridge Factory Pattern (from DocuPilot)

`getBridge()` returns the correct `OfficeBridge` implementation at runtime:

```
getOfficeHost()  →  "excel" | "word" | "powerpoint" | "unknown"
getBridge()      →  ExcelBridge | WordBridge | PowerPointBridge | NullBridge
```

Each bridge implements:
- `getContext(): Promise<DocumentContext>` — reads relevant document state for the AI system prompt
- `insertText(text): Promise<void>` — inserts/replaces text in the document

This decouples the agent from Office host specifics.

### 3. Plugin Loader

`plugin-loader.ts` embeds all three plugin manifests as TypeScript constants (no runtime file reads). At startup it calls `loadPlugin()` → returns the `PluginConfig` for the current host.

The plugin config is used to:
- Build the AI system prompt prefix (commands, execution rules, forbidden ops)
- Route code execution through the correct error recovery settings
- Expose the correct command triggers in the UI

### 4. Code Executor (from DocuPilot)

When the AI response contains a `\`\`\`javascript` block, `code-executor.ts` extracts and evaluates it using `new Function(...)` with the Office namespace injected as parameters.

Error handling:
- Errors are categorized: `api_not_found`, `permission_denied`, `invalid_argument`, `syntax`, `network`, `unknown`
- Retryable errors trigger `executeWithRetry()` → builds a retry prompt → calls the AI again → extracts corrected code → re-executes
- Max retries per plugin: Excel=3, PowerPoint=2, Word=2

### 5. Shared Shell (ExtensionSidepanelShell)

The add-in uses the same `ExtensionSidepanelShell` component as the Chrome extension:

```typescript
// surfaces/shared/extension-sidepanel/ExtensionSidepanelShell.tsx
<ExtensionSidepanelShell
  adapter={adapter}        // ExtensionSidepanelAdapter
  copy={copy}              // localized strings
  testId="office-addin-shell"
  renderConfigView={...}   // OfficeConfigPanel
/>
```

The adapter interface (`ExtensionSidepanelAdapter`) is the seam between Office-specific logic and the shared shell.

### 6. Storage Abstraction

`officeStorage` wraps `OfficeRuntime.storage` with a `localStorage` fallback for dev environments where `OfficeRuntime` is not available:

```typescript
await officeStorage.get<OfficeAgentConfig>('allternit-office-config')
await officeStorage.set('allternit-office-config', config)
```

This replaces `chrome.storage.local` from the Chrome extension.

---

## Data Flow

```
User types task
     ↓
useOfficeSidepanelAdapter.execute(task)
     ↓
getBridge().getContext()          ← reads document state
     ↓
useOfficeAgent.execute(task, ctx) ← builds system prompt from plugin + context
     ↓
fetch POST /v1/chat/completions   ← streaming SSE
     ↓
processAgentResponse(response)
     ├─ no code block → display response text
     └─ has ```javascript block
           ↓
        executeWithRetry(code)
           ├─ success → display text + "✓ Done" note
           └─ failure (retryable) → buildRetryPrompt → re-call AI → retry
```

---

## Plugin System Design

Plugins follow the Claude Code plugin format:

```
.claude-plugin/plugin.json    ← commands, skills list, execution config
system-prompt.md              ← injected before every conversation
skills/*.md                   ← Office.js patterns, safety rules, code snippets
commands/*.md                 ← trigger phrases, step-by-step code, output format
cookbooks/*.md                ← multi-step walkthroughs for complex workflows
tools/tool-definitions.ts     ← typed tool schemas for structured tool use
```

The plugin system is designed to be:
- **Extensible**: new plugins can be added to `plugin-registry.json` and `plugin-loader.ts`
- **Per-host**: Excel/PowerPoint/Word each have completely separate skills, reflecting the API differences
- **Self-documenting**: skill files contain safety rules, error patterns, and working code examples

---

## Branding / Design System

The sand/nude palette is applied at two levels:

1. **Outer wrapper** (`styles.css`) — CSS variables mirroring `surfaces/allternit-platform/src/design/theme.css`:
   - `--bg-primary: #FDF8F3` (sand-50)
   - `--accent-primary: #B08D6E` (sand-400)
   - `--text-primary: #2A1F16` (sand-900)

2. **Config panel** (`OfficeConfigPanel.tsx`) — directly applies Allternit tokens to form elements

3. **Shell internals** — `ExtensionSidepanelShell` injects its own `LIGHT_THEME`/`DARK_THEME` variables. The shell's neutral theme is accepted as-is; the sand palette wraps the shell exterior.

---

## Sideload / Debug Mode

Equivalent to Chrome's "Load unpacked":

```bash
office-addin-debugging start manifest.xml --app excel --dev-server-port 3000
```

This:
1. Opens Excel (or PowerPoint/Word)
2. Loads the manifest from disk
3. Injects the task pane pointing to `https://localhost:3000`
4. Hot-reloads on file changes (Vite HMR)

HTTPS is required — `office-addin-dev-certs install` generates a trusted CA and cert for `localhost`.

---

## Platform Plugin Registry

The plugins are registered in `plugins/plugin-registry.json` and are available in the Allternit platform plugin list at:
```
surfaces/allternit-platform/src/plugins/
```
Each plugin is flagged `"exclusive": true` — it only activates within its corresponding Office host context.
