import { type RefObject, useEffect } from 'react'

const THREAD_INTERACTIVE = 'a[href], button, input, textarea, select, [contenteditable], [role="button"], [role="link"]'

const COMPOSER_BOUNDS = '[data-hud-composer-bounds]'
const COMPOSER_INPUT = 'textarea[aria-label="Text Area"]'

/**
 * In HUD mode the band is for reading over another app — clicking a line is not
 * leaving the composer. Without this, mousedown on the scrollback blurs the
 * input, the band fades, and the focus ring vanishes mid-read.
 *
 * The bounds wrapper (`data-hud-composer-bounds`) should enclose the chat
 * surface but not the drag strip or resize handles, so those gestures are not
 * swallowed.
 */
export function useHudThreadFocus(rootRef: RefObject<HTMLElement | null>): void {
  useEffect(() => {
    const root = rootRef.current

    if (!root) {
      return
    }

    const onPointerDown = (event: PointerEvent) => {
      if (event.button !== 0) {
        return
      }

      const target = event.target

      if (!(target instanceof Element)) {
        return
      }

      if (!target.closest(COMPOSER_BOUNDS)) {
        return
      }

      if (target.closest(THREAD_INTERACTIVE)) {
        return
      }

      event.preventDefault()

      const input = root.querySelector<HTMLElement>(COMPOSER_INPUT)
      input?.focus()
    }

    root.addEventListener('pointerdown', onPointerDown, true)

    return () => root.removeEventListener('pointerdown', onPointerDown, true)
  }, [rootRef])
}
