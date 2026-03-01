/**
 * useSpeakingSignal Hook
 *
 * Derives speaking state from VoiceService playback events.
 * Per spec: "Zero re-trigger risk" - uses ID-guard pattern.
 *
 * This hook:
 * - Subscribes to VoiceService.onPlayback events (play/end/error)
 * - Only returns isSpeaking=true when audio is actually playing
 * - ActivityCenter.status === 'speaking' can gate, but playback drives truth
 */

import { useState, useEffect } from 'react';
import { voiceService } from '../../runtime/VoiceService';
import { activityCenter, type ActivityStatus } from '../../runtime/ActivityCenter';
import { useSmoothedEnergy } from './useAudioEnergy';

export interface SpeakingSignal {
  /** Whether audio is currently playing (VoiceService truth) */
  isSpeaking: boolean;
  /** Current activity status (for state mapping) */
  status: ActivityStatus;
  /** Time since speaking started (ms) */
  speakingDuration: number;
  /** Real audio energy (0-1) for animation */
  energy: number;
}

/**
 * Check if ActivityCenter is in a speaking-compatible state
 * This gates the audio subscription - we only listen when ActivityCenter allows speaking
 */
function isSpeakingCompatibleStatus(status: ActivityStatus): boolean {
  return status === 'speaking';
}

export function useSpeakingSignal(): SpeakingSignal {
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [status, setStatus] = useState<ActivityStatus>('idle');
  const [speakingStartTime, setSpeakingStartTime] = useState<number | null>(null);

  // Get real audio energy from VoiceService
  const { energy } = useSmoothedEnergy(0.3);

  // Subscribe to VoiceService playback events
  useEffect(() => {
    // Initial status check
    const currentStatus = activityCenter.getCurrentStatus();
    setStatus(currentStatus);

    // Check if we're already playing (edge case)
    if (voiceService.isCurrentlyPlaying() && isSpeakingCompatibleStatus(currentStatus)) {
      setIsSpeaking(true);
      setSpeakingStartTime(Date.now());
    }

    // Subscribe to playback events - cleanup is critical to prevent listener leaks
    const unsubscribe = voiceService.onPlayback((event) => {
      const currentStatus = activityCenter.getCurrentStatus();

      switch (event.type) {
        case 'play':
          if (isSpeakingCompatibleStatus(currentStatus)) {
            setIsSpeaking(true);
            setSpeakingStartTime(Date.now());
            setStatus(currentStatus);
          }
          break;

        case 'end':
        case 'error':
          setIsSpeaking(false);
          setSpeakingStartTime(null);
          setStatus(activityCenter.getCurrentStatus());
          break;
      }
    });

    // CLEANUP: Unsubscribe on effect cleanup (prevents listener leaks)
    return unsubscribe;
  }, []);

  // Calculate duration
  const speakingDuration = speakingStartTime
    ? Date.now() - speakingStartTime
    : 0;

  return {
    isSpeaking,
    status,
    speakingDuration,
    energy, // Real audio energy from VoiceService
  };
}

/**
 * Backward compatibility - returns just amplitude (now real energy)
 */
export function useSpeakingAmplitude(): number {
  const { energy } = useSpeakingSignal();
  return energy;
}
