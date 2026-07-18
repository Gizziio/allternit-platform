# Allternit Office Add-in

Three host-specific Microsoft Office developer products that connect Word, Excel, and PowerPoint to the Allternit platform brain. Distribution is debug/sideload mode; Marketplace certification is not part of this launch path.

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
- **Separate stable manifests** — `manifests/word.xml`, `manifests/excel.xml`, and `manifests/powerpoint.xml` install and update independently
- **Hot reload** — Vite HMR works during dev; the task pane reloads automatically
- **Code execution** — The AI can generate and execute Office.js code directly in the task pane sandbox (see `code-executor.ts`)

---

## OfficeCLI Backend (Gateway-Hosted)

The add-in can offload heavy document work to [OfficeCLI](https://github.com/iOfficeAI/OfficeCLI) — a single-binary Office engine running **server-side inside the Allternit API gateway** (`cmd/allternit-api`, port 8013). This gives the agent capabilities Office.js cannot provide: full-document rendering (screenshots/HTML), deep structural analysis, schema validation, atomic batch edits, template merge, and new-document generation.

### How it works

1. **Snapshot sync** — the add-in exports the live document via `Office.getFileAsync` (compressed .docx/.xlsx/.pptx bytes, sliced) and uploads it to the gateway (`POST /api/v1/office/cli/document`). All `officecli` commands run against that server-side snapshot.
2. **Read/analyze/render/validate** — `officecli_view`, `officecli_render`, `officecli_get`, `officecli_query`, `officecli_analyze` tools run on the snapshot. Screenshots come back as inline previews in the sidepanel.
3. **Mutation** — live edits still go through the existing Office.js tools. OfficeCLI mutation is used for:
   - **New-document generation** (`officecli_create` + `officecli_batch`) → delivered as a download artifact.
   - **Live apply-back** (`target: "live"` on `officecli_edit`/`officecli_batch`) — the edited snapshot is written back into the open document via host APIs (`insertFileFromBase64` / `insertWorksheetsFromBase64` / `insertSlidesFromBase64`). Destructive: requires approval.
   - **Direct file-path editing** — only when the gateway shares the filesystem (local dev) and the document is a saved `file://` path. Office will prompt to reload.
4. **Self-healing loop** — after Office.js edits the snapshot is marked dirty and lazily re-synced, so the agent can verify its own work with `officecli_render` (screenshot) and `officecli_analyze` (validate + issues) before finishing.

### Tool surface

| Tool | Purpose |
|---|---|
| `officecli_view` / `officecli_get` / `officecli_query` | Read content, structure, styles — outline/text/JSON |
| `officecli_render` | Screenshot (PNG) or HTML render — the agent's "eyes" |
| `officecli_analyze` | Schema validation + issue enumeration |
| `officecli_edit` / `officecli_batch` | Single op / atomic multi-op edits (snapshot or `target:"live"`) |
| `officecli_create` / `officecli_merge` / `officecli_dump` | New files, `{{key}}` template merge, round-trip dump |
| `officecli_raw` / `officecli_exec` | Raw-XML fallback and allowlisted escape hatch |
| `officecli_watch_start` / `officecli_watch_stop` | Live auto-refreshing HTML preview (SSE) |
| `mcp_officecli_*` | Tools discovered dynamically from OfficeCLI's MCP server (single `command` param, passed through verbatim) |

### Setup

- The gateway host needs the `officecli` binary: `brew install officecli` (or the official install script), optionally pinned via `OFFICECLI_BIN`.
- Dev gateway runs with `ALLTERNIT_LOCAL_DEV_BYPASS=1` (already the `make api` default); the add-in auto-detects availability via `GET /api/v1/office/cli/capabilities` and hides the tools when the binary is missing.
- OfficeCLI tool calls that mutate require the same destructive-action approval as existing tools.

---

## Sources & Credits

This add-in draws patterns from:
- [DocuPilotAI/DocuPilot](https://github.com/DocuPilotAI/DocuPilot) (MIT) — bridge factory, code executor, error categorization
- [tfriedel/claude-office-skills](https://github.com/tfriedel/claude-office-skills) (MIT) — skill file structure
- [anthropics/financial-services-plugins](https://github.com/anthropics/financial-services-plugins) (Apache 2.0) — plugin.json schema, financial model patterns
- [menahishayan/MS-Office-AI](https://github.com/menahishayan/MS-Office-AI) (MIT) — selection change events, worksheet management
