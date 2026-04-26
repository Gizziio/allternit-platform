# Allternit Reality Spec: UI & Surfaces (Allternit OS)

**Location:** `surfaces/allternit-platform/`  
**Status:** ACTIVE / EVOLVING  
**Date:** April 14, 2026

## 1. Role
The UI system has evolved from a simple tabbed interface into a web-based operating environment known as **Allternit OS**. It provides a windowed, multi-panel workspace for interacting with agents, workflows, and tools.

## 2. Shell Layout System
Implementation: `src/shell/layout/`
The Shell provides a persistent frame containing:
- **TopBar:** Navigation, Breadcrumbs, and Global Actions.
- **Sidebar:** Navigation between OS "Programs" (Chat, Code, Agents, Terminal).
- **PanelContainer:** Dynamic regions for specialized tools (Diff, Artifacts, Inspect).
- **BottomBar:** Connection and Sync status indicators.

## 3. Allternit OS (Web Environment)
Implementation: `src/allternit-os/`
- **Programs:** Independent modules that run within the shell (e.g., `programs/terminal`, `programs/workflow-builder`).
- **Services:** UI-level shared logic for notifications, window management, and store synchronization.
- **Stores:** State management for agents, models, and sessions.

## 4. Integration Strategy (API First)
**The "Kernel Bridge" (`src/integration/kernel/`) is DEPRECATED.**
Allternit OS now communicates with the system through a centralized **API Client** that routes requests through the `routing-gateway`. This ensures that the UI remains decoupled from the specific execution environment (Local vs Cloud).

## 5. Current Gaps vs Target
- **Tab-Centric Legacy:** Some parts of the codebase still reference the "Unified UI Law" tab-centric model, while the "OS" model is moving toward more complex window/panel management.
- **Direct Bridge Removal:** The migration from direct kernel bridges to the API client is ongoing and needs to be completed across all "Programs."
