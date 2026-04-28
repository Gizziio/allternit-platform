/**
 * Allternit Z-Index Scale
 *
 * Problem: The codebase had z-index values ranging from 1 to 2,147,483,647
 * with no layering contract. Dropdowns fought modals, tooltips disappeared
 * behind panels, and clicks went to the wrong layer.
 *
 * Rule: Every z-index must come from this scale. No magic numbers.
 */

export const Z = {
  // Base layers (0-90)
  base: 0,
  background: 1,
  content: 10,
  sticky: 20,
  floating: 100, // Toolbars, minimaps, floating orbs

  // Shell chrome (110-140)
  rail: 110,
  sidecar: 120,
  canvasOverlay: 130,
  shellHeader: 140,

  // Controls & menus (150-169)
  railControls: 150,
  dropdown: 160,
  contextMenu: 165,
  tooltip: 168,

  // Modals & overlays (170-189)
  dropdownBackdrop: 169, // Click-catch scrim behind dropdowns
  modalBackdrop: 170,
  modal: 180,
  drawer: 185,

  // Notifications (190-199)
  toast: 190,
  notification: 195,

  // System layers (200-299)
  onboarding: 200,
  guidedTour: 210,
  permissionBanner: 220,
  dragOverlay: 230,

  // Dev / debug (900+)
  devOverlay: 900,
} as const;

// Convenience for CSS custom properties
export const Z_CSS = Object.fromEntries(
  Object.entries(Z).map(([k, v]) => [`--z-${k}`, String(v)])
) as Record<`--z-${keyof typeof Z}`, string>;
