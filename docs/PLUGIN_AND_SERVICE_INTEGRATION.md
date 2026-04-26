# Codex Workflow → Allternit Integration

> **Last Updated:** 2026-04-18
>
> This document describes the integration of 6 Codex workflow projects into the Allternit platform.

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           CODEX WORKFLOW INTEGRATION                        │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  PLUGINS (Layer 3 — Universal Plugin SDK)                                   │
│  ├── verceldeploy-plugin        → Deploy to Vercel via CLI/API              │
│  ├── remotioncard-plugin        → Generate videos with Remotion             │
│  └── iosappbuild-plugin         → Build iOS apps with xcodebuild            │
│                                                                             │
│  SKILLS (Layer 5 — Agent Prompt Packs)                                      │
│  ├── docx                       → Generate Word documents                   │
│  ├── powerpoint                 → Generate PowerPoint decks                 │
│  └── mobile-app-design          → Design mobile apps, output RN/Figma       │
│                                                                             │
│  SERVICE (Layer 4 — Document Generation Backend)                            │
│  └── services/document-generator/                                           │
│      ├── main.py                → FastAPI service (DOCX, PPTX, XLSX)        │
│      ├── utils/docx_generator.py                                            │
│      ├── utils/pptx_generator.py                                            │
│      ├── utils/xlsx_generator.py                                            │
│      └── utils/sharepoint_uploader.py                                       │
│                                                                             │
│  TOOL CONNECTOR (Layer 4 — Agent Swarm Bridge)                              │
│  └── domains/agent-swarm/tools/document-generator/mod.ts                    │
│                                 → Zod-typed HTTP client to the service      │
│                                                                             │
│  REGISTRY                                                                   │
│  ├── .mcp.json                  → MCP server configs for 3 plugins          │
│  ├── domains/agent-swarm/tools/tool_registry.json                           │
│  └── ~/.allternit/plugin-manager/ui-state.json                              │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 1. Plugins

Plugins use `@allternit/plugin-sdk` and expose 3 adapters: **CLI**, **HTTP**, **MCP**.

### 1.1 Vercel Deploy Plugin

**Path:** `plugins/verceldeploy-plugin/`

**What it does:**
Takes a local project directory and deploys it to Vercel. Supports both preview and production deployments.

**Entry point:** `src/index.ts` → `execute(host, params)`

**Parameters:**
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `path` | string | ✅ | Absolute path to project directory |
| `projectName` | string | ❌ | Vercel project name |
| `prod` | boolean | ❌ | Deploy to production (default: false) |

**How it works:**
1. Reads `VERCEL_TOKEN` from `host.config.get('VERCEL_TOKEN')` or `process.env.VERCEL_TOKEN`
2. Checks if `vercel` CLI is installed via `which vercel`
3. If CLI exists, runs: `vercel --yes --cwd <path> [--prod] [--name <name>]`
4. If CLI is missing, returns the exact command for the user to run manually

**Configuration:**
```bash
export VERCEL_TOKEN="your_token_here"
```

**Usage:**
```bash
# CLI adapter
node plugins/verceldeploy-plugin/adapters/cli.js --path ./my-app --prod

# MCP adapter (Claude Desktop)
# Registered in .mcp.json as "verceldeploy"
```

---

### 1.2 Remotion Video Plugin

**Path:** `plugins/remotioncard-plugin/`

**What it does:**
Generates programmatic videos using Remotion. Accepts a natural language prompt, uses an LLM to generate Remotion React components, and can render to MP4.

**Entry point:** `src/index.ts` → `execute(host, params)`

**Parameters:**
| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `prompt` | string | — | Natural language description of the video |
| `action` | enum | `"generate"` | `"generate"` | `"preview"` | `"render"` |
| `durationInFrames` | number | 150 | Video length in frames |
| `width` | number | 1920 | Resolution width |
| `height` | number | 1080 | Resolution height |
| `fps` | number | 30 | Frames per second |

**How it works:**
1. **generate:** Creates a temp work directory, calls `host.llm.complete()` with a detailed Remotion prompt template, writes `Video.tsx` and `index.tsx`, returns the code
2. **preview:** Returns the Remotion Studio command: `npx remotion studio index.tsx`
3. **render:** Spawns `npx remotion render index.tsx GeneratedVideo out.mp4` with a 5-minute timeout

**Prerequisites:**
- Node.js
- Remotion CLI: `npm install -g remotion`
- FFmpeg (for MP4 output)

**Usage:**
```bash
# Generate component code
node plugins/remotioncard-plugin/adapters/cli.js --prompt "A dark intro with logo fade-in" --action generate

# Render to MP4
node plugins/remotioncard-plugin/adapters/cli.js --prompt "A dark intro with logo fade-in" --action render
```

---

### 1.3 iOS App Builder Plugin

**Path:** `plugins/iosappbuild-plugin/`

**What it does:**
Builds and runs iOS apps from React Native, Expo, or Swift projects using `xcodebuild`.

**Entry point:** `src/index.ts` → `execute(host, params)`

**Parameters:**
| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `path` | string | — | Path to project directory |
| `projectType` | enum | `"react-native"` | `"react-native"` | `"expo"` | `"swift"` |
| `scheme` | string | — | Xcode scheme name |
| `target` | enum | `"simulator"` | `"simulator"` | `"device"` | `"archive"` |
| `simulatorName` | string | `"iPhone 15"` | Simulator to use |
| `configuration` | enum | `"Debug"` | `"Debug"` | `"Release"` |
| `clean` | boolean | false | Run `xcodebuild clean` first |

**How it works:**
1. Platform guard: fails if not on macOS
2. Validates project path exists
3. Checks `xcodebuild` availability
4. Constructs build command based on project type:
   - React Native/Expo: finds `.xcworkspace` or `.xcodeproj` in `ios/`
   - Swift: uses `swift build` or `xcodebuild`
5. Adds destination (`-destination "platform=iOS Simulator,name=..."`)
6. Executes build with 10-minute timeout
7. If simulator target + success: boots simulator, installs `.app`, attempts launch

**Prerequisites:**
- macOS
- Xcode Command Line Tools (`xcodebuild`, `simctl`)
- For device builds: valid signing certificates + provisioning profiles

**Usage:**
```bash
node plugins/iosappbuild-plugin/adapters/cli.js \
  --path ./my-react-native-app \
  --target simulator \
  --simulatorName "iPhone 15" \
  --configuration Debug
```

---

## 2. Skills

Skills are agent prompt packs stored in `.agents/skills/`. They provide structured workflows, constraints, and output formats for LLM agents.

### 2.1 Docx Skill

**Path:** `.agents/skills/docx/SKILL.md`

**What it does:**
Guides agents to generate professional Microsoft Word documents from structured outlines or prompts.

**Backend:** Routes to `document-generator` service via `domains/agent-swarm/tools/document-generator/mod.ts`
- Action: `generateStudyGuide`
- Format: `docx`

**Document patterns included:**
- Business Proposal (Title, Executive Summary, Problem, Solution, Pricing, CTA)
- Technical Spec (Title, Overview, Architecture, API Surface, Data Model, Security, Deployment)
- SOP (Title, Purpose, Scope, Responsibilities, Procedure, References)

**Agent workflow:**
1. Clarify document type, audience, tone, length
2. Generate structured JSON outline
3. Call `document-generator` tool with `generateStudyGuide` action
4. Return file path + summary + revision suggestions

**Example invocation:**
```typescript
import { execute } from '../domains/agent-swarm/tools/document-generator/mod.ts';

const result = await execute({
  action: "generateStudyGuide",
  topic: "Q3 Infrastructure Migration Spec",
  format: "docx",
  length: "medium",
  learning_objectives: ["Migrate DB to Postgres 16", "Set up read replicas"],
  key_terms: ["Blue-green deployment", "Database replication"],
  include_self_check: true
});
// result.file_name, result.sharepoint_file_url
```

---

### 2.2 PowerPoint Skill

**Path:** `.agents/skills/powerpoint/SKILL.md`

**What it does:**
Guides agents to generate PowerPoint presentations from prompts, data outlines, or Excel summaries.

**Backend:** Routes to `document-generator` service via `domains/agent-swarm/tools/document-generator/mod.ts`
- Action: `generatePhotoCardDeck`

**Slide types documented:**
- `title` — Title + subtitle, centered
- `bullets` — Title + 3-5 bullets
- `two-column` — Side-by-side content
- `image-right` — Bullets left, image placeholder right
- `chart` — Bar chart from data
- `section-divider` — Full-bleed background with section title

**Agent workflow:**
1. Clarify audience, duration, key message
2. Generate slide outline as JSON array
3. Call `document-generator` tool with `generatePhotoCardDeck` action
4. Return file path + narrative arc + speaker notes

**Example invocation:**
```typescript
import { execute } from '../domains/agent-swarm/tools/document-generator/mod.ts';

const result = await execute({
  action: "generatePhotoCardDeck",
  title: "Q3 Revenue Review",
  slide_count: 8,
  deck_style: "photo_card",
  key_points: [
    "Revenue up 24% YoY",
    "Enterprise segment leading growth",
    "New partnerships in APAC"
  ]
});
// result.file_name, result.sharepoint_file_url
```

---

### 2.3 Mobile App Design Skill

**Path:** `.agents/skills/mobile-app-design/SKILL.md`

**What it does:**
Guides agents to design mobile app UI/UX, outputting Figma-compatible JSON, React Native/Expo code, asset manifests, and navigation flows.

**No backend required** — this is a pure prompt-engineering skill.

**Design principles:**
- One hero per screen
- Thumb zone priority (primary actions in bottom 25%)
- Platform respect (iOS ≠ Android)
- 60fps feel (no decorative animation)
- Density discipline (max 3 actions per screen)

**Agent workflow (5-step):**
1. **Discover** — platform, audience, core user story
2. **Architect** — screens + flows + states
3. **Frame** — key screens with safe area constraints
4. **Componentize** — extract reusable components
5. **Export** — Figma JSON + React Native scaffold + asset checklist

**Figma bridge:**
Generates HTML preview → calls existing `html-to-figma` plugin via deep-capture → pushes to Figma file.

**React Native scaffold output:**
```
app/
├── (tabs)/
│   ├── _layout.tsx
│   ├── index.tsx
│   └── profile.tsx
├── (stack)/
│   ├── _layout.tsx
│   └── detail.tsx
├── components/
│   ├── Button.tsx
│   ├── Card.tsx
│   └── Input.tsx
├── constants/
│   └── theme.ts
└── assets/
    ├── icons/
    └── images/
```

---

## 3. Document Generator Service

**Path:** `services/document-generator/`

**What it is:**
A FastAPI Python service that generates academic and business artifacts (DOCX, PPTX, XLSX) and uploads them to SharePoint.

**Source:** Copied from `~/summit-copilot-skills/` and integrated into the monorepo.

**Endpoints:**
| Method | Path | Description |
|--------|------|-------------|
| GET | `/health` | Health check |
| POST | `/actions/generatePhotoCardDeck` | Generate PPTX deck |
| POST | `/actions/generateStudyGuide` | Generate DOCX/PDF guide |
| POST | `/actions/generateRubricSpreadsheet` | Generate XLSX rubric |
| POST | `/actions/createCanvasModule` | Create Canvas LMS module |

**Authentication:** `X-API-Key` header (default: `your-secret-api-key`)

**Environment variables:**
```bash
export API_KEY="your-secret-api-key"
export TENANT_ID="your-tenant-id"
export CLIENT_ID="your-client-id"
export CLIENT_SECRET="your-client-secret"
```

**Run locally:**
```bash
cd services/document-generator
pip install -r requirements.txt
uvicorn main:app --host 0.0.0.0 --port 8000
```

**Run with Docker:**
```bash
cd services/document-generator
docker build -t allternit-document-generator .
docker run -p 8000:8000 -e API_KEY=your-key allternit-document-generator
```

---

## 4. Tool Connector

**Path:** `domains/agent-swarm/tools/document-generator/mod.ts`

**What it does:**
Bridges Allternit agents to the Document Generator FastAPI service. Provides Zod-typed input/output schemas and error handling.

**Schema:**
- **Input:** `action` (enum) + action-specific fields (title, topic, slide_count, key_points, etc.)
- **Output:** `success` + `request_id` + `artifact_type` + `file_name` + `sharepoint_file_url`

**Configuration:**
```typescript
const SERVICE_BASE_URL = process.env.DOCUMENT_GENERATOR_URL || "http://localhost:8000";
const API_KEY = process.env.DOCUMENT_GENERATOR_API_KEY || "your-secret-api-key";
```

**Registered in:** `domains/agent-swarm/tools/tool_registry.json`
- Tool ID: `document-generator`
- Entrypoint: `tools/document-generator/mod.ts`
- Safety level: `safe`

---

## 5. Integration Points

### 5.1 MCP Servers

**File:** `.mcp.json`

Claude Desktop / Cursor can call all 3 plugins via MCP:
```json
{
  "mcpServers": {
    "verceldeploy": { "command": "node", "args": ["plugins/verceldeploy-plugin/adapters/mcp.js"] },
    "remotioncard": { "command": "node", "args": ["plugins/remotioncard-plugin/adapters/mcp.js"] },
    "iosappbuild": { "command": "node", "args": ["plugins/iosappbuild-plugin/adapters/mcp.js"] }
  }
}
```

### 5.2 Plugin Manager UI State

**File:** `~/.allternit/plugin-manager/ui-state.json`

All 3 plugins are registered with metadata, entry points, and commands.

### 5.3 Tool Registry

**File:** `domains/agent-swarm/tools/tool_registry.json`

The `document-generator` tool is registered alongside existing tools (`autoland`, `canvas.list.courses`, `agent-browser.automation`, etc.).

### 5.4 Validation

**File:** `scripts/validate-codex-plugins.ts`

Run e2e validation:
```bash
cd ~/Desktop/allternit-workspace/allternit
npx tsx scripts/validate-codex-plugins.ts
```

Checks:
- All plugin manifests are valid JSON
- All plugin source files exist
- All skills have valid YAML frontmatter
- MCP config is valid JSON
- Tool registry contains `document-generator`
- Plugin manager UI state is valid

---

## 6. Data Flow

### Docx Generation Example

```
User asks: "Write a technical spec for the new auth API"
  ↓
Agent reads .agents/skills/docx/SKILL.md
  ↓
Agent clarifies: audience, tone, length
  ↓
Agent generates JSON outline
  ↓
Agent calls document-generator tool
  ↓
Connector (mod.ts) POSTs to /actions/generateStudyGuide
  ↓
FastAPI service (main.py) calls docx_generator.py
  ↓
DOCX file generated → optionally uploaded to SharePoint
  ↓
Response: { file_name, sharepoint_file_url }
  ↓
Agent returns file path + summary to user
```

### Vercel Deploy Example

```
User asks: "Deploy this Next.js app to production"
  ↓
Agent reads plugin manifest
  ↓
Agent calls verceldeploy-plugin execute()
  ↓
Plugin checks VERCEL_TOKEN, validates path
  ↓
Plugin spawns: vercel --yes --cwd ./my-app --prod
  ↓
Vercel CLI deploys → returns deployment URL
  ↓
Agent returns URL to user
```

---

## 7. File Locations Summary

| Component | Path |
|-----------|------|
| Vercel Plugin | `plugins/verceldeploy-plugin/` |
| Remotion Plugin | `plugins/remotioncard-plugin/` |
| iOS Builder Plugin | `plugins/iosappbuild-plugin/` |
| Docx Skill | `.agents/skills/docx/SKILL.md` |
| PowerPoint Skill | `.agents/skills/powerpoint/SKILL.md` |
| Mobile App Design Skill | `.agents/skills/mobile-app-design/SKILL.md` |
| Document Generator Service | `services/document-generator/` |
| Tool Connector | `domains/agent-swarm/tools/document-generator/mod.ts` |
| Integration Registry | `CODEX_PLUGINS_REGISTRY.json` |
| E2E Validation Script | `scripts/validate-codex-plugins.ts` |
| MCP Config | `.mcp.json` |
| Tool Registry | `domains/agent-swarm/tools/tool_registry.json` |
| Plugin Manager State | `~/.allternit/plugin-manager/ui-state.json` |

---

## 8. Next Steps to Activate

1. **Install plugin dependencies** (when ready):
   ```bash
   for d in verceldeploy-plugin remotioncard-plugin iosappbuild-plugin; do
     (cd plugins/$d && npm install)
   done
   ```

2. **Set secrets:**
   ```bash
   export VERCEL_TOKEN="..."
   export DOCUMENT_GENERATOR_API_KEY="..."
   ```

3. **Start the document generator service:**
   ```bash
   cd services/document-generator
   pip install -r requirements.txt
   uvicorn main:app --port 8000
   ```

4. **Run validation:**
   ```bash
   npx tsx scripts/validate-codex-plugins.ts
   ```
