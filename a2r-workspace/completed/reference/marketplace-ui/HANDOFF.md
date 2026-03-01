# Hand-off Document: A2rchitech Marketplace UI Implementation

## 1. Objective Recap

The primary objective is to implement a polished, production-grade UI for a Marketplace within the A2rchitech shell. This Marketplace UI will operate in two modes: "Registered" (reusing the existing registry browsing UI) and "Marketplace" (for discovery, inspection, and importing assets to a draft registry). The implementation must adhere to strict guidelines, including working within the `a2rchitech` repository, avoiding backend logic implementation, and ensuring "Import" functionality rather than "Activate" in Marketplace mode.

## 2. Current Status & Accomplishments

The following steps have been completed:

*   **Project Root Confirmed**: The `a2rchitech` repository root has been identified as `/Users/macbook/Desktop/a2rchitech-workspace/a2rchitech`.
*   **Initial Codebase Investigation (Step 1)**: Extensive search using `grep` and `ls` commands has been performed to locate existing registry implementations. Key findings include:
    *   The main application is `apps/shell`.
    *   Existing UI components for the registry are `apps/shell/src/components/RegistryView.tsx`.
    *   A surprisingly comprehensive `apps/shell/src/components/MarketplaceView.tsx` already exists, providing a strong foundation.
    *   The primary application entry point appears to be `apps/shell/src/App.tsx`.
    *   Data and logic are likely handled by `packages/registry` and `services/registry-service`.
*   **`docs/marketplace_ui` Directory Created**: The documentation directory `apps/shell/docs/marketplace_ui` has been created.
*   **`UI_MAP.md` Created and Documented**: The first required deliverable, `UI_MAP.md`, has been created at `apps/shell/docs/marketplace_ui/UI_MAP.md`. It details the key file paths, component and state architecture, interaction flows, and a preliminary plan for implementation.
*   **`TwoModeRegistryView.tsx` Component Created**: A new React component, `apps/shell/src/components/TwoModeRegistryView.tsx`, has been created. This component includes a UI switch to toggle between a "Registered" mode (rendering `RegistryView`) and a "Marketplace" mode (rendering `MarketplaceView`).
*   **`MarketplaceView.tsx` Modified for "Import" Semantics**: The existing `apps/shell/src/components/MarketplaceView.tsx` has been updated to align with the "Import to Registry (Draft)" requirement. This involved:
    *   Renaming `handleInstall` to `handleImport`.
    *   Updating the API call from `api.installSkill` to `api.importSkill` (assuming `importSkill` will be implemented or mocked).
    *   Changing the `Asset` interface property `installed` to `isImported`.
    *   Updating all relevant UI text from "Install" or "Installed" to "Import" or "Imported" across buttons, status badges, and descriptions.
    *   Updating associated CSS classes from `installed` to `imported`.

## 3. Next Steps (To Do)

The following tasks remain to fully complete the request:

*   **Integrate `TwoModeRegistryView`**:
    *   Locate where `RegistryView` is currently rendered in `apps/shell/src/App.tsx`.
    *   Replace the direct rendering of `RegistryView` with `TwoModeRegistryView` in `apps/shell/src/App.tsx`.
*   **Data Layer Implementation (Step 3)**:
    *   Create the single boundary module `/src/<wherever your app keeps services>/marketplaceClient.ts`. Based on current findings, this would likely be `apps/shell/src/runtime/marketplaceClient.ts` or `apps/shell/src/api/marketplaceClient.ts` if a dedicated `api` folder exists.
    *   Implement `searchAssets(params) -> Promise<SearchResults>`, `getAssetDetail(assetId) -> Promise<AssetDetail>`, and `importAsset(assetRef) -> Promise<ImportResult>`.
    *   If real endpoints do not exist, provide deterministic mock data from a new file, e.g., `apps/shell/src/runtime/marketplaceFixtures.ts`.
    *   Update `MarketplaceView.tsx` to use this new `marketplaceClient.ts` instead of directly calling `api.listSkills()` and `api.importSkill()`.
*   **Deliverable: `API_CONTRACTS.md`**: Define the exact request/response shapes the UI expects, including stubs/mocks if backend endpoints are missing. This should be placed in `apps/shell/docs/marketplace_ui/API_CONTRACTS.md`.
*   **Deliverable: `WIREFRAME_TO_IMPLEMENTATION.md`**: Map wireframe sections to components. Given that `MarketplaceView` already exists, this will involve mapping existing wireframe sections (or conceptual ones) to the existing `MarketplaceView` components and any new components (like `TwoModeRegistryView`). This should be placed in `apps/shell/docs/marketplace_ui/WIREFRAME_TO_IMPLEMENTATION.md`.
*   **Deliverable: `ACCEPTANCE_TESTS.md` (Step 5)**: Write click-by-click checks for UI correctness, ensuring:
    *   Registry mode still functions as before.
    *   Marketplace mode loads correctly.
    *   Search and filters update results.
    *   Clicking a result opens the detail panel.
    *   Import triggers a call to `importAsset()` and shows a success state.
    *   No "Activate/Enable" actions appear in Marketplace mode.
    This should be placed in `apps/shell/docs/marketplace_ui/ACCEPTANCE_TESTS.md`.
*   **UI Quality Bar (Step 4)**: Ensure the final UI matches existing A2rchitech styling patterns, is visually appealing, handles empty/loading/error states, and uses appropriate UI elements.

## 4. Assumptions/Decisions Made

*   The A2rchitech project root is `/Users/macbook/Desktop/a2rchitech-workspace/a2rchitech`.
*   The primary UI application to modify is `apps/shell`.
*   The presence of `MarketplaceView.tsx` significantly streamlines the UI implementation, as a substantial portion of the UI structure, filtering, and detail display is already present. The task shifted from building a new Marketplace UI to integrating and adapting an existing one.
*   The `api` object used in `MarketplaceView.tsx` (e.g., `api.listSkills()`) is assumed to be `apps/shell/src/runtime/ApiClient.ts` or a similar file. This `ApiClient` will eventually be replaced or wrapped by the `marketplaceClient.ts` to create the requested boundary module.
*   The `importSkill` method is assumed to exist or will be added to the `api` client/boundary module.

## 5. Potential Blockers/Open Questions

*   **`api.importSkill` Implementation**: The `MarketplaceView.tsx` now calls `api.importSkill(id)`. This method needs to be implemented in the `ApiClient` or mocked in `marketplaceClient.ts`.
*   **Styling Consistency**: While `MarketplaceView.tsx` uses CSS classes, `RegistryView.tsx` uses inline styles. This will need to be harmonized during the UI Quality Bar step to ensure consistency with project conventions.
*   **Integration Point for `TwoModeRegistryView`**: While `apps/shell/src/App.tsx` is the most likely candidate, further investigation might be needed if `RegistryView` is wrapped within another component before `App.tsx`.
