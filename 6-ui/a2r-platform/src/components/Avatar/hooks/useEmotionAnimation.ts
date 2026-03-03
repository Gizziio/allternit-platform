/**
 * useEmotionAnimation Hook
 * 
 * Manages emotion-based animations for the avatar.
 * Returns animation styles and handles emotion transitions.
 */

import { useMemo, useEffect, useState } from 'react';
import type { AvatarEmotion, AvatarConfig } from '../../../lib/agents/character.types';

export interface EmotionAnimationResult {
  containerStyle: React.CSSProperties;
  bodyTransform: string;
  eyeTransform: string;
  glowIntensity: number;
  glowPulse: boolean;
}

const EMOTION_CONFIG: Record<AvatarEmotion, {
  duration: number;
  easing: string;
  containerTransform?: string;
  bodyTransform?: string;
  eyeTransform?: string;
  glowIntensity: number;
  glowPulse: boolean;
}> = {
  alert: {
    duration: 300,
    easing: 'ease-out',
    containerTransform: 'translateY(-4px)',
    glowIntensity: 0.8,
    glowPulse: true,
  },
  curious: {
    duration: 500,
    easing: 'ease-in-out',
    containerTransform: 'rotate(-5deg)',
    eyeTransform: 'translateX(-2px)',
    glowIntensity: 0.6,
    glowPulse: true,
  },
  focused: {
    duration: 200,
    easing: 'ease-out',
    containerTransform: 'scale(0.98)',
    eyeTransform: 'scaleY(0.85)',
    glowIntensity: 0.4,
    glowPulse: false,
  },
  steady: {
    duration: 4000,
    easing: 'ease-in-out',
    bodyTransform: 'translateY(-2px)',
    glowIntensity: 0.5,
    glowPulse: true,
  },
  pleased: {
    duration: 400,
    easing: 'cubic-bezier(0.68, -0.55, 0.265, 1.55)',
    containerTransform: 'translateY(-2px) scale(1.02)',
    eyeTransform: 'scaleY(0.9)',
    glowIntensity: 0.7,
    glowPulse: true,
  },
  skeptical: {
    duration: 600,
    easing: 'ease-in-out',
    containerTransform: 'translateX(-3px) rotate(-2deg)',
    eyeTransform: 'translateY(-1px)',
    glowIntensity: 0.5,
    glowPulse: false,
  },
  mischief: {
    duration: 300,
    easing: 'ease-out',
    containerTransform: 'rotate(3deg)',
    glowIntensity: 0.6,
    glowPulse: true,
  },
  proud: {
    duration: 500,
    easing: 'ease-out',
    containerTransform: 'translateY(-3px) scale(1.01)',
    eyeTransform: 'translateY(-1px)',
    glowIntensity: 0.9,
    glowPulse: true,
  },
};

export function useEmotionAnimation(
  emotion: AvatarEmotion,
  personality: AvatarConfig['personality']
): EmotionAnimationResult {
  const [previousEmotion, setPreviousEmotion] = useState<AvatarEmotion>(emotion);
  const [isTransitioning, setIsTransitioning] = useState(false);
  
  // Track emotion changes
  useEffect(() => {
    if (emotion !== previousEmotion) {
      setIsTransitioning(true);
      const timer = setTimeout(() => {
        setPreviousEmotion(emotion);
        setIsTransitioning(false);
      }, EMOTION_CONFIG[emotion].duration);
      
      return () => clearTimeout(timer);
    }
  }, [emotion, previousEmotion]);
  
  const result = useMemo((): EmotionAnimationResult => {
    const config = EMOTION_CONFIG[emotion];
    
    // Apply personality modifiers
    const bounceMultiplier = personality.bounce || 0.3;
    const swayMultiplier = personality.sway || 0.15;
    
    // Build container style
    const containerStyle: React.CSSProperties = {
      transition: `transform ${config.duration}ms ${config.easing}`,
    };
    
    // Apply transforms based on emotion
    if (config.containerTransform) {
      // Apply personality modifiers to transforms
      let transform = config.containerTransform;
      
      // Add idle bounce for certain emotions
      if (emotion === 'steady' || emotion === 'pleased') {
        const bounceAmount = -2 * bounceMultiplier;
        transform += ` translateY(${bounceAmount}px)`;
      }
      
      // Add idle sway for certain emotions
      if (emotion === 'exploratory' || emotion === 'mischief') {
        const swayAmount = 2 * swayMultiplier;
        transform += ` rotate(${swayAmount}deg)`;
      }
      
      containerStyle.transform = transform;
    }
    
    return {
      containerStyle,
      bodyTransform: config.bodyTransform || '',
      eyeTransform: config.eyeTransform || '',
      glowIntensity: config.glowIntensity,
      glowPulse: config.glowPulse && personality.breathing,
    };
  }, [emotion, personality.bounce, personality.sway, personality.breathing]);
  
  return result;
}

/**
 * Get the CSS animation class for an emotion
 */
export function getEmotionAnimationClass(emotion: AvatarEmotion): string {
  return `agent-avatar--emotion-${emotion}`;
}

/**
 * Get animation duration for an emotion
 */
export function getEmotionDuration(emotion: AvatarEmotion): number {
  return EMOTION_CONFIG[emotion].duration;
}

/**
 * Check if an emotion should loop continuously
 */
export function isContinuousEmotion(emotion: AvatarEmotion): boolean {
  return emotion === 'steady';
}
