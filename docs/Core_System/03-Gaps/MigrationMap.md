# Migration Map

**Version:** v0.1 Foundation
**Last updated:** 2026-03-14

## Purpose
Map every existing implementation file to its target location in the computer-use architecture. This document reflects the actual state of the v0.1 migration.

## Strategy
- Additive migration: copy or symlink, do not delete originals until new paths are verified
- Wrappers over rewrites: wrap existing modules behind new interfaces
- Preserve imports: shim old import paths to new locations during transition

## Completed Migrations

### Allternit Operator Service → services/computer-use-operator/

| Source | Target | Status |
|--------|--------|--------|
| `4-services/allternit-operator/src/main.py` | `services/computer-use-operator/src/main.py` | Done |
| `4-services/allternit-operator/src/__init__.py` | `services/computer-use-operator/src/__init__.py` | Done |
| `4-services/allternit-operator/src/brain_adapter.py` | `services/computer-use-operator/src/brain_adapter.py` | Done |
| `4-services/allternit-operator/src/plugin_engine.py` | `services/computer-use-operator/src/plugin_engine.py` | Done |
| `4-services/allternit-operator/src/telemetry.py` | `services/computer-use-operator/src/telemetry.py` | Done |
| `4-services/allternit-operator/src/browser_use/` | `services/computer-use-operator/src/browser_use/` | Done |
| `4-services/allternit-operator/src/allternit_vision/` | `services/computer-use-operator/src/allternit_vision/` | Done |
| `4-services/allternit-operator/Dockerfile` | `services/computer-use-operator/Dockerfile` | Done |
| `4-services/allternit-operator/requirements.txt` | `services/computer-use-operator/requirements.txt` | Done |

### Module Extraction → packages/computer-use/

| Source Module | Target Package | Status |
|--------------|---------------|--------|
| `brain_adapter.py` → session mgmt | `packages/computer-use/sessions/` | Done |
| `brain_adapter.py` → receipts | `packages/computer-use/receipts/` | Done |
| `brain_adapter.py` → policy | `packages/computer-use/policy/` | Done |
| `brain_adapter.py` → events | `packages/computer-use/core/` | Done |
| `telemetry.py` | `packages/computer-use/telemetry/` | Done |
| `allternit_vision/` | `packages/computer-use/vision/` | Done (standalone parser, no broken imports) |
| `browser_use/manager.py` → playwright | `packages/computer-use/adapters/browser/playwright/` | Done |
| `browser_use/manager.py` → browser-use | `packages/computer-use/adapters/browser/browser-use/` | Done |
| `browser_use/manager.py` → CDP | `packages/computer-use/adapters/browser/cdp/` | Done |
| `main.py` → desktop | `packages/computer-use/adapters/desktop/pyautogui/` | Done |

### Directories Removed (were stubs with no working code)

| Removed Path | Reason |
|-------------|--------|
| `adapters/browser/extension/` | No implementation — v0.2 |
| `adapters/browser/electron-web/` | No implementation — v0.2 |
| `adapters/browser/lightpanda/` | No implementation — v0.2 |
| `adapters/browser/puppeteer/` | No implementation — v0.2 |
| `adapters/browser/selenium/` | No implementation — v0.2 |
| `adapters/desktop/ui-tars/` | No implementation — v0.2 |
| `adapters/desktop/os-native/` | No implementation — v0.2 |
| `adapters/retrieval/` | Entire family — v0.2 |
| `adapters/hybrid/` | Entire family — v0.2 |
| `modes/` (7 empty subdirs) | Empty directories — routing handles modes |
| `contracts/` | Empty — schemas live in spec/computer-use/Contracts/ |
| `cookbooks/` | Empty — golden paths live in golden-paths/ |

## Kernel Components (No Move — Reference Only)

| Source | Role | Notes |
|--------|------|-------|
| `1-kernel/allternit-kernel/src/operator/orchestrator.ts` | TypeScript task lifecycle orchestrator | Stays in kernel |
| `1-kernel/allternit-kernel/src/operator/vision-parser.ts` | Parse VLM output | Stays in kernel |
| `1-kernel/allternit-kernel/src/operator/integrity.ts` | Safety and receipts (TS side) | Stays in kernel |
| `1-kernel/allternit-kernel/src/operator/dak/` | Deterministic Action Kernel | Stays in kernel |

## Configuration (No Move)

| Path | Status |
|------|--------|
| `~/.allternit/rails/` | No change |
| `~/.allternit/receipts/` | No change — new schema overlay applied |
| `~/.allternit/chrome-profile/` | Referenced by browser adapters |

## Rollback Plan
- Delete `services/computer-use-operator/`, originals in `4-services/` untouched
- Delete `packages/computer-use/`, operator still runs from original path
- Router is opt-in; disable by routing directly to operator endpoints
