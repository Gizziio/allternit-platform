# Architecture Notes - A2R Shell V2

## Docking & Tabs
- **FlexLayout** is restricted to BrowserView only.
- App-level navigation is handled by nav.store.ts and rendered via ViewHost.tsx.
- This prevents "global ide" syndrome and keeps the OS shell mode-based.

## Command Palette (Invoke)
- InvokeWindow is a dedicated Electron BrowserWindow.
- Triggered by Cmd+A / Option+A.
- Communication with the main window is handled via Electron IPC.

## Console Drawer
- Ported from legacy A2R implementation.
- Resizable bottom sheet, persists across view changes.
- Contains system logs, agent traces, and terminal REPLs.

## Design System
- Glass-morphism based on a layered token system (base, elevated, thick).
- Mode-aware color palettes (Chat: Blue, Cowork: Purple, Code: Green).
