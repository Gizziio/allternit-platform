/**
 * Contract types for the Computer Use engine adapter.
 *
 * These replace the `@ant/computer-use-mcp` / `@ant/computer-use-mcp/types`
 * imports the subtree used to carry. The shapes are derived from how the
 * subtree actually consumes them (wrapper.tsx, hostAdapter.ts, mcpServer.ts,
 * executor.ts, ComputerUseApproval.tsx) — the old `@ant/*` packages were
 * never vendored into this repo, so this module is the canonical contract
 * now. `AppStateStore.computerUseMcpState` mirrors these shapes structurally
 * (see the comment there); keep them compatible.
 */

// ── Gates ────────────────────────────────────────────────────────────────────

export type CoordinateMode = 'pixels' | 'normalized'

export interface CuSubGates {
  pixelValidation: boolean
  clipboardPasteMultiline: boolean
  mouseAnimation: boolean
  hideBeforeAction: boolean
  autoTargetDisplay: boolean
  clipboardGuard: boolean
}

// ── Host adapter ─────────────────────────────────────────────────────────────

export interface Logger {
  silly?: (message: string, ...args: unknown[]) => void
  debug: (message: string, ...args: unknown[]) => void
  info: (message: string, ...args: unknown[]) => void
  warn: (message: string, ...args: unknown[]) => void
  error: (message: string, ...args: unknown[]) => void
}

export interface CuCapabilities {
  screenshotFiltering: 'native' | 'none'
  platform: string
  /** Sentinel bundle ID used by the package frontmost gate (never matches). */
  hostBundleId?: string
}

export interface DisplayGeometry {
  width: number
  height: number
  scaleFactor: number
  displayId?: number
}

export interface FrontmostApp {
  bundleId: string
  displayName: string
}

export interface InstalledApp {
  bundleId: string
  displayName: string
  path?: string
  iconDataUrl?: string
}

export interface RunningApp {
  bundleId: string
  displayName: string
  pid?: number
}

export interface ScreenshotResult {
  /** Base64-encoded image bytes. */
  base64: string
  width: number
  height: number
  mimeType: string
}

export interface ResolvePrepareCaptureResult {
  displayId: number
  width: number
  height: number
  hidden: string[]
}

/**
 * Backend executor. The original CLI implementation delegated to native
 * macOS modules (@ant/computer-use-input / -swift). The engine backend
 * delegates to the Allternit Computer Use Engine over HTTP; methods the
 * engine does not expose throw with a clear message rather than silently
 * no-op'ing.
 */
export interface ComputerExecutor {
  capabilities: CuCapabilities

  // Hide/defocus — the engine backend never hides host apps; both no-op.
  prepareForAction(
    allowlistBundleIds: string[],
    displayId?: number,
  ): Promise<string[]>
  previewHideSet(
    allowlistBundleIds: string[],
    displayId?: number,
  ): Promise<Array<{ bundleId: string; displayName: string }>>

  // Display
  getDisplaySize(displayId?: number): Promise<DisplayGeometry>
  listDisplays(): Promise<DisplayGeometry[]>
  findWindowDisplays(
    bundleIds: string[],
  ): Promise<Array<{ bundleId: string; displayIds: number[] }>>
  resolvePrepareCapture(opts: {
    allowedBundleIds: string[]
    preferredDisplayId?: number
    autoResolve: boolean
    doHide?: boolean
  }): Promise<ResolvePrepareCaptureResult>

  // Capture
  screenshot(opts: {
    allowedBundleIds: string[]
    displayId?: number
  }): Promise<ScreenshotResult>
  zoom(
    regionLogical: { x: number; y: number; w: number; h: number },
    allowedBundleIds: string[],
    displayId?: number,
  ): Promise<{ base64: string; width: number; height: number }>

  // Keyboard
  key(keySequence: string, repeat?: number): Promise<void>
  holdKey(keyNames: string[], durationMs: number): Promise<void>
  type(text: string, opts: { viaClipboard: boolean }): Promise<void>
  readClipboard(): Promise<string>
  writeClipboard(text: string): Promise<void>

  // Mouse
  moveMouse(x: number, y: number): Promise<void>
  click(
    x: number,
    y: number,
    button: 'left' | 'right' | 'middle',
    count: 1 | 2 | 3,
    modifiers?: string[],
  ): Promise<void>
  mouseDown(): Promise<void>
  mouseUp(): Promise<void>
  getCursorPosition(): Promise<{ x: number; y: number }>
  drag(
    from: { x: number; y: number } | undefined,
    to: { x: number; y: number },
  ): Promise<void>
  scroll(x: number, y: number, dx: number, dy: number): Promise<void>

  // App management — not exposed by the engine backend.
  getFrontmostApp(): Promise<FrontmostApp | null>
  appUnderPoint(
    x: number,
    y: number,
  ): Promise<{ bundleId: string; displayName: string } | null>
  listInstalledApps(): Promise<InstalledApp[]>
  getAppIcon(path: string): Promise<string | undefined>
  listRunningApps(): Promise<RunningApp[]>
  openApp(bundleId: string): Promise<void>
}

export interface OsPermissionsState {
  granted: boolean
  accessibility?: boolean
  screenRecording?: boolean
}

export interface ComputerUseHostAdapter {
  serverName: string
  logger: Logger
  executor: ComputerExecutor
  ensureOsPermissions(): Promise<OsPermissionsState>
  isDisabled(): boolean
  getSubGates(): CuSubGates
  getAutoUnhideEnabled(): boolean
  /**
   * Pixel-validation decode hook. The native backend could not provide a
   * synchronous decode (async-only image processor), so validation was
   * always skipped. The engine backend keeps the same designed fallback.
   */
  cropRawPatch?: ((...args: unknown[]) => unknown) | null
}

// ── Permissions ──────────────────────────────────────────────────────────────

export interface CuGrantFlags {
  clipboardRead: boolean
  clipboardWrite: boolean
  systemKeyCombos: boolean
}

export const DEFAULT_GRANT_FLAGS: CuGrantFlags = {
  clipboardRead: false,
  clipboardWrite: false,
  systemKeyCombos: false,
}

export interface CuPermissionRequestApp {
  requestedName: string
  resolved?: { bundleId: string; displayName: string }
  alreadyGranted?: boolean
}

export interface CuPermissionRequest {
  apps: CuPermissionRequestApp[]
  requestedFlags: Partial<CuGrantFlags>
  reason?: string
  willHide?: string[]
  /** Present when OS-level permissions are missing (native backend only). */
  tccState?: { accessibility: boolean; screenRecording: boolean }
}

export interface CuGrantedApp {
  bundleId: string
  displayName: string
  grantedAt: number
}

export interface CuDeniedApp {
  bundleId: string
  reason: 'user_denied' | 'not_installed'
}

export interface CuPermissionResponse {
  granted: CuGrantedApp[]
  denied: CuDeniedApp[]
  flags: CuGrantFlags
}

// ── Session dispatch ─────────────────────────────────────────────────────────

export interface ScreenshotDims {
  width: number
  height: number
  displayWidth: number
  displayHeight: number
  displayId: number
  originX: number
  originY: number
}

export type CuContentBlock =
  | { type: 'text'; text: string }
  | { type: 'image'; mimeType: string; data: string }
  | { type: string; [key: string]: unknown }

export interface CuCallToolResult {
  content: CuContentBlock[]
  isError?: boolean
  telemetry?: { error_kind?: string }
}

/**
 * Per-session glue the CLI provides to the dispatcher. Implemented by
 * wrapper.tsx's `buildSessionContext`; every accessor reads through the
 * per-call `ToolUseContext` ref so AppState is always current.
 */
export interface ComputerUseSessionContext {
  getAllowedApps(): readonly CuGrantedApp[]
  getGrantFlags(): CuGrantFlags
  getUserDeniedBundleIds(): string[]
  getSelectedDisplayId(): number | undefined
  getDisplayPinnedByModel(): boolean
  getDisplayResolvedForApps(): string | undefined
  getLastScreenshotDims(): ScreenshotDims | undefined
  onPermissionRequest(
    req: CuPermissionRequest,
    dialogSignal?: unknown,
  ): Promise<CuPermissionResponse>
  onAllowedAppsChanged(apps: CuGrantedApp[], flags: CuGrantFlags): void
  onAppsHidden(ids: string[]): void
  onResolvedDisplayUpdated(id: number | undefined): void
  onDisplayPinned(id: number | undefined): void
  onDisplayResolvedForApps(key: string | undefined): void
  onScreenshotCaptured(dims: ScreenshotDims): void
  checkCuLock(): Promise<{ holder: string | undefined; isSelf: boolean }>
  acquireCuLock(): Promise<void>
  formatLockHeldMessage(holder: string): string
}

// ── Screenshot target sizing ─────────────────────────────────────────────────

export interface ApiResizeParams {
  maxWidth: number
  maxHeight: number
}

/**
 * Target bounds for transcoder resize (the Anthropic computer-use API caps
 * images at 1568px on the long edge). The engine backend passes screenshot
 * bytes through unmodified; this stays as the documented ceiling for
 * coordinate math.
 */
export const API_RESIZE_PARAMS: ApiResizeParams = {
  maxWidth: 1568,
  maxHeight: 1568,
}

/** Fit physical pixels inside the API bounds, preserving aspect. No upscale. */
export function targetImageSize(
  physW: number,
  physH: number,
  params: ApiResizeParams = API_RESIZE_PARAMS,
): [number, number] {
  if (physW <= 0 || physH <= 0) return [0, 0]
  const scale = Math.min(
    1,
    params.maxWidth / physW,
    params.maxHeight / physH,
  )
  return [Math.round(physW * scale), Math.round(physH * scale)]
}
