# Tauri → Electron Migration Ledger

**Created**: 2024-01-16
**Status**: In Progress - Phase 0: Repo Archaeology
**Migrated By**: Sisyphus AI Agent

---

## 1. Tauri-Related Codepaths Inventory

### 1.1 Tauri App Structure

| File/Directory | Purpose | Tauri API Used | Migration Status | Notes |
|---|---|---|---|---|
| `apps/shell-tauri/` | Tauri host application | N/A | `unmapped` | Main Tauri app directory |
| `apps/shell-tauri/src-tauri/` | Tauri src-tauri build | Tauri 2.5 | `unmapped` | Contains Cargo.toml, tauri.conf.json |
| `apps/shell-tauri/src-tauri/Cargo.toml` | Tauri dependencies | tauri 2.5 | `unmapped` | Defines Tauri version and features |
| `apps/shell-tauri/src-tauri/tauri.conf.json` | Tauri configuration | Config schema | `unmapped` | Window config, security, bundle settings |
| `apps/shell-tauri/src-tauri/build.rs` | Build script | tauri-build | `unmapped` | Tauri build hook |
| `apps/shell-tauri/src-tauri/src/` | Tauri main source | N/A | `unmapped` | Contains index.html, ui folder |
| `apps/shell-tauri/Cargo.toml` | Workspace Cargo | N/A | `unmapped` | Root workspace for Tauri |
| `apps/shell-tauri/test-shell.sh` | Test script | Shell | `unmapped` | Shell test script |

### 1.2 Tauri Dependencies

| Dependency | Version | Used In | Purpose | Migration Status |
|---|---|---|---|---|
| `tauri` | 2.5 | `apps/shell-tauri/src-tauri/Cargo.toml` | Core Tauri framework | `unmapped` |
| `tauri-build` | 2.5 | `apps/shell-tauri/src-tauri/Cargo.toml` | Build-time Tauri utilities | `unmapped` |
| `tauri-plugin-shell` | 2 | `apps/shell-tauri/src-tauri/Cargo.toml` | Shell plugin | `unmapped` |
| `withGlobalTauri` | N/A | `apps/shell-tauri/src-tauri/tauri.conf.json` | Global Tauri API exposure | `unmapped` |

### 1.3 Tauri API Usage in Frontend

| File | Tauri API Used | Purpose | Migration Status | Notes |
|---|---|---|---|---|
| `apps/ui/src/views/GpuRenderer.tsx` | `window.__TAURI__.webview.emit()` | GPU navigation, input, execution | `unmapped` | Tauri webview IPC for GPU renderer |
| `apps/ui/src/views/GpuRenderer.tsx` | `window.__TAURI__ !== undefined` | Tauri availability check | `unmapped` | Feature detection |
| `apps/shell/dist/assets/index-*.js` (bundled) | `window.__TAURI__` | Bundled Tauri references | `unmapped` | Needs regeneration after migration |

---

## 2. Browser Components Inventory

### 2.1 Browser Capsule UI

| File | Purpose | Tauri Dependency | Migration Status | Notes |
|---|---|---|---|---|
| `apps/ui/src/views/BrowserView.ts` | Main browser capsule (1643 lines) | Indirect via GpuRenderer | `unmapped` | Core browser UI - mostly React/DOM |
| `apps/ui/src/views/StageSlot.tsx` | Stage container component | None | `unmapped` | Pure DOM - no Tauri dependency |
| `apps/ui/src/views/GpuRenderer.tsx` | GPU renderer with Tauri IPC | Heavy Tauri usage | `unmapped` | Needs Electron BrowserView equivalent |
| `apps/shell/src/components/tabs/Browser/BrowserViewComponent.tsx` | React browser component | None | `unmapped` | Simple React component |

### 2.2 Browser Runtime (Playwright)

| File | Purpose | Tauri Dependency | Migration Status | Notes |
|---|---|---|---|---|
| `services/browser-runtime/src/index.ts` | HTTP server for browser service | None | `unmapped` | Runs Playwright headless |
| `services/browser-runtime/src/browser.ts` | Playwright controller | None | `unmapped` | Agent renderer - no changes needed |
| `services/browser-runtime/src/types.ts` | Type definitions | None | `unmapped` | Types only |

### 2.3 A2UI Adapters

| File | Purpose | Tauri Dependency | Migration Status | Notes |
|---|---|---|---|---|
| `apps/ui/src/a2ui/adapters/BrowserAdapter.ts` | Browser → A2UI schema | None | `unmapped` | Pure mapping - no changes |
| `apps/ui/src/a2ui/adapters/StageAdapter.ts` | Stage → A2UI schema | None | `unmapped` | Pure mapping - no changes |
| `apps/ui/src/a2ui/adapters/RendererAdapter.ts` | Renderer → A2UI schema | None | `unmapped` | Pure mapping - no changes |
| `apps/ui/src/a2ui/adapters/types.ts` | Adapter types | None | `unmapped` | Types only |

---

## 3. Host Responsibilities Mapping

### 3.1 Current Tauri Host Responsibilities

| Capability | Current Implementation | Tauri API | Target Electron Module | Migration Status |
|---|---|---|---|---|
| **Window Creation** | Single BrowserWindow configured in tauri.conf.json | Tauri config | `electron.BrowserWindow` | `unmapped` |
| **WebView Rendering** | React UI via Vite dev server in Tauri webview | `withGlobalTauri` | `electron.BrowserView` | `unmapped` |
| **IPC (Main → Renderer)** | Tauri invoke/emit | `window.__TAURI__.invoke()` | `ipcRenderer.invoke()` | `unmapped` |
| **IPC (Renderer → Main)** | Tauri emit/listen | `window.__TAURI__.event.emit()` | `ipcMain.handle()` | `unmapped` |
| **Browser Navigation** | Not implemented in Tauri | N/A | BrowserView navigation | `unmapped` |
| **File System** | Not implemented | N/A | `electron.dialog`, fs module | `unmapped` |
| **Native Menus** | Not implemented | N/A | `electron.Menu` | `unmapped` |
| **Shortcuts** | Not implemented | N/A | globalShortcut | `unmapped` |
| **Clipboard** | Not implemented | N/A | `electron.clipboard` | `unmapped` |
| **Notifications** | Not implemented | N/A | `electron.Notification` | `unmapped` |
| **Deep Links** | Not implemented | N/A | `electron.app.setAsDefaultProtocolClient` | `unmapped` |

---

## 4. Repository Structure Reference

### 4.1 Shell Applications

```
apps/
├── shell/                          # React + Vite frontend
│   ├── src/
│   │   ├── main.tsx
│   │   ├── App.tsx
│   │   ├── components/
│   │   │   └── tabs/Browser/
│   │   ├── runtime/
│   │   ├── styles/
│   │   └── utils/
│   ├── package.json
│   └── vite.config.ts
│
├── shell-tauri/                    # Tauri host (TO BE MIGRATED)
│   ├── src-tauri/
│   │   ├── Cargo.toml
│   │   ├── tauri.conf.json
│   │   ├── build.rs
│   │   ├── capabilities/
│   │   ├── icons/
│   │   └── src/
│   │       └── index.html
│   ├── Cargo.toml
│   └── test-shell.sh
│
└── shell-electron/                 # NEW: Electron host (TO BE CREATED)
    ├── package.json
    ├── tsconfig.json
    ├── main.ts
    ├── preload.ts
    └── src/
```

### 4.2 Core Packages

```
packages/
├── capsule-sdk/                    # Capsule SDK (headless)
│   └── src/
│       ├── core/
│       ├── controllers/
│       └── guards/
```

### 4.3 Services

```
services/
└── browser-runtime/                # Playwright service (AGENT renderer)
    ├── src/
    │   ├── index.ts
    │   ├── browser.ts
    │   └── types.ts
    └── package.json
```

### 4.4 UI Adapters

```
apps/ui/src/
└── a2ui/adapters/                  # A2UI adapters (pure mapping)
    ├── index.ts
    ├── types.ts
    ├── BrowserAdapter.ts
    ├── StageAdapter.ts
    └── RendererAdapter.ts
```

---

## 5. Migration Summary

| Category | Total Items | Mapped | Implemented | Validated |
|---|---|---|---|---|
| Tauri Files/Directories | 12 | 0 | 0 | 0 |
| Tauri Dependencies | 4 | 0 | 0 | 0 |
| Tauri API Usage Points | 15+ | 0 | 0 | 0 |
| Browser Components | 6 | 0 | 0 | 0 |
| Host Capabilities | 11 | 0 | 0 | 0 |

---

## 6. Next Steps

1. **Complete Phase 0**: Finish host responsibility mapping
2. **Begin Phase 1**: Create `apps/shell-electron/` scaffold
3. **Create ELECTRON_HOST_PLAN.md**: Document run commands and architecture
4. **Create ELECTRON_IPC_CONTRACT.md**: Define IPC channels and events
5. **Implement HUMAN renderer**: BrowserView-based Stage implementation

---

*This ledger is updated throughout the migration. Last update: 2024-01-16*
