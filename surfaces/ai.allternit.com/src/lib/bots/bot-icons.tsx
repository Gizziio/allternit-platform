/**
 * Custom Bot Icons — Hand-designed SVG icons for Allternit bots
 *
 * Each icon is a unique, polished design that reflects the bot's purpose.
 * Uses the bot's accent color for brand consistency.
 *
 * @module bot-icons
 */

import React from 'react';

// ============================================================================
// Icon Props
// ============================================================================

export interface BotIconProps {
  size?: number;
  color?: string;
  className?: string;
}

// ============================================================================
// A:// Oracle — Stylized eye with radiating knowledge lines
// ============================================================================

export function ALOracleIcon({ size = 24, color = '#6366f1', className }: BotIconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      {/* Outer radiating lines */}
      <path d="M12 2v3" stroke={color} strokeWidth="1.5" strokeLinecap="round" />
      <path d="M12 19v3" stroke={color} strokeWidth="1.5" strokeLinecap="round" />
      <path d="M2 12h3" stroke={color} strokeWidth="1.5" strokeLinecap="round" />
      <path d="M19 12h3" stroke={color} strokeWidth="1.5" strokeLinecap="round" />
      <path d="M4.93 4.93l2.12 2.12" stroke={color} strokeWidth="1.5" strokeLinecap="round" />
      <path d="M16.95 16.95l2.12 2.12" stroke={color} strokeWidth="1.5" strokeLinecap="round" />
      <path d="M4.93 19.07l2.12-2.12" stroke={color} strokeWidth="1.5" strokeLinecap="round" />
      <path d="M16.95 7.05l2.12-2.12" stroke={color} strokeWidth="1.5" strokeLinecap="round" />
      {/* Eye shape */}
      <path
        d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"
        stroke={color}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* Pupil */}
      <circle cx="12" cy="12" r="3" fill={color} />
      {/* Inner highlight */}
      <circle cx="10.5" cy="10.5" r="1" fill="white" opacity="0.6" />
    </svg>
  );
}

// ============================================================================
// Deep Researcher — Stacked documents with magnifying lens
// ============================================================================

export function DeepResearcherIcon({ size = 24, color = '#8b5cf6', className }: BotIconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      {/* Back document */}
      <rect
        x="5"
        y="3"
        width="12"
        height="16"
        rx="2"
        stroke={color}
        strokeWidth="1.5"
        opacity="0.4"
      />
      {/* Front document */}
      <rect
        x="7"
        y="5"
        width="12"
        height="16"
        rx="2"
        stroke={color}
        strokeWidth="1.5"
        fill="none"
      />
      {/* Document lines */}
      <path d="M10 9h6" stroke={color} strokeWidth="1.5" strokeLinecap="round" opacity="0.6" />
      <path d="M10 12h4" stroke={color} strokeWidth="1.5" strokeLinecap="round" opacity="0.6" />
      <path d="M10 15h5" stroke={color} strokeWidth="1.5" strokeLinecap="round" opacity="0.6" />
      {/* Magnifying lens */}
      <circle cx="17" cy="17" r="4" stroke={color} strokeWidth="2" fill="none" />
      <path d="M20 20l2 2" stroke={color} strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

// ============================================================================
// Code Reviewer — Shield with code brackets and checkmark
// ============================================================================

export function CodeReviewerIcon({ size = 24, color = '#06b6d4', className }: BotIconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      {/* Shield outline */}
      <path
        d="M12 2l8 3v6c0 5.25-3.5 9.74-8 11-4.5-1.26-8-5.75-8-11V5l8-3z"
        stroke={color}
        strokeWidth="1.5"
        strokeLinejoin="round"
        fill="none"
      />
      {/* Code brackets */}
      <path d="M9 9l-2 3 2 3" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M15 9l2 3-2 3" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      {/* Checkmark */}
      <path d="M10 14l2 2 4-4" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

// ============================================================================
// Writing Partner — Fountain pen with ink trail
// ============================================================================

export function WritingPartnerIcon({ size = 24, color = '#f59e0b', className }: BotIconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      {/* Pen body */}
      <path
        d="M17 3l4 4-12 12H5v-4L17 3z"
        stroke={color}
        strokeWidth="1.5"
        strokeLinejoin="round"
        fill="none"
      />
      {/* Pen tip */}
      <path d="M5 19l-2 2" stroke={color} strokeWidth="2" strokeLinecap="round" />
      {/* Pen nib detail */}
      <path d="M13 7l4 4" stroke={color} strokeWidth="1.5" strokeLinecap="round" />
      {/* Ink trail */}
      <path
        d="M3 21c2 0 3-1 5-1s3 1 5 1 3-1 5-1 3 1 5 1"
        stroke={color}
        strokeWidth="1.5"
        strokeLinecap="round"
        opacity="0.5"
      />
    </svg>
  );
}

// ============================================================================
// Data Analyst — Ascending bars with trend line
// ============================================================================

export function DataAnalystIcon({ size = 24, color = '#10b981', className }: BotIconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      {/* Bars */}
      <rect x="3" y="14" width="3" height="7" rx="1" fill={color} opacity="0.4" />
      <rect x="8" y="11" width="3" height="10" rx="1" fill={color} opacity="0.6" />
      <rect x="13" y="8" width="3" height="13" rx="1" fill={color} opacity="0.8" />
      <rect x="18" y="5" width="3" height="16" rx="1" fill={color} />
      {/* Trend line */}
      <path
        d="M4.5 15.5l5-3 5-3 5-3"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* Data points */}
      <circle cx="4.5" cy="15.5" r="1.5" fill={color} />
      <circle cx="9.5" cy="12.5" r="1.5" fill={color} />
      <circle cx="14.5" cy="9.5" r="1.5" fill={color} />
      <circle cx="19.5" cy="6.5" r="1.5" fill={color} />
    </svg>
  );
}

// ============================================================================
// Social SDR — Signal broadcast with conversation bubbles
// ============================================================================

export function SocialSDRIcon({ size = 24, color = '#ef4444', className }: BotIconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      {/* Center dot (sender) */}
      <circle cx="12" cy="12" r="3" fill={color} />
      {/* Signal rings */}
      <path
        d="M12 6a6 6 0 0 1 6 6"
        stroke={color}
        strokeWidth="1.5"
        strokeLinecap="round"
        opacity="0.8"
      />
      <path
        d="M12 3a9 9 0 0 1 9 9"
        stroke={color}
        strokeWidth="1.5"
        strokeLinecap="round"
        opacity="0.5"
      />
      <path
        d="M12 18a6 6 0 0 1-6-6"
        stroke={color}
        strokeWidth="1.5"
        strokeLinecap="round"
        opacity="0.8"
      />
      <path
        d="M12 21a9 9 0 0 1-9-9"
        stroke={color}
        strokeWidth="1.5"
        strokeLinecap="round"
        opacity="0.5"
      />
      {/* Target dots */}
      <circle cx="19" cy="8" r="1.5" fill={color} opacity="0.7" />
      <circle cx="5" cy="16" r="1.5" fill={color} opacity="0.7" />
    </svg>
  );
}

// ============================================================================
// UX Auditor — Eye with grid overlay and precision marks
// ============================================================================

export function UXAuditorIcon({ size = 24, color = '#ec4899', className }: BotIconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      {/* Eye outline */}
      <path
        d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"
        stroke={color}
        strokeWidth="1.5"
        strokeLinejoin="round"
        fill="none"
      />
      {/* Iris */}
      <circle cx="12" cy="12" r="4" stroke={color} strokeWidth="1.5" fill="none" />
      {/* Pupil */}
      <circle cx="12" cy="12" r="1.5" fill={color} />
      {/* Grid overlay */}
      <path d="M2 12h20" stroke={color} strokeWidth="0.5" opacity="0.3" />
      <path d="M12 5v14" stroke={color} strokeWidth="0.5" opacity="0.3" />
      {/* Corner precision marks */}
      <path d="M4 4l2 2" stroke={color} strokeWidth="1" strokeLinecap="round" opacity="0.5" />
      <path d="M20 4l-2 2" stroke={color} strokeWidth="1" strokeLinecap="round" opacity="0.5" />
      <path d="M4 20l2-2" stroke={color} strokeWidth="1" strokeLinecap="round" opacity="0.5" />
      <path d="M20 20l-2-2" stroke={color} strokeWidth="1" strokeLinecap="round" opacity="0.5" />
    </svg>
  );
}

// ============================================================================
// Icon Registry — Maps bot IDs to their icon components
// ============================================================================

export const BOT_ICON_MAP: Record<string, React.FC<BotIconProps>> = {
  'al-oracle': ALOracleIcon,
  'deep-researcher': DeepResearcherIcon,
  'code-reviewer': CodeReviewerIcon,
  'writing-partner': WritingPartnerIcon,
  'data-analyst': DataAnalystIcon,
  'social-sdr': SocialSDRIcon,
  'ux-auditor': UXAuditorIcon,
};

/**
 * Get the custom icon component for a bot by ID.
 * Falls back to a generic bot icon if not found.
 */
export function getBotIcon(botId: string): React.FC<BotIconProps> {
  return BOT_ICON_MAP[botId] ?? GenericBotIcon;
}

/**
 * Generic fallback icon for bots without custom icons.
 */
export function GenericBotIcon({ size = 24, color = '#6b7280', className }: BotIconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      {/* Robot head outline */}
      <rect
        x="4"
        y="6"
        width="16"
        height="14"
        rx="3"
        stroke={color}
        strokeWidth="1.5"
        fill="none"
      />
      {/* Antenna */}
      <path d="M12 6V3" stroke={color} strokeWidth="1.5" strokeLinecap="round" />
      <circle cx="12" cy="2" r="1" fill={color} />
      {/* Eyes */}
      <circle cx="9" cy="12" r="1.5" fill={color} />
      <circle cx="15" cy="12" r="1.5" fill={color} />
      {/* Mouth */}
      <path d="M9 16h6" stroke={color} strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}
