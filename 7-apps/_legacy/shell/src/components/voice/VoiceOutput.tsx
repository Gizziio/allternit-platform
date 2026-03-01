/**
 * VoiceOutput Component - TTS playback visualization
 * 
 * Shows speaking animation while AI response is being spoken.
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { voiceService } from '../../runtime/VoiceService';
import './VoiceOutput.css';

interface VoiceOutputProps {
  isSpeaking?: boolean;
  showControls?: boolean;
  size?: 'small' | 'medium' | 'large';
  visualizerType?: 'waveform' | 'bars' | 'circular';
}

type SpeakingState = 'idle' | 'speaking' | 'paused';

export const VoiceOutput: React.FC<VoiceOutputProps> = ({
  isSpeaking: externalSpeaking,
  showControls = true,
  size = 'medium',
  visualizerType = 'waveform',
}) => {
  const [state, setState] = useState<SpeakingState>('idle');
  const [energy, setEnergy] = useState(0);
  const animationRef = useRef<number | null>(null);
  const unsubscribeRef = useRef<(() => void) | null>(null);

  // Subscribe to voice service events
  useEffect(() => {
    unsubscribeRef.current = voiceService.onEnergy((newEnergy) => {
      setEnergy(newEnergy);
    });

    return () => {
      unsubscribeRef.current?.();
    };
  }, []);

  // Track speaking state
  useEffect(() => {
    if (externalSpeaking !== undefined) {
      setState(externalSpeaking ? 'speaking' : 'idle');
    }
  }, [externalSpeaking]);

  // Start animation loop when speaking
  useEffect(() => {
    if (state === 'speaking') {
      const animate = () => {
        // Energy is updated via voiceService callback
        animationRef.current = requestAnimationFrame(animate);
      };
      animationRef.current = requestAnimationFrame(animate);
    }

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [state]);

  const handleStop = useCallback(() => {
    voiceService.stopAudio();
    setState('idle');
  }, []);

  const iconSize = size === 'small' ? 16 : size === 'large' ? 32 : 24;

  return (
    <div className={`voice-output voice-output--${state} voice-output--${size}`}>
      {/* Visualizer */}
      <div className={`voice-output__visualizer voice-output__visualizer--${visualizerType}`}>
        {visualizerType === 'waveform' && (
          <div className="voice-output__waveform">
            {[...Array(20)].map((_, i) => (
              <div
                key={i}
                className="voice-output__bar"
                style={{
                  animationDelay: `${i * 0.05}s`,
                  transform: `scaleY(${0.2 + energy * Math.sin(i * 0.3 + Date.now() / 100) * 0.8})`,
                }}
              />
            ))}
          </div>
        )}

        {visualizerType === 'bars' && (
          <div className="voice-output__bars">
            {[...Array(8)].map((_, i) => (
              <div
                key={i}
                className="voice-output__bar voice-output__bar--rect"
                style={{
                  animationDelay: `${i * 0.08}s`,
                  height: `${20 + energy * 60 + Math.sin(i * 0.5 + Date.now() / 80) * 20}%`,
                }}
              />
            ))}
          </div>
        )}

        {visualizerType === 'circular' && (
          <div className="voice-output__circular">
            {[...Array(12)].map((_, i) => (
              <div
                key={i}
                className="voice-output__orb"
                style={{
                  animationDelay: `${i * 0.1}s`,
                  transform: `rotate(${i * 30}deg) translateY(${8 + energy * 12}px)`,
                  opacity: 0.4 + energy * 0.6,
                }}
              />
            ))}
          </div>
        )}
      </div>

      {/* Status text */}
      {state === 'speaking' && (
        <div className="voice-output__status">
          <span className="voice-output__status--text">Speaking...</span>
          <span className="voice-output__status--dot">●</span>
        </div>
      )}

      {/* Controls */}
      {showControls && state === 'speaking' && (
        <div className="voice-output__controls">
          <button
            className="voice-output__stop"
            onClick={handleStop}
            title="Stop speaking"
            type="button"
          >
            <svg
              viewBox="0 0 24 24"
              fill="currentColor"
              style={{ width: iconSize, height: iconSize }}
            >
              <rect x="6" y="6" width="12" height="12" rx="2" />
            </svg>
          </button>
        </div>
      )}
    </div>
  );
};

// Convenience component that subscribes to voice service automatically
export const SpeakingIndicator: React.FC<{ size?: 'small' | 'medium' | 'large' }> = ({
  size = 'medium',
}) => {
  const [isSpeaking, setIsSpeaking] = useState(false);

  useEffect(() => {
    const unsubscribe = voiceService.onPlayback((event) => {
      if (event.type === 'play') {
        setIsSpeaking(true);
      } else if (event.type === 'end' || event.type === 'error') {
        setIsSpeaking(false);
      }
    });

    return unsubscribe;
  }, []);

  return <VoiceOutput isSpeaking={isSpeaking} size={size} showControls={true} />;
};

export default VoiceOutput;
