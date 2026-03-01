# UI Map: A2rchitech Marketplace

This document outlines the file structure, components, and data flow for the A2rchitech Marketplace UI. It is based on the initial investigation of the codebase.

## 1. Key File Paths

Based on the codebase search, the relevant files and directories for the existing Registry implementation are:

*   **Primary UI Application**: `apps/shell`
*   **Registry Page Route**: `apps/shell/src/pages/registry` (Likely location of the main registry component)
*   **Registry UI Components**: `apps/shell/src/components/Registry/` (Reusable components for the registry)
*   **Registry Data & Logic**: `packages/registry/` (Contains data models, and core logic for handling registry assets)
*   **Backend Service**: `services/registry-service/` (The backend service that manages the registry data)
*   **Rust Components**: `crates/registry/` (Core data structures and logic, likely for performance)

## 2. Component & State Architecture

*   **UI Framework**: The `apps/shell` seems to be a Next.js application, based on the `package.json` in the root.
*   **State Management**: The exact state management library is not yet determined, but it's likely React state or a library like Redux or Zustand. This will be confirmed by inspecting the files in `apps/shell/src/pages/registry`.
*   **Data Flow**:
    1.  The UI in `apps/shell` makes API calls to the `services/registry-service`.
    2.  The `services/registry-service` uses the `packages/registry` and `crates/registry` to manage and retrieve asset data.
    3.  The data is returned to the UI and rendered.

## 3. Interaction Flows

The existing registry likely supports the following interactions:

*   **Viewing assets**: Listing all available agents, tools, skills, etc.
*   **Activating/Deactivating assets**: Enabling or disabling assets in the user's environment.
*   **Importing assets**: Adding new assets to the registry from an external source.

The new Marketplace UI will build on these existing flows, adding a "Marketplace" mode for discovery and import, separate from the "Registered" mode for managing existing assets.

## 4. Plan for Marketplace UI Implementation

1.  **Integrate Mode Switch**: Add a "Registered" / "Marketplace" switch in the `apps/shell/src/pages/registry` component.
2.  **Build Marketplace Components**: Create new React components for the Marketplace UI inside `apps/shell/src/components/Marketplace/`.
    *   `MarketplaceView`
    *   `MarketplaceSearchBar`
    *   `MarketplaceFilters`
    *   `MarketplaceResultsList`
    *   `MarketplaceDetailsPanel`
3.  **Create Data Client**: Implement a `marketplaceClient.ts` in `apps/shell/src/lib/` to handle all communication with the backend, with mock data for endpoints that don't exist yet.
4.  **Wire Up UI**: Connect the Marketplace components to the data client and render the UI.

This map will be updated as the implementation progresses.
