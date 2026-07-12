/**
 * Shared button/control class strings for the settings surface.
 * Single source so every settings panel renders the same quiet controls.
 */

/** Quiet bordered secondary button — the default action style in settings. */
export const QUIET_BUTTON_CLASS = "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-solid border-[var(--border-subtle)] bg-transparent text-[13px] font-medium text-[var(--text-primary)] cursor-pointer hover:bg-[var(--bg-secondary)] transition-colors disabled:opacity-50 disabled:cursor-not-allowed";

/** Muted gray destructive button — quiet until hovered. */
export const DESTRUCTIVE_BUTTON_CLASS = "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-solid border-[var(--border-subtle)] bg-[var(--bg-secondary)] text-[13px] font-medium text-[var(--text-secondary)] cursor-pointer hover:text-[var(--status-error)] hover:border-[var(--status-error)]/30 transition-colors disabled:opacity-50 disabled:cursor-not-allowed";

/** Standard settings select styling, shared by the migrated panels. */
export const SETTINGS_SELECT_CLASS = "p-2 px-3 rounded-lg border border-solid border-[var(--border-subtle)] bg-[var(--bg-secondary)] text-[var(--ui-text-primary)] text-[13px] font-medium outline-none cursor-pointer focus:border-[var(--accent-primary)]";
