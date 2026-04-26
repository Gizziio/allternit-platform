# Allternit Cowork Mode Specification

## Mental Model
Cowork is a collaborative agent workspace focused on artifact production rather than just message history. It is a multi-panel orchestrator where agents and users work on shared documents, toolchains, and execution runs.

## Layout Regions
- **Cowork Rail**: Project-oriented navigation (Home, Workstreams, Artifacts, Plugins, Context).
- **Conversation Panel**: Contextual chat, scoped to the current workstream.
- **Artifact Canvas**: Central area for rendering documents, code, and UI blocks.
- **Inspector Panels**: Right-side docks for execution tracing and step details.
- **Console Drawer**: Global bottom overlay for system logs and terminal access.

## Panel Behavior
- deterministic split-pane model (not global FlexLayout).
- resizable via draggable handles.
- collapsible to zero-width (maintaining state).
- tabs within dock regions.

## Plugin Definition (Execution Capsules)
- **Manifest (plugin.json)**: metadata and entry points.
- **Tools (mcp.json)**: MCP server configurations.
- **Commands**: Slash-command markdown/json definitions.
- **Skills**: Auto-activated skill packs (SKILL.md).
- **UI Panels**: React components for specific artifact or inspector rendering.

## Document Model
- Persistent artifacts stored in .
- Types: Document, Code, Table, Board, UI-Block.
- Lifecycle: Create -> Pin -> Open -> Edit -> Export.

## Run Model
- A 'Run' is a unified execution unit containing multiple steps (Search, Browser, Desktop).
- Steps are structured and traceable in the Inspector.

## Spawn Rules
- Terminal: Internal drawer or external window.
- Browser: Internal panel by default.
- Invoke: Always separate Electron window.
- Cowork Panels: Always internal.
