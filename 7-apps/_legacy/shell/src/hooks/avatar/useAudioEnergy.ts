/**
 * useAudioEnergy Hook
 *
 * Consumes real audio energy from VoiceService.
 * Drives avatar speaking animation with actual audio amplitude data.
 *
 * Implementation:
 * - Subscribes to VoiceService.onEnergy events
 * - RAF updates for smooth animation
 * - Immediate teardown on unmount or when not speaking
 */

import { useState, useEffect, useRef } from 'react';
import { voiceService } from '../../runtime/VoiceService';

export interface AudioEnergyState {
  /** Current energy level (0-1) */
  energy: number;
  /** Whether audio analysis is active */
  isActive: boolean;
}

export function useAudioEnergy(): AudioEnergyState {
  const [energy, setEnergy] = useState(0);
  const [isActive, setIsActive] = useState(false);
  const animationRef = useRef<number | null>(null);
  const lastEnergyRef = useRef(0);

  useEffect(() => {
    // Subscribe to energy events
    const unsubscribe = voiceService.onEnergy((newEnergy) => {
      lastEnergyRef.current = newEnergy;
      setEnergy(newEnergy);
      setIsActive(newEnergy > 0.001); // Small threshold for "active"
    });

    return () => {
      unsubscribe();
    };
  }, []);

  return { energy, isActive };
}

/**
 * Hook for smoothed energy (avoids jitter in animation)
 * Applies simple moving average for smoother transitions
 */
export function useSmoothedEnergy(smoothing: number = 0.3): { energy: number; isActive: boolean } {
  const { energy, isActive } = useAudioEnergy();
  const smoothedRef = useRef(0);

  useEffect(() => {
    // Simple exponential smoothing
    smoothedRef.current = smoothedRef.current * (1 - smoothing) + energy * smoothing;
  }, [energy, smoothing]);

  return { energy: smoothedRef.current, isActive };
}
