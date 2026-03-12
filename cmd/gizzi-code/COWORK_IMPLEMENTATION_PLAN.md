# Gizzi Code Cowork Mode - Implementation Plan

## Vision

Create a **distinctive Cowork Mode TUI** that differs from traditional Chat/Code modes with:
- **Obsidian-themed background** - Dark, sophisticated collaborative workspace aesthetic
- **Claude-style layout** - Chat-first with inline work blocks + right rail
- **Unique mascot behavior** - Focused, proud, collaborative personality states
- **Real-time collaboration** - Multi-user awareness, shared context, approval workflows

---

## Architecture

### 1. Visual Design System

#### Color Palette (Obsidian Theme)
```typescript
// Cowork-specific theme
const COWORK_THEME = {
  // Background: Deep obsidian with subtle purple undertones
  bg: '#0F1115',           // Darker than chat (#151921)
  bgSecondary: '#1A1D26',  // Rail background
  bgTertiary: '#252A36',   // Work blocks
  
  // Accent: Purple (#A78BFA) - different from Chat blue, Code green
  accent: '#A78BFA',
  accentMuted: 'rgba(167, 139, 250, 0.2)',
  accentGlow: 'rgba(167, 139, 250, 0.4)',
  
  // Status colors (warmer than chat)
  success: '#86EFAC',      // Soft green
  warning: '#FCD34D',      // Amber
  error: '#FCA5A5',        // Soft red
  info: '#93C5FD',         // Soft blue
  
  // Text hierarchy
  textPrimary: '#ECECEC',
  textSecondary: '#9B9B9B',
  textMuted: '#6B6B6B',
  
  // Borders
  border: 'rgba(255, 255, 255, 0.08)',
  borderStrong: 'rgba(255, 255, 255, 0.15)',
}
```

#### Layout Structure
```
┌─────────────────────────────────────────────────────────────────────┐
│  COWORK OPS CENTER                           [ COLLABORATIVE MODE ] │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  ┌─────────────────────────────────────┐  ┌──────────────────────┐  │
│  │                                      │  │  PROGRESS           │  │
│  │  CHAT TRANSCRIPT                     │  │  ✓ Task initialized │  │
│  │  (with inline work blocks)           │  │  ⚡ Running build    │  │
│  │                                      │  │  ○ Tests pending    │  │
│  │  [User]: Start the build             │  │  ○ Deploy           │  │
│  │                                      │  │                     │  │
│  │  [Gizzi]: Running build command...   │  │  ─────────────────  │  │
│  │                                      │  │  FILES TOUCHED      │  │
│  │  ┌──────────────────────────────┐   │  │  📄 src/main.ts     │  │
│  │  │ 📦 COMMAND                   │   │  │  📄 package.json    │  │
│  │  │ $ npm run build              │   │  │  📄 tsconfig.json   │  │
│  │  └──────────────────────────────┘   │  │                     │  │
│  │                                      │  │  ─────────────────  │  │
│  │  [Gizzi]: Build complete ✓           │  │  CONTEXT            │  │
│  │                                      │  │  📁 /projects/app   │  │
│  │  ┌──────────────────────────────┐   │  │  🤖 build-agent     │  │
│  │  │ ✓ FILE EDIT                  │   │  │  ⏱️  2m 34s         │  │
│  │  │ dist/bundle.js (+2.3kb)      │   │  │                     │  │
│  │  └──────────────────────────────┘   │  │  ─────────────────  │  │
│  │                                      │  │  [Gizzi Mascot]     │  │
│  │  [Composer Input...]                 │  │  "Making progress!" │  │
│  │                                      │  │                     │  │
│  └─────────────────────────────────────┘  └──────────────────────┘  │
│                                                                      │
├─────────────────────────────────────────────────────────────────────┤
│  🟢 Cowork Active  │  Session: 2m 34s  │  Actions: 12  │  ⌘+N New  │
└─────────────────────────────────────────────────────────────────────┘
```

---

### 2. Component Architecture

#### Core Components

```typescript
// src/cli/ui/tui/routes/cowork.tsx
export function Cowork() {
  return (
    <GIZZIFrame theme="obsidian">
      <CoworkLayout>
        <CoworkMainViewport>
          <CoworkTranscript />
          <CoworkComposer />
        </CoworkMainViewport>
        
        <CoworkRightRail>
          <ProgressChecklist />
          <FilesTouched />
          <ContextPanel />
          <MascotCorner />
        </CoworkRightRail>
      </CoworkLayout>
    </GIZZIFrame>
  )
}
```

#### Work Block Types (Inline in Transcript)

```typescript
type WorkBlockType =
  | 'command'      // Terminal command execution
  | 'file-edit'    // File modifications
  | 'file-read'    // File reads
  | 'observation'  // Screenshot/viewport state
  | 'tool-call'    // Tool usage
  | 'approval'     // Approval request
  | 'checkpoint'   // Save point
  | 'narration'    // Agent thinking/explanation
```

---

### 3. Event Protocol

#### Cowork Events (from cowork.types.ts)

```typescript
// Session lifecycle
'cowork.session.start'
'cowork.session.end'

// Work events
'cowork.observation'    // Screenshots, state
'cowork.action'         // Click, type, navigate
'cowork.command'        // Terminal commands
'cowork.file'           // File operations
'cowork.tool_call'
'cowork.tool_result'

// Safety & control
'cowork.approval_request'
'cowork.approval_result'
'cowork.checkpoint'
'cowork.restore'

// Communication
'cowork.narration'      // Agent explanations
'cowork.takeover'       // User manual control
```

---

### 4. Mascot Behavior

#### Cowork-Specific States

```typescript
type CoworkMascotState =
  | 'focused'      // Default working state
  | 'proud'        // After completing tasks
  | 'thinking'     // Processing complex tasks
  | 'excited'      // Making good progress
  | 'concerned'    // Encountered issues
  | 'collaborating' // Multi-user session
```

#### Mascot Thoughts (Cowork-specific)

```typescript
const COWORK_THOUGHTS = [
  'Cowork mode means we move with the task, not around it.',
  'I like keeping the workspace tidy and the progress visible.',
  'Collaboration is easier when everyone can see the plan.',
  'I track every file touched and command run. Transparency matters.',
  'If this gets complex, I break it into checkpoints.',
  'The rail shows our progress. We are making good time.',
  'Agent on deck. Clear task, clear outcome, let us move.',
]
```

---

## Implementation Steps

### Phase 1: Foundation (Done)
- ✅ Basic Cowork route exists
- ✅ Purple accent color (#A78BFA)
- ✅ Tab structure (Dashboard/Sessions/Templates)
- ✅ Basic Ops Rail

### Phase 2: Enhanced Layout (Next)
- [ ] Implement chat-first transcript layout
- [ ] Add inline work blocks (Command, File, Observation)
- [ ] Build right rail with progress checklist
- [ ] Add files touched panel
- [ ] Add context panel (folder, agent, timing)

### Phase 3: Event Integration
- [ ] Subscribe to cowork.* events
- [ ] Render work blocks from events
- [ ] Update progress checklist in real-time
- [ ] Handle approval requests
- [ ] Support checkpoints

### Phase 4: Mascot & Polish
- [ ] Cowork-specific mascot states
- [ ] Mascot thoughts/quotes
- [ ] Obsidian theme (darker bg, purple accents)
- [ ] Smooth animations for work blocks
- [ ] Status bar with session stats

### Phase 5: Commands
- [ ] `gizzi cowork run [task]` - Start collaborative session
- [ ] `gizzi cowork list` - List active/past runs
- [ ] `gizzi cowork attach <id>` - Attach to running session
- [ ] `gizzi cowork approve <id>` - Approve pending action
- [ ] `gizzi cowork checkpoint <id>` - Create/restore checkpoints

---

## File Structure

```
src/cli/ui/tui/routes/
  cowork.tsx              # Main Cowork route (enhance existing)
  
src/cli/ui/tui/component/cowork/
  transcript.tsx          # Chat transcript with work blocks
  composer.tsx            # Input composer
  work-blocks/
    command.tsx           # Command execution block
    file-edit.tsx         # File modification block
    observation.tsx       # Screenshot/viewport block
    tool-call.tsx         # Tool usage block
    approval.tsx          # Approval request block
    checkpoint.tsx        # Checkpoint block
  right-rail/
    progress.tsx          # Progress checklist
    files-touched.tsx     # Files panel
    context.tsx           # Context panel
  mascot/
    cowork-mascot.tsx     # Cowork-specific mascot
    thoughts.tsx          # Thought bubbles
  
src/cli/commands/cowork/
  run.ts                  # Start cowork session
  list.ts                 # List sessions
  attach.ts               # Attach to session
  approve.ts              # Handle approvals
  checkpoint.ts           # Checkpoint management
  schedule.ts             # Schedule management
```

---

## Success Metrics

1. **Visual Distinction**: Cowork looks clearly different from Chat/Code modes
2. **Information Density**: Right rail shows progress, files, context at a glance
3. **Real-time Updates**: Work blocks appear inline as agent works
4. **Collaboration**: Multiple users can observe/approve/interact
5. **Transparency**: Every action, file change, and decision is visible

---

## Design Principles

1. **Chat-First**: Conversation is the primary interface
2. **Inline Context**: Work happens in the transcript, not separate panels
3. **Progress Visibility**: Right rail always shows "where we are"
4. **Obsidian Aesthetic**: Dark, sophisticated, professional
5. **Purple Accent**: Distinct from Chat (blue) and Code (green)
6. **Mascot Personality**: Focused, proud, collaborative (not playful/mischievous)

---

## Next Steps

1. **Enhance existing cowork.tsx** with chat-first layout
2. **Create work block components** for inline rendering
3. **Build right rail** with progress/files/context
4. **Integrate event stream** for real-time updates
5. **Add mascot behaviors** specific to Cowork mode
