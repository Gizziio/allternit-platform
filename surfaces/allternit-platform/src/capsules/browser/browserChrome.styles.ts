/**
 * Browser Chrome Styles
 *
 * Platform-token-compliant styles for the browser capsule chrome
 * (tab bar, nav bar, menus, popups, dropdowns).
 *
 * Replaces hardcoded colors with design-system tokens so the browser
 * mode feels as polished as chat / code / cowork / design modes.
 */

import {
  MODE_COLORS,
  BACKGROUND,
  TEXT,
  BORDER,
  RADIUS,
  SHADOW,
  TYPOGRAPHY,
  ANIMATION,
  GLASS,
} from "@/design/allternit.tokens";

const browser = MODE_COLORS.browser;

// ============================================================================
// Menu / Popup / Dropdown (Glass morphism)
// ============================================================================

export const menuBase = {
  background: BACKGROUND.secondary,
  backdropFilter: "blur(20px)",
  WebkitBackdropFilter: "blur(20px)",
  border: `1px solid ${browser.border}`,
  borderRadius: RADIUS.md,
  boxShadow: `${SHADOW.md}, 0 0 0 1px ${browser.panelTint}`,
  fontSize: TYPOGRAPHY.size.sm,
  color: TEXT.secondary,
  overflow: "hidden",
} as const;

export const menuSectionLabel = {
  padding: "6px 12px",
  fontSize: "10px",
  textTransform: "uppercase" as const,
  letterSpacing: "0.1em",
  color: TEXT.tertiary,
  fontWeight: TYPOGRAPHY.weight.semibold,
} as const;

export const menuDivider = {
  height: 1,
  background: BORDER.subtle,
  margin: "4px 8px",
} as const;

export const menuItem = {
  display: "flex",
  alignItems: "center",
  gap: 8,
  width: "100%",
  padding: "6px 12px",
  border: "none",
  background: "transparent",
  cursor: "pointer",
  color: TEXT.secondary,
  fontSize: TYPOGRAPHY.size.sm,
  textAlign: "left" as const,
  transition: ANIMATION.fast,
} as const;

export const menuItemHover = {
  background: browser.panelTint,
  color: TEXT.primary,
} as const;

export const menuItemActive = {
  color: browser.accent,
} as const;

// ============================================================================
// Tab Bar
// ============================================================================

export const tabBar = {
  height: 36,
  minHeight: 36,
  maxHeight: 36,
  display: "flex",
  flexDirection: "row" as const,
  alignItems: "flex-end",
  paddingLeft: 4,
  paddingRight: 4,
  background: BACKGROUND.primary,
  flexShrink: 0,
  position: "relative" as const,
} as const;

export const tabItem = (isActive: boolean) =>
  ({
    display: "flex",
    flexDirection: "row" as const,
    alignItems: "center",
    height: 30,
    paddingLeft: 10,
    paddingRight: 6,
    cursor: "pointer",
    borderRadius: "8px 8px 0 0",
    transition: `background ${ANIMATION.fast}`,
    background: isActive ? BACKGROUND.secondary : "transparent",
    color: isActive ? TEXT.primary : TEXT.tertiary,
    overflow: "hidden",
    position: "relative" as const,
  } as const);

export const tabCloseButton = {
  marginLeft: 4,
  padding: 2,
  borderRadius: "50%",
  border: "none",
  background: "transparent",
  cursor: "pointer",
  color: "inherit",
  opacity: 0.5,
  display: "flex",
  flexShrink: 0,
  transition: ANIMATION.fast,
} as const;

export const tabCloseButtonHover = {
  background: BACKGROUND.hover,
  opacity: 1,
} as const;

export const tabLoadingBar = {
  position: "absolute" as const,
  bottom: 0,
  left: 0,
  right: 0,
  height: 2,
  overflow: "hidden",
} as const;

export const tabLoadingBarInner = {
  width: "25%",
  height: "100%",
  background: browser.accent,
} as const;

// ============================================================================
// Nav Bar
// ============================================================================

export const navBar = {
  height: 40,
  minHeight: 40,
  maxHeight: 40,
  display: "flex",
  flexDirection: "row" as const,
  alignItems: "center",
  gap: 8,
  paddingLeft: 8,
  paddingRight: 8,
  background: BACKGROUND.secondary,
  borderBottom: `1px solid ${BORDER.subtle}`,
  flexShrink: 0,
} as const;

export const urlBar = {
  display: "flex",
  alignItems: "center",
  height: 32,
  background: BACKGROUND.primary,
  borderRadius: RADIUS.full,
  paddingLeft: 16,
  paddingRight: 16,
  flex: 1,
  border: `1px solid ${BORDER.subtle}`,
  transition: ANIMATION.fast,
} as const;

export const urlBarFocused = {
  borderColor: browser.border,
  boxShadow: `0 0 0 3px ${browser.soft}`,
} as const;

export const navButton = (active?: boolean, disabled?: boolean) =>
  ({
    padding: 6,
    borderRadius: "50%",
    border: "none",
    background: "transparent",
    cursor: disabled ? "not-allowed" : "pointer",
    color: active ? browser.accent : disabled ? TEXT.tertiary : TEXT.secondary,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    opacity: disabled ? 0.5 : 1,
    transition: ANIMATION.fast,
  } as const);

export const navButtonHover = {
  background: BACKGROUND.hover,
} as const;

// ============================================================================
// Empty State
// ============================================================================

export const emptyState = {
  width: "100%",
  height: "100%",
  display: "flex",
  flexDirection: "column" as const,
  alignItems: "center",
  justifyContent: "center",
  background: BACKGROUND.primary,
} as const;

export const emptyStateTitle = {
  fontSize: TYPOGRAPHY.size.xl,
  fontWeight: TYPOGRAPHY.weight.semibold,
  color: TEXT.primary,
  marginTop: 24,
} as const;

export const emptyStateSubtitle = {
  fontSize: TYPOGRAPHY.size.sm,
  color: TEXT.tertiary,
  marginTop: 8,
} as const;

// ============================================================================
// Accent Line
// ============================================================================

export const accentLine = {
  height: 2,
  flexShrink: 0,
  background: `linear-gradient(90deg, transparent, ${browser.accent}, transparent)`,
  opacity: 0.4,
} as const;

// ============================================================================
// Home Page Suggested Action Button
// ============================================================================

export const suggestionButton = {
  display: "flex",
  alignItems: "center",
  gap: 8,
  padding: "8px 16px",
  borderRadius: RADIUS.md,
  border: `1px solid ${BORDER.subtle}`,
  background: BACKGROUND.secondary,
  color: TEXT.secondary,
  fontSize: TYPOGRAPHY.size.sm,
  cursor: "pointer",
  transition: ANIMATION.base,
} as const;

export const suggestionButtonHover = {
  background: browser.panelTint,
  borderColor: browser.border,
  color: TEXT.primary,
  transform: "translateY(-1px)",
} as const;

// ============================================================================
// Chat Pane
// ============================================================================

export const chatPane = {
  flexShrink: 0,
  borderLeft: `1px solid ${BORDER.subtle}`,
  overflow: "hidden",
  display: "flex",
  flexDirection: "column" as const,
  background: BACKGROUND.primary,
} as const;

export const resizeHandle = (isResizing: boolean) =>
  ({
    width: 8,
    flexShrink: 0,
    cursor: "col-resize",
    position: "relative" as const,
    background: isResizing ? browser.soft : "transparent",
    transition: ANIMATION.fast,
  } as const);

export const resizeHandleLine = (isResizing: boolean) =>
  ({
    position: "absolute" as const,
    left: 3,
    top: 0,
    bottom: 0,
    width: 1,
    background: isResizing ? browser.accent : BORDER.subtle,
    transition: ANIMATION.fast,
  } as const);
