# Unified UI Project Brief: Building a Disco GenTabs-like System with A2UI

## Project Overview

Build a unified UI system similar to Google's Disco GenTabs - an AI-powered interface that transforms multiple content sources (tabs, documents, APIs) into dynamic, interactive web applications using natural language.

---

## Reference Technologies

### Google Disco & GenTabs

**What it is:** An experimental Chromium-based browser from Google Labs (announced December 2025) featuring GenTabs - AI-generated interactive applications created from open browser tabs.

**Key Sources:**
- Official Blog: https://blog.google/technology/google-labs/gentabs-gemini-3/
- TechCrunch Coverage: https://techcrunch.com/2025/12/11/google-debuts-disco-a-gemini-powered-tool-for-making-web-apps-from-browser-tabs/
- 9to5Google: https://9to5google.com/2025/12/11/google-disco-gentab-browser/

**Core Capabilities:**
- Analyzes all open browser tabs simultaneously
- Uses chat history to understand user context and intent
- Generates temporary single-page applications on-the-fly
- Creates structured interfaces: timelines, planners, maps, comparisons, simulations
- All generated elements link back to original sources (attribution)
- No code required - natural language interface
- Powered by Gemini 3 (Google's most intelligent model)

**Technical Characteristics:**
- Built on Chromium
- Split interface: chat/omnibox on one side, web content on the other
- GenTabs are NOT hosted web pages - they are temporary SPAs generated dynamically
- Operates at the "interaction and orchestration layer" rather than reinventing web platform
- Implements "assembly and transformation" model vs passive page consumption

---

### A2UI (Agent-to-User Interface)

**What it is:** Google's open-source (Apache 2.0) declarative UI protocol for agent-driven interfaces. Enables AI agents to generate rich, interactive UIs that render natively across platforms without executing arbitrary code.

**Key Sources:**
- Official Documentation: https://a2ui.org/
- GitHub Repository: https://github.com/google/A2UI
- Introduction: https://a2ui.org/introduction/what-is-a2ui/
- Google Developers Blog: https://developers.googleblog.com/introducing-a2ui-an-open-project-for-agent-driven-interfaces/

**Current Status:** v0.8 (Public Preview), 9.6k+ GitHub stars

**Core Architecture (Three Layers):**
1. **UI Structure** - Components and layout
2. **Application State** - Data model with bindings
3. **Client Rendering** - Platform-specific native widgets

**How A2UI Works (Four-Stage Process):**
1. **Generation**: LLM creates A2UI Response (JSON payload) describing UI composition
2. **Transport**: Payload travels via A2A Protocol, AG UI, SSE, or WebSockets
3. **Resolution**: Client's A2UI Renderer parses JSON structure
4. **Rendering**: Abstract components map to native implementations

**Key Message Types:**
- `surfaceUpdate` - Modifies component structure
- `dataModelUpdate` - Changes application state
- `beginRendering` - Initiates display

**Core Concepts:**
- **Surface**: Canvas holding components (dialog, sidebar, main view)
- **Component**: UI elements (Button, TextField, Card, DataTable, etc.)
- **Data Model**: Application state with data binding
- **Catalog**: Available component types (client-controlled for security)

**Design Principles:**
- **Security-First**: Declarative data, NOT executable code. Agents request components from client's trusted catalog only
- **LLM-Optimized**: Flat component lists with ID references enable incremental generation and streaming
- **Framework-Agnostic**: Same JSON renders on React, Angular, Lit, Flutter, SwiftUI, Jetpack Compose
- **Developer Flexibility**: Open registry pattern for custom components and "Smart Wrappers"

**What A2UI is NOT:**
- Not a framework (it's a protocol)
- Not HTML replacement
- Not a robust styling system
- Not web-exclusive

**Platform Support:**
- Web: React, Angular, Lit
- Mobile: Flutter, SwiftUI, Jetpack Compose
- Desktop: Native implementations

---

## System Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         UNIFIED UI SYSTEM                                │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  ┌──────────────────┐                                                   │
│  │  CONTEXT LAYER   │                                                   │
│  ├──────────────────┤                                                   │
│  │ - URL Scraper    │  Collects content from multiple sources           │
│  │ - File Parser    │  Normalizes into structured format                │
│  │ - API Connector  │  Tracks source attribution                        │
│  │ - Chat History   │                                                   │
│  └────────┬─────────┘                                                   │
│           │                                                              │
│           ▼                                                              │
│  ┌──────────────────┐                                                   │
│  │ ORCHESTRATION    │                                                   │
│  ├──────────────────┤                                                   │
│  │ - Intent Detect  │  Analyzes context + user request                  │
│  │ - Task Classify  │  Determines UI pattern needed                     │
│  │ - LLM Interface  │  Generates A2UI JSON payloads                     │
│  │ - Prompt Engine  │  (Claude API or Gemini API)                       │
│  └────────┬─────────┘                                                   │
│           │                                                              │
│           ▼                                                              │
│  ┌──────────────────┐                                                   │
│  │ A2UI PROTOCOL    │                                                   │
│  ├──────────────────┤                                                   │
│  │ - JSON Payloads  │  Declarative component descriptions               │
│  │ - Data Bindings  │  State management                                 │
│  │ - Streaming      │  Progressive/incremental updates                  │
│  └────────┬─────────┘                                                   │
│           │                                                              │
│           ▼                                                              │
│  ┌──────────────────┐                                                   │
│  │ RENDERING LAYER  │                                                   │
│  ├──────────────────┤                                                   │
│  │ - A2UI Renderer  │  Maps abstract components to native widgets       │
│  │ - Component Cat. │  Trusted catalog of available components          │
│  │ - Action Handler │  Processes user interactions                      │
│  └──────────────────┘                                                   │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Data Flow

```
User Input (natural language)
        │
        ▼
┌───────────────────┐
│ Context Collector │ ◄── URLs, Files, APIs, Chat History
└─────────┬─────────┘
          │
          ▼
┌───────────────────┐
│ Content Normalizer│ ──► Structured data with source attribution
└─────────┬─────────┘
          │
          ▼
┌───────────────────┐
│ Intent Classifier │ ──► Task type: comparison, planning, research, viz
└─────────┬─────────┘
          │
          ▼
┌───────────────────┐
│   LLM Processor   │ ──► Prompt + Context ──► A2UI JSON Response
└─────────┬─────────┘
          │
          ▼
┌───────────────────┐
│  A2UI Renderer    │ ──► Interactive UI with source links
└───────────────────┘
          │
          ▼
User interacts ──► Actions sent back to LLM for refinement
```

---

## Implementation Phases

### Phase 1: Foundation (Week 1-2)

**Objective:** Set up A2UI rendering infrastructure

**Tasks:**
1. Clone A2UI repository: `git clone https://github.com/google/A2UI`
2. Set up React project with A2UI Lit renderer
3. Implement base component catalog:
   - Card
   - Button
   - TextField
   - TextArea
   - DataTable
   - List
   - Image
4. Create data model layer with state management (Zustand recommended)
5. Build basic surface management (main view, sidebar, dialogs)

**Deliverable:** Static A2UI renderer that can display hardcoded JSON payloads

---

### Phase 2: Context Collection (Week 2-3)

**Objective:** Build multi-source content ingestion

**Tasks:**
1. URL scraper using Cheerio or Puppeteer
   - Extract text content
   - Extract metadata (title, description, images)
   - Handle different content types
2. File parser support:
   - PDF (pdf-parse library)
   - Markdown
   - Plain text
   - JSON/structured data
3. API connector framework
   - Generic REST client
   - Response normalization
4. Content normalization pipeline:
   ```typescript
   interface NormalizedContent {
     id: string;
     sourceUrl: string;
     sourceType: 'url' | 'file' | 'api' | 'chat';
     title: string;
     content: string;
     metadata: Record<string, any>;
     extractedAt: Date;
   }
   ```
5. Source attribution tracking system

**Deliverable:** Context collector that can ingest multiple sources and output normalized content array

---

### Phase 3: LLM Orchestration (Week 3-4)

**Objective:** Connect LLM for A2UI generation

**Tasks:**
1. LLM API integration (choose one or support multiple):
   - Claude API (recommended)
   - Gemini API
   - OpenAI API
2. Prompt engineering for A2UI generation:
   ```
   System prompt structure:
   - Role: UI generator
   - Output format: A2UI JSON specification
   - Available components: [catalog list]
   - Context: [normalized content]
   - User intent: [user message]
   ```
3. Intent classification layer:
   - Comparison (multiple items side-by-side)
   - Planning (timelines, schedules, tasks)
   - Research (information synthesis, citations)
   - Visualization (charts, graphs, maps)
   - Form/Collection (data input interfaces)
4. Template/pattern selection based on intent
5. Streaming response handling for progressive UI rendering

**Deliverable:** LLM pipeline that takes context + user message and outputs valid A2UI JSON

---

### Phase 4: Dynamic Generation (Week 4-5)

**Objective:** Real-time UI generation and interaction

**Tasks:**
1. WebSocket setup for streaming LLM responses
2. Progressive rendering implementation:
   - Parse partial JSON as it streams
   - Update UI incrementally
   - Handle component additions/updates
3. Incremental update system:
   - Efficient diffing for conversation-based refinements
   - Preserve user state during updates
4. Interactive callback handling:
   - Button clicks
   - Form submissions
   - Component interactions
   - Feed actions back to LLM for regeneration
5. Error handling and recovery

**Deliverable:** Fully dynamic UI that generates and updates in real-time based on LLM output

---

### Phase 5: Polish & Production (Week 5-6)

**Objective:** Production-ready features

**Tasks:**
1. Source verification UI:
   - Clickable citations
   - Source preview on hover
   - Original source navigation
2. Session management:
   - Save generated apps
   - Restore previous sessions
   - Share generated views
3. Export capabilities:
   - Download as standalone HTML
   - Export data as JSON/CSV
   - Screenshot/PDF export
4. Performance optimization:
   - Caching layer for repeated content
   - Lazy loading for large datasets
   - Bundle optimization
5. Error states and loading UX

**Deliverable:** Production-ready unified UI system

---

## Technical Stack Recommendations

| Layer | Technology | Rationale |
|-------|------------|-----------|
| Frontend Framework | React 18+ | Best A2UI support, large ecosystem |
| A2UI Renderer | @anthropic/a2ui-react or Lit | Official implementations |
| State Management | Zustand | Lightweight, works well with streaming |
| Transport | WebSocket | Required for streaming LLM responses |
| HTTP Client | Axios or fetch | API calls |
| Content Extraction | Cheerio + Puppeteer | Static + dynamic page scraping |
| PDF Parsing | pdf-parse | Document extraction |
| LLM Client | Anthropic SDK / Google AI SDK | Official SDKs |
| Styling | Tailwind CSS | Utility-first, rapid prototyping |
| Build Tool | Vite | Fast development, good React support |
| Testing | Vitest + React Testing Library | Modern testing stack |

---

## A2UI JSON Payload Examples

### Basic Card Component
```json
{
  "surfaces": [{
    "id": "main",
    "components": [
      {
        "id": "card-1",
        "type": "Card",
        "props": {
          "title": "Summary",
          "content": "{{dataModel.summary}}"
        }
      }
    ]
  }],
  "dataModel": {
    "summary": "This is the synthesized content from your sources..."
  }
}
```

### Comparison Table
```json
{
  "surfaces": [{
    "id": "main",
    "components": [
      {
        "id": "comparison-table",
        "type": "DataTable",
        "props": {
          "columns": ["Feature", "Option A", "Option B", "Option C"],
          "rows": "{{dataModel.comparisonData}}",
          "sourceLinks": "{{dataModel.sources}}"
        }
      }
    ]
  }],
  "dataModel": {
    "comparisonData": [...],
    "sources": [
      {"id": "src-1", "url": "https://...", "title": "Source 1"}
    ]
  }
}
```

### Interactive Timeline
```json
{
  "surfaces": [{
    "id": "main",
    "components": [
      {
        "id": "timeline-1",
        "type": "Timeline",
        "props": {
          "events": "{{dataModel.events}}",
          "interactive": true
        }
      },
      {
        "id": "action-button",
        "type": "Button",
        "props": {
          "label": "Refine Timeline",
          "action": "refine"
        }
      }
    ]
  }],
  "dataModel": {
    "events": [
      {"date": "2025-01-15", "title": "Event 1", "source": "src-1"},
      {"date": "2025-02-01", "title": "Event 2", "source": "src-2"}
    ]
  }
}
```

---

## Component Catalog (Minimum Viable)

### Display Components
- **Card** - Content container with title, body, actions
- **Text** - Formatted text with markdown support
- **Image** - Image display with caption and source
- **List** - Ordered/unordered lists
- **DataTable** - Tabular data with sorting/filtering
- **Timeline** - Chronological event display
- **Chart** - Basic charts (bar, line, pie)

### Input Components
- **Button** - Action triggers
- **TextField** - Single-line text input
- **TextArea** - Multi-line text input
- **Select** - Dropdown selection
- **Checkbox** - Boolean toggles
- **DatePicker** - Date selection

### Layout Components
- **Container** - Flexbox container
- **Grid** - CSS Grid layout
- **Tabs** - Tabbed content sections
- **Accordion** - Collapsible sections

### Special Components
- **SourceCitation** - Linked reference to original source
- **LoadingPlaceholder** - Streaming content indicator
- **ErrorBoundary** - Error display

---

## LLM Prompt Template

```markdown
# System Prompt

You are a UI generation agent. Your task is to analyze the provided context and user request, then generate an A2UI JSON payload that creates an interactive interface to help the user accomplish their goal.

## Available Components
[Insert component catalog with props]

## Output Format
You must output valid A2UI JSON with this structure:
- surfaces: Array of surface objects containing components
- dataModel: Object containing all data bindings

## Rules
1. Every piece of information must link to its source
2. Use appropriate component types for the task
3. Create interactive elements where useful
4. Support incremental refinement
5. Keep the UI focused and uncluttered

## Task Types
- COMPARISON: Use DataTable or side-by-side Cards
- PLANNING: Use Timeline, List, or Calendar components
- RESEARCH: Use Cards with citations, expandable sections
- VISUALIZATION: Use Chart, Graph, or Map components

# User Context
Sources:
{{normalized_content}}

Chat History:
{{chat_history}}

# User Request
{{user_message}}

# Generate A2UI Response
```

---

## Minimum Viable Product Scope

For initial release, focus on:

1. **A2UI Renderer** with 6 core components (Card, Text, DataTable, List, Button, TextField)
2. **URL input** as primary context source (paste URLs to analyze)
3. **Single LLM call** generating unified view (no streaming initially)
4. **Basic source attribution** (clickable links to original URLs)
5. **Simple chat interface** for refinement requests

This MVP can be built in approximately 2 weeks with one developer.

---

## Key Success Metrics

1. **Generation Time** - Time from request to rendered UI (<5 seconds target)
2. **Source Accuracy** - All claims traceable to sources (100% target)
3. **Interaction Latency** - Time to respond to user actions (<1 second target)
4. **Cross-Platform Rendering** - Same payload renders correctly on web + mobile

---

## Security Considerations

1. **No Code Execution** - A2UI is declarative only; never execute generated code
2. **Component Whitelist** - Only allow pre-approved components from catalog
3. **Content Sanitization** - Sanitize all scraped content before display
4. **Source Validation** - Verify URLs before fetching
5. **Rate Limiting** - Limit LLM calls per user/session
6. **Authentication** - Secure access to generation endpoints

---

## Additional Resources

- A2UI Specification: https://a2ui.org/specification/
- A2UI Examples: https://github.com/google/A2UI/tree/main/examples
- CopilotKit A2UI Integration: https://www.copilotkit.ai/blog/build-with-googles-new-a2ui-spec-agent-user-interfaces-with-a2ui-ag-ui
- Google Labs Disco Waitlist: https://labs.google.com/disco

---

*Document generated for unified UI development project*
*Last updated: January 2025*
