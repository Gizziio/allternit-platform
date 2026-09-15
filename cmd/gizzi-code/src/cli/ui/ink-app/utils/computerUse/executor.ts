/**
 * CLI ComputerExecutor factory — engine backend.
 *
 * The original implementation wrapped two native macOS modules
 * (@ant/computer-use-input enigo input + @ant/computer-use-swift
 * ScreenCaptureKit). Those packages were never vendored into this repo; the
 * executor is now backed by the Allternit Computer Use Engine over HTTP
 * (see ./engine/executor.ts). The factory name is kept so hostAdapter.ts
 * stays close to its original shape; the gate callbacks are accepted for
 * signature compatibility but only used by a native backend.
 */

import { createEngineExecutor } from './engine/index.js'
import type { ComputerExecutor } from './engine/index.js'

export function createCliExecutor(_opts: {
  getMouseAnimationEnabled: () => boolean
  getHideBeforeActionEnabled: () => boolean
}): ComputerExecutor {
  if (process.platform !== 'darwin') {
    throw new Error(
      `createCliExecutor called on ${process.platform}. Computer control is macOS-only.`,
    )
  }
  return createEngineExecutor()
}
