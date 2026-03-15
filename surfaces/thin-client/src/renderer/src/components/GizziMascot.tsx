"use client";

import { useState, useEffect, useMemo } from 'react';

export type GizziEmotion = 'alert' | 'curious' | 'focused' | 'steady' | 'pleased' | 'skeptical' | 'mischief' | 'proud';

interface GizziMascotProps {
  size?: number;
  emotion?: GizziEmotion;
  className?: string;
}

type EyePreset = 'square' | 'wide' | 'curious' | 'narrow' | 'pleased' | 'skeptical' | 'mischief' | 'proud';

interface EmotionProfile {
  expressions: string[];
  bodyAnimation: string;
  beaconAnimation: string;
  eyePreset: EyePreset;
  typeDelay: number;
  holdDelay: number;
}

const gizziStyles = `
@keyframes gizzi-float {
  0%, 100% { transform: translateY(0px); }
  50% { transform: translateY(-2px); }
}

@keyframes gizzi-alert-hop {
  0%, 100% { transform: translateY(0px); }
  20% { transform: translateY(-4px); }
  40% { transform: translateY(-1px); }
}

@keyframes gizzi-curious-tilt {
  0%, 100% { transform: rotate(0deg) translateY(0px); }
  35% { transform: rotate(-3deg) translateY(-1px); }
  68% { transform: rotate(2deg) translateY(-2px); }
}

@keyframes gizzi-focused-breathe {
  0%, 100% { transform: scale(1); }
  50% { transform: scale(1.015); }
}

@keyframes gizzi-steady-hold {
  0%, 100% { transform: translateY(0px); }
  50% { transform: translateY(-1px); }
}

@keyframes gizzi-pleased-bob {
  0%, 100% { transform: translateY(0px) rotate(0deg); }
  40% { transform: translateY(-3px) rotate(-1deg); }
  70% { transform: translateY(-1px) rotate(1deg); }
}

@keyframes gizzi-skeptical-lean {
  0%, 100% { transform: rotate(0deg); }
  50% { transform: rotate(-2.5deg) translateX(-1px); }
}

@keyframes gizzi-mischief-sway {
  0%, 100% { transform: rotate(0deg) translateY(0px); }
  30% { transform: rotate(2deg) translateY(-1px); }
  60% { transform: rotate(-2deg) translateY(-2px); }
}

@keyframes gizzi-proud-lift {
  0%, 100% { transform: translateY(0px); }
  50% { transform: translateY(-3px) scale(1.01); }
}

@keyframes gizzi-beacon-soft {
  0%, 100% { opacity: 0.55; transform: scale(0.94); }
  50% { opacity: 0.92; transform: scale(1.04); }
}

@keyframes gizzi-beacon-alert {
  0%, 100% { opacity: 0.5; transform: scale(0.9); }
  50% { opacity: 1; transform: scale(1.12); }
}
`;

const EMOTION_PROFILES: Record<GizziEmotion, EmotionProfile> = {
  alert: {
    expressions: ['://', '://>', '://'],
    bodyAnimation: 'gizzi-alert-hop 2.6s ease-in-out infinite',
    beaconAnimation: 'gizzi-beacon-alert 1.4s ease-in-out infinite',
    eyePreset: 'wide',
    typeDelay: 210,
    holdDelay: 1040,
  },
  curious: {
    expressions: [':__', ':/?', ':__'],
    bodyAnimation: 'gizzi-curious-tilt 4.6s ease-in-out infinite',
    beaconAnimation: 'gizzi-beacon-soft 2.2s ease-in-out infinite',
    eyePreset: 'curious',
    typeDelay: 240,
    holdDelay: 1180,
  },
  focused: {
    expressions: [':__', ':||', ':__'],
    bodyAnimation: 'gizzi-focused-breathe 4.4s ease-in-out infinite',
    beaconAnimation: 'gizzi-beacon-soft 2.5s ease-in-out infinite',
    eyePreset: 'narrow',
    typeDelay: 250,
    holdDelay: 1280,
  },
  steady: {
    expressions: [':__', ':__', ':__'],
    bodyAnimation: 'gizzi-steady-hold 5.8s ease-in-out infinite',
    beaconAnimation: 'gizzi-beacon-soft 2.8s ease-in-out infinite',
    eyePreset: 'square',
    typeDelay: 320,
    holdDelay: 1360,
  },
  pleased: {
    expressions: [':)', ':))', ':)'],
    bodyAnimation: 'gizzi-pleased-bob 3.8s ease-in-out infinite',
    beaconAnimation: 'gizzi-beacon-soft 2s ease-in-out infinite',
    eyePreset: 'pleased',
    typeDelay: 250,
    holdDelay: 1100,
  },
  skeptical: {
    expressions: [':/', ':/_', ':/'],
    bodyAnimation: 'gizzi-skeptical-lean 4.4s ease-in-out infinite',
    beaconAnimation: 'gizzi-beacon-soft 2.4s ease-in-out infinite',
    eyePreset: 'skeptical',
    typeDelay: 260,
    holdDelay: 1240,
  },
  mischief: {
    expressions: [':)', ':>>', ':~'],
    bodyAnimation: 'gizzi-mischief-sway 4.2s ease-in-out infinite',
    beaconAnimation: 'gizzi-beacon-soft 1.9s ease-in-out infinite',
    eyePreset: 'mischief',
    typeDelay: 220,
    holdDelay: 1060,
  },
  proud: {
    expressions: [':)', ':_)', ':)'],
    bodyAnimation: 'gizzi-proud-lift 4.8s ease-in-out infinite',
    beaconAnimation: 'gizzi-beacon-soft 2.1s ease-in-out infinite',
    eyePreset: 'proud',
    typeDelay: 250,
    holdDelay: 1200,
  },
};

function renderEye(side: 'left' | 'right', preset: EyePreset) {
  const x = side === 'left' ? 33 : 59;

  switch (preset) {
    case 'wide':
      return <rect x={x} y="36" width="8" height="10" rx="2" fill="#111318" />;
    case 'curious':
      return side === 'left' ? (
        <rect x={x} y="36" width="8" height="8" rx="2" fill="#111318" />
      ) : (
        <path d={`M${x} 45L${x + 4} 36L${x + 8} 45`} stroke="#111318" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      );
    case 'narrow':
      return <rect x={x} y="40" width="8" height="4" rx="2" fill="#111318" />;
    case 'pleased':
      return (
        <path
          d={`M${x} 43C${x + 2} 39 ${x + 6} 39 ${x + 8} 43`}
          stroke="#111318"
          strokeWidth="3"
          strokeLinecap="round"
          fill="none"
        />
      );
    case 'skeptical':
      return side === 'left' ? (
        <path d={`M${x} 40H${x + 8}`} stroke="#111318" strokeWidth="3" strokeLinecap="round" />
      ) : (
        <path d={`M${x} 44L${x + 8} 40`} stroke="#111318" strokeWidth="3" strokeLinecap="round" />
      );
    case 'mischief':
      return side === 'left' ? (
        <path d={`M${x} 42L${x + 8} 38`} stroke="#111318" strokeWidth="3" strokeLinecap="round" />
      ) : (
        <path d={`M${x} 38L${x + 8} 42`} stroke="#111318" strokeWidth="3" strokeLinecap="round" />
      );
    case 'proud':
      return (
        <path
          d={`M${x} 44C${x + 2} 41 ${x + 6} 41 ${x + 8} 44`}
          stroke="#111318"
          strokeWidth="3"
          strokeLinecap="round"
          fill="none"
        />
      );
    case 'square':
    default:
      return <rect x={x} y="37" width="8" height="8" rx="2" fill="#111318" />;
  }
}

export function GizziMascot({
  size = 92,
  emotion = 'pleased',
  className,
}: GizziMascotProps) {
  const profile = useMemo(() => EMOTION_PROFILES[emotion], [emotion]);
  const [expressionIndex, setExpressionIndex] = useState(0);
  const [visibleLength, setVisibleLength] = useState(profile.expressions[0]?.length ?? 0);

  useEffect(() => {
    const expression = profile.expressions[expressionIndex] ?? profile.expressions[0] ?? ':__';
    const isTyping = visibleLength < expression.length;
    const nextDelay = isTyping ? profile.typeDelay : profile.holdDelay;

    const timeoutId = window.setTimeout(() => {
      if (isTyping) {
        setVisibleLength((current) => Math.min(current + 1, expression.length));
        return;
      }

      const nextIndex = (expressionIndex + 1) % profile.expressions.length;
      setExpressionIndex(nextIndex);
      setVisibleLength(profile.expressions[nextIndex]?.length ? 1 : 0);
    }, nextDelay);

    return () => window.clearTimeout(timeoutId);
  }, [expressionIndex, profile, visibleLength]);

  const mouthText = (profile.expressions[expressionIndex] ?? ':__').slice(0, visibleLength);

  return (
    <div
      className={className}
      style={{ width: size, height: size, cursor: 'default' }}
      role="img"
      aria-label="Gizzi mascot"
    >
      <style>{gizziStyles}</style>
      <svg
        viewBox="0 0 96 96"
        width={size}
        height={size}
        aria-hidden="true"
        style={{ animation: 'gizzi-float 6.2s ease-in-out infinite' }}
        shapeRendering="geometricPrecision"
      >
        {/* Shadow */}
        <ellipse cx="48" cy="86" rx="21" ry="4" fill="rgba(9, 11, 14, 0.14)" />

        {/* Body Group */}
        <g
          style={{
            transformOrigin: '48px 48px',
            animation: profile.bodyAnimation,
          }}
        >
          {/* Beacon */}
          <rect
            x="44"
            y="8"
            width="8"
            height="5"
            rx="2"
            fill="#D97757"
            style={{
              transformOrigin: '48px 10px',
              animation: profile.beaconAnimation,
            }}
          />

          {/* Ears */}
          <rect x="24" y="15" width="17" height="7" rx="3" fill="#D4B08C" />
          <rect x="55" y="15" width="17" height="7" rx="3" fill="#D4B08C" />

          {/* Main body */}
          <path
            d="M25 23H71L78 30V56L72 63V69L64 76H32L24 69V63L18 56V30L25 23Z"
            fill="#D4B08C"
          />

          {/* Left hand */}
          <path d="M18 40H14V44H10V48H14V52H18V56H22V40H18Z" fill="#D4B08C" />
          
          {/* Right hand */}
          <path d="M78 40H82V44H86V48H82V52H78V56H74V40H78Z" fill="#D4B08C" />

          {/* Face area */}
          <rect x="24" y="29" width="48" height="31" rx="9" fill="rgba(17, 19, 24, 0.16)" />

          {/* Eyes */}
          <g style={{ transformOrigin: '48px 40px' }}>
            {renderEye('left', profile.eyePreset)}
            {renderEye('right', profile.eyePreset)}
          </g>

          {/* Nose */}
          <path
            d="M44.5 52L48 42L51.5 52H49.6L48.8 49.5H47.2L46.4 52H44.5ZM47.75 47.7H48.25L48 46.65L47.75 47.7Z"
            fill="#D97757"
          />
          <rect x="46" y="47.2" width="4" height="1.4" rx="0.7" fill="#D97757" />

          {/* Mouth text */}
          <text
            x="48"
            y="57.5"
            textAnchor="middle"
            fill="#D97757"
            fontSize="8.2"
            fontWeight="700"
            fontFamily='"SFMono-Regular", "SF Mono", Consolas, "Liberation Mono", Menlo, monospace'
            letterSpacing="-0.4"
          >
            {mouthText}
          </text>

          {/* Legs */}
          <rect x="24" y="74" width="8" height="12" fill="#D4B08C" />
          <rect x="36" y="74" width="8" height="12" fill="#D4B08C" />
          <rect x="52" y="74" width="8" height="12" fill="#D4B08C" />
          <rect x="64" y="74" width="8" height="12" fill="#D4B08C" />
        </g>
      </svg>
    </div>
  );
}

export default GizziMascot;
