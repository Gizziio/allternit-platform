/**
 * PresenceTransition Component
 *
 * Handles deterministic Orb ↔ Avatar transitions.
 * Per spec section 4.3 transition timing:
 * - Orb Fade Out: 300ms ease-out
 * - Avatar Fade In: 300ms ease-in
 * - Gap: 50ms (both hidden)
 * - Total Duration: 650ms
 *
 * This component wraps either Orb or Avatar and handles the fade
 * transition between them based on render mode and transition phase.
 */

import React, { useEffect, useState, type ReactNode } from 'react';
import type { TransitionPhase } from '../../hooks/avatar/useAvatarState';

// Transition timing constants per spec section 4.3
const FADE_DURATION_MS = 300;
const GAP_DURATION_MS = 50;

interface PresenceTransitionProps {
  /** Current render mode */
  renderMode: 'orb' | 'avatar';
  /** Current transition phase */
  transitionPhase: TransitionPhase;
  /** Orb component to render when in orb mode */
  orbElement: ReactNode;
  /** Avatar component to render when in avatar mode */
  avatarElement?: ReactNode;
  /** Position of the presence (for shared layout position) */
  position?: 'fixed' | 'absolute' | 'relative';
  /** Bottom offset for fixed positioning */
  bottomOffset?: string;
  /** Right offset for fixed positioning */
  rightOffset?: string;
}

/**
 * Manages transition timing and visibility
 */
export const PresenceTransition: React.FC<PresenceTransitionProps> = ({
  renderMode,
  transitionPhase,
  orbElement,
  avatarElement,
  position = 'fixed',
  bottomOffset = '24px',
  rightOffset = '24px',
}) => {
  const hasAvatar = avatarElement != null;
  const effectiveRenderMode = hasAvatar ? renderMode : 'orb';
  const effectiveTransitionPhase = hasAvatar ? transitionPhase : 'stable';

  // Track what we're currently showing and transition state
  const [visibleElement, setVisibleElement] = useState<'orb' | 'avatar' | null>(null);
  const [opacity, setOpacity] = useState(1);
  const [isTransitioning, setIsTransitioning] = useState(false);

  // Handle transition phase changes
  useEffect(() => {
    let animationFrameId: number;
    let startTime: number;

    const animate = (currentTime: number) => {
      if (!startTime) startTime = currentTime;
      const elapsed = currentTime - startTime;
      
      if (effectiveTransitionPhase === 'fading-out') {
        // Orb → Avatar: fade out current (orb), wait gap, fade in avatar
        const fadeProgress = Math.min(elapsed / FADE_DURATION_MS, 1);
        setOpacity(1 - fadeProgress);
        
        if (fadeProgress >= 1) {
          // Orb hidden, now in gap period
          setVisibleElement(null);
          
          if (elapsed >= FADE_DURATION_MS + GAP_DURATION_MS) {
            // Gap done, start fading in avatar
            setIsTransitioning(true);
            setVisibleElement('avatar');
            
            // Fade in avatar
            const fadeInProgress = Math.min(
              (elapsed - FADE_DURATION_MS - GAP_DURATION_MS) / FADE_DURATION_MS,
              1
            );
            setOpacity(fadeInProgress);
            
            if (fadeInProgress >= 1) {
              // Transition complete
              setIsTransitioning(false);
              setOpacity(1);
            }
          }
        }
      } else if (effectiveTransitionPhase === 'fading-in') {
        // Avatar → Orb: fade out avatar, wait gap, fade in orb
        const fadeProgress = Math.min(elapsed / FADE_DURATION_MS, 1);
        setOpacity(1 - fadeProgress);
        
        if (fadeProgress >= 1) {
          // Avatar hidden, now in gap period
          setVisibleElement(null);
          
          if (elapsed >= FADE_DURATION_MS + GAP_DURATION_MS) {
            // Gap done, start fading in orb
            setIsTransitioning(true);
            setVisibleElement('orb');
            
            // Fade in orb
            const fadeInProgress = Math.min(
              (elapsed - FADE_DURATION_MS - GAP_DURATION_MS) / FADE_DURATION_MS,
              1
            );
            setOpacity(fadeInProgress);
            
            if (fadeInProgress >= 1) {
              // Transition complete
              setIsTransitioning(false);
              setOpacity(1);
            }
          }
        }
      } else {
        // Stable state
        setOpacity(1);
        setIsTransitioning(false);
        setVisibleElement(effectiveRenderMode);
      }

      if (isTransitioning || effectiveTransitionPhase !== 'stable') {
        animationFrameId = requestAnimationFrame(animate);
      }
    };

    if (effectiveTransitionPhase !== 'stable') {
      startTime = 0;
      animationFrameId = requestAnimationFrame(animate);
    } else {
      // Immediate switch in stable state
      setVisibleElement(effectiveRenderMode);
      setOpacity(1);
      setIsTransitioning(false);
    }

    return () => {
      if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
      }
    };
  }, [effectiveTransitionPhase, effectiveRenderMode, isTransitioning]);

  // Determine which element to show
  const currentElement =
    visibleElement === 'avatar'
      ? avatarElement ?? orbElement
      : visibleElement === 'orb'
        ? orbElement
        : null;
  if (!currentElement) {
    return null;
  }

  return (
    <div
      className="gizzi-presence-transition"
      style={{
        position,
        bottom: bottomOffset,
        right: rightOffset,
        zIndex: 9998,
        opacity,
        transition: effectiveTransitionPhase === 'stable' 
          ? 'opacity 300ms ease-out' 
          : 'none',
        pointerEvents: 'auto',
      }}
    >
      <div style={{ pointerEvents: 'auto' }}>{currentElement}</div>
    </div>
  );
};

/**
 * Simplified transition wrapper for when you just need fade animation
 */
interface FadeTransitionProps {
  visible: boolean;
  children: ReactNode;
  duration?: number;
}

export const FadeTransition: React.FC<FadeTransitionProps> = ({
  visible,
  children,
  duration = 300,
}) => {
  const [opacity, setOpacity] = useState(visible ? 1 : 0);
  const [isMounted, setIsMounted] = useState(visible);

  useEffect(() => {
    if (visible) {
      setIsMounted(true);
      // Small delay to ensure DOM is ready for transition
      requestAnimationFrame(() => {
        setOpacity(1);
      });
    } else {
      setOpacity(0);
      // Unmount after transition completes
      const timer = setTimeout(() => {
        setIsMounted(false);
      }, duration);
      return () => clearTimeout(timer);
    }
  }, [visible, duration]);

  if (!isMounted) {
    return null;
  }

  return (
    <div
      style={{
        opacity,
        transition: `opacity ${duration}ms ease-out`,
      }}
    >
      {children}
    </div>
  );
};

export default PresenceTransition;
