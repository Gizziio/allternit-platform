# Allternit Video Brief

> **Remotion Video Content Plan**
> For: Allternit Overview/Demo Video
> Length: 2-3 minutes

---

## Allternit Brand Colors (Sand/Nude Palette)

> **Official brand colors from design system**

| Color Name | Hex Code | Usage |
|------------|----------|-------|
| **Primary** | `#D4B08C` | nude-400, main brand (brighter for dark theme) |
| **Secondary** | `#B08D6E` | sand-500, accents |
| **Accent** | `#D97757` | warm accent for highlights |
| **Light Text** | `#ECECEC` | Primary text for dark theme |
| **Dark Background** | `#2A1F16` | sand-950, backgrounds |
| **Sand 300** | `#D4BFA8` | hover states |
| **Sand 900** | `#4A3829` | deep brown |

### Full Color Scale
```
--nude-400: #D4B08C  ← PRIMARY (use this!)
--sand-500:  #B08D6E  ← Secondary
--sand-300:  #D4BFA8
--sand-900:  #4A3829
--sand-950:  #2A1F16  ← Dark background
--accent:    #D97757
```

---

## Logo Usage

### 1. AllternitLogo (Brand Logo)
**File:** `surfaces/allternit-platform/src/components/AllternitLogo.tsx`

- Sparkles icon with gradient ring
- Colors: primary `#D4B08C`, secondary `#B08D6E`, accent `#D97757`
- Variants: horizontal, stacked, icon-only
- Sizes: sm (20px), md (28px), lg (40px)

### 2. ArchitectLogo (Persona Logo)
**File:** `surfaces/allternit-platform/src/components/ai-elements/ArchitectLogo.tsx`

- Geometric, technical persona for Allternit
- 12 rectilinear blocks arranged in a circle
- Central crosshair square
- **5 States:** idle, listening, thinking, speaking, asleep
- Uses `currentColor` - inherits from parent
- **For video:** Use brand primary `#D4B08C`

---

## Video Structure

### Act 1: The Problem (0:00 - 0:30)

**Hook:** "Every company is building AI agents. Almost none have the infrastructure to run them safely."

**Visual:**
- Split screen showing fragmented AI tools chaos
- Red highlights for: vendor lock-in, no audit trails, security gaps
- Text overlay: "6+ tools just to run one agent"

**Key Points:**
- Most teams stitch together 6+ different tools
- No governance, no audit trails
- Vendor lock-in with every major AI provider

---

### Act 2: The Solution - Allternit (0:30 - 1:30)

**Visual:** Clean 8-layer architecture animation

**Script:**
"Introducing Allternit — The Enterprise Agentic Operating System"

**Layer Reveal:**
```
┌─────────────────────────────────────┐
│  LAYER 7: Apps                      │  ← Shell, Terminal, API
├─────────────────────────────────────┤
│  LAYER 6: UI                        │  ← React components
├─────────────────────────────────────┤
│  LAYER 5: Agents                    │  ← Native agent workspaces
├─────────────────────────────────────┤
│  LAYER 4: Services                  │  ← Memory, Registry, Voice
├─────────────────────────────────────┤
│  LAYER 3: Adapters                  │  ← Vendor integrations
├─────────────────────────────────────┤
│  LAYER 2: Governance                │  ← Policy, Audit, WIH
├─────────────────────────────────────┤
│  LAYER 1: Kernel                    │  ← Execution, Sandboxing
├─────────────────────────────────────┤
│  LAYER 0: Substrate                 │  ← Intent Graph, WASM
└─────────────────────────────────────┘
```

---

### Act 3: Key Differentiators (1:30 - 2:15)

#### 3.1 No Vendor Lock-In 🗝️
**Visual:** Padlock opening, data staying within company boundary
**Script:** "Your data. Your models. Your infrastructure. No vendor lock-in. Ever."

#### 3.2 Local Models + BYOC (Bring Your Own Compute) 💻
**Visual:** Logos: Ollama, LM Studio, + "Your GPU" graphic
**Script:** "Run Ollama. Run LM Studio. Any OpenAI-compatible model. Or bring your own VPS. Your GPU, your rules."

**Supported:**
- Ollama (llama3.2, llama3.1, codellama, mistral)
- LM Studio
- Any OpenAI-compatible API
- BYOC-VPS (Bring Your Own Compute VPS)

#### 3.3 Deterministic Behavior 🎯
**Visual:** Same input → Same output (Intent Graph animation)
**Script:** "Deterministic. Predictable. Every action traceable through the Intent Graph."

#### 3.4 Pro-Agent Platform — Native OpenCLAW 🧠
**Visual:** "OpenCLAW" text → morphs to "Native" → agent workspace files appearing
**Script:** "Built on the OpenCLAW philosophy — now native. This is a pro-agent platform."

#### 3.5 Agent Workspace Files 📁
**Visual:** File tree expanding animation
```
agent-workspace/
├── IDENTITY.md    ← Who am I?
├── SOUL.md        ← Personality & voice
├── POLICY.md      ← Dynamic policy overrides
├── TOOLS.md       ← Tool configuration
├── BRAIN.md       ← Task graph
├── MEMORY.md      ← Memory index
├── VOICE.md       ← TTS configuration
├── USER.md        ← User preferences
├── PLAYBOOK.md    ← Operational procedures
├── skills/        ← Skill definitions
│   ├── filesystem/
│   ├── git/
│   └── ...
└── business/      ← Client topology
```
**Script:** "A full agent in a folder. Portable. Version-controllable. Deploy anywhere. Just copy the folder."

#### 3.6 Features & Modes 🎨
**Visual:** Three mode cards with brand colors
**Script:** "Three modes for every workflow — Chat, Cowork, Code."

| Mode | Description | When to Use |
|------|-------------|-------------|
| **Chat** | Conversation, research | Quick questions, exploration |
| **Cowork** | Collaboration, review | Working together, approvals |
| **Code** | Development, execution | Building, testing, running |

---

### Act 4: Demo / Screen Recording (2:15 - 2:45)

**Scene 1: Shell Launch + Agent Selection**
```
1. Open Shell app
2. Select "Code Assistant" from templates
3. Watch IDENTITY.md, SOUL.md, POLICY.md load
4. Agent ready indicator appears
```

**Scene 2: Policy Gate (Governance)**
```
Agent wants to: "Delete production database"
→ Policy Engine: [CHECK]
→ Rule triggered: "destructive: require_approval"
→ UI shows: 🔴 BLOCKED - User approval required
→ Audit log entry created
```

**Scene 3: Model Selection (Local + BYOC)**
```
User: Settings → Model
→ Options appear:
  ├── OpenAI (cloud)
  ├── Anthropic (cloud)
  ├── Ollama (local) ← SELECT
  │   └── llama3.2 ✓
  └── LM Studio (local)
→ Status: Connected to local Ollama
```

**Scene 4: Mode Switching**
```
Toggle between Chat → Cowork → Code
Show UI adapting to each mode
Brand color shifts subtly
```

---

### Act 5: Call to Action (2:45 - 3:00)

**Visual:** ArchitectLogo (thinking state) + tagline

**Script:**
"Allternit."
"No vendor lock-in. Full sovereignty. Native pro-agent."
"Build agents with confidence."
"[allternit.dev]"

---

## Animation Specs (Remotion)

### Color Variables
```css
--brand-primary:   #D4B08C;  /* nude-400 - USE THIS */
--brand-secondary: #B08D6E;  /* sand-500 */
--brand-accent:   #D97757;   /* warm accent */
--brand-dark:     #2A1F16;   /* sand-950 - backgrounds */
--brand-text:     #ECECEC;   /* light text */
--sand-300:       #D4BFA8;
--sand-900:       #4A3829;
--success:        #22c55e;
--danger:         #ef4444;
```

### Animation Presets
1. **ArchitectLogo** - Use the 5 states (idle, listening, thinking, speaking, asleep)
2. **Layer Stack** - Slide up with stagger (100ms per layer)
3. **Agent File Tree** - Recursive expand with 50ms stagger
4. **Policy Shield** - Scale in + pulse + checkmark/X
5. **Intent Graph** - Nodes pop, edges draw connecting lines
6. **Mode Cards** - Slide + subtle glow in brand color
7. **Data Flow** - Particles using brand primary (#D4B08C)

---

## Voiceover Script

**[0:00 - 0:08]**
"Every company is building AI agents. But here's the problem — they're all doing it wrong."

**[0:08 - 0:18]**
"Most teams stitch together six different tools, cross their fingers, and hope nothing breaks. No governance. No audit trails. Vendor lock-in with every provider."

**[0:18 - 0:30]**
"We're told to move fast and break things. But when AI agents have access to your infrastructure... breaking things gets expensive."

**[0:30 - 0:40]**
"Introducing Allternit — the Enterprise Agentic Operating System."

**[0:40 - 1:00]**
"Allternit gives you a complete infrastructure stack purpose-built for AI agents. From the substrate up."

**[1:00 - 1:15]**
"Layer zero provides the foundation — intent graphs for full provenance, WASM sandboxing for secure execution."

**[1:15 - 1:25]**
"The kernel handles all execution. Tools, processes, sandboxing — all in one place."

**[1:25 - 1:35]**
"Governance is built in, not bolted on. Every action passes through policy before execution. Every decision is logged."

**[1:35 - 1:45]**
"Here's what makes Allternit different. No vendor lock-in. Ever. Your data. Your models. Your infrastructure."

**[1:45 - 1:55]**
"Run local models with Ollama. Or OpenAI-compatible API. Bring your own LM Studio. Any compute to your VPS. Your GPU, your rules."

**[1:55 - 2:05]**
"Deterministic behavior. Same input, same output. Every action traceable through the Intent Graph."

**[2:05 - 2:15]**
"This is a pro-agent platform. Built on OpenCLAW — now native. Full agent workspaces — IDENTITY, SOUL, POLICY, TOOLS, BRAIN, MEMORY — all in a folder."

**[2:15 - 2:25]**
"Copy the folder, you copied the agent. Portable. Version-controllable. Deploy anywhere."

**[2:25 - 2:35]**
"Three modes for every workflow. Chat, Cowork, Code. Pick your vibe, get things done."

**[2:35 - 2:45]**
[SCREEN RECORDING]

**[2:45 - 2:55]**
"Build agents with confidence. Allternit."

**[2:55 - 3:00]**
"allternit.dev"

---

## Screen Recording Checklist

Record these 7 scenes at 1920x1080:

| # | Scene | What to Show |
|---|-------|--------------|
| 1 | Shell Launch | App opens, dark theme, brand colors visible |
| 2 | Agent Selection | Browse templates, select "Code Assistant" |
| 3 | Workspace Load | Files loading (IDENTITY, SOUL, POLICY appear) |
| 4 | Policy Gate | Attempt destructive action, show block + approval |
| 5 | Model Switch | Settings → Models → Select Ollama |
| 6 | Mode Toggle | Switch between Chat → Cowork → Code |
| 7 | Terminal | Run a simple agent task end-to-end |

**Recording Tips:**
- ✅ Use dark mode throughout
- ✅ Show brand primary color `#D4B08C` in UI elements
- ✅ Capture at 1920x1080 minimum
- ✅ Use built-in screen recording (Cmd+Shift+5 on Mac)

---

## Export Specs

- **Resolution**: 1920x1080
- **Frame Rate**: 30fps
- **Format**: MP4 (H.264)
- **Audio**: External voiceover (record after script approval)

---

## What You Need to Provide

| Item | Status |
|------|--------|
| Voiceover audio | ❓ Pending |
| Screen recordings (7 scenes) | ❓ Pending |
| Script approval | ❓ Pending |

---

## Next Steps

1. ✅ Brand colors confirmed (#D4B08C primary)
2. ✅ Logo confirmed (ArchitectLogo + AllternitLogo)
3. ✅ Key differentiators integrated
4. ❓ Approve script
5. ❓ Record screen recordings
6. ❓ Build Remotion animations
7. ❓ Produce final video
