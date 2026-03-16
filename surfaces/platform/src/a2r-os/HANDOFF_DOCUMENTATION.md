# A2rchitect Super-Agent OS - Hand-off Documentation

**Status:** Phase 1 Complete (Infrastructure)  
**Date:** 2026-03-09  
**Next:** Phase 2 (Integration with Brain Runtime)

---

## 📋 Executive Summary

The A2rchitect Super-Agent OS infrastructure has been implemented. This transforms the sidecar from static panels into a dynamic, multi-program "Utility Pane" that can render complex agent outputs (research documents, spreadsheets, slides) independently of the chat view.

### What's Been Built

| Component | Status | Description |
|-----------|--------|-------------|
| Program Types | ✅ | Type-safe state definitions for all 11 program types |
| useSidecarStore | ✅ | Zustand store with persistence, multi-program support |
| A2rCanvas | ✅ | Main container with tab bar, resizing, program router |
| SparkPage | ✅ | Full Genspark-style research document renderer |
| AI-Sheets | ✅ | Interactive grid with Python viz support |
| AI-Slides | ✅ | Presentation builder with themes & presenter mode |
| Launch Protocol | ✅ | XML-style IPC for agents to launch programs |
| Live Dev | 🟡 | Basic structure, needs sandbox hardening |
| Media Drive | 🟡 | UI complete, needs FS integration |
| Other Programs | 🟡 | Placeholders with feature lists |

---

## 🗂️ File Structure

```
src/a2r-os/
├── index.ts                    # Main exports
├── HANDOFF_DOCUMENTATION.md    # This file
├── types/
│   └── programs.ts             # All TypeScript definitions
├── stores/
│   └── useSidecarStore.ts      # State management
├── components/
│   └── A2rCanvas.tsx           # Main UI container
├── programs/
│   ├── SparkPageProgram.tsx    # Research documents ⭐
│   ├── AISheetsProgram.tsx     # Data grid + viz ⭐
│   ├── AISlidesProgram.tsx     # Presentations ⭐
│   ├── LiveDevProgram.tsx      # Code preview
│   ├── MediaDriveProgram.tsx   # Asset manager
│   └── OtherPrograms.tsx       # Draw, Pod, Phone, MoA, Browser
└── utils/
    └── launchProtocol.ts       # Agent IPC utilities
```

---

## 🚀 Quick Start

### 1. Add A2rCanvas to Your Layout

```tsx
import { A2rCanvas } from './a2r-os';

function App() {
  return (
    <div className="flex h-screen">
      {/* Main chat/code/browser view */}
      <main className="flex-1">
        <ChatView />
      </main>
      
      {/* Utility Pane - persists across view switches */}
      <A2rCanvas className="flex-shrink-0" />
    </div>
  );
}
```

### 2. Launch Programs from Agents

```tsx
import { useLaunchProtocol, processAgentMessage } from './a2r-os';

function ChatAgent({ threadId }) {
  const launcher = useLaunchProtocol(threadId);
  
  // Direct API
  const handleResearch = () => {
    launcher.launchSparkPage(
      "Mars Colonization Research",
      "Latest developments in Mars habitat technology"
    );
  };
  
  // Parse from agent message
  const handleAgentResponse = (message: string) => {
    const programIds = processAgentMessage(message, threadId);
    if (programIds.length > 0) {
      console.log(`Launched ${programIds.length} programs`);
    }
  };
}
```

### 3. Agent Output Format

Agents can embed launch commands in their responses:

```xml
<launch_utility type="spark-page" title="Mars Research">
{
  "topic": "Mars Colonization",
  "sections": [...],
  "citations": [...]
}
</launch_utility>
```

---

## 📊 Architecture Overview

### The "OS" Metaphor

```
┌─────────────────────────────────────────────────────────────┐
│                    A2rchitect Shell                         │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐         │
│  │   Chat      │  │    Code     │  │   Browser   │  Views  │
│  │   View      │  │    View     │  │    View     │         │
│  └─────────────┘  └─────────────┘  └─────────────┘         │
│                                                             │
│  ═══════════════════════════════════════════════════════   │
│                    Persistent State                         │
│  ═══════════════════════════════════════════════════════   │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │              Utility Pane (A2rCanvas)               │   │
│  │  ┌─────┬─────┬─────┬─────────────────────────────┐  │   │
│  │  │ 📝  │ 📊  │ 🎬  │      Program Tabs           │  │   │
│  │  └─────┴─────┴─────┴─────────────────────────────┘  │   │
│  │  ┌─────────────────────────────────────────────────┐│   │
│  │  │                                            │    ││   │
│  │  │          Active Program Renderer           │    ││   │
│  │  │    (SparkPage / AI-Sheets / AI-Slides)     │    ││   │
│  │  │                                            │    ││   │
│  │  └─────────────────────────────────────────────────┘│   │
│  └─────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

### State Flow

```
Agent Response
      │
      ▼
┌─────────────┐
│   Parser    │──► Extracts <launch_utility> tags
└─────────────┘
      │
      ▼
┌─────────────┐
│   Store     │──► useSidecarStore.launchProgram()
└─────────────┘
      │
      ▼
┌─────────────┐
│  A2rCanvas  │──► Renders based on activeProgram.type
└─────────────┘
      │
      ▼
┌─────────────┐
│   Program   │──► Type-specific renderer with state
└─────────────┘
```

---

## 🔧 API Reference

### useSidecarStore

```typescript
// Program lifecycle
launchProgram<T>(request: LaunchProgramRequest<T>): string
terminateProgram(id: string): boolean
activateProgram(id: string): boolean
suspendProgram(id: string): boolean

// State management
updateProgramState<T>(id: string, updater: (state: T) => T): boolean
setProgramState<T>(id: string, state: T): boolean
getProgramState<T>(id: string): T | null

// UI
setExpanded(expanded: boolean): void
setWidth(width: number): void

// Selectors
getActiveProgram(): A2rProgram | null
getProgramsByType(type: A2rProgramType): A2rProgram[]
getProgramsByThread(threadId: string): A2rProgram[]
```

### Launch Protocol

```typescript
// High-level helpers
launchSparkPage(title, topic, threadId, options?): string
launchAISheets(title, columns, threadId, options?): string
launchAISlides(title, threadId, options?): string
launchLiveDev(title, files, entryFile, threadId, options?): string
launchMediaDrive(threadId): string
launchDrawStudio(imageUrl, threadId): string
launchAIPod(title, threadId): string
launchTelephony(phoneNumber?, threadId): string
launchMoACockpit(taskDescription, threadId): string

// Message processing
parseLaunchCommands(message: string): LaunchCommand[]
processAgentMessage(message: string, threadId: string): string[]

// React hook
const launcher = useLaunchProtocol(threadId);
launcher.launchSparkPage(...)
launcher.launchAISheets(...)
// ... etc
```

---

## 🎯 Program State Specifications

### SparkPage State

```typescript
interface SparkPageState {
  topic: string;
  sections: Array<{
    id: string;
    type: 'hero' | 'heading' | 'paragraph' | 'columns' | 'evidence' | 'divider';
    content: string;
    metadata?: Record<string, unknown>;
  }>;
  citations: Array<{
    id: string;
    number: number;
    source: string;
    url: string;
    snippet: string;
  }>;
  evidence: Array<{
    id: string;
    type: 'screenshot' | 'chart' | 'code' | 'quote';
    src: string;
    caption: string;
  }>;
  tableOfContents: Array<{ id: string; title: string; level: number }>;
  isGenerating: boolean;
  generationProgress?: {
    currentStep: string;
    percentComplete: number;
  };
}
```

### AI-Sheets State

```typescript
interface AISheetsState {
  title: string;
  columns: Array<{
    id: string;
    header: string;
    type: 'text' | 'number' | 'date' | 'boolean' | 'formula';
  }>;
  rows: Array<{
    id: string;
    cells: Record<string, unknown>;
  }>;
  visualizations: Array<{
    id: string;
    type: 'bar' | 'line' | 'scatter' | 'pie' | 'heatmap';
    title: string;
    pythonCode?: string;
  }>;
  isGenerating: boolean;
}
```

### AI-Slides State

```typescript
interface AISlidesState {
  title: string;
  slides: Array<{
    id: string;
    type: 'title' | 'content' | 'split' | 'image' | 'code' | 'quote';
    content: string;
    layout: string;
    transition?: string;
  }>;
  currentSlideIndex: number;
  theme: AISlideTheme;
  isPresenting: boolean;
}
```

---

## ✅ Verification Checklist

Before passing to the next phase, verify:

- [x] Store persists programs across app restarts
- [x] Programs stay open when switching between Chat/Code/Browser views
- [x] SparkPage renders with citations, TOC, and evidence
- [x] AI-Sheets supports cell editing and row insertion
- [x] AI-Slides has presenter mode and theme switching
- [x] Launch protocol correctly parses XML-style commands
- [x] Multiple programs can run simultaneously
- [x] Tab bar allows switching between programs
- [x] Resize handle adjusts pane width
- [x] TypeScript types are complete and exported

---

## 🔮 Phase 2 Tasks (Next Agent)

### Priority 1: Brain Runtime Integration

1. **Kernel Integration**
   - Create kernel events for `LAUNCH_PROGRAM`, `UPDATE_PROGRAM_STATE`
   - Wire agent message parser to kernel output
   - Add program state sync between kernel and UI

2. **Agent Message Format**
   ```xml
   <launch_utility type="spark-page" title="Mars Research">
   {
     "topic": "Mars Colonization",
     "sections": [...]
   }
   </launch_utility>
   ```

3. **Auto-launch on Agent Output**
   - Hook into message stream parser
   - Auto-detect and execute launch commands
   - Show toast notifications on program launch

### Priority 2: Program Enhancements

1. **SparkPage**
   - Add real-time streaming of sections during generation
   - Integrate with browser screenshots for evidence
   - Add export to PDF/Markdown

2. **AI-Sheets**
   - Add Python visualization execution (Plotly/Matplotlib)
   - Integrate with kernel for formula evaluation
   - Add CSV import/export

3. **AI-Slides**
   - Add Reveal.js integration for advanced transitions
   - Export to PPTX/PDF
   - Speaker notes panel

### Priority 3: Missing Programs

1. **Live Dev** - Harden iframe sandbox, add hot-reload
2. **Media Drive** - Integrate with `.a2r/drive` filesystem
3. **MoA Cockpit** - Real-time agent status from kernel
4. **Telephony** - Vapi.ai WebRTC integration
5. **Draw Studio** - Canvas masking + inpainting API
6. **AI Pod** - ElevenLabs TTS integration

---

## 🐛 Known Issues

1. **SparkPage**: Citation popovers can overflow viewport on small screens
2. **AI-Sheets**: No formula evaluation (needs kernel integration)
3. **AI-Slides**: Theme changes don't animate smoothly
4. **A2rCanvas**: Resize handle doesn't show cursor on some browsers

---

## 📚 Dependencies

```json
{
  "zustand": "^4.x",
  "immer": "^10.x",
  "react": "^18.x",
  "typescript": "^5.x"
}
```

Optional for full functionality:
- `reveal.js` - For advanced slide transitions
- `plotly.js` - For chart rendering in AI-Sheets
- `ag-grid-react` - Alternative data grid (currently using custom)

---

## 🤝 Integration Points

### With Kernel (1-kernel)

```typescript
// Kernel should emit these events
interface KernelEvents {
  'program:launch': { type: string; title: string; state: unknown };
  'program:update': { id: string; state: unknown };
  'program:close': { id: string };
}

// Kernel should accept these commands
interface KernelCommands {
  'program:execute': { id: string; command: string };
  'program:query': { id: string };
}
```

### With Agent Runtime

```typescript
// Agents should be able to use these tools
interface AgentTools {
  launch_program: {
    type: A2rProgramType;
    title: string;
    initialState: unknown;
  };
  
  update_program: {
    id: string;
    updates: Partial<unknown>;
  };
  
  read_program_state: {
    id: string;
  };
}
```

---

## 📞 Contact

For questions about this implementation:
1. Check the types in `types/programs.ts`
2. Review the store in `stores/useSidecarStore.ts`
3. Examine program renderers in `programs/`

---

**End of Phase 1 Hand-off Documentation**
