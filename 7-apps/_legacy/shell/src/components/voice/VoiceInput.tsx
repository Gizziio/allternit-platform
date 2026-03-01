/**
 * VoiceInput Component - Beautiful voice recording UI
 * 
 * Provides microphone button, recording visualization, and speech-to-text integration.
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { speechToText } from '../../runtime/SpeechToText';
import { voiceService } from '../../runtime/VoiceService';
import './VoiceInput.css';

interface VoiceInputProps {
  onTranscript: (text: string) => void;
  onError?: (error: string) => void;
  language?: string;
  disabled?: boolean;
  placeholder?: string;
  autoSubmit?: boolean;
  showWaveform?: boolean;
  size?: 'small' | 'medium' | 'large';
}

type RecordingState = 'idle' | 'listening' | 'processing' | 'error';

export const VoiceInput: React.FC<VoiceInputProps> = ({
  onTranscript,
  onError,
  language = 'en-US',
  disabled = false,
  placeholder = 'Click to speak...',
  autoSubmit = true,
  showWaveform = true,
  size = 'medium',
}) => {
  const [state, setState] = useState<RecordingState>('idle');
  const [transcript, setTranscript] = useState('');
  const [interimTranscript, setInterimTranscript] = useState('');
  const [audioLevel, setAudioLevel] = useState(0);
  const [sttSupported, setSttSupported] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animationFrameRef = useRef<number | null>(null);

  // Check STT support on mount
  useEffect(() => {
    setSttSupported(speechToText.isSupported());
    
    if (speechToText.isSupported()) {
      speechToText.setLanguage(language);
    }
  }, [language]);

  // Setup speech recognition callbacks
  useEffect(() => {
    if (!speechToText.isSupported()) return;

    const unsubscribe = speechToText.on((event) => {
      switch (event.type) {
        case 'start':
          setState('listening');
          startAudioMonitoring();
          break;

        case 'result':
          if (event.result) {
            if (event.result.isFinal) {
              setTranscript(prev => prev + event.result!.transcript);
            } else {
              setInterimTranscript(event.result.transcript);
            }
          }
          break;

        case 'end':
          stopAudioMonitoring();
          if (transcript.trim()) {
            setState('processing');
            // Submit after a short delay to show processing state
            setTimeout(() => {
              onTranscript(transcript);
              setTranscript('');
              setInterimTranscript('');
              setState('idle');
            }, 500);
          } else {
            setState('idle');
          }
          break;

        case 'error':
          setState('error');
          stopAudioMonitoring();
          onError?.(event.error || 'Speech recognition error');
          setTimeout(() => setState('idle'), 2000);
          break;

        case 'no-match':
          setState('idle');
          break;
      }
    });

    return () => {
      unsubscribe();
      stopAudioMonitoring();
    };
  }, [transcript, onTranscript, onError]);

  // Start audio monitoring for waveform visualization
  const startAudioMonitoring = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        }
      });

      mediaRecorderRef.current = new MediaRecorder(stream);

      audioContextRef.current = new AudioContext();
      const source = audioContextRef.current.createMediaStreamSource(stream);
      analyserRef.current = audioContextRef.current.createAnalyser();
      analyserRef.current.fftSize = 256;
      source.connect(analyserRef.current);

      const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount);

      const updateLevel = () => {
        if (analyserRef.current) {
          analyserRef.current.getByteFrequencyData(dataArray);
          const average = dataArray.reduce((a, b) => a + b, 0) / dataArray.length;
          setAudioLevel(average / 255);
          animationFrameRef.current = requestAnimationFrame(updateLevel);
        }
      };

      updateLevel();
    } catch (err) {
      console.error('Failed to access microphone:', err);
      setState('error');
      onError?.('Microphone access denied');
    }
  };

  // Stop audio monitoring
  const stopAudioMonitoring = () => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
    if (mediaRecorderRef.current) {
      mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop());
      mediaRecorderRef.current = null;
    }
    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }
    analyserRef.current = null;
    setAudioLevel(0);
  };

  // Toggle recording
  const handleToggleRecording = useCallback(() => {
    if (state === 'listening') {
      speechToText.stop();
    } else if (state === 'idle') {
      setTranscript('');
      setInterimTranscript('');
      speechToText.start();
    }
  }, [state]);

  // Handle keyboard shortcut
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ctrl+Space or Meta+Space to toggle voice
      if (e.code === 'Space' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        if (!disabled) {
          handleToggleRecording();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [disabled, handleToggleRecording]);

  const buttonSize = size === 'small' ? 40 : size === 'large' ? 72 : 56;
  const iconSize = size === 'small' ? 18 : size === 'large' ? 32 : 24;

  return (
    <div className={`voice-input voice-input--${size}`}>
      {/* Main microphone button */}
      <button
        className={`voice-input__button voice-input__button--${state}`}
        onClick={handleToggleRecording}
        disabled={disabled || !sttSupported}
        style={{ width: buttonSize, height: buttonSize }}
        title={sttSupported ? 'Click or Ctrl+Space to speak' : 'Speech not supported'}
        type="button"
      >
        {/* Recording indicator ring */}
        {state === 'listening' && (
          <div 
            className="voice-input__pulse"
            style={{ 
              transform: `scale(${1 + audioLevel * 0.5})`,
              opacity: 0.3 + audioLevel * 0.7 
            }}
          />
        )}

        {/* Animated wave visualization */}
        {state === 'listening' && showWaveform && (
          <div className="voice-input__waveform">
            {[...Array(5)].map((_, i) => (
              <div
                key={i}
                className="voice-input__wave"
                style={{
                  animationDelay: `${i * 0.1}s`,
                  animationDuration: `${0.5 + audioLevel}s`,
                  transform: `scaleY(${0.3 + Math.sin(i * 0.8 + Date.now() / 200) * 0.7 * audioLevel})`,
                }}
              />
            ))}
          </div>
        )}

        {/* Microphone icon */}
        <svg
          className="voice-input__icon"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          style={{ width: iconSize, height: iconSize }}
        >
          {state === 'listening' ? (
            // Recording state - filled microphone
            <>
              <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
              <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
              <line x1="12" y1="19" x2="12" y2="23" />
              <line x1="8" y1="23" x2="16" y2="23" />
            </>
          ) : (
            // Idle state - outline microphone
            <>
              <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
              <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
              <line x1="12" y1="19" x2="12" y2="23" />
              <line x1="8" y1="23" x2="16" y2="23" />
            </>
          )}
        </svg>

        {/* Processing spinner */}
        {state === 'processing' && (
          <div className="voice-input__spinner" />
        )}

        {/* Error indicator */}
        {state === 'error' && (
          <svg
            className="voice-input__icon voice-input__icon--error"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <circle cx="12" cy="12" r="10" />
            <line x1="15" y1="9" x2="9" y2="15" />
            <line x1="9" y1="9" x2="15" y2="15" />
          </svg>
        )}
      </button>

      {/* Transcript display */}
      {(transcript || interimTranscript) && (
        <div className="voice-input__transcript">
          <span className="voice-input__transcript--final">{transcript}</span>
          <span className="voice-input__transcript--interim">{interimTranscript}</span>
          {state === 'listening' && (
            <span className="voice-input__cursor">|</span>
          )}
        </div>
      )}

      {/* Empty state */}
      {!transcript && !interimTranscript && state === 'idle' && (
        <div className="voice-input__placeholder">
          {placeholder}
        </div>
      )}

      {/* Unsupported warning */}
      {!sttSupported && (
        <div className="voice-input__unsupported">
          Speech recognition not supported in this browser
        </div>
      )}
    </div>
  );
};

export default VoiceInput;
