/**
 * Runtime globals the vendored Electron main process expects (Node Buffer,
 * process.env). Must evaluate BEFORE any vendored module — import this first
 * in SlidesApp.tsx (ESM side-effect order follows import order).
 */
import { Buffer } from 'buffer'

;(globalThis as Record<string, unknown>).Buffer ??= Buffer
;(globalThis as Record<string, unknown>).process ??= { env: {} }
;(globalThis as Record<string, unknown>).__dirname ??= '/virtual/src/main'
;(globalThis as Record<string, unknown>).__filename ??= '/virtual/src/main/index.js'
