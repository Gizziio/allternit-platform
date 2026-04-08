/**
 * Agent Avatar Component
 * 
 * Main container component for rendering agent avatars.
 * Supports emotions, animations, and interactions.
 * 
 * @example
 * ```tsx
 * <AgentAvatar 
 *   config={avatarConfig}
 *   emotion="pleased"
 *   size={80}
 *   isAnimating={true}
 * />
 * ```
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import type { AvatarConfig, AvatarEmotion } from '../../lib/agents/character.types';
import { DEFAULT_AVATAR_CONFIG } from '../../lib/agents/character.types';
import type { AgentAvatarProps } from './AgentAvatar.types';
import { calculateAvatarDimensions } from './AgentAvatar.types';
import { Body } from './parts/Body';
import { Eyes } from './parts/Eyes';
import { Antennas } from './parts/Antennas';
import { Glow } from './parts/Glow';
import { Accessories } from './parts/Accessories';
import { useEmotionAnimation } from './hooks/useEmotionAnimation';
import { useReactiveAnimation } from './hooks/useReactiveAnimation';
import { useAvatarAnimation } from './hooks/useAvatarAnimation';

import './AgentAvatar.styles.css';

// Default values
const DEFAULT_SIZE = 80;
const DEFAULT_EMOTION: AvatarEmotion = 'steady';

export const AgentAvatar: React.FC<AgentAvatarProps> = ({
  config: configProp,
  emotion = DEFAULT_EMOTION,
  size = DEFAULT_SIZE,
  isAnimating = true,
  interactionState: controlledInteractionState,
  className = '',
  onClick,
  onEmotionChange,
  showGlow = true,
  lookAt = null,
}) => {
  // Use default config if none provided
  const config = configProp ?? DEFAULT_AVATAR_CONFIG;
  
  // Refs
  const containerRef = useRef<HTMLDivElement>(null);
  
  // Local state for interaction when not controlled
  const [localInteractionState, setLocalInteractionState] = useState<'idle' | 'hover' | 'active'>('idle');
  const interactionState = controlledInteractionState ?? localInteractionState;
  
  // Track previous emotion for transitions
  const [currentEmotion, setCurrentEmotion] = useState<AvatarEmotion>(
    config.currentEmotion ?? emotion
  );
  
  // Animation hooks
  const emotionAnim = useEmotionAnimation(currentEmotion, config.personality);
  const reactiveAnim = useReactiveAnimation(interactionState);
  const baseAnim = useAvatarAnimation(config, isAnimating);
  
  // Calculate dimensions
  const dimensions = calculateAvatarDimensions(size);
  
  // Update emotion when prop changes
  useEffect(() => {
    if (emotion !== currentEmotion) {
      const prevEmotion = currentEmotion;
      setCurrentEmotion(emotion);
      onEmotionChange?.(emotion);
      
      // Dispatch custom event for emotion change
      if (containerRef.current) {
        const event = new CustomEvent('avatar:emotionchange', {
          detail: { from: prevEmotion, to: emotion }
        });
        containerRef.current.dispatchEvent(event);
      }
    }
  }, [emotion, currentEmotion, onEmotionChange]);
  
  // Update current emotion from config
  useEffect(() => {
    if (config.currentEmotion && config.currentEmotion !== currentEmotion) {
      setCurrentEmotion(config.currentEmotion);
    }
  }, [config.currentEmotion, currentEmotion]);
  
  // Interaction handlers
  const handleMouseEnter = useCallback(() => {
    if (!controlledInteractionState) {
      setLocalInteractionState('hover');
    }
  }, [controlledInteractionState]);
  
  const handleMouseLeave = useCallback(() => {
    if (!controlledInteractionState) {
      setLocalInteractionState('idle');
    }
  }, [controlledInteractionState]);
  
  const handleMouseDown = useCallback(() => {
    if (!controlledInteractionState) {
      setLocalInteractionState('active');
    }
  }, [controlledInteractionState]);
  
  const handleMouseUp = useCallback(() => {
    if (!controlledInteractionState) {
      setLocalInteractionState('hover');
    }
  }, [controlledInteractionState]);
  
  const handleClick = useCallback(() => {
    onClick?.();
  }, [onClick]);
  
  // Combine animation styles
  const containerStyle: React.CSSProperties = {
    width: size,
    height: size,
    position: 'relative',
    display: 'inline-block',
    cursor: onClick ? 'pointer' : 'default',
    ...emotionAnim.containerStyle,
    ...reactiveAnim.containerStyle,
  };
  
  // Build class names
  const containerClasses = [
    'agent-avatar',
    `agent-avatar--emotion-${currentEmotion}`,
    `agent-avatar--interaction-${interactionState}`,
    isAnimating ? 'agent-avatar--animating' : '',
    className,
  ].filter(Boolean).join(' ');
  
  // Determine glow intensity based on emotion
  const getGlowIntensity = (): number => {
    switch (currentEmotion) {
      case 'alert': return 0.8;
      case 'focused': return 0.4;
      case 'pleased': return 0.7;
      case 'proud': return 0.9;
      default: return 0.5;
    }
  };
  
  return (
    <div
      ref={containerRef}
      className={containerClasses}
      style={containerStyle}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onMouseDown={handleMouseDown}
      onMouseUp={handleMouseUp}
      onClick={handleClick}
      role="img"
      aria-label={`Agent avatar showing ${currentEmotion} emotion`}
    >
      <svg
        width={size}
        height={size}
        viewBox={dimensions.viewBox}
        className="agent-avatar__svg"
        style={baseAnim.svgStyle}
      >
        <defs>
          {/* Glow filter */}
          <filter id={`glow-${config.colors?.glow?.replace('#', '') ?? 'default'}`} x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="4" result="coloredBlur" />
            <feMerge>
              <feMergeNode in="coloredBlur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          
          {/* Clip path for body */}
          <clipPath id={`body-clip-${config.baseShape ?? 'rounded'}`}>
            <Body 
              shape={config.baseShape ?? 'round'}
              colors={config.colors ?? { primary: '#6366f1', secondary: '#8b5cf6', glow: '#6366f1', outline: '#1e1b4b' }}
              size={100}
              renderForClipPath
            />
          </clipPath>
        </defs>
        
        {/* Glow layer */}
        {showGlow && (
          <Glow
            color={config.colors?.glow ?? '#6366f1'}
            size={100}
            intensity={getGlowIntensity()}
            pulse={isAnimating && (config.personality?.breathing ?? false)}
          />
        )}
        
        {/* Body layer */}
        <g className="agent-avatar__body-layer">
          <Body
            shape={config.baseShape ?? 'round'}
            colors={config.colors ?? { primary: '#6366f1', secondary: '#8b5cf6', glow: '#6366f1', outline: '#1e1b4b' }}
            size={100}
            emotion={currentEmotion}
            isAnimating={isAnimating}
          />
        </g>
        
        {/* Accessories layer (behind eyes) */}
        <g className="agent-avatar__accessories-back-layer">
          <Accessories
            accessories={config.accessories ?? []}
            layer="back"
            colors={config.colors ?? { primary: '#6366f1', secondary: '#8b5cf6', glow: '#6366f1', outline: '#1e1b4b' }}
            size={100}
          />
        </g>
        
        {/* Eyes layer */}
        <g className="agent-avatar__eyes-layer">
          <Eyes
            config={config.eyes}
            size={100}
            emotion={currentEmotion}
            isAnimating={isAnimating}
            lookAt={lookAt}
          />
        </g>
        
        {/* Accessories layer (front) */}
        <g className="agent-avatar__accessories-front-layer">
          <Accessories
            accessories={config.accessories ?? []}
            layer="front"
            colors={config.colors ?? { primary: '#6366f1', secondary: '#8b5cf6', glow: '#6366f1', outline: '#1e1b4b' }}
            size={100}
          />
        </g>
        
        {/* Antennas layer */}
        <g className="agent-avatar__antennas-layer">
          <Antennas
            config={config.antennas}
            colors={config.colors}
            size={100}
            emotion={currentEmotion}
            isAnimating={isAnimating}
          />
        </g>
      </svg>
    </div>
  );
};

// Convenience export for common sizes
export const AgentAvatarSizes = {
  XS: 24,
  SM: 32,
  MD: 44,
  LG: 64,
  XL: 80,
  XXL: 120,
  XXXL: 200,
} as const;

// Static avatar (no animations)
export const StaticAgentAvatar: React.FC<Omit<AgentAvatarProps, 'isAnimating'>> = (props) => (
  <AgentAvatar {...props} isAnimating={false} />
);

// Display name for debugging
AgentAvatar.displayName = 'AgentAvatar';
StaticAgentAvatar.displayName = 'StaticAgentAvatar';
