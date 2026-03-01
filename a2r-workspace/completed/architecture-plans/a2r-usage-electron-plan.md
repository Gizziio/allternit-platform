# A2R Usage Electron Wrapper Plan

A2R Usage previously relied on Tauri, but we now host it natively in our Electron shell. The plan:

1. **Create a preload bridge** (`5-ui/a2r-platform/src/a2r-usage/electron-preload.ts`) that exposes the APIs the A2R Usage UI expects (`invoke`, `listen`, `getVersion`, tray helpers) via Electron IPC so the renderer stays runtime-agnostic.
2. **Rewire `5-ui/a2r-platform/src/a2r-usage/ui/App.tsx`** to import from the new preload shim (`a2rUsageShim`) instead of Tauri APIs. Remove any Tauri-specific plugins and replace them with Electron equivalents (update checks, tray icons, resource paths).
3. **Host provider orchestration inside Electron** by proxying to the new `/api/v1/telemetry/*` endpoints; the React UI can continue using the shared telemetry store so it doesn’t care whether the data originates from Tauri, Electron, or the operator.
4. **Keep the plugin assets** (`plugins/*.json`, `plugin.js`) in the A2R-managed `5-ui/a2r-platform/src/a2r-usage/plugins` folder but run them via our Python QuickJS runner in `4-services/a2r-operator`, eliminating the need for the original Rust/Tauri host.

After this refactor, the A2R Usage UI renders inside the Electron shell with normalized telemetry snapshots and no upstream branding.
