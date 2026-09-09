/**
 * Engine-backed ComputerExecutor.
 *
 * Replaces the native macOS executor (`@ant/computer-use-input` enigo input +
 * `@ant/computer-use-swift` ScreenCaptureKit) with calls to the Allternit
 * Computer Use Engine via `@allternit/computer-use`.
 *
 * Honest capability boundary: the engine dispatches the Claude native
 * action set (left/right/middle/double click, drag, type, key, scroll,
 * screenshot) plus wait. Actions with no engine equivalent — hover/mouse
 * move, mouse button phases, key hold, display geometry, host-app
 * management — throw a clear "not supported by the engine backend" error
 * instead of silently no-op'ing. Clipboard stays local via pbpaste/pbcopy
 * on macOS, matching the original CLI behavior.
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

  /**
   * Run one direct-mode batch; throws with the engine's error message.
   *
   * Per-action failures are checked at two levels because the gateway's
   * direct path counts a failed adapter envelope as an "ok" action entry:
   *   - outcome.status === 'error'  → the adapter raised
   *   - outcome.result.status === 'failed' → the adapter returned a failed
   *     ResultEnvelope (e.g. UNSUPPORTED_ACTION) without raising
   * Neither may be silently swallowed: a resolved promise means every action
   * genuinely executed.
   */
  async function runActions(actions: EngineAction[]): Promise<void> {
    const result = await client.executeDirect(actions)
    if (result.error) {
      throw new Error(
        `Engine error (${result.error.code}): ${result.error.message}`,
      )
    }
    if (result.status !== 'completed') {
      throw new Error(
        `Engine run ${result.status}: ${result.summary || 'no summary'}`,
      )
    }
    const outcomes =
      (result.result as { actions?: Array<Record<string, unknown>> } | null)
        ?.actions ?? []
    const failures = outcomes.filter((outcome) => {
      if (outcome.status !== 'ok') return true
      const envelope = outcome.result as
        | { status?: string; error?: { message?: string } | null }
        | null
        | undefined
      return envelope?.status === 'failed'
    })
    if (failures.length > 0) {
      const details = failures
        .map((outcome) => {
          const envelope = outcome.result as
            | { error?: { message?: string } | null }
            | null
            | undefined
          const message =
            (typeof outcome.error === 'string' && outcome.error) ||
            envelope?.error?.message ||
            'unknown error'
          return `#${String(outcome.index)} ${String(outcome.kind)}: ${message}`
        })
        .join('; ')
      throw new Error(`Engine action(s) failed: ${details}`)
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
      // Direct-mode 'screenshot' action through the adapter layer; the run
      // result carries the PNG in artifacts[] (fallback: result.screenshot_b64).
      // The legacy /vision/screenshot route does not exist on the gateway.
      const result = await client.executeDirect([
        { kind: 'screenshot', action_id: 'engine-screenshot' },
      ])
      const artifact = (result.artifacts ?? []).find(
        (a) => a.type === 'screenshot',
      )
      const raw =
        (typeof artifact?.content === 'string' && artifact.content) ||
        (typeof artifact?.url === 'string' && artifact.url) ||
        (typeof result.result?.screenshot_b64 === 'string' &&
          result.result.screenshot_b64) ||
        null
      if (!raw) {
        throw new Error(
          `Engine screenshot produced no image (run ${result.run_id} status ${result.status})`,
        )
      }
      const base64 = raw.replace(/^data:image\/[a-z+]+;base64,/, '')
      const [width, height] = pngDimensions(base64)
      return { base64, width, height, mimeType: 'image/png' }
    },

    async zoom(): Promise<{ base64: string; width: number; height: number }> {
      throw notSupported('Region capture (zoom)')
    },

    // ── Keyboard ─────────────────────────────────────────────────────────────

    async key(keySequence: string, repeat = 1): Promise<void> {
      const actions = Array.from({ length: repeat }, () => ({
        // The engine executor dispatches the Claude native action set;
        // adapters read `key` (CDP) or `keys` (pyautogui) — send both.
        kind: 'key',
        input: { key: keySequence, keys: keySequence },
      }))
      await runActions(actions)
    },

    async holdKey(keyNames: string[], durationMs: number): Promise<void> {
      // No engine adapter implements key-hold; a 'key' action with hold_ms
      // would be accepted and silently not held. Fail loudly instead.
      throw notSupported(
        `Key hold (${keyNames.join('+')} for ${durationMs}ms)`,
      )
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
      // The engine executor has no hover/mouse_move in its native action
      // set; faking it with a click would be worse than an honest error.
      throw notSupported(`Mouse move/hover to (${x}, ${y})`)
    },

    async click(
      x: number,
      y: number,
      button: 'left' | 'right' | 'middle',
      count: 1 | 2 | 3,
      modifiers?: string[],
    ): Promise<void> {
      // Map to the engine's native click vocabulary. Adapters read pixel
      // coordinates from input.x/input.y.
      const kind =
        count === 2 && button === 'left'
          ? 'double_click'
          : button === 'left'
            ? 'left_click'
            : button === 'right'
              ? 'right_click'
              : 'middle_click'
      const single = count === 3 ? 3 : 1
      const actions = Array.from({ length: single }, () => ({
        kind,
        input: { x, y, button, modifiers },
      }))
      await runActions(actions)
    },

    async mouseDown(): Promise<void> {
      // No engine adapter implements button phases; fail loudly.
      throw notSupported('Mouse button hold (down/up phases)')
    },

    async mouseUp(): Promise<void> {
      throw notSupported('Mouse button hold (down/up phases)')
    },

    async getCursorPosition(): Promise<{ x: number; y: number }> {
      throw notSupported('Cursor position query')
    },

    async drag(
      from: { x: number; y: number } | undefined,
      to: { x: number; y: number },
    ): Promise<void> {
      if (!from) {
        throw notSupported('Drag without an explicit start coordinate')
      }
      // Engine native drag; the CDP adapter reads startX/startY/endX/endY.
      await runActions([
        {
          kind: 'left_click_drag',
          input: { startX: from.x, startY: from.y, endX: to.x, endY: to.y },
        },
      ])
    },

    async scroll(
      x: number,
      y: number,
      dx: number,
      dy: number,
    ): Promise<void> {
      // The CDP adapter reads x/y + deltaX/deltaY from input.
      await runActions([
        { kind: 'scroll', input: { x, y, deltaX: dx, deltaY: dy } },
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
