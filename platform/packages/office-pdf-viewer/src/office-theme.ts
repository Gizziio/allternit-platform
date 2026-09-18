/**
 * Shared visual theme for the Allternit office editors.
 *
 * Reads the platform's design tokens (CSS custom properties defined by
 * ai.allternit.com) so the editors match the host surface exactly; the
 * fallbacks reproduce the same dark-warm palette when the editor runs
 * standalone (dev harness, tests).
 */
export const officeTheme = {
  bg: 'var(--shell-view-bg, #141110)',
  panel: 'var(--surface-panel, #1c1815)',
  card: 'var(--bg-secondary, #211c18)',
  cardHover: 'var(--bg-tertiary, #2a241f)',
  text: 'var(--text-primary, #e7e5e4)',
  textSecondary: 'var(--text-secondary, #a8a29e)',
  textTertiary: 'var(--text-tertiary, #78716c)',
  border: 'var(--border-subtle, rgba(231, 229, 228, 0.09))',
  borderStrong: 'var(--border-default, rgba(231, 229, 228, 0.16))',
  accent: 'var(--accent-primary, #D97757)',
  accentSoft: 'color-mix(in srgb, var(--accent-primary, #D97757) 14%, transparent)',
  radius: 12,
  radiusSm: 8,
  serif: 'ui-serif, Georgia, "Times New Roman", serif',
  sans: 'ui-sans-serif, system-ui, -apple-system, sans-serif',
  mono: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
} as const

/** Secondary toolbar button (ghost with a subtle border). */
export const toolButton: React.CSSProperties = {
  background: 'transparent',
  color: officeTheme.textSecondary,
  border: `1px solid ${officeTheme.border}`,
  borderRadius: officeTheme.radiusSm,
  padding: '7px 14px',
  fontSize: 12.5,
  fontWeight: 600,
  fontFamily: officeTheme.sans,
  cursor: 'pointer',
  whiteSpace: 'nowrap',
}

/** Primary action button (accent). */
export const primaryButton: React.CSSProperties = {
  ...toolButton,
  background: officeTheme.accent,
  border: 'none',
  color: '#141110',
}

/** Header brand lockup pieces. */
export const brandStyles: Record<string, React.CSSProperties> = {
  brand: {
    display: 'flex',
    alignItems: 'baseline',
    gap: 6,
    userSelect: 'none',
  },
  accent: {
    color: officeTheme.accent,
    fontFamily: officeTheme.mono,
    fontSize: 14,
    fontWeight: 700,
  },
  wordmark: {
    color: officeTheme.text,
    fontFamily: officeTheme.serif,
    fontSize: 15,
    letterSpacing: '0.18em',
    fontWeight: 500,
  },
}
