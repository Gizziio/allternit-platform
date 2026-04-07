import { createMemo } from "solid-js"

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyRequest = any

/**
 * Derives the dock blocking state from raw permission and question signal slices.
 *
 * Returns three memos:
 *   blocked          — true when any blocker (permission or question) is pending
 *   permissionRequest — the first pending permission request, or undefined
 *   questionRequest   — the first pending question request (only when no permission pending), or undefined
 *
 * This is the single source of truth for blocking state used by both
 * the composer region rendering and any page-level autofocus guards.
 */
export function createComposerState(
  permissions: () => AnyRequest[],
  questions: () => AnyRequest[],
) {
  const permissionRequest = createMemo<AnyRequest | undefined>(() => permissions()[0])
  const questionRequest = createMemo<AnyRequest | undefined>(() =>
    permissions().length === 0 ? questions()[0] : undefined,
  )
  const blocked = createMemo(() => permissions().length > 0 || questions().length > 0)

  return { blocked, permissionRequest, questionRequest }
}
