import React from 'react';

// Inline SVG path elements for all capsule icons
// This avoids import issues with SVG files

export type CapsuleType = 
  | 'browser' | 'inspector' | 'agent-steps' | 'studio' | 'templates' | 'artifacts' 
  | 'opencode' | 'claude-code' | 'amp' | 'aider' | 'gemini-cli' | 'cursor' 
  | 'verdant' | 'qwen' | 'goose' | 'codex';

export interface CapsuleIconProps {
  type: string;
  className?: string;
  size?: number;
}

export const CapsuleIcon: React.FC<CapsuleIconProps> = ({ type, className, size = 20 }) => {
  const icon = CapsuleIconRegistry[type] || CapsuleIconRegistry['browser'];
  
  return (
    <svg 
      height={size} 
      viewBox="0 0 24 24" 
      fill="none" 
      stroke="currentColor" 
      strokeWidth="2" 
      strokeLinecap="round" 
      strokeLinejoin="round"
      className={className}
      data-testid="capsule-icon-svg"
    >
      {icon.path}
    </svg>
  );
};

export const CapsuleIconRegistry: Record<string, { path: React.ReactNode; color: string }> = {
  // Core UI icons
  'browser': {
    path: (
      <>
        <circle cx="12" cy="12" r="10" />
        <line x1="2" y1="12" x2="22" y2="12" />
        <path d="M12 2a10 10 0 0 1 10 10 10 10 0 0 1-10 10 10 10 0 0 1-10-10 10 10 0 0 1 10-10z" />
      </>
    ),
    color: '#3b82f6'
  },
  'browser_view': {
    path: (
      <>
        <circle cx="12" cy="12" r="10" />
        <line x1="2" y1="12" x2="22" y2="12" />
        <path d="M12 2a10 10 0 0 1 10 10 10 10 0 0 1-10 10 10 10 0 0 1-10-10 10 10 0 0 1 10-10z" />
      </>
    ),
    color: '#3b82f6'
  },
  'inspector': {
    path: (
      <>
        <path d="M21 11.75v7.25a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h7.25" />
        <polyline points="15 3 21 3 21 9" />
        <line x1="10" y1="14" x2="21" y2="3" />
      </>
    ),
    color: '#10b981'
  },
  'inspector_view': {
    path: (
      <>
        <path d="M21 11.75v7.25a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h7.25" />
        <polyline points="15 3 21 3 21 9" />
        <line x1="10" y1="14" x2="21" y2="3" />
      </>
    ),
    color: '#10b981'
  },
  'agent-steps': {
    path: <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />,
    color: '#f59e0b'
  },
  'studio': {
    path: (
      <>
        <rect x="3" y="3" width="18" height="18" rx="2" />
        <path d="M9 3v18" />
        <path d="M3 9h18" />
      </>
    ),
    color: '#8b5cf6'
  },
  'studio_view': {
    path: (
      <>
        <rect x="3" y="3" width="18" height="18" rx="2" />
        <path d="M9 3v18" />
        <path d="M3 9h18" />
      </>
    ),
    color: '#8b5cf6'
  },
  'templates': {
    path: (
      <>
        <path d="M3 9h18v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V9Z" />
        <path d="m3 9 2.45-4.91A2 2 0 0 1 7.24 3h9.52a2 2 0 0 1 1.8 1.09L21 9" />
      </>
    ),
    color: '#ec4899'
  },
  'artifacts': {
    path: (
      <>
        <path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z" />
        <path d="m3.3 7 8.7 5 8.7-5" />
        <path d="M12 22V12" />
      </>
    ),
    color: '#6366f1'
  },

  // Vendor icons for CLI brain tools
  'opencode': {
    path: (
      <>
        <circle cx="12" cy="12" r="10" />
        <path d="M12 2a10 10 0 0 0-7 17" />
        <path d="M12 19l5-5" />
      </>
    ),
    color: '#3b82f6'
  },
  'claude-code': {
    path: (
      <>
        <rect x="2" y="2" width="20" height="20" rx="2" />
        <path d="M12 6h6" />
        <path d="M9 9h6a1 1 0 0 1 1 1v4" />
        <path d="M9 14h6" />
        <circle cx="12" cy="12" r="2" />
      </>
    ),
    color: '#d97706'
  },
  'amp': {
    path: (
      <>
        <path d="M4 4h16v16H4z" />
        <path d="M9 9h6v6H9z" />
        <path d="M4 20h16" />
      </>
    ),
    color: '#f97316'
  },
  'aider': {
    path: (
      <>
        <circle cx="12" cy="12" r="10" />
        <path d="M8 12l4-4 4 4" />
        <path d="M8 12l4 4 4-4" />
        <line x1="12" y1="8" x2="12" y2="16" />
      </>
    ),
    color: '#10b981'
  },
  'gemini-cli': {
    path: (
      <>
        <circle cx="12" cy="12" r="10" />
        <path d="M12 2a10 10 0 0 1 0 20" />
        <circle cx="12" cy="12" r="3" />
      </>
    ),
    color: '#4285f4'
  },
  'cursor': {
    path: (
      <>
        <path d="M4 4l16 8-8 4-4 8-8-4z" />
        <path d="M4 4l6 3" />
      </>
    ),
    color: '#1e88ad8'
  },
  'verdant': {
    path: (
      <>
        <path d="M12 2L2 7l10 5v10l-10 5z" />
        <path d="M12 22V11.5" />
        <path d="M2 7l10 5 10-5" />
      </>
    ),
    color: '#42404d'
  },
  'qwen': {
    path: (
      <>
        <circle cx="12" cy="12" r="10" />
        <path d="M8 8h8v8H8z" />
        <circle cx="12" cy="12" r="3" />
      </>
    ),
    color: '#6366f6'
  },
  'goose': {
    path: (
      <>
        <path d="M4 8h16v8H4z" />
        <path d="M8 4v4" />
        <path d="M16 4v4" />
        <path d="M4 16h16" />
      </>
    ),
    color: '#9367f1'
  },
  'codex': {
    path: (
      <>
        <path d="M4 4h16v16H4z" />
        <path d="M8 8l4 8" />
        <path d="M16 8l-4 8" />
        <path d="M8 12h8" />
      </>
    ),
    color: '#00a4d5'
  },

  // Fallback icon for unknown types
  'unknown': {
    path: <circle cx="12" cy="12" r="10" stroke="#9ca3af" strokeWidth="2" />,
    color: '#9ca3af'
  },
};
