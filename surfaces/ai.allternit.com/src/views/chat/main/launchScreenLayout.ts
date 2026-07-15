/**
 * Shared geometry for the two launch screens the Chat/Cowork toggle swaps
 * between (ChatEmptyState and CoworkLaunchpad). Both render the same
 * ChatComposer, and the toggle lives inside its BottomDock — so the composer
 * box must sit at the exact same position and width in both modes, otherwise
 * the input bar visibly jumps when switching.
 *
 * Any change here moves the composer in BOTH modes; never let the two screens
 * drift apart by styling these values locally.
 */

/** Distance from the top of the view to the header zone. */
export const LAUNCH_TOP_PADDING = '10vh';

/**
 * Fixed height of the greeting/header zone above the composer. Content is
 * bottom-aligned inside it, so the short Cowork header (title + tagline)
 * leaves the composer at the same y as the taller Chat header
 * (logo + title + tagline), whose natural height defines this value.
 */
export const LAUNCH_HEADER_ZONE_HEIGHT = 274;

/** Vertical gap between the header zone and the composer, and below it. */
export const LAUNCH_SECTION_GAP = 64;

/** Composer column width (Chat column: max-w-[640px] minus px-6 padding). */
export const LAUNCH_COMPOSER_WIDTH = 592;

/**
 * ChatComposer renders its quick-action pill row (44px incl. margin) above
 * the composer box when showTopActions is on, which the Chat launch screen
 * enables. Cowork hides that row, so it reserves the same height to keep the
 * composer box aligned across the toggle.
 */
export const LAUNCH_TOP_ACTIONS_HEIGHT = 44;
