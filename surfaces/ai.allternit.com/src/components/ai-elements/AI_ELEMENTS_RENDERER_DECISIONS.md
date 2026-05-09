# AI Elements Renderer Decisions
## UnifiedMessageRenderer.tsx — Per-Part-Type Component Choices

This file documents every decision made in `UnifiedMessageRenderer.tsx` about which component
renders each stream part type. Read this before adding, replacing, or removing any case.

**Rule: no agent adds a component to this renderer without updating this file.**

---

## Library Files — Wired vs Not Wired vs Custom

### REPLACED with library compound components (do not re-add custom versions)

| Part type | Removed impl | Now uses | File |
|-----------|-------------|----------|------|
| `reasoning` | `ThoughtProcessHeader` (custom collapsible) | `Reasoning` + `ReasoningTrigger` + `ReasoningContent` | `reasoning.tsx` |
| `plan` | inline div with Check/Clock/X icons | `Plan` + `PlanHeader` + `PlanTitle` + `PlanContent` + `PlanTrigger` | `plan.tsx` |
| `queue` | inline div with status icons | `Queue` + `QueueList` + `QueueItem` + `QueueItemIndicator` + `QueueItemContent` | `queue.tsx` |
| `task` | inline flex card with Clock/CheckCircle | `Task` + `TaskTrigger` + `TaskContent` + `TaskItem` | `task.tsx` |
| `checkpoint` | inline blue card with CheckCircle | `Checkpoint` + `CheckpointIcon` + `CheckpointDescription` | `checkpoint.tsx` |
| `commit` | inline green card with hash badge | `Commit` + `CommitHeader` + `CommitHash` + `CommitMessage` + `CommitCopyButton` | `commit.tsx` |
| `test-results` | inline table with CheckCircle/XCircle/Clock | `TestResults` + `TestResultsHeader` + `TestResultsSummary` + `Test` | `test-results.tsx` |
| `file-tree` | `FileTreeNode` helper (emoji+indent) | `FileTree` + `FileTreeFolder` + `FileTreeFile` via `renderFileTreeNodes()` | `file-tree.tsx` |

**Removed functions:** `ThoughtProcessHeader`, `FileTreeNode`  
**Removed phosphor icons:** `CheckCircle`, `XCircle`, `Clock`, `Check`, `X`, `CaretRight`

---

### KEPT as custom — do not replace with library

| Part type | Why kept |
|-----------|----------|
| `dynamic-tool` / `GlassPill` | `humanizeToolCall()` converts raw names to readable titles — library shows raw toolName |
| `source-document` / `SourceDocumentCard` | Sky-blue design + `SourcesFooter` strip — no library equivalent |
| `terminal` / `TerminalPill` | Glass-morphism design — library `Terminal` is plain style |
| `web-preview` / `BrowserPreviewCard` | Opens URLs in browser panel — library renders inline iframe |
| `artifact` / `ArtifactCard` | Side panel selection state — library `Artifact` has no panel integration |
| `confirmation` | `ConfirmationUIPart` has `title+description+actions[]` — library needs Vercel AI SDK tool state machine |
| `reasoning` verbose + ThoughtTrace | Kept for `viewMode === 'verbose'` when structured steps are present |

---

### ADDED new cases (zero coverage before Option B)

| Part type | Implementation | File |
|-----------|---------------|------|
| `environment-variables` | `EnvironmentVariables` compound with toggle | `environment-variables.tsx` |
| `snippet` | `Snippet` + `SnippetInput` + `SnippetCopyButton` | `snippet.tsx` |
| `stack-trace` | `StackTrace` compound; trace string reconstructed from frames | `stack-trace.tsx` |
| `package-info` | `PackageInfo` + sub-components for name/version/deps | `package-info.tsx` |
| `chain-of-thought` | `ChainOfThought` + `ChainOfThoughtHeader` + `ChainOfThoughtContent` + `ChainOfThoughtStep` | `chain-of-thought.tsx` |
| `context` | Custom info card (sky-blue accent) — no library equivalent | inline |
| `agent` | Custom info card (amber accent) — no library equivalent | inline |
| `open-in` | Button with `ArrowSquareOut`, opens `openInId` as URL | inline |
| `schema` | **Dual-path**: `SchemaDisplay` when schema has `method`+`path` (HTTP API shape); JSON `<pre>` otherwise | inline + `schema-display.tsx` |

---

## The 5 "Library Files NOT Wired" — Decisions

These files existed but were excluded from the renderer. Here is the full rationale and current status:

### `image.tsx` — Excluded (type mismatch)

**Why not wired:** `image.tsx` uses `Experimental_GeneratedImage` from the Vercel AI SDK — it expects
`{ base64: string, mediaType: string }` produced by `generateImage()`. Our `ImageUIPart` has `url: string`
(a hosted URL, not raw base64). They are genuinely different APIs.

**What we do instead:** Render `<img src={part.url}>` directly in the `image` case.

**If you want base64 support:** Add a `generated-image` part type with `base64` + `mediaType` fields and
wire `image.tsx` there. Do not change the existing `image` case — it would break all URL-based images.

---

### `web-preview.tsx` — Exported but NOT used in renderer

**Why not used in renderer:** Library `WebPreviewBody` renders an inline iframe. Our platform has a
dedicated browser panel (`browserview`). `BrowserPreviewCard` opens URLs there — much better UX for
multi-tab browsing, no CSP iframe issues, works with authenticated sessions.

**When to use library version:** Use `WebPreview` + `WebPreviewBody` directly in any view that needs an
embedded iframe widget (not full-panel). It IS exported and available — just not in the stream renderer.

**Do not** replace `BrowserPreviewCard` in the renderer with it.

---

### `artifact.tsx` — Exported but NOT used in renderer

**Why not used in renderer:** Library `Artifact` is a simple display card with no selection state.
`ArtifactCard` from `artifact-panel.tsx` tracks which artifact is selected and opens the side panel.
Removing side panel integration would break the entire artifact preview flow.

**When to use library version:** Use `Artifact` directly in non-panel contexts — artifact lists, gallery
rows, embeds — where selection state isn't needed.

---

### `schema-display.tsx` — NOW CONDITIONALLY WIRED (2026-05-09)

**Why originally excluded:** Library `SchemaDisplay` requires HTTP API shape (`method`, `path`,
`parameters`, `requestBody`, `responseBody`). Our `SchemaUIPart.schema` is `unknown` — generic JSON.

**Current state:** The `schema` case now checks if `part.schema` has `method: string` and `path: string`
at the top level. If yes → `SchemaDisplay`. If no → JSON `<pre>` block.

**Do not** always use `SchemaDisplay` — most schemas the AI generates are JSON schemas, not HTTP API specs.

---

### `jsx-preview.tsx` — NOW WIRED (2026-05-09)

**Why originally excluded:** No `jsx-preview` part type existed in `ExtendedUIPart`.

**Current state — two wiring points:**

1. **`sandbox` case:** if `part.html` starts with an uppercase component tag (`/^\s*<[A-Z<]/`), render via
   `JSXPreview` instead of a raw `<iframe srcDoc>`. Allows the backend to emit a sandbox part whose content
   is actually JSX and have it rendered as live React.

2. **`jsx-preview` part type:** dedicated new case using `JSXPreview` + `JSXPreviewContent` +
   `JSXPreviewError`. The backend should emit this when it explicitly wants live component rendering.

---

## Showcase Tool Components — Added 2026-05-09

New part types from the aisdkagents.com catalog integrated as first-class stream parts:

| Part type | Component | Description |
|-----------|-----------|-------------|
| `email-draft` | `EmailDraft` / `email-tool.tsx` | AI-composed email — To/Cc/Subject/Body + Open in Gmail + Mail App + Copy |
| `sms-draft` | `SMSDraft` / `sms-tool.tsx` | SMS bubble thread — Open in Messages + Copy + Edit + Reset |
| `recipe` | `RecipeDraft` / `recipe-tool.tsx` | Recipe card — step carousel, serving scaler, per-step timers |
| `image-search` | `ImageSearchTool` / `image-search-tool.tsx` | 3-col image grid with full lightbox |
| `app-recommendations` | `AppRecommendations` / `app-recommendations.tsx` | App cards with icon, rating, category, install link |
| `model-comparison` | `ModelComparison` / `model-comparison.tsx` | Feature table — default/compact/hover variants |
| `mock-chat` | `MockChat` / `mock-chat.tsx` | Simulated chat in claude/gpt/grok/gemini style with thinking bubble |
| `levee-wizard` | `LeveeWizard` / `levee-wizard.tsx` | Multi-step adaptive interview: text/choice/multi-choice/rating/confirm |
| `jsx-preview` | `JSXPreview` / `jsx-preview.tsx` | Inline React component with streaming tag auto-completion |

### Standalone components (no part type — imported directly by views)

| Component | File | Use case |
|-----------|------|----------|
| `BentoLayout` | `bento-layout.tsx` | Feature grid bento — 1x1/1x2/2x1/2x2 cells, accent glow, custom slots |

---

## Catalog Coverage — aisdkagents.com

### Free catalog — covered

| Category | Item | Status |
|----------|------|--------|
| Chat UI Elements | Basic Chat, Queue, Task, Tool Execution | ✅ |
| Reasoning & Sources | Reasoning, Sources & Citations, Inline Citations | ✅ |
| Confirmations & Plans | Plan, Tool Approval, Inline Citations Demo | ✅ |
| Artifacts | Canvas Draw (excalidraw), Chart, Code, Mermaid | ✅ |
| JSON Render | Data Table, Form, Cards, Chart (json-render.tsx) | ✅ |
| AI Components showcase | Email, SMS, Recipe, Image Search, App Recommendations | ✅ |
| AI Components showcase | Levee Wizard, What's New Dialog, Questions Panel | ✅ |
| UI Components | Model Comparison (3 variants), Mock Chat (4 styles) | ✅ |
| Marketing UI | Bento Layout | ✅ |

### Intentionally deferred (external dependencies required)

| Item | Blocker |
|------|---------|
| Map Artifact / Claude Map Itinerary | Requires Leaflet — not installed |
| JSON Render Three.js | Requires Three.js — complex setup |
| JSON Render Remotion | Requires Remotion — video rendering pipeline |
| Code Artifact in-browser Python | Requires Pyodide — heavy WASM bundle |
| Image Generation Demo | Needs `generateImage()` + base64 pipeline + `image.tsx` |

### Pro catalog (extrapolated patterns)

Pro items follow the same component patterns with richer backend orchestration:
- Orchestrator-Worker → emits `plan` + `task` + `queue` parts
- Evaluator-Optimizer → emits `chain-of-thought` + `test-results` parts
- Plan Builder Agent → emits `levee-wizard` for HIL input, then `plan`
- Tool Approval patterns → `confirmation` part
- Tool lifecycle hooks → `dynamic-tool` state transitions

---

## Stream Part → Component Quick Reference

| Stream Part | Component | Notes |
|-------------|-----------|-------|
| `text` | `Markdown` | cursor injected when streaming |
| `reasoning` | `Reasoning` / `ThoughtTrace` | ThoughtTrace only when verbose + structured steps |
| `code` | `CodeBlock` / `ArtifactCard` | ArtifactCard when filename + onSelectArtifact present |
| `terminal` | `TerminalPill` | glass-morphism custom style |
| `dynamic-tool` | `GlassPill` | humanized title, collapsible result |
| `source-document` | `SourceDocumentCard` | sky-blue card + SourcesFooter strip |
| `error` | inline div | ErrorUIPart has no frames — not StackTrace |
| `stack-trace` | `StackTrace` | frames reconstructed into string for parser |
| `test-results` | `TestResults` | summary spreads `skipped: 0` (our type omits it) |
| `plan` | `Plan` | status dots rendered inside PlanContent |
| `checkpoint` | `Checkpoint` | |
| `audio` | `AudioPlayer` | full control bar |
| `artifact` | `ArtifactCard` | side panel integration |
| `mcp-app` | `McpAppFrame` | |
| `citation` | `InlineCitation` | links back to source-document by sourceId |
| `queue` | `Queue` | |
| `task` | `Task` | |
| `commit` | `Commit` | |
| `confirmation` | custom div | library Confirmation needs Vercel AI SDK state machine |
| `file-tree` | `FileTree` | renderFileTreeNodes() recursive helper |
| `sandbox` | `JSXPreview` or iframe | JSXPreview when html starts with uppercase component tag |
| `jsx-preview` | `JSXPreview` | dedicated part type |
| `web-preview` | `BrowserPreviewCard` | opens browser panel, not inline iframe |
| `canvas` | placeholder div | Canvas is layout-level, not stream-renderable |
| `file-operation` | `FileChangeCard` / pill | FileChangeCard when content + onSelectArtifact |
| `image` | `ArtifactCard` / `<img>` | ArtifactCard when onSelectArtifact provided |
| `openui` | `AllternitOpenUIRenderer` / `ArtifactCard` | |
| `environment-variables` | `EnvironmentVariables` | |
| `snippet` | `Snippet` | |
| `package-info` | `PackageInfo` | |
| `schema` | `SchemaDisplay` or JSON pre | SchemaDisplay only when HTTP API shape detected |
| `chain-of-thought` | `ChainOfThought` | |
| `context` | custom sky-blue card | |
| `agent` | custom amber card | |
| `open-in` | button + ArrowSquareOut | |
| `email-draft` | `EmailDraft` | |
| `sms-draft` | `SMSDraft` | |
| `recipe` | `RecipeDraft` | |
| `image-search` | `ImageSearchTool` | |
| `app-recommendations` | `AppRecommendations` | |
| `model-comparison` | `ModelComparison` | |
| `mock-chat` | `MockChat` | |
| `levee-wizard` | `LeveeWizard` | |
