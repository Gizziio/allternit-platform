/**
 * useAvatarAnimation Hook
 * 
 * Manages base avatar animations including idle states,
 * breathing effects, and personality-driven movements.
 */

import { useMemo, useEffect, useRef, useState } from 'react';
import type { AvatarConfig } from '../../../lib/agents/character.types';

export interface AvatarAnimationResult {
  svgStyle: React.CSSProperties;
  bodyStyle: React.CSSProperties;
  isAnimating: boolean;
}

interface AnimationPhase {
  offset: number;
  transform: string;
  easing: string;
}

/**
 * Generate idle animation keyframes based on personality
 */
function generateIdleKeyframes(personality: AvatarConfig['personality']): AnimationPhase[] {
  const { bounce, sway } = personality;
  
  // Base transforms
  const bounceAmount = -3 * bounce; // Max -3px bounce
  const swayAmount = 2 * sway; // Max 2deg sway
  
  return [
    { offset: 0, transform: 'translateY(0) rotate(0deg)', easing: 'ease-in-out' },
    { offset: 0.25, transform: `translateY(${bounceAmount * 0.5}px) rotate(${-swayAmount}deg)`, easing: 'ease-in-out' },
    { offset: 0.5, transform: `translateY(${bounceAmount}px) rotate(0deg)`, easing: 'ease-in-out' },
    { offset: 0.75, transform: `translateY(${bounceAmount * 0.5}px) rotate(${swayAmount}deg)`, easing: 'ease-in-out' },
    { offset: 1, transform: 'translateY(0) rotate(0deg)', easing: 'ease-in-out' },
  ];
}

/**
 * Get animation duration based on personality
 */
function getAnimationDuration(personality: AvatarConfig['personality']): number {
  // More bounce = faster animation
  const baseDuration = 4000;
  const speedFactor = 1 - (personality.bounce * 0.3);
  return baseDuration * speedFactor;
}

export function useAvatarAnimation(
  config: AvatarConfig,
  isAnimating: boolean
): AvatarAnimationResult {
  const animationRef = useRef<Animation | null>(null);
  const [animationState, setAnimationState] = useState<'idle' | 'playing'>('idle');
  
  // Generate unique animation name based on config
  const animationName = useMemo(() => {
    const hash = `${config.baseShape}-${config.personality.bounce}-${config.personality.sway}`;
    return `avatar-idle-${hash.replace(/[^a-zA-Z0-9]/g, '-')}`;
  }, [config.baseShape, config.personality.bounce, config.personality.sway]);
  
  // Create and manage CSS animation
  useEffect(() => {
    if (!isAnimating) {
      animationRef.current?.cancel();
      setAnimationState('idle');
      return;
    }
    
    // Create keyframes
    const keyframes = generateIdleKeyframes(config.personality);
    const duration = getAnimationDuration(config.personality);
    
    // Check if animation already exists
    const existingStyle = document.getElementById(`style-${animationName}`);
    if (!existingStyle) {
      const style = document.createElement('style');
      style.id = `style-${animationName}`;
      
      const keyframeCSS = keyframes.map(k => 
        `${k.offset * 100}% { transform: ${k.transform}; animation-timing-function: ${k.easing}; }`
      ).join('\n');
      
      style.textContent = `
        @keyframes ${animationName} {
          ${keyframeCSS}
        }
      `;
      
      document.head.appendChild(style);
    }
    
    setAnimationState('playing');
    
    return () => {
      animationRef.current?.cancel();
    };
  }, [isAnimating, animationName, config.personality]);
  
  const svgStyle = useMemo((): React.CSSProperties => {
    if (!isAnimating) {
      return {};
    }
    
    return {
      animation: `${animationName} ${getAnimationDuration(config.personality)}ms ease-in-out infinite`,
      transformOrigin: 'center',
    };
  }, [isAnimating, animationName, config.personality]);
  
  const bodyStyle = useMemo((): React.CSSProperties => {
    if (!isAnimating || !config.personality.breathing) {
      return {};
    }
    
    return {
      animation: `body-breathe 4s ease-in-out infinite`,
      transformOrigin: 'center',
    };
  }, [isAnimating, config.personality.breathing]);
  
  return {
    svgStyle,
    bodyStyle,
    isAnimating: animationState === 'playing',
  };
}

/**
 * Hook for locomotion animations (entry/exit)
 */
export function useLocomotionAnimation(
  type: 'walk-in' | 'walk-out' | 'crawl' | 'pop-in' | 'fade-in',
  direction: 'left' | 'right' = 'left',
  onComplete?: () => void
): {
  style: React.CSSProperties;
  isAnimating: boolean;
} {
  const [isAnimating, setIsAnimating] = useState(true);
  
  const config = useMemo(() => {
    const configs = {
      'walk-in': {
        duration: 600,
        keyframes: [
          { transform: `translateX(${direction === 'left' ? '-100%' : '100%'})`, opacity: 0 },
          { transform: 'translateX(0)', opacity: 1 },
        ],
      },
      'walk-out': {
        duration: 500,
        keyframes: [
          { transform: 'translateX(0)', opacity: 1 },
          { transform: `translateX(${direction === 'left' ? '-100%' : '100%'})`, opacity: 0 },
        ],
      },
      'crawl': {
        duration: 800,
        keyframes: [
          { transform: 'translateY(20px) scaleY(0.8)', opacity: 0 },
          { transform: 'translateY(0) scaleY(1)', opacity: 1 },
        ],
      },
      'pop-in': {
        duration: 400,
        keyframes: [
          { transform: 'scale(0)', opacity: 0 },
          { transform: 'scale(1.1)', opacity: 1, offset: 0.7 },
          { transform: 'scale(1)', opacity: 1 },
        ],
      },
      'fade-in': {
        duration: 500,
        keyframes: [
          { opacity: 0, transform: 'scale(0.95)' },
          { opacity: 1, transform: 'scale(1)' },
        ],
      },
    };
    return configs[type];
  }, [type, direction]);
  
  useEffect(() => {
    const timer = setTimeout(() => {
      setIsAnimating(false);
      onComplete?.();
    }, config.duration);
    
    return () => clearTimeout(timer);
  }, [config.duration, onComplete]);
  
  const style: React.CSSProperties = {
    animation: `locomotion-${type} ${config.duration}ms ease-out forwards`,
  };
  
  return { style, isAnimating };
}

/**
 * Hook for blinking animation
 */
export function useBlinkAnimation(
  blinkRate: AvatarConfig['eyes']['blinkRate'],
  isAnimating: boolean
): {
  shouldBlink: boolean;
  blinkDuration: number;
} {
  const [isBlinking, setIsBlinking] = useState(false);
  
  const intervalMs = useMemo(() => {
    switch (blinkRate) {
      case 'slow': return 6000;
      case 'fast': return 2000;
      case 'normal': return 4000;
      case 'never': return Infinity;
      default: return 4000;
    }
  }, [blinkRate]);
  
  useEffect(() => {
    if (!isAnimating || blinkRate === 'never') {
      return;
    }
    
    const interval = setInterval(() => {
      setIsBlinking(true);
      setTimeout(() => setIsBlinking(false), 150);
    }, intervalMs);
    
    return () => clearInterval(interval);
  }, [isAnimating, blinkRate, intervalMs]);
  
  return {
    shouldBlink: isBlinking,
    blinkDuration: 150,
  };
}

/**
 * Hook for tracking animation frame
 * Useful for smooth animations
 */
export function useAnimationFrame(
  callback: (deltaTime: number) => void,
  isRunning: boolean
): void {
  const requestRef = useRef<number>();
  const previousTimeRef = useRef<number>();
  
  useEffect(() => {
    if (!isRunning) {
      if (requestRef.current) {
        cancelAnimationFrame(requestRef.current);
      }
      return;
    }
    
    const animate = (time: number) => {
      if (previousTimeRef.current !== undefined) {
        const deltaTime = time - previousTimeRef.current;
        callback(deltaTime);
      }
      previousTimeRef.current = time;
      requestRef.current = requestAnimationFrame(animate);
    };
    
    requestRef.current = requestAnimationFrame(animate);
    
    return () => {
      if (requestRef.current) {
        cancelAnimationFrame(requestRef.current);
      }
    };
  }, [isRunning, callback]);
}
