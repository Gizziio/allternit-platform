# Allternit Shell Implementation Backlog

This file tracks high-fidelity UI components and features that have been implemented but are currently unwired, stubbed, or require real backend integration.

## 1. Chat Composer (PromptInput)
- [ ] **Model Selection**: `PromptModelSelector` uses a hardcoded list. Needs wiring to the dynamic model registry/backend.
- [ ] **Voice Recording**: Toggle and UI states implemented. Needs integration with Web Audio API and a transcription service (Whisper/Gemini-Flash).
- [ ] **Mode Toggles**: Search, Research, Agent, and Temp Chat toggles are UI-only. Need to be added to the prompt generation context.
- [ ] **Adaptive Context**: Terminal Sync and App Context toggles exist. Need logic to pull PTY history and OS-level accessibility/window context.
- [ ] **Attachments**: "Attach" button is visible. Needs a file picker dialog and multipart upload/embedding handling.
- [ ] **Auto-suggestion**: "Tab-to-finish" logic uses a mock string ("react component"). Needs real autocomplete/LLM-prediction integration.

## 2. Message Actions & Intelligence
- [ ] **Chain of Thought (CoT)**: Rendering and collapsible structure verified with mock data. Needs to parse real `<thought>` tags or event streams from AI drivers.
- [ ] **Tool Call Visualization**: `ToolCall` component verified with mock events. Needs integration with the real `Runner` execution stream.
- [ ] **JSON Render**: `@json-render/react` is installed. `ChatView` needs logic to detect and render JSON schemas instead of raw markdown for specific tool outputs.
- [ ] **TTS (Speak)**: "Speaker" button exists. Needs wiring to a speech synthesis engine.
- [ ] **Branching**: "Branch Session" ellipsis action exists. Needs logic to duplicate the current thread state into a new `ChatStore` ID.
- [ ] **Retry Modes**: Think Hard/Harder/Ultra actions are stubbed. Need to map these to specific system prompt prefixes (e.g., "Analyze this step-by-step with extreme detail").

## 3. Global UI State
- [ ] **Persistence**: `ChatStore` and `ThemeStore` use localStorage. Heavy sessions may require SQLite migration (already in root as `storage.sqlite3`).
- [ ] **Native Interop**: Sidebar Toggle and Window Controls are positioned for macOS. Windows/Linux title bar logic needs verification.

## 4. Dependencies Ready for Use
- `react-markdown` / `rehype-highlight` / `shiki`: Integrated for code/rich text.
- `framer-motion`: Available for complex animations.
- `use-stick-to-bottom`: Integrated for chat ergonomics.
- `radix-ui`: Primitives (Popover, Tooltip, Collapsible) are fully configured.
## 5. Cowork Mode (Orchestrator Surface)
- [ ] **Plugin Registry Wiring**: PluginRegistryView displays mock plugins. Needs logic to scan plugins/ directory, parse plugin.json manifests, and dynamically register capabilities.
- [ ] **MCP Execution**: MCP connectors are listed in UI. Needs wiring to the mcp-sdk to launch and manage local tool servers.
- [ ] **Slash Commands**: Cowork composer needs logic to parse / commands from active plugins and inject their templates.
- [ ] **Skill Activation**: Needs automated keyword matching logic to attach skill packs to active Runs.
- [ ] **Artifact Persistence**: ArtifactStore uses a basic Zustand persist. Needs real-time syncing with the filesystem/git for collaborative editing.
- [ ] **Run Model Integration**: CoworkRoot displays mock steps. Needs to be wired to the Unified Run Engine to show real-time progress of search/browser/desktop actions.
- [ ] **Context Panel**: Needs a functional file-picker and session-binding logic to allow Projects style context attachment.
- [ ] **Document Rendering**: ArtifactRenderer is currently a simple pre block. Needs specialized renderers for PDFs, CSV/Tables, and JSON-Render UI blocks.
