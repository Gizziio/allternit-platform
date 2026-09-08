/**
 * Engine-backed ComputerExecutor.
 *
 * Replaces the native macOS executor (`@ant/computer-use-input` enigo input +
 * `@ant/computer-use-swift` ScreenCaptureKit) with calls to the Allternit
 * Computer Use Engine via `@allternit/computer-use`.
 *
 * Honest capability boundary: the engine exposes input actions
 * (click/type/key/scroll/drag/hover/wait) and screenshots. Host-app
 * management (hide/unhide, enumeration, activation) and display geometry are
 * NOT engine concepts — those methods either no-op (hide: the engine never
 * hides host apps) or throw a clear "not supported by the engine backend"
 * error. Clipboard stays local via pbpaste/pbcopy on macOS, matching the
 * original CLI behavior.
 */

import { AllternitComputerUseClient } from '@allternit/computer-use'
import type { EngineAction } from '@allternit/computer-use'
import { execFileNoThrow } from '../../execFileNoThrow.js'
import { CLI_CU_CAPABILITIES, CLI_HOST_BUNDLE_ID } from '../common.js'
import type {
  ComputerExecutor,
  DisplayGeometry,
  FrontmostApp,
  InstalledApp,
  ResolvePrepareCaptureResult,
  RunningApp,
  ScreenshotResult,
} from './types.js'

export interface EngineExecutorOptions {
  /**
   * Engine endpoint. Defaults mirror the rest of the repo
   * (surfaces/ai.allternit.com, packages/sdk capabilities/computer.ts).
   */
  endpoint?: string
  apiKey?: string
}

export function resolveEngineEndpoint(): string {
  return (
    process.env.ACU_GATEWAY_URL ??
    process.env.ALLTERNIT_COMPUTER_USE_URL ??
    'http://127.0.0.1:8760'
  )
}

/** Read [width, height] from a base64 PNG's IHDR chunk. */
function pngDimensions(base64: string): [number, number] {
  const buf = Buffer.from(base64, 'base64')
  // PNG signature (8 bytes) + IHDR length(4) + "IHDR"(4) + width(4) + height(4)
  if (
    buf.length < 24 ||
    buf.readUInt32BE(0) !== 0x89504e47 // "\x89PNG"
  ) {
    return [0, 0]
  }
  return [buf.readUInt32BE(16), buf.readUInt32BE(20)]
}

function notSupported(what: string): Error {
  return new Error(
    `${what} is not supported by the engine backend (Allternit Computer Use Engine).`,
  )
}

export function createEngineExecutor(
  opts: EngineExecutorOptions = {},
): ComputerExecutor {
  const endpoint = opts.endpoint ?? resolveEngineEndpoint()
  const client = new AllternitComputerUseClient({
    endpoint,
    apiKey: opts.apiKey,
  })

  /** Run one direct-mode batch; throws with the engine's error message. */
  async function runActions(actions: EngineAction[]): Promise<void> {
    const result = await client.executeDirect(actions)
    if (result.error) {
      throw new Error(
        `Engine error (${result.error.code}): ${result.error.message}`,
      )
    }
  }

  async function readClipboardViaPbpaste(): Promise<string> {
    const { stdout, code } = await execFileNoThrow('pbpaste', [], {
      useCwd: false,
    })
    if (code !== 0) {
      throw new Error(`pbpaste exited with code ${code}`)
    }
    return stdout
  }

  async function writeClipboardViaPbcopy(text: string): Promise<void> {
    const { code } = await execFileNoThrow('pbcopy', [], {
      input: text,
      useCwd: false,
    })
    if (code !== 0) {
      throw new Error(`pbcopy exited with code ${code}`)
    }
  }

  return {
    capabilities: {
      ...CLI_CU_CAPABILITIES,
      screenshotFiltering: 'none',
      hostBundleId: CLI_HOST_BUNDLE_ID,
    },

    // ── Hide/defocus — the engine never hides host apps: designed no-ops ─────

    async prepareForAction(): Promise<string[]> {
      return []
    },
    async previewHideSet() {
      return []
    },

    // ── Display — geometry is not exposed by the engine API ──────────────────

    async getDisplaySize(): Promise<DisplayGeometry> {
      throw notSupported('Display geometry')
    },
    async listDisplays(): Promise<DisplayGeometry[]> {
      throw notSupported('Display listing')
    },
    async findWindowDisplays() {
      throw notSupported('Window display lookup')
    },
    async resolvePrepareCapture(opts: {
      allowedBundleIds: string[]
      preferredDisplayId?: number
      autoResolve: boolean
      doHide?: boolean
    }): Promise<ResolvePrepareCaptureResult> {
      // No hide, no resolver chain — the engine owns targeting.
      return {
        displayId: opts.preferredDisplayId ?? 0,
        width: 0,
        height: 0,
        hidden: [],
      }
    },

    // ── Capture ──────────────────────────────────────────────────────────────

    async screenshot(): Promise<ScreenshotResult> {
      const { screenshot } = await client.visionScreenshot()
      const [width, height] = pngDimensions(screenshot)
      return { base64: screenshot, width, height, mimeType: 'image/png' }
    },

    async zoom(): Promise<{ base64: string; width: number; height: number }> {
      throw notSupported('Region capture (zoom)')
    },

    // ── Keyboard ─────────────────────────────────────────────────────────────

    async key(keySequence: string, repeat = 1): Promise<void> {
      const actions = Array.from({ length: repeat }, () => ({
        kind: 'key',
        input: { keys: keySequence },
      }))
      await runActions(actions)
    },

    async holdKey(keyNames: string[], durationMs: number): Promise<void> {
      await runActions([
        {
          kind: 'key',
          input: { keys: keyNames.join('+'), hold_ms: durationMs },
        },
      ])
    },

    async type(
      text: string,
      opts: { viaClipboard: boolean },
    ): Promise<void> {
      if (opts.viaClipboard) {
        // Same discipline as the native backend: write, verify, type Cmd+V.
        await writeClipboardViaPbcopy(text)
        if ((await readClipboardViaPbpaste()) !== text) {
          throw new Error('Clipboard write did not round-trip.')
        }
        await runActions([{ kind: 'key', input: { keys: 'command+v' } }])
        return
      }
      await runActions([{ kind: 'type', input: { text } }])
    },

    readClipboard: readClipboardViaPbpaste,
    writeClipboard: writeClipboardViaPbcopy,

    // ── Mouse ────────────────────────────────────────────────────────────────

    async moveMouse(x: number, y: number): Promise<void> {
      await runActions([{ kind: 'hover', target: { x, y } }])
    },

    async click(
      x: number,
      y: number,
      button: 'left' | 'right' | 'middle',
      count: 1 | 2 | 3,
      modifiers?: string[],
    ): Promise<void> {
      await runActions([
        {
          kind: 'click',
          target: { x, y },
          input: { button, click_count: count, modifiers },
        },
      ])
    },

    async mouseDown(): Promise<void> {
      await runActions([
        { kind: 'click', input: { button: 'left', phase: 'down' } },
      ])
    },

    async mouseUp(): Promise<void> {
      await runActions([
        { kind: 'click', input: { button: 'left', phase: 'up' } },
      ])
    },

    async getCursorPosition(): Promise<{ x: number; y: number }> {
      throw notSupported('Cursor position query')
    },

    async drag(
      from: { x: number; y: number } | undefined,
      to: { x: number; y: number },
    ): Promise<void> {
      await runActions([
        {
          kind: 'drag',
          input: {
            from_x: from?.x,
            from_y: from?.y,
            to_x: to.x,
            to_y: to.y,
          },
        },
      ])
    },

    async scroll(
      x: number,
      y: number,
      dx: number,
      dy: number,
    ): Promise<void> {
      await runActions([
        { kind: 'scroll', target: { x, y }, input: { delta_x: dx, delta_y: dy } },
      ])
    },

    // ── App management — not engine concepts ─────────────────────────────────

    async getFrontmostApp(): Promise<FrontmostApp | null> {
      return null
    },
    async appUnderPoint(): Promise<{
      bundleId: string
      displayName: string
    } | null> {
      throw notSupported('App-under-point lookup')
    },
    async listInstalledApps(): Promise<InstalledApp[]> {
      // The engine has no app enumeration; the request_access tool
      // description simply omits the installed-app hint.
      return []
    },
    async getAppIcon(): Promise<string | undefined> {
      return undefined
    },
    async listRunningApps(): Promise<RunningApp[]> {
      throw notSupported('Running-app listing')
    },
    async openApp(bundleId: string): Promise<void> {
      await client.executeIntent(`Open application ${bundleId}`)
    },
  }
}
