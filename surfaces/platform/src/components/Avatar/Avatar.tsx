/**
 * Avatar Component
 * 
 * Visual representation of agent state with mood-based animations.
 */

import React, { useMemo } from 'react';
import styles from './Avatar.module.css';
import type { VisualState, AvatarSize, Mood } from '@allternit/visual-state/types';
import { getMoodColor, getAnimationSpeed, getGlowIntensity } from '@allternit/visual-state/types';

export interface AvatarProps {
  /** Current visual state */
  visualState: VisualState;
  /** Avatar size */
  size?: AvatarSize;
  /** Enable animations */
  animate?: boolean;
  /** Click handler */
  onClick?: () => void;
  /** Additional CSS class */
  className?: string;
  /** Reduced motion preference */
  reducedMotion?: boolean;
}

/**
 * Avatar Component - Renders agent avatar based on visual state
 */
export const Avatar: React.FC<AvatarProps> = ({
  visualState,
  size = 'md',
  animate = true,
  onClick,
  className = '',
  reducedMotion = false,
}) => {
  const { mood, intensity, confidence, reliability } = visualState;

  // Calculate dynamic styles
  const avatarStyles = useMemo(() => {
    const baseColor = getMoodColor(mood);
    const animationSpeed = getAnimationSpeed(intensity);
    const glowIntensity = getGlowIntensity(confidence);

    return {
      '--avatar-color': baseColor,
      '--avatar-glow': `${glowIntensity}px`,
      '--animation-speed': animate && !reducedMotion ? `${1 / animationSpeed}s` : '0s',
      '--confidence-opacity': 0.5 + (confidence * 0.5),
      '--reliability-border': `${2 + (reliability * 3)}px`,
    } as React.CSSProperties;
  }, [mood, intensity, confidence, reliability, animate, reducedMotion]);

  // Size class
  const sizeClass = styles[size];

  // Mood-specific class
  const moodClass = styles[mood];

  return (
    <div
      className={`${styles.avatar} ${sizeClass} ${moodClass} ${className}`}
      style={avatarStyles}
      onClick={onClick}
      role="img"
      aria-label={`Agent is ${mood}, intensity ${intensity}/10, confidence ${Math.round(confidence * 100)}%`}
      title={`${mood} (${intensity}/10) - Confidence: ${Math.round(confidence * 100)}%`}
    >
      {/* Base shape */}
      <div className={styles.base}>
        <MoodShape mood={mood} intensity={intensity} />
      </div>

      {/* Animated elements */}
      {animate && !reducedMotion && (
        <>
          <div className={styles.pulse} />
          <div className={styles.glow} />
        </>
      )}

      {/* Confidence indicator */}
      <div className={styles.confidenceRing} />

      {/* Mood-specific decorations */}
      <MoodDecorations mood={mood} intensity={intensity} />
    </div>
  );
};

// ============================================================================
// Mood Shape Component
// ============================================================================

interface MoodShapeProps {
  mood: Mood;
  intensity: number;
}

const MoodShape: React.FC<MoodShapeProps> = ({ mood, intensity }) => {
  // Scale factor based on intensity
  const scale = 0.8 + (intensity / 50);

  switch (mood) {
    case 'idle':
      return (
        <svg viewBox="0 0 100 100" className={styles.shape} style={{ transform: `scale(${scale})` }}>
          <circle cx="50" cy="50" r="40" fill="currentColor" opacity="0.8" />
          <circle cx="35" cy="45" r="5" fill="white" />
          <circle cx="65" cy="45" r="5" fill="white" />
          <path d="M 35 60 Q 50 65 65 60" stroke="white" strokeWidth="3" fill="none" />
        </svg>
      );

    case 'focused':
      return (
        <svg viewBox="0 0 100 100" className={styles.shape} style={{ transform: `scale(${scale})` }}>
          <circle cx="50" cy="50" r="40" fill="currentColor" />
          <ellipse cx="35" cy="45" rx="8" ry="6" fill="white" />
          <ellipse cx="65" cy="45" rx="8" ry="6" fill="white" />
          <circle cx="35" cy="45" r="3" fill="currentColor" />
          <circle cx="65" cy="45" r="3" fill="currentColor" />
          <path d="M 40 65 L 50 60 L 60 65" stroke="white" strokeWidth="3" fill="none" />
        </svg>
      );

    case 'thinking':
      return (
        <svg viewBox="0 0 100 100" className={styles.shape} style={{ transform: `scale(${scale})` }}>
          <circle cx="50" cy="50" r="40" fill="currentColor" />
          <circle cx="30" cy="40" r="6" fill="white" />
          <circle cx="70" cy="40" r="6" fill="white" />
          <text x="75" y="25" fontSize="20" fill="white">💭</text>
          <path d="M 35 65 Q 50 55 65 65" stroke="white" strokeWidth="3" fill="none" />
        </svg>
      );

    case 'uncertain':
      return (
        <svg viewBox="0 0 100 100" className={styles.shape} style={{ transform: `scale(${scale})` }}>
          <circle cx="50" cy="50" r="40" fill="currentColor" />
          <text x="35" y="50" fontSize="20" fill="white">🤨</text>
          <path d="M 35 70 Q 50 60 65 70" stroke="white" strokeWidth="3" fill="none" />
        </svg>
      );

    case 'celebrating':
      return (
        <svg viewBox="0 0 100 100" className={styles.shape} style={{ transform: `scale(${scale})` }}>
          <circle cx="50" cy="50" r="40" fill="currentColor" />
          <text x="20" y="30" fontSize="15" fill="white">✨</text>
          <text x="70" y="30" fontSize="15" fill="white">✨</text>
          <circle cx="35" cy="45" r="5" fill="white" />
          <circle cx="65" cy="45" r="5" fill="white" />
          <path d="M 30 60 Q 50 75 70 60" stroke="white" strokeWidth="4" fill="none" />
        </svg>
      );

    case 'warning':
      return (
        <svg viewBox="0 0 100 100" className={styles.shape} style={{ transform: `scale(${scale})` }}>
          <polygon points="50,10 90,90 10,90" fill="currentColor" />
          <text x="42" y="70" fontSize="30" fill="white">!</text>
        </svg>
      );

    case 'error':
      return (
        <svg viewBox="0 0 100 100" className={styles.shape} style={{ transform: `scale(${scale})` }}>
          <circle cx="50" cy="50" r="40" fill="currentColor" />
          <path d="M 35 35 L 65 65 M 65 35 L 35 65" stroke="white" strokeWidth="6" strokeLinecap="round" />
        </svg>
      );

    case 'listening':
      return (
        <svg viewBox="0 0 100 100" className={styles.shape} style={{ transform: `scale(${scale})` }}>
          <circle cx="50" cy="50" r="40" fill="currentColor" />
          <text x="40" y="60" fontSize="30" fill="white">👂</text>
          <path d="M 20 50 Q 10 50 15 40" stroke="white" strokeWidth="2" fill="none" opacity="0.5" />
          <path d="M 20 50 Q 10 50 15 60" stroke="white" strokeWidth="2" fill="none" opacity="0.5" />
        </svg>
      );

    case 'speaking':
      return (
        <svg viewBox="0 0 100 100" className={styles.shape} style={{ transform: `scale(${scale})` }}>
          <circle cx="50" cy="50" r="40" fill="currentColor" />
          <ellipse cx="50" cy="45" rx="15" ry="10" fill="white" />
          <circle cx="30" cy="35" r="4" fill="white" opacity="0.6" />
          <circle cx="70" cy="35" r="4" fill="white" opacity="0.6" />
          <circle cx="25" cy="25" r="3" fill="white" opacity="0.4" />
          <circle cx="75" cy="25" r="3" fill="white" opacity="0.4" />
        </svg>
      );

    case 'sleeping':
      return (
        <svg viewBox="0 0 100 100" className={styles.shape} style={{ transform: `scale(${scale})` }}>
          <circle cx="50" cy="50" r="40" fill="currentColor" opacity="0.6" />
          <text x="30" y="45" fontSize="15" fill="white">💤</text>
          <path d="M 35 55 Q 40 55 40 60 Q 40 65 35 65" stroke="white" strokeWidth="2" fill="none" />
          <path d="M 60 55 Q 65 55 65 60 Q 65 65 60 65" stroke="white" strokeWidth="2" fill="none" />
        </svg>
      );

    case 'confused':
      return (
        <svg viewBox="0 0 100 100" className={styles.shape} style={{ transform: `scale(${scale})` }}>
          <circle cx="50" cy="50" r="40" fill="currentColor" />
          <text x="30" y="40" fontSize="12" fill="white" transform="rotate(-20 30 40)">?</text>
          <text x="60" y="40" fontSize="12" fill="white" transform="rotate(20 60 40)">?</text>
          <path d="M 40 65 Q 50 60 60 65" stroke="white" strokeWidth="3" fill="none" />
        </svg>
      );

    default:
      return (
        <svg viewBox="0 0 100 100" className={styles.shape} style={{ transform: `scale(${scale})` }}>
          <circle cx="50" cy="50" r="40" fill="currentColor" />
          <text x="40" y="60" fontSize="30" fill="white">🤖</text>
        </svg>
      );
  }
};

// ============================================================================
// Mood Decorations Component
// ============================================================================

interface MoodDecorationsProps {
  mood: Mood;
  intensity: number;
}

const MoodDecorations: React.FC<MoodDecorationsProps> = ({ mood, intensity }) => {
  const decorationCount = Math.ceil(intensity / 3);

  switch (mood) {
    case 'celebrating':
      return (
        <>
          {Array.from({ length: decorationCount }).map((_, i) => (
            <span
              key={i}
              className={styles.sparkle}
              style={{
                animationDelay: `${i * 0.2}s`,
                left: `${20 + Math.random() * 60}%`,
                top: `${20 + Math.random() * 60}%`,
              }}
            >
              ✨
            </span>
          ))}
        </>
      );

    case 'thinking':
      return (
        <>
          {Array.from({ length: decorationCount }).map((_, i) => (
            <span
              key={i}
              className={styles.thoughtBubble}
              style={{
                animationDelay: `${i * 0.3}s`,
                right: `${-10 - i * 5}px`,
                top: `${10 + i * 10}px`,
              }}
            >
              💭
            </span>
          ))}
        </>
      );

    case 'error':
      return (
        <div className={styles.errorShake}>
          <span className={styles.errorIcon}>⚡</span>
        </div>
      );

    default:
      return null;
  }
};

export default Avatar;
