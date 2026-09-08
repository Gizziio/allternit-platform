/**
 * Per-session tool dispatcher.
 *
 * Replaces `bindSessionContext` from `@ant/computer-use-mcp`: binds a host
 * adapter + coordinate mode + per-session CLI context into a
 * `(toolName, args) => result` function that wrapper.tsx installs as the
 * `.call()` override on every `mcp__computer-use__*` tool.
 *
 * Responsibilities (mirroring the native package):
 *   - feature gate (`adapter.isDisabled()`)
 *   - cross-session lock check / acquire (via ctx)
 *   - the request_access permission dialog (via ctx.onPermissionRequest)
 *   - coordinate scaling for 'normalized' mode
 *   - executor dispatch + screenshot write-backs (dims, hidden apps)
 *
 * Per-app enforcement note: the native backend could identify the app under
 * the cursor and gate each input action against the session allowlist. The
 * engine backend has no app-under-point concept, so input tools are not
 * per-app gated here — the allowlist is established via request_access and
 * enforcement is delegated to the engine/approval layer.
 */

import type {
  ComputerUseHostAdapter,
  ComputerUseSessionContext,
  CoordinateMode,
  CuCallToolResult,
  CuContentBlock,
  CuPermissionRequest,
  ScreenshotDims,
} from './types.js'

export type CuDispatch = (
  name: string,
  args: unknown,
) => Promise<CuCallToolResult>

type Args = Record<string, unknown>

function asArgs(args: unknown): Args {
  return typeof args === 'object' && args !== null ? (args as Args) : {}
}

function asPair(value: unknown): [number, number] | undefined {
  if (
    Array.isArray(value) &&
    value.length === 2 &&
    typeof value[0] === 'number' &&
    typeof value[1] === 'number'
  ) {
    return [value[0], value[1]]
  }
  return undefined
}

function text(message: string): CuCallToolResult {
  return { content: [{ type: 'text', text: message }] }
}

function errorResult(err: unknown): CuCallToolResult {
  const message = err instanceof Error ? err.message : String(err)
  return {
    content: [{ type: 'text', text: message }],
    isError: true,
    telemetry: { error_kind: 'dispatch_error' },
  }
}

const CLICK_COUNTS: Record<string, 1 | 2 | 3> = {
  left_click: 1,
  right_click: 1,
  middle_click: 1,
  double_click: 2,
  triple_click: 3,
}

const CLICK_BUTTONS: Record<string, 'left' | 'right' | 'middle'> = {
  left_click: 'left',
  double_click: 'left',
  triple_click: 'left',
  right_click: 'right',
  middle_click: 'middle',
}

export function bindSessionContext(
  adapter: ComputerUseHostAdapter,
  coordinateMode: CoordinateMode,
  ctx: ComputerUseSessionContext,
): CuDispatch {
  const { executor } = adapter

  async function scalePair(pair: [number, number]): Promise<[number, number]> {
    if (coordinateMode !== 'normalized') return pair
    // Normalized coordinates live in a 0-1000 square over the active display.
    const display = await executor.getDisplaySize()
    return [
      Math.round((pair[0] * display.width) / 1000),
      Math.round((pair[1] * display.height) / 1000),
    ]
  }

  async function grantLock(): Promise<string | undefined> {
    const lock = await ctx.checkCuLock()
    if (lock.holder !== undefined) {
      return lock.isSelf
        ? undefined
        : ctx.formatLockHeldMessage(lock.holder)
    }
    await ctx.acquireCuLock()
    return undefined
  }

  async function handleRequestAccess(args: Args): Promise<CuCallToolResult> {
    const requested = Array.isArray(args.apps)
      ? args.apps.filter((a): a is string => typeof a === 'string')
      : []
    const installed = await executor.listInstalledApps().catch(() => [])
    const allowed = ctx.getAllowedApps()
    const allowedIds = new Set(allowed.map(a => a.bundleId))

    const req: CuPermissionRequest = {
      apps: requested.map(name => {
        const resolved = installed.find(
          a =>
            a.bundleId === name ||
            a.displayName.toLowerCase() === name.toLowerCase(),
        )
        return {
          requestedName: name,
          resolved: resolved
            ? { bundleId: resolved.bundleId, displayName: resolved.displayName }
            : undefined,
          alreadyGranted: resolved
            ? allowedIds.has(resolved.bundleId)
            : undefined,
        }
      }),
      requestedFlags: {
        clipboardRead: args.clipboardRead === true,
        clipboardWrite: args.clipboardWrite === true,
        systemKeyCombos: args.systemKeyCombos === true,
      },
      willHide: [],
    }

    const resp = await ctx.onPermissionRequest(req)
    if (resp.granted.length > 0 || resp.denied.length > 0) {
      ctx.onAllowedAppsChanged(resp.granted, resp.flags)
    }
    const deniedInstalled = resp.denied.filter(d => d.reason === 'user_denied')
    return text(
      resp.granted.length > 0
        ? `Access granted for ${resp.granted.length} app(s)` +
            (deniedInstalled.length > 0
              ? `; denied for ${deniedInstalled.length}.`
              : '.')
        : 'Access denied.',
    )
  }

  async function handleScreenshot(): Promise<CuCallToolResult> {
    const result = await executor.screenshot({
      allowedBundleIds: ctx.getAllowedApps().map(a => a.bundleId),
      displayId: ctx.getSelectedDisplayId(),
    })
    const dims: ScreenshotDims = {
      width: result.width,
      height: result.height,
      displayWidth: result.width,
      displayHeight: result.height,
      displayId: ctx.getSelectedDisplayId() ?? 0,
      originX: 0,
      originY: 0,
    }
    ctx.onScreenshotCaptured(dims)
    const content: CuContentBlock[] = [
      {
        type: 'image',
        mimeType: result.mimeType,
        data: result.base64,
      },
      { type: 'text', text: `Screenshot captured (${result.width}x${result.height}).` },
    ]
    return { content }
  }

  return async function dispatch(
    name: string,
    rawArgs: unknown,
  ): Promise<CuCallToolResult> {
    if (adapter.isDisabled()) {
      return {
        content: [
          { type: 'text', text: 'Computer use is disabled by configuration.' },
        ],
        isError: true,
      }
    }

    const lockError = await grantLock()
    if (lockError) {
      return { content: [{ type: 'text', text: lockError }], isError: true }
    }

    const args = asArgs(rawArgs)
    try {
      // ── Access / capture ────────────────────────────────────────────────
      if (name === 'request_access') return await handleRequestAccess(args)
      if (name === 'screenshot') return await handleScreenshot()
      if (name === 'zoom') {
        const region = asPair(
          Array.isArray(args.region) ? args.region.slice(0, 2) : undefined,
        )
        const size = asPair(
          Array.isArray(args.region) ? args.region.slice(2, 4) : undefined,
        )
        if (!region || !size) {
          return {
            content: [
              { type: 'text', text: 'zoom requires region [x, y, w, h].' },
            ],
            isError: true,
          }
        }
        const [x, y] = await scalePair(region)
        const [w, h] = await scalePair(size)
        const result = await executor.zoom(
          { x, y, w, h },
          ctx.getAllowedApps().map(a => a.bundleId),
          ctx.getSelectedDisplayId(),
        )
        return {
          content: [
            {
              type: 'image',
              mimeType: 'image/png',
              data: result.base64,
            },
          ],
        }
      }
      if (name === 'switch_display') {
        const display = args.display
        if (display === 'auto') {
          ctx.onDisplayPinned(undefined)
          return text('Display selection set to auto.')
        }
        const id = Number(display)
        if (!Number.isInteger(id) || id < 0) {
          return {
            content: [
              {
                type: 'text',
                text: 'switch_display expects a display ID or "auto".',
              },
            ],
            isError: true,
          }
        }
        ctx.onDisplayPinned(id)
        return text(`Display ${id} selected.`)
      }

      // ── Mouse ───────────────────────────────────────────────────────────
      if (name in CLICK_COUNTS) {
        const coordinate = asPair(args.coordinate)
        if (!coordinate) {
          return {
            content: [{ type: 'text', text: `${name} requires coordinate.` }],
            isError: true,
          }
        }
        const [x, y] = await scalePair(coordinate)
        const modifiers = Array.isArray(args.modifiers)
          ? args.modifiers.filter((m): m is string => typeof m === 'string')
          : undefined
        await executor.click(
          x,
          y,
          CLICK_BUTTONS[name]!,
          CLICK_COUNTS[name]!,
          modifiers,
        )
        return text(`${name.replace(/_/g, ' ')} at (${x}, ${y}).`)
      }
      if (name === 'left_click_drag') {
        const to = asPair(args.coordinate)
        if (!to) {
          return {
            content: [
              { type: 'text', text: 'left_click_drag requires coordinate.' },
            ],
            isError: true,
          }
        }
        const from = asPair(args.start_coordinate)
        const [toX, toY] = await scalePair(to)
        const scaledFrom = from ? await scalePair(from) : undefined
        await executor.drag(
          scaledFrom ? { x: scaledFrom[0], y: scaledFrom[1] } : undefined,
          { x: toX, y: toY },
        )
        return text(
          `Dragged to (${toX}, ${toY})` +
            (scaledFrom ? ` from (${scaledFrom[0]}, ${scaledFrom[1]}).` : '.'),
        )
      }
      if (name === 'scroll') {
        const coordinate = asPair(args.coordinate)
        if (!coordinate) {
          return {
            content: [
              { type: 'text', text: 'scroll requires coordinate.' },
            ],
            isError: true,
          }
        }
        const [x, y] = await scalePair(coordinate)
        const dx = typeof args.delta_x === 'number' ? args.delta_x : 0
        const dy = typeof args.delta_y === 'number' ? args.delta_y : 0
        await executor.scroll(x, y, dx, dy)
        return text(`Scrolled at (${x}, ${y}).`)
      }

      // ── Keyboard / text ─────────────────────────────────────────────────
      if (name === 'type') {
        if (typeof args.text !== 'string') {
          return {
            content: [{ type: 'text', text: 'type requires text.' }],
            isError: true,
          }
        }
        await executor.type(args.text, {
          viaClipboard: args.via_clipboard === true,
        })
        return text(`Typed ${args.text.length} character(s).`)
      }
      if (name === 'key') {
        if (typeof args.keySequence !== 'string') {
          return {
            content: [
              { type: 'text', text: 'key requires keySequence.' },
            ],
            isError: true,
          }
        }
        const repeat = typeof args.repeat === 'number' ? args.repeat : 1
        await executor.key(args.keySequence, repeat)
        return text(`Pressed ${args.keySequence}.`)
      }
      if (name === 'hold_key') {
        const keyNames = Array.isArray(args.keyNames)
          ? args.keyNames.filter((k): k is string => typeof k === 'string')
          : []
        const duration = typeof args.duration === 'number' ? args.duration : 0
        if (keyNames.length === 0) {
          return {
            content: [
              { type: 'text', text: 'hold_key requires keyNames.' },
            ],
            isError: true,
          }
        }
        await executor.holdKey(keyNames, duration)
        return text(`Held ${keyNames.join('+')} for ${duration}ms.`)
      }

      // ── Apps ────────────────────────────────────────────────────────────
      if (name === 'open_application') {
        if (typeof args.app !== 'string') {
          return {
            content: [
              { type: 'text', text: 'open_application requires app.' },
            ],
            isError: true,
          }
        }
        await executor.openApp(args.app)
        return text(`Opened ${args.app}.`)
      }

      return {
        content: [{ type: 'text', text: `Unknown computer use tool: ${name}` }],
        isError: true,
      }
    } catch (err) {
      return errorResult(err)
    }
  }
}
