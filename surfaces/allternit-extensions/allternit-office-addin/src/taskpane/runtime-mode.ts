/**
 * Task-pane runtime mode — decides between the two renderable experiences:
 *
 * - `full-ai`   — Office.js initialized AND a gateway bootstrap/auth context is
 *                 available. Renders the in-pane agent (ExtensionSidepanelShell
 *                 driven by useOfficeAgent through the Office sidepanel adapter).
 * - `companion` — Office.js failed to initialize (or hasn't yet) or no bootstrap
 *                 context exists. Renders the companion shell: document binding,
 *                 heartbeat, suggested-action buttons that steer the platform
 *                 agent via postMessage.
 *
 * The resolver is a pure function so the mode rule is unit-testable; the
 * office-initialized flag is tracked module-side and set from main.tsx once
 * Office.onReady fires.
 */
import type { OfficeBootstrapState } from '@/lib/platform-gateway'

export type TaskpaneRuntimeMode = 'full-ai' | 'companion'

export interface TaskpaneModeInput {
  /** True once Office.onReady fired with a real Office host context. */
  officeInitialized: boolean
  /** Current gateway bootstrap/auth context (token + workspace/project). */
  bootstrap: Pick<OfficeBootstrapState, 'auth' | 'context'>
}

export function resolveTaskpaneMode(input: TaskpaneModeInput): TaskpaneRuntimeMode {
  if (!input.officeInitialized) return 'companion'
  const { auth, context } = input.bootstrap
  const hasAuthContext = Boolean(auth.token || context.workspaceId || context.projectId)
  return hasAuthContext ? 'full-ai' : 'companion'
}

// ── Office.js readiness flag ─────────────────────────────────────────────────

let officeInitialized = false

/** Called from main.tsx when Office.onReady resolves. */
export function markOfficeRuntimeReady(): void {
  officeInitialized = true
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('allternit-office-runtime-ready'))
  }
}

export function isOfficeRuntimeReady(): boolean {
  return officeInitialized
}
