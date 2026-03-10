# Genspark AI → A2rchitech Integration Plan

**Document Version:** 1.0  
**Date:** March 9, 2026  
**Status:** Ready for Implementation  

---

## Executive Summary

This document provides a **complete, phased integration plan** to evolve A2rchitech from a powerful CLI/Chat workspace into a **Creator & Knowledge Workspace** that rivals Genspark AI's capabilities while maintaining our core strengths (local PTY, file system access, multi-agent orchestration).

### Strategic Positioning

| Aspect | Genspark AI | A2rchitech (Current) | A2rchitech (Target) |
|--------|-------------|---------------------|---------------------|
| **Primary User** | Creators, Knowledge Workers | Developers, Engineers | **Creators + Developers** |
| **Output Format** | Sparkpages (rich documents) | Chat/Markdown | **Canvas + Chat Hybrid** |
| **Model Strategy** | Mixture of Agents (MoA) | Single model per session | **MoA Orchestrator** |
| **Media Support** | Images, Audio, Video, Podcasts | Text/Code only | **Full Multimedia Suite** |
| **Execution** | Cloud-based, async | Local PTY, sync | **Hybrid Async+Sync** |
| **File System** | 1GB-1TB cloud drive | Local filesystem | **A2r-Drive + Local** |

---

## Part 1: Complete Feature Mapping

### 1.1 Genspark AI Feature Inventory

| # | Feature | Description | UI Pattern | Backend Tech |
|---|---------|-------------|------------|--------------|
| **1** | **Sparkpages** | Wikipedia-style generated pages with citations, images, embedded tools | Full-page document viewer with sidebar TOC | Multi-model aggregation, web scraping |
| **2** | **Call For Me** | Voice AI that makes real phone calls (appointments, inquiries) | Phone dialer UI + transcript viewer | Twilio/Vapi API, STT/TTS |
| **3** | **AI Slides** | Auto-generated slide decks with fact-checking | PowerPoint-style carousel editor | Reveal.js/Deck API |
| **4** | **AI Sheets** | Live web data scraping into interactive tables | Excel-like grid with Python charts | Pandas + AG Grid |
| **5** | **AI Developer** | Low-code website builder from prompts | Split view: chat + live iframe preview | WebContainer/iframe |
| **6** | **AI Pods** | Multi-voice audio podcast generation | Audio player with waveform | ElevenLabs + audio mixing |
| **7** | **Image Generation** | Unlimited keyframes, thumbnails, concept art | Grid gallery with draw-to-edit | FLUX/DALL-E 3 API |
| **8** | **Draw-to-Edit** | Mask-based image inpainting | Canvas overlay with brush tool | Stability AI Inpainting |
| **9** | **Video Generation** | Text-to-video with lip-sync | Video player with timeline | Kling/Sora API |
| **10** | **Autopilot Browser** | Autonomous web navigation for research | Progress cockpit with step indicators | Puppeteer/Playwright |
| **11** | **Download For Me** | Agent fetches and organizes files from web | Asset manager with thumbnails | Headless browser + storage |
| **12** | **Mixture of Agents** | Auto-routes prompts to best models | "Creative Cockpit" progress UI | Model routing DAG |
| **13** | **Super Agents** | Custom AI employees for workflows | Agent builder wizard | Workflow automation |

---

### 1.2 A2rchitech Current State Assessment

#### ✅ Existing Strengths (Keep & Enhance)

| Component | Status | Notes |
|-----------|--------|-------|
| **4 Views** (Chat, Cowork, Code, Browser) | ✅ Active | Well-architected, mode-switching works |
| **PTY Integration** | ✅ Active | Rust kernel handles terminals perfectly |
| **API Drivers** (Claude, Gemini, Ollama) | ✅ Active | Multi-model support exists |
| **Artifact System** | ✅ Active | Basic artifact rendering works |
| **Sidecar Panel** | ✅ Active | Right rail with tabs (Artifact, Preview, Changes) |
| **Shell Layout** | ✅ Active | Resizable panels, flexible layout system |
| **Canvas Protocol** | ✅ Active | 9 canvas types defined (chat, code, cowork, etc.) |
| **Electron App** | ✅ Active | Desktop wrapper with IPC |

#### ⚠️ Critical Gaps (Must Build)

| Gap | Priority | Effort | Impact |
|-----|----------|--------|--------|
| **G1: Dynamic Canvas Renderer** | P0 | High | Enables Sparkpages equivalent |
| **G2: MoA Orchestrator** | P0 | High | Parallel agent execution |
| **G3: Specialized Renderers** (Slides, Sheets) | P1 | Medium | Creator workflow support |
| **G4: A2r-Drive Asset Manager** | P1 | Medium | File organization for creators |
| **G5: Multimedia APIs** (Image, Audio, Video) | P1 | Medium | Content creation tools |
| **G6: Draw-to-Edit Canvas** | P2 | Medium | Image editing workflow |
| **G7: Async Job Queue** | P2 | High | Autopilot-style background tasks |
| **G8: Live Code Preview** | P1 | Low | Embedded website preview |
| **G9: Telephony Integration** | P3 | Low | "Call For Me" equivalent |

---

## Part 2: Architecture Design

### 2.1 A2r-Canvas Architecture

#### Concept: "The Computer" Mental Model

As you noted, think of A2r-Canvas not as a feature but as **the computer itself** — a utility that renders content and hosts specialized "programs" (renderers).

```
┌─────────────────────────────────────────────────────────────────┐
│                     A2rchitech Shell                            │
├─────────────────────────────────────────────────────────────────┤
│  ┌─────────────┐  ┌───────────────────┐  ┌─────────────────┐   │
│  │             │  │                   │  │                 │   │
│  │   Chat/     │  │    A2r-Canvas     │  │   A2r-Drive     │   │
│  │   Cowork/   │  │   (The Computer)  │  │   (Assets)      │   │
│  │   Code/     │  │                   │  │                 │   │
│  │   Browser   │  │  ┌─────────────┐  │  │  ┌───────────┐  │   │
│  │   View      │  │  │  Renderer   │  │  │  │ Images    │  │   │
│  │             │  │  │  (Slides)   │  │  │  │ Documents │  │   │
│  │             │  │  ├─────────────┤  │  │  │ Code      │  │   │
│  │             │  │  │  Renderer   │  │  │  │ Videos    │  │   │
│  │             │  │  │  (Sheets)   │  │  │  └───────────┘  │   │
│  │             │  │  ├─────────────┤  │  └─────────────────┘   │
│  │             │  │  │  Renderer   │  │                        │
│  │             │  │  │  (Preview)  │  │                        │
│  │             │  │  └─────────────┘  │                        │
│  │             │  └───────────────────┘                        │
│  └─────────────┘                                               │
└─────────────────────────────────────────────────────────────────┘
```

#### Component Hierarchy

```
A2rCanvasView/
├── CanvasContainer.tsx          # Main split-pane wrapper
├── CanvasRouter.tsx             # Routes content to renderers
├── renderers/
│   ├── DocumentRenderer.tsx     # Sparkpages equivalent (ProseMirror)
│   ├── SlidesRenderer.tsx       # Presentation decks (Reveal.js)
│   ├── SheetsRenderer.tsx       # Data grids (AG Grid)
│   ├── CodeRenderer.tsx         # Live preview (iframe/WebContainer)
│   ├── ImageRenderer.tsx        # Image gallery + editor
│   ├── VideoRenderer.tsx        # Video player + timeline
│   ├── AudioRenderer.tsx        # Audio player + waveform
│   └── MermaidRenderer.tsx      # Diagrams (existing)
├── hooks/
│   ├── useCanvasStream.ts       # Handles artifact streaming
│   └── useCanvasLayout.ts       # Manages split-pane state
└── utils/
    ├── artifact-parser.ts       # Parses XML artifact tags
    └── renderer-registry.ts     # Maps types to renderers
```

---

### 2.2 Mixture of Agents (MoA) Orchestrator

#### Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    User Prompt                              │
│         "Build a landing page with 3 images"                │
└─────────────────────┬───────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────┐
│              Router Agent (Gemini 2.5 Flash)                │
│   - Parses intent                                           │
│   - Generates Task DAG                                      │
│   - Assigns models to tasks                                 │
└─────────────────────┬───────────────────────────────────────┘
                      │
        ┌─────────────┼─────────────┐
        │             │             │
        ▼             ▼             ▼
┌──────────────┐ ┌──────────┐ ┌──────────────┐
│ Task 1: Code │ │ Task 2:  │ │ Task 3:      │
│ Claude 3.7   │ │ FLUX API │ │ FLUX API     │
│ (HTML/CSS)   │ │ (Image 1)│ │ (Image 2, 3) │
└──────┬───────┘ └────┬─────┘ └──────┬───────┘
       │              │               │
       └──────────────┼───────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────┐
│              Synthesizer Agent (Claude 3.7)                 │
│   - Compiles all outputs                                    │
│   - Generates final artifact JSON                           │
│   - Streams to Canvas                                       │
└─────────────────────────────────────────────────────────────┘
```

#### Task DAG Structure

```typescript
interface MoATaskGraph {
  id: string;
  prompt: string;
  tasks: MoATask[];
  dependencies: TaskDependency[];
}

interface MoATask {
  id: string;
  type: 'text' | 'image' | 'audio' | 'video' | 'code' | 'search';
  modelId: string; // e.g., 'claude-3-7', 'flux-1.1', 'elevenlabs'
  prompt: string;
  status: 'pending' | 'running' | 'complete' | 'error';
  output?: any;
}

interface TaskDependency {
  fromTaskId: string;
  toTaskId: string;
}
```

#### Creative Cockpit UI

```tsx
// Shows parallel task progress
<CreativeCockpit>
  <TaskStep status="done" model="Claude 3.7">
    Writing landing page HTML/CSS...
  </TaskStep>
  <TaskStep status="running" model="FLUX" progress={67}>
    Generating image 1/3...
  </TaskStep>
  <TaskStep status="pending" model="FLUX">
    Generating image 2/3...
  </TaskStep>
  <TaskStep status="pending" model="FLUX">
    Generating image 3/3...
  </TaskStep>
</CreativeCockpit>
```

---

### 2.3 A2r-Drive Asset Manager

#### Directory Structure

```
.a2r_drive/
├── images/
│   ├── 2026-03-09/
│   │   ├── landing-hero-1.png
│   │   ├── landing-hero-2.png
│   │   └── metadata.json
├── documents/
│   └── research/
├── code/
├── audio/
├── video/
└── manifest.json
```

#### UI Component

```tsx
<A2rDriveSidebar>
  <AssetFilter tabs={['all', 'images', 'documents', 'code', 'audio', 'video']} />
  <AssetGrid>
    <AssetCard
      type="image"
      thumbnail="/path/to/thumb.png"
      name="landing-hero-1.png"
      createdAt="2m ago"
      onPreview={() => openImageViewer()}
      onDrawToEdit={() => openCanvasEditor()}
    />
  </AssetGrid>
</A2rDriveSidebar>
```

---

### 2.4 Draw-to-Edit Canvas

#### User Flow

1. User clicks image in A2r-Drive sidebar
2. Image opens in modal with HTML5 Canvas overlay
3. User draws mask (brush tool)
4. User types edit prompt: "Make this a latte"
5. System sends: original image + mask + prompt to Inpainting API
6. New image replaces old in A2r-Drive
7. UI updates instantly

#### Technical Stack

- **Canvas:** `react-konva` or `fabric.js`
- **API:** Stability AI Inpainting or Replicate FLUX
- **Storage:** Local `.a2r_drive/` with versioning

---

## Part 3: Implementation Phases

### Phase 1: Canvas Foundation (Weeks 1-2)

**Goal:** Enable split-pane Canvas view with basic renderers

#### Tasks

| # | Task | Files to Create/Modify | Owner | Status |
|---|------|------------------------|-------|--------|
| 1.1 | Create `A2rCanvasView.tsx` | `6-ui/a2r-platform/src/views/A2rCanvasView.tsx` | | ⏳ |
| 1.2 | Add `canvas` ViewType | `nav.types.ts`, `registry.ts` | | ⏳ |
| 1.3 | Build `CanvasContainer.tsx` | `src/views/canvas/CanvasContainer.tsx` (react-resizable-panels) | | ⏳ |
| 1.4 | Create `CanvasRouter.tsx` | `src/views/canvas/CanvasRouter.tsx` | | ⏳ |
| 1.5 | Build `DocumentRenderer.tsx` | `src/views/canvas/renderers/DocumentRenderer.tsx` (ProseMirror) | | ⏳ |
| 1.6 | Build `CodeRenderer.tsx` | `src/views/canvas/renderers/CodeRenderer.tsx` (iframe preview) | | ⏳ |
| 1.7 | Update `ShellApp.tsx` | Add canvas view routing | | ⏳ |
| 1.8 | Update `rust-stream-adapter.ts` | Add `canvas` artifact type handling | | ⏳ |

#### Deliverables

- ✅ Split-pane Canvas view working
- ✅ Document renderer (Notion-style)
- ✅ Code renderer with live preview
- ✅ All 4 views (Chat, Cowork, Code, Browser) can spawn Canvas

---

### Phase 2: MoA Orchestrator (Weeks 3-4)

**Goal:** Enable parallel multi-agent execution

#### Tasks

| # | Task | Files to Create/Modify | Owner | Status |
|---|------|------------------------|-------|--------|
| 2.1 | Create Router Agent | `4-services/orchestration/kernel-service/src/moa/router.rs` | | ⏳ |
| 2.2 | Build Task DAG generator | `src/moa/task_graph.rs` | | ⏳ |
| 2.3 | Create Parallel Executor | `src/moa/executor.rs` | | ⏳ |
| 2.4 | Build Synthesizer Agent | `src/moa/synthesizer.rs` | | ⏳ |
| 2.5 | Create `CreativeCockpit` UI | `src/components/moa/CreativeCockpit.tsx` | | ⏳ |
| 2.6 | Update Kernel API | Add `/api/moa/submit` endpoint | | ⏳ |
| 2.7 | Add model routing config | `a2r/config.json` moa section | | ⏳ |

#### Deliverables

- ✅ MoA Router parses prompts into task graphs
- ✅ Parallel execution driver spawns multiple workers
- ✅ Creative Cockpit shows real-time progress
- ✅ Synthesizer compiles outputs into artifacts

---

### Phase 3: Specialized Renderers (Weeks 5-6)

**Goal:** Add Slides, Sheets, and multimedia renderers

#### Tasks

| # | Task | Files to Create/Modify | Owner | Status |
|---|------|------------------------|-------|--------|
| 3.1 | Build `SlidesRenderer.tsx` | Uses Reveal.js, renders slide decks | | ⏳ |
| 3.2 | Build `SheetsRenderer.tsx` | Uses AG Grid, interactive data tables | | ⏳ |
| 3.3 | Build `ImageRenderer.tsx` | Gallery grid with lightbox | | ⏳ |
| 3.4 | Build `VideoRenderer.tsx` | Video player with timeline scrubber | | ⏳ |
| 3.5 | Build `AudioRenderer.tsx` | Audio player with waveform (Wavesurfer.js) | | ⏳ |
| 3.6 | Update artifact parser | Support new renderer types | | ⏳ |

#### Deliverables

- ✅ Slides renderer (PowerPoint-style)
- ✅ Sheets renderer (Excel-like grid)
- ✅ Image/Video/Audio renderers

---

### Phase 4: A2r-Drive & Multimedia (Weeks 7-8)

**Goal:** Asset management and media generation

#### Tasks

| # | Task | Files to Create/Modify | Owner | Status |
|---|------|------------------------|-------|--------|
| 4.1 | Create `.a2r_drive/` structure | Auto-create on workspace init | | ⏳ |
| 4.2 | Build `A2rDriveSidebar.tsx` | Asset manager UI | | ⏳ |
| 4.3 | Add Image Generation driver | `kernel-service/src/drivers/image_generation.rs` | | ⏳ |
| 4.4 | Add Audio Generation driver | `kernel-service/src/drivers/audio_generation.rs` | | ⏳ |
| 4.5 | Add Video Generation driver | `kernel-service/src/drivers/video_generation.rs` | | ⏳ |
| 4.6 | Update Rust adapter | Handle media artifact types | | ⏳ |

#### Deliverables

- ✅ A2r-Drive sidebar with asset filtering
- ✅ Image generation API integration (FLUX/DALL-E)
- ✅ Audio generation API integration (ElevenLabs)
- ✅ Video generation API integration (Kling/Sora)

---

### Phase 5: Draw-to-Edit & Advanced Features (Weeks 9-10)

**Goal:** Image editing and telephony

#### Tasks

| # | Task | Files to Create/Modify | Owner | Status |
|---|------|------------------------|-------|--------|
| 5.1 | Build `DrawToEditCanvas.tsx` | react-konva mask editor | | ⏳ |
| 5.2 | Add Inpainting API driver | Stability AI/Replicate integration | | ⏳ |
| 5.3 | Build `TelephonyDriver.ts` | Twilio/Vapi integration | | ⏳ |
| 5.4 | Create `CallForMeUI.tsx` | Phone dialer + transcript viewer | | ⏳ |
| 5.5 | Update MoA to support telephony | Add `telephony` task type | | ⏳ |

#### Deliverables

- ✅ Draw-to-Edit canvas working
- ✅ Telephony integration ("Call For Me")
- ✅ Full multimedia workflow

---

### Phase 6: Autopilot & Async Execution (Weeks 11-12)

**Goal:** Background task execution

#### Tasks

| # | Task | Files to Create/Modify | Owner | Status |
|---|------|------------------------|-------|--------|
| 6.1 | Create job queue system | SQLite/Redis queue in Kernel | | ⏳ |
| 6.2 | Build background kernel daemon | Runs independent of Electron UI | | ⏳ |
| 6.3 | Add push notifications | macOS/Windows native notifications | | ⏳ |
| 6.4 | Build session rehydration | Fetch completed jobs on app reopen | | ⏳ |
| 6.5 | Create `AutopilotStatus.tsx` | Shows background task progress | | ⏳ |

#### Deliverables

- ✅ Async job queue working
- ✅ Background kernel daemon
- ✅ Push notifications for task completion
- ✅ Session rehydration

---

## Part 4: UI/UX Flow Mapping

### 4.1 Genspark Flow → A2rchitech Flow

#### Scenario: "Build a landing page for my coffee brand with 3 custom images"

**Genspark Flow:**
1. User types prompt in central search bar
2. "Loading/Thinking" cockpit shows multiple agents working
3. Finished "Sparkpage" appears with text, iframe website, 3 images
4. User clicks image, draws on coffee cup, types "Make this a latte"
5. Image updates instantly

**A2rchitech Flow (Post-Integration):**
1. User types prompt in Chat/Cowork/Code/Browser view
2. System detects complex request → spawns Canvas automatically
3. **Creative Cockpit** appears above chat:
   ```
   [⚡️ Claude 3.7: Writing HTML/CSS...] 🟡 In Progress
   [⚡️ FLUX: Generating image 1/3...] 🟢 Done
   [⚡️ FLUX: Generating image 2/3...] 🟡 In Progress
   [⚡️ FLUX: Generating image 3/3...] ⚪ Pending
   ```
4. View splits: Left = Chat history, Right = A2r-Canvas
   - HTML/CSS streams into **CodeRenderer** (iframe preview)
   - Images appear in **A2r-Drive sidebar** thumbnails
5. User clicks image in A2r-Drive → opens **DrawToEditCanvas**
6. User masks cup, types "latte" → inpainting API call
7. New image replaces old, UI updates instantly

---

### 4.2 View Integration Matrix

| View | Canvas Support | MoA Support | A2r-Drive | Draw-to-Edit |
|------|---------------|-------------|-----------|--------------|
| **Chat** | ✅ Right pane | ✅ Full | ✅ Sidebar | ✅ Modal |
| **Cowork** | ✅ Right pane | ✅ Full | ✅ Sidebar | ✅ Modal |
| **Code** | ✅ Right pane (Preview) | ✅ Full | ✅ Sidebar | ✅ Modal |
| **Browser** | ✅ Right pane (Capture) | ✅ Full | ✅ Sidebar | ✅ Modal |

---

## Part 5: Technical Specifications

### 5.1 Artifact Type Extensions

Add to `rust-stream-adapter.ts`:

```typescript
type ArtifactKind = 
  | "image" | "svg" | "mermaid" | "jsx" | "html"
  | "document"    // ProseMirror editor
  | "slides"      // Reveal.js deck
  | "sheet"       // AG Grid table
  | "audio"       // Wavesurfer player
  | "video"       // Video player
  | "podcast"     // Multi-track audio
  ;
```

### 5.2 Canvas Renderer Registry

```typescript
// src/views/canvas/utils/renderer-registry.ts

export interface RendererConfig {
  type: ArtifactKind;
  component: React.ComponentType<RendererProps>;
  supportsEdit: boolean;
  supportsPreview: boolean;
}

export const RENDERER_REGISTRY: Map<ArtifactKind, RendererConfig> = new Map([
  ['document', { type: 'document', component: DocumentRenderer, supportsEdit: true, supportsPreview: true }],
  ['slides', { type: 'slides', component: SlidesRenderer, supportsEdit: true, supportsPreview: true }],
  ['sheet', { type: 'sheet', component: SheetsRenderer, supportsEdit: true, supportsPreview: true }],
  ['html', { type: 'html', component: CodeRenderer, supportsEdit: false, supportsPreview: true }],
  ['image', { type: 'image', component: ImageRenderer, supportsEdit: true, supportsPreview: true }],
  // ... etc
]);
```

### 5.3 MoA Configuration

```json
// a2r/config.json
{
  "moa": {
    "enabled": true,
    "router_model": "gemini-2.5-flash",
    "default_models": {
      "text": "anthropic:claude-3-7-sonnet",
      "code": "anthropic:claude-3-7-sonnet",
      "image": "replicate:flux-1.1",
      "audio": "elevenlabs:turbo",
      "video": "kling:1.5",
      "search": "gemini-2.5-flash"
    },
    "max_parallel_tasks": 5,
    "timeout_seconds": 300
  }
}
```

---

## Part 6: Testing & Validation

### 6.1 Test Scenarios

| # | Scenario | Expected Result |
|---|----------|-----------------|
| T1 | "Write a blog post about AI" | Canvas opens with DocumentRenderer, text streams in real-time |
| T2 | "Create a pitch deck for investors" | Canvas opens with SlidesRenderer, 10-slide deck generated |
| T3 | "Analyze this CSV data" | Canvas opens with SheetsRenderer, interactive grid + charts |
| T4 | "Build a landing page with 3 images" | MoA spawns 4 parallel tasks, Canvas shows CodeRenderer + images in A2r-Drive |
| T5 | "Make this coffee cup a latte" | Draw-to-Edit canvas opens, inpainting API returns edited image |
| T6 | "Research competitors and download their pricing pages" | Autopilot runs in background, files appear in A2r-Drive |

### 6.2 Performance Benchmarks

| Metric | Target | Measurement |
|--------|--------|-------------|
| Canvas render time | < 100ms | Time from artifact received to rendered |
| MoA task spawn time | < 500ms | Time from prompt to all tasks running |
| Image generation | < 10s | Time from prompt to image displayed |
| Draw-to-Edit latency | < 5s | Time from submit to edited image shown |
| Autopilot background | N/A | Task completes after UI closed |

---

## Part 7: Rollout Plan

### Week 1-2: Canvas Foundation
- [ ] Daily standups on Canvas progress
- [ ] Friday demo: Split-pane working with DocumentRenderer

### Week 3-4: MoA Orchestrator
- [ ] Wednesday: Router + DAG generator working
- [ ] Friday demo: Parallel task execution visible in Creative Cockpit

### Week 5-6: Specialized Renderers
- [ ] Wednesday: Slides + Sheets renderers complete
- [ ] Friday demo: Generate a 10-slide deck from prompt

### Week 7-8: A2r-Drive & Multimedia
- [ ] Wednesday: Asset manager sidebar working
- [ ] Friday demo: Generate 3 images, appear in A2r-Drive

### Week 9-10: Draw-to-Edit & Telephony
- [ ] Wednesday: Mask editor working
- [ ] Friday demo: Edit image with draw-to-edit flow

### Week 11-12: Autopilot & Polish
- [ ] Wednesday: Async job queue working
- [ ] Friday: Full integration test
- [ ] **Release: A2rchitech 2.0 "Creator Edition"**

---

## Appendix A: File Inventory

### Files to Create

```
6-ui/a2r-platform/src/views/
├── A2rCanvasView.tsx                    # NEW
├── canvas/
│   ├── CanvasContainer.tsx              # NEW
│   ├── CanvasRouter.tsx                 # NEW
│   ├── renderers/
│   │   ├── DocumentRenderer.tsx         # NEW
│   │   ├── SlidesRenderer.tsx           # NEW
│   │   ├── SheetsRenderer.tsx           # NEW
│   │   ├── CodeRenderer.tsx             # NEW (extend existing)
│   │   ├── ImageRenderer.tsx            # NEW
│   │   ├── VideoRenderer.tsx            # NEW
│   │   ├── AudioRenderer.tsx            # NEW
│   │   └── MermaidRenderer.tsx          # EXISTING (move)
│   ├── hooks/
│   │   ├── useCanvasStream.ts           # NEW
│   │   └── useCanvasLayout.ts           # NEW
│   └── utils/
│       ├── artifact-parser.ts           # NEW
│       └── renderer-registry.ts         # NEW
│   ├── components/
│   │   ├── CreativeCockpit.tsx          # NEW
│   │   ├── A2rDriveSidebar.tsx          # NEW
│   │   └── DrawToEditCanvas.tsx         # NEW
│   └── drivers/
│       ├── image_generation.ts          # NEW
│       ├── audio_generation.ts          # NEW
│       ├── video_generation.ts          # NEW
│       └── telephony.ts                 # NEW
│
4-services/orchestration/kernel-service/src/
├── moa/
│   ├── router.rs                        # NEW
│   ├── task_graph.rs                    # NEW
│   ├── executor.rs                      # NEW
│   └── synthesizer.rs                   # NEW
└── drivers/
    ├── image_generation.rs              # NEW
    ├── audio_generation.rs              # NEW
    ├── video_generation.rs              # NEW
    └── telephony.rs                     # NEW
```

### Files to Modify

```
6-ui/a2r-platform/src/
├── nav/nav.types.ts                     # Add 'canvas' ViewType
├── views/registry.ts                    # Register A2rCanvasView
├── shell/ShellApp.tsx                   # Add canvas routing
├── lib/ai/rust-stream-adapter.ts        # Add canvas artifact types
├── stores/sidecar-store.ts              # Add canvas panel state
└── views/
    ├── ChatView.tsx                     # Add canvas spawn logic
    ├── CoworkRoot.tsx                   # Add canvas spawn logic
    └── code/CodeRoot.tsx                # Add canvas spawn logic

4-services/orchestration/kernel-service/src/
├── lib.rs                               # Export MoA modules
├── main.rs                              # Add MoA config
└── brain/gateway.rs                     # Add MoA task routing
```

---

## Appendix B: API Endpoints

### New Endpoints

| Method | Endpoint | Purpose |
|--------|----------|---------|
| POST | `/api/canvas/spawn` | Spawn new canvas instance |
| POST | `/api/moa/submit` | Submit MoA task graph |
| GET | `/api/moa/status/:jobId` | Get MoA job progress |
| POST | `/api/media/generate` | Generate image/audio/video |
| POST | `/api/media/inpaint` | Draw-to-Edit inpainting |
| GET | `/api/drive/assets` | List A2r-Drive assets |
| POST | `/api/drive/upload` | Upload asset to drive |
| POST | `/api/telephony/call` | "Call For Me" telephony |

---

## Appendix C: Design Tokens

### Canvas Colors

```typescript
// src/design/tokens.ts
export const canvasColors = {
  canvasBg: '#1E1E1E',
  canvasBorder: 'rgba(255,255,255,0.08)',
  canvasAccent: '#D4956A', // A2rchitech amber
  rendererBg: '#252525',
  rendererHeader: '#2D2D2D',
  cockpitPending: 'rgba(255,255,255,0.3)',
  cockpitRunning: 'rgba(255,159,10,0.6)',
  cockpitDone: 'rgba(52,199,89,0.6)',
};
```

---

## Summary

This plan transforms A2rchitech into a **Creator & Knowledge Workspace** that:

1. ✅ **Matches Genspark's core features** (Sparkpages → Canvas, MoA, multimedia)
2. ✅ **Preserves A2rchitech strengths** (PTY, local files, multi-model support)
3. ✅ **Adds creator-specific workflows** (Slides, Sheets, Draw-to-Edit)
4. ✅ **Enables async execution** (Autopilot-style background tasks)
5. ✅ **Maintains developer appeal** (Code preview, terminal integration)

**Total Estimated Effort:** 12 weeks (3 months)  
**Team Size:** 2-3 developers  
**Risk Level:** Medium (leverages existing architecture)

---

**Next Steps:**
1. Review and approve this plan
2. Set up project tracking (Jira/Linear)
3. Begin Phase 1: Canvas Foundation
