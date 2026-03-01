# Agent Studio / TUI Alignment Analysis

**Date:** 2026-02-23  
**Purpose:** Ensure Agent Studio (ShellUI) matches TUI agent creation structure

---

## ✅ Alignment Status: MATCHED

The Agent Studio (`studio` view) and TUI agent creation are **aligned** through the shared API types.

---

## API Structure (Source of Truth)

### CreateAgentRequest (Backend - agents.rs)
```rust
pub struct CreateAgentRequest {
    pub name: String,
    pub description: String,
    #[serde(default = "default_agent_type")]
    pub agent_type: String,        // "worker" | "orchestrator" | "sub-agent"
    #[serde(default)]
    pub parent_agent_id: Option<String>,
    pub model: String,             // "gpt-4o", "claude-sonnet-4-20250514", etc.
    pub provider: String,          // "openai", "anthropic", etc.
    pub capabilities: Vec<String>,
    #[serde(default)]
    pub system_prompt: Option<String>,
    #[serde(default)]
    pub tools: Vec<String>,
    #[serde(default)]
    pub max_iterations: i32,       // default: 10
    #[serde(default)]
    pub temperature: f32,          // default: 0.7
    #[serde(default)]
    pub voice: Option<VoiceConfig>,
    #[serde(default)]
    pub config: serde_json::Value, // characterBlueprint, characterSeed, etc.
}
```

---

## Agent Studio (ShellUI) Implementation

### File: `6-ui/a2r-platform/src/views/AgentView.tsx`

**View Modes:**
- `list` - Agent grid/list with "Create Agent" button
- `create` - Multi-step creation form (`CreateAgentForm`)
- `edit` - Edit existing agent (`EditAgentForm`)
- `detail` - Agent detail view (`AgentDetailView`)

### CreateAgentForm Structure

**Form State (CreateAgentInput):**
```typescript
{
  name: string;
  description: string;
  type: 'worker' | 'orchestrator' | 'sub-agent';
  parentAgentId?: string;
  model: string;           // 'gpt-4o' (default)
  provider: string;        // 'openai' (default)
  capabilities: string[];
  systemPrompt: string;
  tools: string[];
  maxIterations: number;   // 10 (default)
  temperature: number;     // 0.7 (default)
  voice: {
    voiceId: string;
    enabled: boolean;
  };
}
```

**Creation Flow Steps:**
1. **Welcome** - Introduction & template selection
2. **Blueprint** - Character setup (coding, writing, analysis, etc.)
3. **Specialty** - Skill selection from specialty options
4. **Temperament** - Precision vs creativity slider
5. **Card Seed** - Domain focus, DoD, escalation rules, hard bans
6. **Voice** - Voice selection and configuration
7. **Review** - Final confirmation with forge animation

**Character System:**
- `CharacterLayerPanel` - Visual character stats
- `CHARACTER_SETUPS` - Predefined setups (coding, writing, etc.)
- `CHARACTER_SPECIALTY_OPTIONS` - Skills per setup
- `computeCharacterStats` - Stats calculation
- `recordCharacterTelemetry` - Telemetry for evolution

---

## TUI Integration Points

### TUI Routes (`tui_routes.rs`)
```rust
pub struct AgentInfo {
    pub id: String,
    pub name: String,
    pub description: Option<String>,
}

// GET /api/v1/app/agents
async fn get_app_agents() -> Json<Vec<AgentInfo>>
```

### Agent Routes (`agents.rs`)
```rust
// Core endpoints used by both TUI and Agent Studio:
POST   /api/v1/agents              # Create agent
GET    /api/v1/agents              # List agents
GET    /api/v1/agents/:id          # Get agent
PUT    /api/v1/agents/:id          # Update agent
DELETE /api/v1/agents/:id          # Delete agent
POST   /api/v1/agents/:id/run      # Start run
GET    /api/v1/agents/:id/runs     # List runs
```

---

## Alignment Verification

| Field | API (TUI) | Agent Studio | Status |
|-------|-----------|--------------|--------|
| name | ✅ String | ✅ string | ✅ Match |
| description | ✅ String | ✅ string | ✅ Match |
| agent_type | ✅ String | ✅ 'worker'\|'orchestrator'\|'sub-agent' | ✅ Match |
| parent_agent_id | ✅ Option<String> | ✅ string \| undefined | ✅ Match |
| model | ✅ String | ✅ string | ✅ Match |
| provider | ✅ String | ✅ string | ✅ Match |
| capabilities | ✅ Vec<String> | ✅ string[] | ✅ Match |
| system_prompt | ✅ Option<String> | ✅ string | ✅ Match |
| tools | ✅ Vec<String> | ✅ string[] | ✅ Match |
| max_iterations | ✅ i32 | ✅ number | ✅ Match |
| temperature | ✅ f32 | ✅ number | ✅ Match |
| voice | ✅ Option<VoiceConfig> | ✅ {voiceId, enabled} | ✅ Match |
| config | ✅ serde_json::Value | ✅ object | ✅ Match |

---

## Agent Studio Enhancement for TUI Parity

### Current Gaps:
1. **Interactive Capsule Tab** - Not yet implemented (P3.9.8)
2. **Template Gallery** - Partial (blueprint selection exists)
3. **Debug/Preview Mode** - Not yet implemented

### Recommended Additions:

```typescript
// Agent Studio tabs for P3.9.8
interface AgentStudioTabs {
  // Existing
  'create': CreateAgentForm;       // Multi-step creation
  'edit': EditAgentForm;           // Edit agent
  'detail': AgentDetailView;       // Agent details
  
  // New for P3.9
  'interactive-capsule': {         // Interactive capsule preview
    capsuleId: string;
    surface: ToolUISurface;
    debugMode: boolean;
  };
  'template-gallery': {            // Extended template browser
    templates: AgentTemplate[];
    categories: string[];
  };
  'character-debug': {             // Character system debugger
    telemetry: CharacterTelemetryEvent[];
    stats: CharacterStats;
  };
}
```

---

## Integration Architecture

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   TUI (Rust)    │────▶│  API (axum)     │◀────│ Agent Studio    │
│                 │     │                 │     │ (React/SolidJS) │
│ - Agent creation│     │ - agents.rs     │     │                 │
│ - List agents   │     │ - tui_routes.rs │     │ - Create form   │
│ - Run agent     │     │                 │     │ - Edit form     │
└─────────────────┘     └─────────────────┘     └─────────────────┘
                               │
                               ▼
                        ┌─────────────────┐
                        │  Agent Store    │
                        │  (SQLite/DB)    │
                        └─────────────────┘
```

---

## Conclusion

✅ **Agent Studio and TUI are aligned** through the shared REST API (`agents.rs`)

✅ **Both use the same CreateAgentRequest/CreateAgentInput structure**

✅ **Agent Studio adds UI enhancements:**
- Multi-step wizard flow
- Character blueprint system
- Voice configuration UI
- Real-time telemetry

🔄 **For P3.9.8:** Add Interactive Capsule tab to Agent Studio for testing interactive surfaces during agent development.

---

**Next:** Proceed to P3.10 Chrome Extension
