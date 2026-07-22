# Agent Creation Wizard — Brutal Audit Report

**Date:** 2026-04-25
**Auditor:** Kimi Code CLI
**Scope:** `src/views/agent-view/components/CreateAgentForm.tsx`, agent types, Prisma schema, plugin runtime, tool registry

---

## Executive Summary

The user is **100% correct** to be angry. The Allternit agent creation wizard is a **masterclass in UI theater** — 7 steps of glossy animations, RPG-style character stats, and personality sliders that create the *illusion* of deep configuration, while the actual functional difference between agents boils down to: **name + systemPrompt + model + a string array called "capabilities"**.

There are **two parallel wizard implementations** in the codebase (a symptom of architectural drift), neither of which connects to the actual plugin/MCP runtime in a meaningful way. The backend stores agents as nearly identical JSON blobs, and the "character layer" is a fantasy stat sheet that does not affect LLM inference.

---

## 1. The Two Wizards (Yes, Two)

| Wizard | Location | Steps | Status |
|--------|----------|-------|--------|
| **CreateAgentForm** (the "fancy" one) | `src/views/agent-view/components/CreateAgentForm.tsx` | 7-step: Welcome → Identity → Personality → Character → Avatar → Runtime → Workspace → Review | **Active/Primary** |
| **AgentCreationWizard** | `src/components/agents/AgentCreationWizard.tsx` | 4-step: Identity → Character → Tools → Review | **Secondary/Modal** |

The 7-step wizard is the one the user is referring to. It is **3,165 lines** of animated glassmorphism. The 4-step wizard is a simpler modal that appears to be used in other contexts. They don't share state or components.

---

## 2. Step-by-Step: Real vs. Fake

### Step 1: **Welcome** — ❌ PURE UI FLUFF
- Animated floating particles, orbiting dots, spring-physics icon
- 3 feature cards ("Define Personality", "Equip Tools", "Deploy & Monitor")
- **Nothing stored.** Nothing sent to backend. It's a PowerPoint slide with a "Get Started" button.

### Step 2: **Identity** — ✅ REAL
Collects and stores:
- `name` → stored in DB
- `description` → stored in DB
- `type` (orchestrator/sub-agent/worker/specialist/reviewer) → stored in DB
- `parentAgentId` → stored in DB

**Verdict:** This is legitimate. The only step so far that actually matters.

### Step 3: **Personality** — ❌ UI FLUFF / COSMETIC
Collects:
- **Big Five sliders**: Openness, Conscientiousness, Extraversion, Agreeableness (0-100%)
- **Communication Style**: Direct / Analytical / Collaborative / Creative
- **Work Style**: Independent / Team-Oriented / Requires Supervision
- **Decision Making**: Data-Driven / Intuitive / Consensus-Based
- **Personality Traits** (tags): e.g., "Stoic", "Sarcastic"
- **Backstory** (textarea)

**Where it goes:** All dumped into `config.personality` as a JSON blob.

**Does it affect the agent?** **NO.** The backend Prisma schema has no personality fields. The `agent.service.ts` does not read these values when constructing prompts or calling the LLM. The `systemPrompt` is the only thing that shapes behavior, and the personality sliders do not auto-generate into the system prompt. These are **decorations**.

### Step 4: **Character** — ⚠️ MIXED (Mostly Fake)

**Real parts:**
- `setup` (coding/creative/research/operations/generalist) → affects capability preset strings
- `specialtySkills` → stored in config, used in role card generation
- `hardBans` → stored in config (but enforcement is unclear)
- `systemPrompt` / voice rules → stored, somewhat real

**Fake parts (the RPG stat sheet):**
- **"Projected Level" (Lv 1-20)**: Computed from fake XP formulas. Not stored as a DB column. Not used by the LLM.
- **"Class"** (Builder, Creator, Analyst, Operator): Pure label. No runtime effect.
- **"XP"**: Calculated from `completed_missions*1.3 + step_completed*0.08`. This telemetry does not actually exist in a tracked form.
- **Setup Stats with progress bars**: "Implementation Reliability" (RIG), "Code Throughput" (THR), "Security Hygiene" (SAF), "Debug/Test Fidelity" (FIT) — these are **fantasy metrics**. They have formulas like `clamp((mission_success_rate*0.45 + step_completion_rate*0.35)*99,0,99)` but the input variables (`mission_success_rate`, etc.) are not actually measured or tracked per-agent. The values are **derived from hardcoded probe context defaults** (`formulaProbeContext()` returns `mission_success_rate: 0.7`, etc.).
- **Specialty Scores**: Numbers next to skills (e.g., "TypeScript 12"). Meaningless.

**The hard truth:** The entire "Character Profile" step is a **gamification skin** over what should be prompt engineering and tool selection. The "stats" are as real as a D&D character sheet.

### Step 5: **Avatar** — ❌ PURE UI FLUFF
- Full avatar creator with body shapes (round/square/hex/diamond/cloud), eye presets (round/wide/narrow/curious/starry), antenna styles, colors, glow effects, emotions
- Stored in `avatar` JSON column as `AvatarConfig`
- **Does not affect agent behavior in any way.** It is purely visual decoration for the UI card.

### Step 6: **Runtime** — ✅ REAL (But Incomplete)

Collects and stores:
- `model` + `provider` → stored, functional
- `temperature` → stored, functional
- `maxIterations` → stored, functional
- `voice` (enabled/voiceId/engine/autoSpeak/speakOnCheckpoint) → stored
- `capabilities` → stored as string array
- `systemPrompt` → stored, functional (the single most important field)
- `tools` → stored as string array

**What's MISSING here:**
- **No actual plugin selection.** The "Capabilities Marketplace" shows generic string toggles like `code-generation`, `file-operations`, `web-search` — not the actual plugin system.
- **No MCP server configuration per agent.** MCP integrations exist in the codebase (`src/lib/ai/mcp/`) but are not wired into the wizard.
- **No tool-level permissions.** The wizard has "hard bans" in the Character step, but no granular enable/disable of specific tools (e.g., allow `read_file` but not `write_file`).
- **No model endpoint / API key override.**
- **No memory/retrieval configuration** (RAG, knowledge base, vector store).

### Step 7: **Workspace** — ⚠️ COSMETIC / DISCONNECTED
- Workspace layer toggles: cognitive, identity, governance, skills, business
- Generates markdown file previews (e.g., `identity.yaml`)
- Claims files are "committed to your agent's capsule repository"

**Reality check:** The workspace initialization calls `agentWorkspaceService.create()` and posts to `/api/v1/agents/{id}/workspace/initialize`, but the actual workspace layer config (`workspaceLayers`) is just a boolean JSON blob. There is no evidence these layers enforce runtime behavior boundaries. The "Configuration Preview" is a `<pre>` tag rendering static text — the agent does not actually read these YAML files at runtime.

### Step 8: **Review** — ❌ UI FLUFF
- Displays the agent card with animated "Forge" sequence
- "Forging {agentName}..." with fake stages: "Initializing neural pathways...", "Calibrating character layer..."
- 6-second artificial delay before API call
- **This is pure theater.** The backend does not "forge" anything. It inserts a row into SQLite.

---

## 3. What the Backend Actually Stores

From `prisma/schema.prisma`, the `Agent` model:

```prisma
model Agent {
  id            String   @id @default(cuid())
  userId        String
  name          String
  description   String?
  type          String   @default("worker")
  parentAgentId String?
  model         String
  provider      String   // openai | anthropic | local | custom
  capabilities  String?  // JSON string[]
  systemPrompt  String?  // THE ONLY THING THAT MATTERS
  tools         String?  // JSON string[]
  maxIterations Int      @default(10)
  temperature   Float    @default(0.7)
  config        String?  // JSON Record<string, unknown> — WHERE EVERYTHING ELSE GETS DUMPED
  status        String   @default("idle")
  workspaceId   String?
  avatar        String?  // JSON AvatarConfig
  identityKey   String?  // Ed25519 public key (unused?)
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt
  lastRunAt     DateTime?
}
```

**Key insight:** Everything from the Personality step, Character step (except setup), Avatar step, and Workspace step gets serialized into a single `config` JSON blob. The backend does not validate it, index it, or use it at inference time. It is a **junk drawer**.

---

## 4. The Plugin/Skill System: Exists, But Disconnected

The codebase **does** have a real plugin architecture:

| Component | Status |
|-----------|--------|
| `src/plugins/plugin.types.ts` | Well-defined types for commands, skills, connectors, MCPs, webhooks |
| `src/lib/plugins/plugin-runtime.ts` | Unified runtime for built-in + vendor plugins |
| `src/plugins/built-in/` | 10 built-in plugins: code, data, flow, image, research, slides, swarms, video, website, assets |
| `src/plugins/vendor/` | 15+ vendor plugins: legal, finance, HR, sales, marketing, etc. |
| `src/lib/ai/mcp/` | MCP client + OAuth provider |
| `src/lib/agents/tool-registry.store.ts` | Zustand store for tool registration, session configs, CLI tools |

**But the wizard completely ignores this.**

In `CreateAgentForm.tsx`, the "Capabilities Marketplace" (Runtime step) renders `CAPABILITY_CATEGORIES` with hardcoded icons and string IDs. It does **not** query `pluginRuntime.listExecutablePlugins()`. It does **not** read from `useToolRegistryStore`. It does **not** show MCP servers. The agent's `tools` array is just strings like `"file_write"`, `"search"`, `"browser"` — with no connection to the actual tool registry.

The `PluginRegistryView.tsx` (`src/views/cowork/PluginRegistryView.tsx`) is a completely separate page that shows telemetry providers with toggle switches. It doesn't let you attach plugins to agents.

---

## 5. What Makes Agents "Unique" Functionally?

**Brutal answer: Almost nothing.**

Two agents created through the wizard will be functionally identical if they have:
- The same `model` (e.g., `gpt-4o`)
- The same `systemPrompt`
- The same `tools` array

The "Personality" sliders, "Character" stats/level/class, "Avatar" colors, and "Workspace" layers do **not** change the LLM API call. They are metadata.

The specialist templates (`src/lib/agents/agent-templates.specialist.ts`) are the closest thing to real differentiation — they pre-fill different `systemPrompt` values and capability strings. But that's just **prompt engineering**, not agent architecture. A "Frontend Developer" agent and a "Backend Developer" agent are both Claude 3.5 Sonnet with different paragraphs of instructions.

---

## 6. Missing Real Configuration (The Gap vs. Gemini / Enterprise)

| What Gemini Enterprise Asks For | What Allternit Asks For | Status |
|--------------------------------|------------------------|--------|
| Model selection | Model selection | ✅ Present |
| Tools / Functions | Generic capability toggles | ⚠️ Too vague |
| Knowledge sources / RAG | Nothing | ❌ Missing |
| Instructions / System prompt | System prompt editor | ✅ Present |
| Function calling schema | Nothing | ❌ Missing |
| Safety settings / Grounding | "Hard bans" (text only) | ⚠️ Weak |
| Deployment / Scaling config | Nothing | ❌ Missing |
| API credentials per agent | Nothing | ❌ Missing |
| Memory / Context window config | Nothing | ❌ Missing |
| Rate limits / Budget | Nothing | ❌ Missing |

---

## 7. Recommendations

### Immediate (High Impact, Low Effort)
1. **Kill the 6-second "Forge" animation.** It's insulting. Call the API immediately.
2. **Remove or demote the RPG stats** (Level, XP, Class, RIG/THR/SAF/FIT). They are fake and users can tell. If you want gamification, make it actually track real metrics from agent runs.
3. **Merge Personality into System Prompt.** The Big Five sliders should either auto-generate prompt text or be removed. Don't store invisible config.
4. **Connect the Runtime step to the real plugin registry.** Replace the generic capability toggles with actual plugin/skill selection from `pluginRuntime.listExecutablePlugins()` and `useToolRegistryStore`.

### Medium Term
5. **Add a real Tool Configuration step.** Let users enable/disable specific tools per agent (Read, Edit, Bash, WebSearch, MCP tools) with permission levels.
6. **Add Knowledge Base / RAG configuration.** Let agents be attached to memory documents, vector stores, or uploaded files.
7. **Add MCP Server selection.** The MCP infrastructure exists but is not exposed in the wizard.
8. **Remove the redundant 4-step wizard.** Maintain one wizard, not two.

### Long Term
9. **Make agents actually different at runtime.** If an agent is a "Coding Specialist" with `temperature: 0.3`, that should affect the actual LLM call. If it has "hard bans," those should be enforced by the tool execution layer, not just stored as text.
10. **Replace the `config` junk drawer with typed schema.** The backend should validate and understand character config, not just serialize it as opaque JSON.

---

## Bottom Line

The Allternit agent wizard is **3000+ lines of beautiful, meticulously animated UI wrapped around ~50 lines of actual configuration.** It creates the emotional experience of building a bespoke AI teammate while producing what is essentially: a named GPT-4o wrapper with a custom system prompt.

The fix is not to add more animations — it's to connect the wizard to the actual plugin runtime, tool registry, and MCP system that already exist in the codebase but are sitting on the sidelines.
