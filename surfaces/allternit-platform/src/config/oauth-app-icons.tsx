/**
 * Client-side icon components for registered OAuth apps.
 * Kept separate from oauth-apps.ts so that file stays server-safe (no JSX).
 */

export const OAuthAppIcons: Record<string, React.ReactNode> = {
  'gizzi-code': (
    <svg width="40" height="40" viewBox="0 0 40 40" fill="none">
      <rect width="40" height="40" rx="10" fill="#1A1410" stroke="rgba(255,255,255,0.1)" strokeWidth="1"/>
      <path d="M13 15l-5 5 5 5M27 15l5 5-5 5M23 11l-6 18" stroke="#D97757" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  ),
  'gizzi-browser': (
    <svg width="40" height="40" viewBox="0 0 40 40" fill="none">
      <rect width="40" height="40" rx="10" fill="#1A1410" stroke="rgba(255,255,255,0.1)" strokeWidth="1"/>
      <circle cx="20" cy="20" r="9" stroke="#6366f1" strokeWidth="1.8"/>
      <path d="M20 11c-3 3-5 5-5 9s2 6 5 9M20 11c3 3 5 5 5 9s-2 6-5 9M11 20h18" stroke="#6366f1" strokeWidth="1.5" strokeLinecap="round"/>
    </svg>
  ),
};

export const DefaultAppIcon = (
  <svg width="40" height="40" viewBox="0 0 40 40" fill="none">
    <rect x="3" y="3" width="34" height="34" rx="8" fill="#1A1410" stroke="rgba(255,255,255,0.1)" strokeWidth="1"/>
    <path d="M14 20h12M20 14v12" stroke="rgba(255,255,255,0.3)" strokeWidth="1.8" strokeLinecap="round"/>
  </svg>
);
