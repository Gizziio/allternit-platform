/**
 * @fileoverview Z-Index Token System
 * 
 * Comprehensive z-index tokens for consistent layering.
 * Organized by UI layer hierarchy.
 * 
 * @module design/tokens/z-index
 * @version 1.0.0
 */

/**
 * Z-index scale
 * Consistent layering values
 */
export const zIndex = {
  /** -1 - Behind content */
  behind: '-1',
  /** 0 - Default/base layer */
  base: '0',
  /** 10 - Docked elements */
  docked: '10',
  /** 20 - Sticky elements */
  sticky: '20',
  /** 30 - Banner elements */
  banner: '30',
  /** 40 - Overlay backdrops */
  overlay: '40',
  /** 50 - Modal dialogs */
  modal: '50',
  /** 60 - Dropdown menus */
  dropdown: '60',
  /** 70 - Popover/tooltip */
  popover: '70',
  /** 80 - Notifications/toasts */
  notification: '80',
  /** 90 - Tooltips */
  tooltip: '90',
  /** 100 - Maximum standard layer */
  maximum: '100',
} as const;

/**
 * Z-index values as numbers (for JS)
 */
export const zIndexNum = {
  behind: -1,
  base: 0,
  docked: 10,
  sticky: 20,
  banner: 30,
  overlay: 40,
  modal: 50,
  dropdown: 60,
  popover: 70,
  notification: 80,
  tooltip: 90,
  maximum: 100,
} as const;

/**
 * Component-specific z-index values
 * Recommended z-index for common components
 */
export const componentZIndex = {
  /** Base content layer */
  content: zIndex.base,
  /** Fixed headers/navigation */
  header: zIndex.docked,
  /** Fixed sidebars */
  sidebar: zIndex.docked,
  /** Fixed footers */
  footer: zIndex.docked,
  /** Sticky table headers */
  stickyHeader: zIndex.sticky,
  /** Sticky sidebar elements */
  stickySidebar: zIndex.sticky,
  /** Alert banners */
  alertBanner: zIndex.banner,
  /** Cookie consent banners */
  cookieBanner: zIndex.banner,
  /** Modal backdrops/scrims */
  backdrop: zIndex.overlay,
  /** Modal dialogs */
  modal: zIndex.modal,
  /** Drawer panels */
  drawer: zIndex.modal,
  /** Select dropdowns */
  select: zIndex.dropdown,
  /** Menu dropdowns */
  menu: zIndex.dropdown,
  /** Autocomplete dropdowns */
  autocomplete: zIndex.dropdown,
  /** Popover panels */
  popover: zIndex.popover,
  /** Date picker panels */
  datePicker: zIndex.popover,
  /** Color picker panels */
  colorPicker: zIndex.popover,
  /** Toast notifications */
  toast: zIndex.notification,
  /** Snackbar notifications */
  snackbar: zIndex.notification,
  /** Alert notifications */
  alert: zIndex.notification,
  /** Tooltip elements */
  tooltip: zIndex.tooltip,
  /** Tour/guide tooltips */
  tour: zIndex.tooltip,
  /** Onboarding tooltips */
  onboarding: zIndex.tooltip,
} as const;

/**
 * Z-index offset utilities
 * For creating sub-layers within components
 */
export const zOffset = {
  /** -1 - Move one layer back */
  back: -1,
  /** 0 - No offset */
  none: 0,
  /** 1 - Move one layer forward */
  forward: 1,
  /** 2 - Move two layers forward */
  front: 2,
} as const;

/**
 * Create a z-index value with offset
 * @param base - Base z-index key
 * @param offset - Offset to apply
 * @returns Calculated z-index value
 */
export function createZIndex(
  base: keyof typeof zIndexNum,
  offset: number = 0
): number {
  return zIndexNum[base] + offset;
}

/**
 * Complete z-index tokens object
 */
export const zIndexTokens = {
  zIndex,
  zIndexNum,
  component: componentZIndex,
  offset: zOffset,
  createZIndex,
} as const;

/** Z-index type */
export type ZIndex = typeof zIndex;
/** Z-index number type */
export type ZIndexNum = typeof zIndexNum;
/** Component z-index type */
export type ComponentZIndex = typeof componentZIndex;
/** Z-index offset type */
export type ZOffset = typeof zOffset;
/** Z-index tokens type */
export type ZIndexTokens = typeof zIndexTokens;

export default zIndexTokens;
