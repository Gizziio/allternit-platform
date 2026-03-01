/**
 * useAvatarState Hook
 *
 * Maps ActivityCenter status to avatar render state.
 * Pure consumer - no side effects, no state mutations.
 *
 * Adaptive polling strategy:
 * - enableAvatarPresence=false: zero polling (feature disabled)
 * - idle + avatar enabled: 500ms (low frequency, state rarely changes)
 * - active states: 100ms (need responsiveness)
 */

import { useState, useEffect, useRef } from 'react';
import { activityCenter, type ActivityStatus } from '../../runtime/ActivityCenter';
import { isFeatureEnabled } from '../../config/featureFlags';

/**
 * Avatar render mode based on ActivityCenter state
 * - 'orb': Show VoiceOrb (default, idle states)
 * - 'avatar': Show avatar placeholder (active states)
 */
export type AvatarRenderMode = 'orb' | 'avatar';

/**
 * Transition phase for smooth Orb ↔ Avatar switching
 */
export type TransitionPhase = 'stable' | 'fading-in' | 'fading-out';

export interface AvatarState {
  /** Current ActivityCenter status */
  status: ActivityStatus;
  /** Whether avatar should be shown vs orb */
  renderMode: AvatarRenderMode;
  /** Current transition phase */
  transitionPhase: TransitionPhase;
  /** Whether avatar feature is enabled */
  isEnabled: boolean;
}

// Polling intervals (ms) - per spec: adaptive based on ActivityCenter status
const POLLING_IDLE = 500;
const POLLING_ACTIVE = 100;

/**
 * Activity statuses that trigger avatar display
 * Per spec: show avatar in these states, return to orb on idle/done
 */
const AVATAR_ACTIVE_STATES: Set<ActivityStatus> = new Set([
  'connecting',
  'reconnecting',
  'thinking',
  'streaming',
  'speaking',
  'error',
]);

/**
 * Activity statuses where orb is shown (avatar hidden)
 */
const ORB_STATES: Set<ActivityStatus> = new Set([
  'idle',
  'done',
]);

export function useAvatarState(): AvatarState {
  const [status, setStatus] = useState<ActivityStatus>('idle');
  const [renderMode, setRenderMode] = useState<AvatarRenderMode>('orb');
  const [transitionPhase, setTransitionPhase] = useState<TransitionPhase>('stable');
  const [isEnabled, setIsEnabled] = useState(false);

  // Refs for tracking state without re-renders
  const prevStatusRef = useRef<ActivityStatus>('idle');
  const prevRenderModeRef = useRef<AvatarRenderMode>('orb');
  const enabledRef = useRef(false);
  const timerRef = useRef<number | null>(null);

  // Check feature flag on mount
  useEffect(() => {
    const checkEnabled = () => {
      const enabled = isFeatureEnabled('enableAvatarPresence');
      setIsEnabled(enabled);
      enabledRef.current = enabled;
    };

    checkEnabled();

    // Listen for runtime flag changes via localStorage event
    const handleFlagsChange = () => checkEnabled();
    window.addEventListener('featureFlagsChanged', handleFlagsChange);

    return () => window.removeEventListener('featureFlagsChanged', handleFlagsChange);
  }, []);

  // Adaptive polling: recursive timeout that adapts mid-flight
  useEffect(() => {
    // No polling when disabled - early return
    if (!enabledRef.current) {
      setRenderMode('orb');
      setTransitionPhase('stable');
      return;
    }

    // Recursive timeout pattern: adapts rate each tick
    const tick = () => {
      const currentStatus = activityCenter.getCurrentStatus();
      setStatus(currentStatus);

      const shouldShowAvatar = AVATAR_ACTIVE_STATES.has(currentStatus);
      const shouldShowOrb = ORB_STATES.has(currentStatus);
      const newRenderMode = shouldShowAvatar || !shouldShowOrb ? 'avatar' : 'orb';

      // Transition handling
      if (newRenderMode !== prevRenderModeRef.current) {
        if (newRenderMode === 'avatar') {
          setTransitionPhase('fading-in');
        } else {
          setTransitionPhase('fading-out');
        }
        prevRenderModeRef.current = newRenderMode;
      }

      if (transitionPhase !== 'stable') {
        if ((newRenderMode === 'avatar' && transitionPhase === 'fading-in') ||
            (newRenderMode === 'orb' && transitionPhase === 'fading-out')) {
          setTransitionPhase('stable');
        }
      }

      prevStatusRef.current = currentStatus;
      setRenderMode(newRenderMode);

      // Adaptive: rate determined fresh each tick based on current status
      const isActive = AVATAR_ACTIVE_STATES.has(currentStatus);
      const nextDelay = isActive ? POLLING_ACTIVE : POLLING_IDLE;

      // Schedule next tick with adaptive delay
      timerRef.current = window.setTimeout(tick, nextDelay);
    };

    // Start the adaptive polling loop
    timerRef.current = window.setTimeout(tick, POLLING_IDLE);

    // Cleanup: clear timer on effect cleanup or when disabled
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [isEnabled, transitionPhase]);

  return {
    status,
    renderMode,
    transitionPhase,
    isEnabled,
  };
}

/**
 * Hook to get just the current status (lighter weight)
 * Uses adaptive polling same as useAvatarState
 */
export function useActivityStatus(): ActivityStatus {
  const [status, setStatus] = useState<ActivityStatus>('idle');
  const isEnabledRef = useRef(false);

  useEffect(() => {
    isEnabledRef.current = isFeatureEnabled('enableAvatarPresence');
    if (!isEnabledRef.current) return;

    const interval = setInterval(() => {
      setStatus(activityCenter.getCurrentStatus());
    }, POLLING_IDLE);

    return () => clearInterval(interval);
  }, []);

  return status;
}

/**
 * Hook to check if we're in an active avatar state
 * Uses adaptive polling same as useAvatarState
 */
export function useIsAvatarActive(): boolean {
  const [isActive, setIsActive] = useState(false);
  const isEnabledRef = useRef(false);

  useEffect(() => {
    isEnabledRef.current = isFeatureEnabled('enableAvatarPresence');
    if (!isEnabledRef.current) {
      setIsActive(false);
      return;
    }

    const interval = setInterval(() => {
      const status = activityCenter.getCurrentStatus();
      setIsActive(AVATAR_ACTIVE_STATES.has(status));
    }, POLLING_IDLE);

    return () => clearInterval(interval);
  }, []);

  return isActive;
}
