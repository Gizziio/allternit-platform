/**
 * AvatarDisplay Component
 *
 * Ready-to-use agent avatar display with automatic visual state management.
 * Simply provide an agentId and it handles the rest.
 */

import React from 'react';
import { Avatar } from '@/components/Avatar';
import { useAgentAvatar, DEFAULT_VISUAL_STATE } from '@/hooks/useAgentAvatar';
import type { AvatarSize } from '@a2r/visual-state/types';
import styles from './AvatarDisplay.module.css';

export interface AvatarDisplayProps {
  /** Agent ID to display avatar for */
  agentId: string;
  /** Avatar size */
  size?: AvatarSize;
  /** Enable animations */
  animate?: boolean;
  /** Show state label below avatar */
  showLabel?: boolean;
  /** Show confidence indicator */
  showConfidence?: boolean;
  /** Click handler */
  onClick?: () => void;
  /** Additional CSS class */
  className?: string;
  /** Reduced motion preference */
  reducedMotion?: boolean;
  /** Hide when idle (show nothing when agent is idle) */
  hideWhenIdle?: boolean;
}

/**
 * AvatarDisplay - Drop-in agent avatar component
 */
export const AvatarDisplay: React.FC<AvatarDisplayProps> = ({
  agentId,
  size = 'md',
  animate = true,
  showLabel = false,
  showConfidence = true,
  onClick,
  className = '',
  reducedMotion = false,
  hideWhenIdle = false,
}) => {
  const { visualState } = useAgentAvatar({
    agentId,
    size,
    animate,
    reducedMotion,
  });

  // Use default state if no state available
  const displayState = visualState || DEFAULT_VISUAL_STATE;

  // Hide when idle if requested
  if (hideWhenIdle && displayState.mood === 'idle') {
    return null;
  }

  return (
    <div className={`${styles.container} ${className}`}>
      <div className={styles.avatarWrapper}>
        <Avatar
          visualState={displayState}
          size={size}
          animate={animate}
          reducedMotion={reducedMotion}
          onClick={onClick}
        />
        
        {showConfidence && visualState && (
          <div className={styles.confidenceIndicator} title={`Confidence: ${Math.round(visualState.confidence * 100)}%`}>
            <div className={styles.confidenceBar}>
              <div
                className={styles.confidenceFill}
                style={{ width: `${visualState.confidence * 100}%` }}
              />
            </div>
          </div>
        )}
      </div>
      
      {showLabel && (
        <div className={styles.label}>
          <span className={styles.moodText}>{displayState.mood}</span>
          <span className={styles.intensityText}>{displayState.intensity}/10</span>
        </div>
      )}
    </div>
  );
};

/**
 * AvatarDisplayInline - Compact inline version for message bubbles
 */
export interface AvatarDisplayInlineProps {
  agentId: string;
  size?: 'xs' | 'sm';
  animate?: boolean;
  className?: string;
}

export const AvatarDisplayInline: React.FC<AvatarDisplayInlineProps> = ({
  agentId,
  size = 'sm',
  animate = true,
  className = '',
}) => {
  const { visualState } = useAgentAvatar({ agentId, size, animate });
  const displayState = visualState || DEFAULT_VISUAL_STATE;

  return (
    <div className={`${styles.inline} ${className}`} title={`${displayState.mood} (${displayState.intensity}/10)`}>
      <Avatar
        visualState={displayState}
        size={size}
        animate={animate}
      />
    </div>
  );
};

export default AvatarDisplay;
