# Allternit Usage components ↔ Allternit telemetry map

Allternit Usage is an in-house telemetry surface inspired by OpenUsage. This document maps the original building blocks onto the Allternit architecture.

## 1. UI shell (`5-ui/allternit-platform/src/allternit-usage/ui/App.tsx`)
- *What it does*: hosts the Live Usage panel, tray controls, plugin filtering, auto-refresh cadence, and provider navigation.
- *Allternit alignment*: We reuse the React/Tailwind views, powered by an Electron wrapper (`electron-preload.ts`) that replaces the original Tauri runtime. The tray/tracking model translates to our `ShellRail`/`MonitorView` pair: the plugin list is the telemetry provider palette, and the tray icon becomes the mail-monitor shortcut.

## 2. Provider plugin architecture (`5-ui/allternit-platform/src/allternit-usage/plugins/*`)
- *What it does*: Each provider ships a `plugin.js` that exports `probe(ctx)` and registers through `globalThis.__allternit_usage_plugin`. The host supplies `ctx.host` helpers (FS, keychain, HTTP, logging).
- *Allternit alignment*: The `allternit-operator` service orchestrates these plugins via a QuickJS engine. Each plugin becomes a telemetry provider that produces `TelemetrySnapshot` (our normalized schema).

## 3. Normalized data model (`5-ui/allternit-platform/src/allternit-usage/ui/lib/plugin-types.ts`)
- *What it does*: Defines how the UI renders providers (lines, primary metrics, icons) and how probes fire (auto-refresh, manual refresh, queue).
- *Allternit alignment*: We align this with `SessionAnalytics` (timeline/token/tool usage). The `TelemetrySnapshot` schema resembles the original `PluginOutput` but is integrated into our unified telemetry system.

## 4. Electron runtime (`6-apps/shell-electron/preload/index.ts`, `5-ui/allternit-platform/src/allternit-usage/electron-preload.ts`)
- *What it does*: Replaces the original Rust/Tauri host. Handles IPC, window sizing, and event bridging between the Electron main process and the React renderer.
- *Allternit alignment*: The Electron main process proxies telemetry requests to the `allternit-operator` API, while the preload bridge exposes the expected hooks (`invoke`, `listen`, etc.) to the UI.

## Summary
Allternit Usage provides a vendor-neutral telemetry shell within the Allternit platform. By keeping the React components and plugin data model but swapping the runtime for Electron/Operator-orchestrated QuickJS, we provide a consistent monitoring experience across all LLM providers.