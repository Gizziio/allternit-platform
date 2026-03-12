# Agent Mode in Gizzi Code Terminal - Understanding & Implementation

## What is Agent Mode?

**Agent Mode** in the terminal is fundamentally different from the a2r-platform web UI. In the terminal context:

### Current Implementation (What We Have):

**Agent Toggle is a STATE FLAG, not a UI component**

When you toggle "Agent ON" in the terminal:
1. ✅ Sets a flag: `agent-enabled = true`
2. ✅ Persists preference in KV store
3. ✅ Makes agent available for commands
4. ❌ Does NOT mount a visible agent UI (like in a2r-platform)
5. ❌ Does NOT show mascot animations
6. ❌ Does NOT show agent surface mode UI

### What Agent Mode DOES in Terminal:

```typescript
// When agent is enabled:
{
  enabled: true,
  // Agent can now:
  - Respond to @mentions in prompts
  - Execute agent commands (/agent, /skills)
  - Run background tasks
  - Access agent skills
  - Use agent-specific features
}
```

### What Agent Mode DOES NOT Do (Yet):

```typescript
// Does NOT:
- Show Gizzi mascot animations (like a2r-platform)
- Display agent surface mode UI
- Show agent thoughts/status visually
- Animate agent entering/exiting
- Display agent mode selection pills
```

---

## Comparison: Terminal vs a2r-platform

### a2r-platform (Web UI):
```
Agent Mode ON = Full Visual Experience
├── Gizzi mascot animations
├── Agent surface mode selector (chat/cowork/code/browser)
├── Agent thoughts display
├── Entry/exit animations
├── Status indicators
└── Interactive agent UI
```

### Gizzi Code (Terminal):
```
Agent Mode ON = State Flag Only
├── enabled: true
├── Can use @mentions
├── Can run agent commands
├── Can access skills
└── NO visual agent UI (yet)
```

---

## Why the Difference?

### Terminal Limitations:
1. **Text-only interface** - Can't render complex animations
2. **Limited screen real estate** - TUI needs to be compact
3. **Different interaction model** - Keyboard-driven, not mouse-driven
4. **Performance constraints** - Can't run complex UI in terminal

### What Makes Sense for Terminal:

**Agent Mode should enable:**
- ✅ @mention routing to agents
- ✅ Agent skill execution
- ✅ Background task processing
- ✅ Agent command availability
- ✅ Session state management

**Agent Mode should NOT try to replicate:**
- ❌ Mascot animations (not feasible in TUI)
- ❌ Visual agent selector (use commands instead)
- ❌ Animated transitions (not suitable for terminal)

---

## Recommended Terminal Agent Mode Implementation

### What We Should Build:

#### 1. **Agent Status Indicator** (Subtle)
```
┌─────────────────────────────────────────┐
│  GIZZI CODE              [Agent: ON] ● │
└─────────────────────────────────────────┘
```
- Small indicator showing agent state
- Green dot when ON, gray when OFF
- Clickable to toggle

#### 2. **Agent Command Hints** (Contextual)
```
When Agent is ON:
┌─────────────────────────────────────────┐
│  @agent-name to mention specific agent  │
│  /skills to list available skills       │
│  /agent-status to check agent state     │
└─────────────────────────────────────────┘
```

#### 3. **Agent Response Display** (When Active)
```
┌─────────────────────────────────────────┐
│  [User]: @research analyze this code    │
│                                         │
│  [🤖 Research Agent]:                   │
│  Analyzing codebase...                  │
│  Found 3 relevant files...              │
│                                         │
│  [Status: ● Working]                    │
└─────────────────────────────────────────┘
```

#### 4. **Agent Selection** (Via Commands, Not UI)
```bash
# Instead of visual selector, use commands:
gizzi agent select research
gizzi agent list
gizzi agent status
```

---

## What Agent Mode SHOULD Do in Terminal

### Core Capabilities:

1. **@mention Routing**
   - When agent is ON: `@agent-name` routes to that agent
   - When agent is OFF: `@agent-name` is treated as plain text

2. **Agent Commands**
   - `/agent select <name>` - Select active agent
   - `/agent list` - List available agents
   - `/agent status` - Show current agent state
   - `/skills` - List available skills

3. **Background Processing**
   - Agent can run tasks in background
   - Status shown in status bar
   - Results delivered when complete

4. **Session Management**
   - Agent maintains session context
   - Remembers conversation history
   - Can reference previous interactions

5. **Skill Execution**
   - Access to agent skills
   - Browser automation
   - File operations
   - Code execution

---

## What We Need to Implement

### Phase 1: Basic Agent Integration (Already Done)
- ✅ Agent toggle state management
- ✅ Persistence in KV store
- ✅ Toggle UI component

### Phase 2: Agent Indicators (To Do)
- [ ] Show agent status in header
- [ ] Visual indicator (dot/icon)
- [ ] Click to toggle
- [ ] Tooltip with agent info

### Phase 3: Agent Commands (To Do)
- [ ] `/agent` command group
- [ ] Agent selection
- [ ] Agent status display
- [ ] Skill listing

### Phase 4: @mention Integration (To Do)
- [ ] Parse @mentions in prompts
- [ ] Route to selected agent
- [ ] Show agent responses
- [ ] Agent response formatting

### Phase 5: Agent Status Display (To Do)
- [ ] Show agent working state
- [ ] Progress indicators
- [ ] Task completion notifications
- [ ] Error handling

---

## Alignment with a2r-platform

### What Should Be Consistent:

1. **Agent Mode Concept**
   - Both: Agent can be ON/OFF
   - Both: Agent processes requests differently when ON
   - Both: Agent has access to skills/tools

2. **Agent Selection**
   - a2r-platform: Visual selector
   - Terminal: Command-based (`/agent select`)
   - Both: Can switch between agents

3. **Agent Capabilities**
   - Both: Access to same skills
   - Both: Can execute same tasks
   - Both: Maintain session context

### What Should Be Different:

1. **Visual Presentation**
   - a2r-platform: Full UI with animations
   - Terminal: Text-based, minimal indicators

2. **Interaction Model**
   - a2r-platform: Mouse + visual selection
   - Terminal: Keyboard + commands

3. **Feedback Mechanism**
   - a2r-platform: Visual animations, mascot
   - Terminal: Text responses, status indicators

---

## Recommendations

### For Terminal Agent Mode:

**DO:**
- ✅ Keep it simple (state flag + commands)
- ✅ Use text-based indicators
- ✅ Leverage keyboard shortcuts
- ✅ Focus on functionality over visuals
- ✅ Integrate with existing terminal workflow

**DON'T:**
- ❌ Try to replicate a2r-platform UI
- ❌ Add complex animations
- ❌ Use valuable screen space for agent UI
- ❌ Make it visually distracting
- ❌ Overcomplicate the interaction

### What to Build Next:

1. **Agent Status in Header** (Simple indicator)
2. **Agent Commands** (`/agent` command group)
3. **@mention Parsing** (Route to agents)
4. **Agent Response Display** (Text-based)
5. **Agent Status Updates** (Working/done states)

---

## Conclusion

**Agent Mode in the terminal is about FUNCTIONALITY, not VISUALS.**

It enables agent capabilities without trying to replicate the a2r-platform visual experience. The terminal agent is:
- Subtle (small indicator)
- Command-driven (not UI-driven)
- Functional (focus on capabilities)
- Integrated (part of terminal workflow)

This is the correct approach for a terminal-based agent system.
