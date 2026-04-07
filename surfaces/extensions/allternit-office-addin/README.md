# Allternit Office Add-in

An AI-powered Microsoft Office task pane add-in that brings the Allternit assistant into Excel, PowerPoint, and Word — running in debug/sideload mode (no AppSource required).

## What It Does

| Host | What the AI can do |
|---|---|
| **Excel** | Analyze data, generate formulas, create charts, build financial models, clean data, format cells |
| **PowerPoint** | Add slides, rewrite content, generate full presentations from outlines, apply branding, create speaker notes |
| **Word** | Rewrite text with tracked changes, improve grammar, summarize documents, create tables, fill templates, redline contracts |

The add-in uses the same `ExtensionSidepanelShell` as the Allternit Chrome extension — same UI, same branded experience, same adapter pattern.

---

## Quick Start (Debug / Sideload Mode)

### 1. Install dependencies
```bash
cd surfaces/extensions/allternit-office-addin
npm install
```

### 2. Install HTTPS certificates (one-time)
```bash
npm run certs
# Installs trusted localhost certs to ~/.office-addin-dev-certs/
```

### 3. Start for a specific app
```bash
npm run dev:excel       # starts Vite + sideloads in Excel
npm run dev:powerpoint  # starts Vite + sideloads in PowerPoint
npm run dev:word        # starts Vite + sideloads in Word
```

### 4. Stop debugging
```bash
npm run stop
```

These commands use `office-addin-debugging` — equivalent to Chrome's "Load unpacked" for Office.

---

## Configuration

Open the add-in task pane and click the ⚙ config icon:

| Setting | Description |
|---|---|
| **API Key** | Your Allternit or Anthropic API key |
| **Base URL** | API endpoint (default: `https://api.anthropic.com`) |
| **Model** | Claude model ID (default: `claude-sonnet-4-6`) |
| **Language** | UI language (`en` or `zh`) |
| Advanced: **System Instruction** | Custom system prompt override |

Config is persisted via `OfficeRuntime.storage` (equivalent to `chrome.storage.local`).

---

## Plugin System

Each Office host has a dedicated plugin at `plugins/{excel,powerpoint,word}/`:

```
plugins/
├── plugin-registry.json          ← central registry for all 3 plugins
├── excel/
│   ├── .claude-plugin/plugin.json  ← commands, skills manifest
│   ├── system-prompt.md            ← Excel-specific AI system prompt
│   ├── skills/                     ← 8 skill reference files
│   ├── commands/                   ← 7 command definitions
│   ├── cookbooks/                  ← 4 step-by-step guides
│   └── tools/tool-definitions.ts  ← 10 typed tool schemas
├── powerpoint/                     ← 6 skills, 6 commands, 4 cookbooks, 9 tools
└── word/                           ← 8 skills, 7 commands, 4 cookbooks, 10 tools
```

The plugin loader (`src/lib/plugin-loader.ts`) automatically selects the correct plugin based on which Office app is running, and injects its system prompt and command list into every AI conversation.

---

## Architecture Summary

```
main.tsx
  └── Office.onReady()
        └── App.tsx
              ├── useOfficeSidepanelAdapter (adapter pattern)
              │     ├── useOfficeAgent (AI + streaming)
              │     └── getBridge() (ExcelBridge | WordBridge | PowerPointBridge)
              └── ExtensionSidepanelShell (shared component)
                    └── OfficeConfigPanel (settings)
```

Key files:
- `src/lib/bridge-factory.ts` — routes `getContext()` and `insertText()` to the right Office.js API
- `src/lib/plugin-loader.ts` — loads per-host plugin config and system prompt
- `src/lib/code-executor.ts` — extracts and executes Office.js code from AI responses with retry
- `src/lib/storage.ts` — `OfficeRuntime.storage` wrapper with `localStorage` fallback
- `src/lib/host-detector.ts` — detects Excel/Word/PowerPoint from `Office.context`

---

## Development Notes

- **HTTPS is required** — Office refuses to load HTTP task panes. Use `npm run certs` to install trusted dev certs
- **Single manifest** — `manifest.xml` supports all three hosts (`Workbook`, `Presentation`, `Document`)
- **Hot reload** — Vite HMR works during dev; the task pane reloads automatically
- **Code execution** — The AI can generate and execute Office.js code directly in the task pane sandbox (see `code-executor.ts`)

---

## Sources & Credits

This add-in draws patterns from:
- [DocuPilotAI/DocuPilot](https://github.com/DocuPilotAI/DocuPilot) (MIT) — bridge factory, code executor, error categorization
- [tfriedel/claude-office-skills](https://github.com/tfriedel/claude-office-skills) (MIT) — skill file structure
- [anthropics/financial-services-plugins](https://github.com/anthropics/financial-services-plugins) (Apache 2.0) — plugin.json schema, financial model patterns
- [menahishayan/MS-Office-AI](https://github.com/menahishayan/MS-Office-AI) (MIT) — selection change events, worksheet management
