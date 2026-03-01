export const tokens = {
  radius: { xs: 6, sm: 10, md: 14, lg: 18, xl: 24, full: 9999 },
  space: { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 },
  motion: {
    fast: '140ms cubic-bezier(0.4, 0, 0.2, 1)',
    base: '200ms cubic-bezier(0.4, 0, 0.2, 1)',
    slow: '300ms cubic-bezier(0.4, 0, 0.2, 1)',
    spring: 'cubic-bezier(0.34, 1.56, 0.64, 1)',
  },
  zindex: {
    base: 0,
    dropdown: 100,
    sticky: 200,
    overlay: 300,
    modal: 400,
    popover: 500,
    tooltip: 600,
    toast: 700,
    max: 9999,
  },
  glass: {
    thin: { background: 'var(--glass-bg)', border: '1px solid var(--border-subtle)', blur: '16px' },
    base: { background: 'var(--glass-bg)', border: '1px solid var(--border-subtle)', blur: '24px' },
    elevated: { background: 'var(--glass-bg-thick)', border: '1px solid var(--border-default)', blur: '32px' },
    thick: { background: 'var(--glass-bg-thick)', border: '1px solid var(--border-strong)', blur: '40px' }
  },
  shadows: {
    xs: 'var(--shadow-sm)',
    sm: 'var(--shadow-sm)',
    md: '0 8px 32px rgba(0,0,0,0.2)',
    lg: '0 12px 48px rgba(0,0,0,0.3)',
    xl: '0 16px 64px rgba(0,0,0,0.4)',
    glass: '0 8px 32px rgba(0,0,0,0.25)',
    glow: '0 0 20px rgba(212, 176, 140, 0.25)',
  },
  colors: {
    // Sand Nude Color Palette
    sand: {
      50: 'var(--sand-50)',
      100: 'var(--sand-100)',
      200: 'var(--sand-200)',
      300: 'var(--sand-300)',
      400: 'var(--sand-400)',
      500: 'var(--sand-500)',
      600: 'var(--sand-600)',
      700: 'var(--sand-700)',
      800: 'var(--sand-800)',
      900: 'var(--sand-900)',
      950: 'var(--sand-950)',
    },
    chat: { primary: 'var(--accent-chat)', gradient: 'linear-gradient(135deg, var(--accent-chat) 0%, var(--sand-600) 100%)' },
    cowork: { primary: 'var(--accent-cowork)', gradient: 'linear-gradient(135deg, var(--accent-cowork) 0%, #7D5F8D 100%)' },
    code: { primary: 'var(--accent-code)', gradient: 'linear-gradient(135deg, var(--accent-code) 0%, #4A7B5A 100%)' },
    system: { bg: 'var(--bg-primary)', surface: 'var(--bg-secondary)', text: 'var(--text-primary)', textMuted: 'var(--text-tertiary)' },
    textPrimary: 'var(--text-primary)',
    textSecondary: 'var(--text-secondary)',
    textTertiary: 'var(--text-tertiary)',
    accentChat: 'var(--accent-chat)',
    accentCode: '#34c759'
  }
};
