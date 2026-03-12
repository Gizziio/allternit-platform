# ConsoleDrawer & A2rOS Integration Analysis

## Current ConsoleDrawer Tabs (15 total)

### ✅ Fully Implemented:
| Tab | Component | Status | Description |
|-----|-----------|--------|-------------|
| queue | KanbanBoard | ✅ | WIH-based kanban (open/ready/signed/blocked/closed) |
| terminal | UnifiedTerminal | ✅ | Single session terminal |
| logs | LogsView | ✅ | Log viewer |
| context | ContextView | ✅ | Context management |
| changes | ChangeSetReview | ✅ | Code changes review |
| agents | OrchestrationView | ✅ | Agent orchestration |
| swarm | SwarmMonitor | ✅ | Multi-agent monitoring |
| policy | PolicyManager | ✅ | Policy governance |
| security | SecurityDashboard | ✅ | Security dashboard |
| executions | RunsView | ✅ | Execution runs |
| scheduler | SchedulerView | ✅ | Job scheduling |
| dag-graph | KanbanDAG | ✅ | DAG visualization |
| trace | RunTraceView | ✅ | Execution tracing |
| problems | ProblemsView | ✅ | Error/problem display |

### ⚠️ Placeholder:
| Tab | Component | Status | Description |
|-----|-----------|--------|-------------|
| receipts | Placeholder div | 🚧 | "Coming Soon" text |

### ❌ Missing from A2rConsole:
| Feature | Status | Description |
|---------|--------|-------------|
| Automation Hub | ❌ | Sequences, triggers, progress tracking |
| Multi-Session Terminal | ❌ | TerminalTabs with real PTY |

---

## What Needs to Be Built

### 1. ConsoleDrawer Additions

**A. Add "automation" Tab**
- Add to DrawerTabId type
- Add tab button in DrawerTabs
- Create AutomationHub component integration
- Features: Sequences list, run/pause/stop controls, progress bars, trigger config

**B. Enhance "terminal" Tab (Optional)**
- Option to switch between UnifiedTerminal (current) and TerminalTabs (multi-session)
- Or replace UnifiedTerminal with TerminalTabs entirely

### 2. Chat Input Bar - Program Dock

**Location Options:**
```
Option A: Above input bar
[📁 Files] [📝 Research] [📊 Data] [📽️ Slides] [💻 Code] ...
[=========================================]
[ What's brewing today?              ][Send]

Option B: Below input bar
[=========================================]
[ What's brewing today?              ][Send]
[📁 Files] [📝 Research] [📊 Data] ... Quick Launch

Option C: Inline with input
[📁] [📝] [📊] [ What's brewing today? ][Send]
```

**Behavior:**
- Click program icon → Launch empty program
- Type @program in chat → Program mention + launch

### 3. Above-Chat-Input Task View

**What exists:** Currently nothing

**What we built in A2rOS:** Kanban board for tasks

**Integration:** Need to check if there's a task indicator/bar above chat input

### 4. @program Mentions in Chat

**Modify in ALL modes:**
- Chat mode: ChatComposer.tsx
- Cowork mode: CoworkTranscript.tsx  
- Code mode: Code mode chat composer
- Browser mode: Browser chat composer

**Features needed:**
- @mention detection in input
- Program dropdown (like @agent dropdown)
- Program preview card when launched
- Inline program rendering in chat thread

### 5. Program Rendering

**Two modes:**
1. **Inline** - Program appears as message in chat thread
2. **Split-pane** - Program opens in A2rCanvasView (side panel)

---

## Implementation Priority

1. **ConsoleDrawer - Automation Tab** (1-2 hours)
   - Add tab
   - Import A2rConsole's AutomationHub
   - Wire into drawer store

2. **Chat Input - Program Dock** (2-3 hours)
   - Create ProgramDock component
   - Add to ChatComposer
   - Handle program launch

3. **@program Mentions** (3-4 hours)
   - Add mention detection
   - Create dropdown
   - Wire to program launcher
   - Do for all 4 modes

4. **Above-Chat Task View** (TBD - need to check if exists)
   - Check if there's existing task bar
   - Integrate Kanban or create new

5. **Program Rendering** (2-3 hours)
   - Inline message component
   - Split-pane integration with A2rCanvasView

---

## Questions for You:

1. **ConsoleDrawer**: Just add "automation" tab? Or also replace terminal with multi-session?

2. **Program Dock Position**: Above input, below input, or inline?

3. **Task View**: Do you want the Kanban board we built to appear above chat input when tasks exist?

4. **@program rendering**: Inline in chat first, then expand to split-pane? Or always split-pane?
