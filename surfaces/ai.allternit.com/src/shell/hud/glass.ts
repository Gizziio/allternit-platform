import { type RefObject, useEffect } from 'react';

/** The caret is in the composer — the HUD sheet's textarea. */
const TYPING_SELECTOR = 'textarea[aria-label="Text Area"]:focus';

/** An open completion list owns the surface; the band falls back behind it. */
const DRAWER_SELECTOR = '[data-hud-composer-drawer]';

/**
 * Native frost behind the HUD band.
 *
 * A platform material, not CSS — `backdrop-filter` reaches nothing here,
 * because a transparent window's backdrop root is the document and the desktop
 * was never in it. The material is composited BELOW the web contents (macOS
 * vibrancy via WindowServer, Windows 11 via the DWM backdrop), which is what
 * lets it see the desktop and also what makes it untouchable from the page: no
 * mask, clip or stacking order can shape it.
 *
 * That is survivable because the band is a flat panel. It still cannot animate,
 * so it is switched while the tint is at full strength and can hide the change:
 * on the moment the band is engaged, off the moment the hold ends and the
 * opacity fade begins. Letting it outlive the fade leaves bare untinted frost
 * on screen.
 *
 * Engaged means the caret is in the composer, and it is the SAME gate the
 * `[data-hud-glass]` scrim runs on — the frost is what that scrim is painted
 * over, so a frost the scrim doesn't cover is bare material. One gate, or the
 * two drift again.
 *
 * Merely holding window focus does not count: activating a window restores
 * focus to whatever had it last, so grabbing the bar to drag the HUD would
 * otherwise read as sitting down to use it. Queried live rather than tracked
 * from `document.activeElement`, which stays put when the window is blurred and
 * would latch the frost on forever once the user had ever typed here — the
 * window's own focus changes are listened for so the query is re-run when
 * `:focus` stops matching under an inactive window.
 *
 * Two vetoes sit over that:
 *
 * - `backing` — because the frost is the window and not the sheet, it is only
 *   ever right when the sheet covers the window; short of that the excess is
 *   frost over empty space.
 * - An open completion drawer, which drops the band to 25% and blurs it. Full-
 *   strength frost behind a band that has deliberately stepped back is the same
 *   bare slab in a different disguise. Observed rather than passed in: the
 *   drawer mounts inside the composer subtree from several call sites, so a prop
 *   would need every one of them to remember.
 *
 * Whether the frost is wanted AT ALL is the user's translucency setting, and
 * that answer lives in main (`hudFrostFor`) next to the state it reads. This
 * hook reports what the band is doing; it does not decide the material.
 */
export function useHudGlass(rootRef: RefObject<HTMLElement | null>, backing: boolean): void {
  useEffect(() => {
    const root = rootRef.current;
    const setFrost = window.allternit?.shell?.hud?.setFrost;

    if (!root || !setFrost) {
      return;
    }

    let on: boolean | null = null;

    const apply = () => {
      const next =
        backing && root.querySelector(DRAWER_SELECTOR) === null && root.querySelector(TYPING_SELECTOR) !== null;

      if (on !== next) {
        on = next;
        void setFrost(next);
      }
    };

    // The drawer mounts and unmounts without any focus change, so neither
    // focusin/focusout nor a re-render is guaranteed to follow it. Coalesced
    // to a frame: this observes the whole shell, and a streaming reply mutates
    // the transcript tens of times a second — the drawer's state cannot change
    // more than once per paint, so re-deciding per mutation is pure churn.
    let frame: null | number = null;

    const schedule = () => {
      if (frame === null) {
        frame = requestAnimationFrame(() => {
          frame = null;
          apply();
        });
      }
    };

    const observer = new MutationObserver(schedule);

    observer.observe(root, { childList: true, subtree: true });

    apply();
    root.addEventListener('focusin', apply);
    root.addEventListener('focusout', apply);
    // Clicking away to another APP fires no focusout — the composer stays
    // document.activeElement — but `:focus` stops matching, so the scrim goes
    // and the frost would be left behind as a bare slab. Deferred a frame so
    // the query runs after the deactivation has landed.
    window.addEventListener('blur', schedule);
    window.addEventListener('focus', schedule);

    return () => {
      void setFrost(false);
      observer.disconnect();

      if (frame !== null) {
        cancelAnimationFrame(frame);
      }

      root.removeEventListener('focusin', apply);
      root.removeEventListener('focusout', apply);
      window.removeEventListener('blur', schedule);
      window.removeEventListener('focus', schedule);
    };
  }, [backing, rootRef]);
}
