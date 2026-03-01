/**
 * GizziAvatarPlaceholder Component
 *
 * Abstract avatar placeholder - NO FACE, NO CHARACTER IDENTITY.
 * Uses SVG to create an "alive but not character-specific" visualization.
 *
 * Visual language:
 * - Abstract mask/silhouette (wireframe style)
 * - Subtle breathing glow
 * - State-responsive color and animation intensity
 * - Speaking state shows mouth-area pulse (not visemes)
 *
 * Per spec: "Use minimal implementation - pure CSS + SVG recommended"
 */

import React, { useEffect, useRef, useState } from 'react';
import type { ActivityStatus } from '../../runtime/ActivityCenter';
import { activityCenter } from '../../runtime/ActivityCenter';

interface GizziAvatarPlaceholderProps {
  /** Current activity status */
  status: ActivityStatus;
  /** Whether TTS audio is playing */
  speaking?: boolean;
  /** Animation intensity 0-1 (derived from speaking amplitude) */
  amplitude?: number;
  /** Size in pixels */
  size?: number;
  /** CSS class name for customization */
  className?: string;
  /** Callback when avatar is clicked (for deep-linking) */
  onClick?: () => void;
}

/**
 * Map ActivityStatus to color theme
 * Uses the same color palette as ActivityPill for consistency
 */
const STATUS_THEMES: Record<ActivityStatus, { primary: string; secondary: string; glow: string }> = {
  idle: {
    primary: 'rgba(96, 165, 250, 0.8)',      // blue-400
    secondary: 'rgba(167, 139, 250, 0.4)',   // purple-400
    glow: 'rgba(96, 165, 250, 0.3)',
  },
  connecting: {
    primary: 'rgba(245, 158, 11, 0.9)',      // amber-500
    secondary: 'rgba(251, 191, 36, 0.4)',
    glow: 'rgba(245, 158, 11, 0.4)',
  },
  reconnecting: {
    primary: 'rgba(249, 115, 22, 0.9)',      // orange-500
    secondary: 'rgba(253, 186, 116, 0.4)',
    glow: 'rgba(249, 115, 22, 0.5)',
  },
  thinking: {
    primary: 'rgba(59, 130, 246, 0.9)',      // blue-500
    secondary: 'rgba(147, 197, 253, 0.4)',
    glow: 'rgba(59, 130, 246, 0.4)',
  },
  streaming: {
    primary: 'rgba(139, 92, 246, 0.9)',      // purple-500
    secondary: 'rgba(196, 181, 253, 0.4)',
    glow: 'rgba(139, 92, 246, 0.5)',
  },
  speaking: {
    primary: 'rgba(16, 185, 129, 0.9)',      // emerald-500
    secondary: 'rgba(52, 211, 153, 0.5)',
    glow: 'rgba(16, 185, 129, 0.6)',
  },
  done: {
    primary: 'rgba(107, 114, 128, 0.8)',     // gray-500
    secondary: 'rgba(156, 163, 175, 0.3)',
    glow: 'rgba(107, 114, 128, 0.2)',
  },
  error: {
    primary: 'rgba(239, 68, 68, 0.9)',       // red-500
    secondary: 'rgba(252, 165, 165, 0.4)',
    glow: 'rgba(239, 68, 68, 0.5)',
  },
};

/**
 * Breathing animation parameters per spec section 3.2
 */
const BREATH_PATTERNS: Record<ActivityStatus, { rate: number; depth: number }> = {
  idle: { rate: 0.1, depth: 0.05 },           // 4-6 breaths/min
  connecting: { rate: 0.17, depth: 0.08 },    // 8-10 breaths/min
  reconnecting: { rate: 0.25, depth: 0.12 },  // Irregular, faster
  thinking: { rate: 0.12, depth: 0.06 },      // 5-6 breaths/min
  streaming: { rate: 0.14, depth: 0.07 },     // 6-8 breaths/min
  speaking: { rate: 0.14, depth: 0.1 },       // 6-8 breaths/min, deeper
  done: { rate: 0.08, depth: 0.04 },          // Slow, single cycle
  error: { rate: 0.2, depth: 0.05 },          // Shallow, quick
};

export const GizziAvatarPlaceholder: React.FC<GizziAvatarPlaceholderProps> = ({
  status,
  speaking = false,
  amplitude = 0,
  size = 200,
  className,
  onClick,
}) => {
  const theme = STATUS_THEMES[status];
  const breathPattern = BREATH_PATTERNS[status];
  const [time, setTime] = useState(0);
  const animationRef = useRef<number>(0);
  const [isValidTarget, setIsValidTarget] = useState(false);

  // Check if there's a valid activity target (for clickability)
  useEffect(() => {
    const checkTarget = () => {
      const activity = activityCenter.getCurrentActivity();
      const nav = activity?.navTarget;
      
      // Valid target: activity exists AND navTarget exists AND navTarget is valid
      const hasValidNav = nav && (
        nav.kind === 'tab' ||
        (nav.kind === 'chatSession' && !!(nav as any).chatSessionId) ||
        (nav.kind === 'brainSession' && !!(nav as any).sessionId)
      );
      
      setIsValidTarget(!!activity && !!hasValidNav);
    };
    
    checkTarget();
    // Poll less frequently for this check (only for cursor/interaction)
    const interval = setInterval(checkTarget, 1000);
    return () => clearInterval(interval);
  }, []);

  // Animation loop for breathing
  useEffect(() => {
    let lastTime = performance.now();

    const animate = (currentTime: number) => {
      const delta = (currentTime - lastTime) / 1000;
      lastTime = currentTime;
      setTime((prev) => prev + delta);
      animationRef.current = requestAnimationFrame(animate);
    };

    animationRef.current = requestAnimationFrame(animate);

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, []);

  // Calculate breathing scale
  const breathScale = 1 + Math.sin(time * breathPattern.rate * Math.PI * 2) * breathPattern.depth;
  
  // Speaking adds pulse variation
  const speakPulse = speaking ? (1 + amplitude * 0.15) : 1;
  const totalScale = breathScale * speakPulse;

  // Color transitions for error/done states
  const isTransientState = status === 'done' || status === 'error';

  // Handle click for deep-linking (only fires when isValidTarget)
  const handleClick = () => {
    if (isValidTarget && onClick) {
      onClick();
    }
  };

  return (
    <div
      className={`gizzi-avatar-placeholder ${className || ''}`}
      onClick={handleClick}
      style={{
        width: size,
        height: size,
        position: 'relative',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        cursor: isValidTarget ? 'pointer' : 'default',
        pointerEvents: isValidTarget ? 'auto' : 'none',  // Critical: don't block when not clickable
        transition: 'cursor 200ms ease, pointer-events 150ms ease',
      }}
    >
      {/* Outer glow */}
      <div
        style={{
          position: 'absolute',
          width: size * 1.2 * totalScale,
          height: size * 1.2 * totalScale,
          borderRadius: '50%',
          background: `radial-gradient(circle, ${theme.glow} 0%, transparent 70%)`,
          filter: 'blur(20px)',
          opacity: isTransientState ? 0.6 : 0.8,
          transition: 'all 300ms ease-out',
        }}
      />

      {/* Main SVG container */}
      <svg
        width={size}
        height={size}
        viewBox="0 0 100 100"
        style={{
          overflow: 'visible',
          transform: `scale(${totalScale})`,
          transition: 'transform 150ms ease-out',
        }}
      >
        {/* Abstract head silhouette - wireframe style */}
        <defs>
          {/* Gradient for head fill */}
          <radialGradient id={`headGradient-${status}`} cx="50%" cy="40%" r="50%">
            <stop offset="0%" stopColor={theme.primary} stopOpacity="0.9" />
            <stop offset="70%" stopColor={theme.primary} stopOpacity="0.6" />
            <stop offset="100%" stopColor={theme.secondary} stopOpacity="0.3" />
          </radialGradient>

          {/* Glow filter */}
          <filter id={`glow-${status}`} x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="2" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* Head outline - abstract mask shape */}
        <path
          d="M50 15 
             C70 15, 85 30, 85 50 
             C85 70, 85 80, 75 88 
             C65 95, 35 95, 25 88 
             C15 80, 15 70, 15 50 
             C15 30, 30 15, 50 15 Z"
          fill={`url(#headGradient-${status})`}
          stroke={theme.primary}
          strokeWidth="1.5"
          strokeOpacity="0.6"
          filter={`url(#glow-${status})`}
          style={{
            transition: 'fill 300ms ease, stroke 300ms ease',
          }}
        />

        {/* Abstract eye area - "mask" look, no eyes */}
        <ellipse
          cx="35"
          cy="45"
          rx="8"
          ry="5"
          fill="none"
          stroke={theme.primary}
          strokeWidth="1"
          strokeOpacity="0.5"
        />
        <ellipse
          cx="65"
          cy="45"
          rx="8"
          ry="5"
          fill="none"
          stroke={theme.primary}
          strokeWidth="1"
          strokeOpacity="0.5"
        />

        {/* Abstract mouth area - breathing indicator */}
        {/* Shows subtle movement when speaking */}
        <ellipse
          cx="50"
          cy="70"
          rx={8 + (speaking ? amplitude * 6 : 0)}
          ry={4 + (speaking ? amplitude * 3 : 0)}
          fill={theme.primary}
          fillOpacity={0.3 + amplitude * 0.4}
          style={{
            transition: 'rx 50ms ease-out, ry 50ms ease-out, fill-opacity 50ms ease',
          }}
        />

        {/* Status indicator ring */}
        <circle
          cx="50"
          cy="50"
          r="45"
          fill="none"
          stroke={theme.primary}
          strokeWidth="0.5"
          strokeOpacity={status === 'speaking' ? 0.6 : 0.3}
          strokeDasharray={status === 'streaming' ? '10 5' : 'none'}
          style={{
            animation: status === 'streaming' 
              ? 'spin 2s linear infinite' 
              : status === 'speaking'
              ? 'pulse 1s ease-in-out infinite'
              : 'none',
          }}
        />
      </svg>

      {/* Inject animation styles if not already present */}
      <style>{`
        @keyframes spin {
          from { transform-origin: center; transform: rotate(0deg); }
          to { transform-origin: center; transform: rotate(360deg); }
        }
        @keyframes pulse {
          0%, 100% { opacity: 0.6; transform: scale(1); }
          50% { opacity: 0.8; transform: scale(1.02); }
        }
      `}</style>
    </div>
  );
};

export default GizziAvatarPlaceholder;
