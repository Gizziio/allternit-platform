/**
 * useReactiveAnimation Hook
 * 
 * Manages reactive animations based on user interaction.
 * Handles hover, click, and other interaction states.
 */

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';

export interface ReactiveAnimationResult {
  containerStyle: React.CSSProperties;
  scale: number;
  brightness: number;
}

const REACTIVE_CONFIG = {
  idle: {
    scale: 1,
    brightness: 1,
    duration: 150,
  },
  hover: {
    scale: 1.05,
    brightness: 1.1,
    duration: 150,
  },
  active: {
    scale: 0.95,
    brightness: 0.95,
    duration: 100,
  },
};

export function useReactiveAnimation(
  interactionState: 'idle' | 'hover' | 'active'
): ReactiveAnimationResult {
  return useMemo((): ReactiveAnimationResult => {
    const config = REACTIVE_CONFIG[interactionState];
    
    return {
      containerStyle: {
        transform: `scale(${config.scale})`,
        filter: `brightness(${config.brightness})`,
        transition: `transform ${config.duration}ms ease-out, filter ${config.duration}ms ease-out`,
      },
      scale: config.scale,
      brightness: config.brightness,
    };
  }, [interactionState]);
}

/**
 * Hook for tracking mouse position relative to avatar
 * Useful for eye tracking effects
 */
export function useMouseTracking(
  containerRef: React.RefObject<HTMLElement>,
  enabled: boolean = true
): { x: number; y: number } | null {
  const [position, setPosition] = useState<{ x: number; y: number } | null>(null);
  
  useEffect(() => {
    if (!enabled || !containerRef.current) return;
    
    const element = containerRef.current;
    
    const handleMouseMove = (e: MouseEvent) => {
      const rect = element.getBoundingClientRect();
      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height / 2;
      
      // Calculate position relative to center (-1 to 1)
      const x = (e.clientX - centerX) / (rect.width / 2);
      const y = (e.clientY - centerY) / (rect.height / 2);
      
      // Clamp values
      setPosition({
        x: Math.max(-1, Math.min(1, x)),
        y: Math.max(-1, Math.min(1, y)),
      });
    };
    
    const handleMouseLeave = () => {
      setPosition(null);
    };
    
    element.addEventListener('mousemove', handleMouseMove);
    element.addEventListener('mouseleave', handleMouseLeave);
    
    return () => {
      element.removeEventListener('mousemove', handleMouseMove);
      element.removeEventListener('mouseleave', handleMouseLeave);
    };
  }, [containerRef, enabled]);
  
  return position;
}

/**
 * Hook for handling click interactions with debounce
 */
export function useClickAnimation(
  onClick?: () => void,
  debounceMs: number = 150
): {
  isAnimating: boolean;
  handleClick: () => void;
} {
  const [isAnimating, setIsAnimating] = useState(false);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  
  const handleClick = useCallback(() => {
    if (isAnimating) return;
    
    setIsAnimating(true);
    onClick?.();
    
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    
    timeoutRef.current = setTimeout(() => {
      setIsAnimating(false);
    }, debounceMs);
  }, [isAnimating, onClick, debounceMs]);
  
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);
  
  return { isAnimating, handleClick };
}


