import * as React from 'react';
import { useEffect, useRef, useState, useCallback } from 'react';
import { voiceService } from '../runtime/VoiceService';
import { speechToText } from '../runtime/SpeechToText';
import './VoiceOrb.css';

interface VoiceOrbProps {
  isListening: boolean;
  onToggleListening: () => void;
  transcript?: string;
  onTranscript?: (text: string) => void;
  onSpeak?: (text: string) => void;
  voice?: string;
  size?: number;
  simple?: boolean;
}

export const VoiceOrb: React.FC<VoiceOrbProps> = ({
  isListening,
  onToggleListening,
  transcript,
  onTranscript,
  onSpeak,
  voice,
  size = 200,
  simple = false,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number>(0);
  const [audioLevel, setAudioLevel] = useState(0);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [transcriptValue, setTranscriptValue] = useState('');
  const [interimTranscript, setInterimTranscript] = useState('');
  const [inputValue, setInputValue] = useState('');
  const unsubscribeEnergyRef = useRef<(() => void) | null>(null);
  const unsubscribePlaybackRef = useRef<(() => void) | null>(null);

  // Subscribe to voice service for energy (waveform animation)
  useEffect(() => {
    unsubscribeEnergyRef.current = voiceService.onEnergy((energy) => {
      setAudioLevel(energy);
    });

    unsubscribePlaybackRef.current = voiceService.onPlayback((event) => {
      if (event.type === 'play') {
        setIsSpeaking(true);
      } else if (event.type === 'end' || event.type === 'error') {
        setIsSpeaking(false);
        setAudioLevel(0);
      }
    });

    return () => {
      unsubscribeEnergyRef.current?.();
      unsubscribePlaybackRef.current?.();
    };
  }, []);

  // Subscribe to speech recognition events
  useEffect(() => {
    if (!speechToText.isSupported()) {
      console.warn('Speech recognition not supported');
      return;
    }

    const unsubscribe = speechToText.on((event) => {
      switch (event.type) {
        case 'start':
          onToggleListening();
          break;

        case 'result':
          if (event.result) {
            if (event.result.isFinal) {
              setTranscriptValue(prev => prev + event.result!.transcript);
            } else {
              setInterimTranscript(event.result.transcript);
            }
            // Call onTranscript callback with full transcript
            if (onTranscript) {
              const full = (transcriptValue + ' ' + event.result.transcript).trim();
              if (full) onTranscript(full);
            }
          }
          break;

        case 'end':
          // Only stop listening if we have final transcript
          if (transcriptValue.trim() || interimTranscript.trim()) {
            onToggleListening();
          }
          setInterimTranscript('');
          break;

        case 'error':
          console.error('Speech recognition error:', event.error);
          if (event.error !== 'no-speech') {
            onToggleListening();
          }
          break;
      }
    });

    return unsubscribe;
  }, [onToggleListening, onTranscript, transcriptValue, interimTranscript]);

  // Toggle listening
  useEffect(() => {
    if (isListening) {
      setTranscriptValue('');
      setInterimTranscript('');
      speechToText.start();
    } else {
      speechToText.stop();
      setInterimTranscript('');
    }
  }, [isListening]);

  // Organic blob animation
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    canvas.width = size * dpr;
    canvas.height = size * dpr;
    canvas.style.width = `${size}px`;
    canvas.style.height = `${size}px`;
    ctx.scale(dpr, dpr);

    let time = 0;
    const centerX = size / 2;
    const centerY = size / 2;

    const drawOrb = () => {
      ctx.clearRect(0, 0, size, size);

      // Background glow
      const glowGradient = ctx.createRadialGradient(
        centerX, centerY, 0,
        centerX, centerY, size / 2
      );

      if (isListening) {
        glowGradient.addColorStop(0, 'rgba(52, 211, 153, 0.4)');
        glowGradient.addColorStop(0.5, 'rgba(96, 165, 250, 0.2)');
        glowGradient.addColorStop(1, 'rgba(167, 139, 250, 0)');
      } else if (isSpeaking) {
        glowGradient.addColorStop(0, 'rgba(244, 114, 182, 0.4)');
        glowGradient.addColorStop(0.5, 'rgba(167, 139, 250, 0.2)');
        glowGradient.addColorStop(1, 'rgba(96, 165, 250, 0)');
      } else {
        glowGradient.addColorStop(0, 'rgba(167, 139, 250, 0.3)');
        glowGradient.addColorStop(0.5, 'rgba(96, 165, 250, 0.15)');
        glowGradient.addColorStop(1, 'rgba(244, 114, 182, 0)');
      }

      ctx.fillStyle = glowGradient;
      ctx.fillRect(0, 0, size, size);

      // Draw organic blob
      const baseRadius = size / 4;
      const pulseAmount = isListening || isSpeaking 
        ? (size / 13) + audioLevel * (size / 10) 
        : (size / 40);
      const points = 64;
      const noiseScale = isListening || isSpeaking ? 0.8 : 0.3;

      ctx.beginPath();

      for (let i = 0; i <= points; i++) {
        const angle = (i / points) * Math.PI * 2;
        const noise1 = Math.sin(angle * 3 + time * 2) * noiseScale;
        const noise2 = Math.sin(angle * 5 - time * 1.5) * noiseScale * 0.5;
        const noise3 = Math.cos(angle * 7 + time * 3) * noiseScale * 0.3;
        const pulse = Math.sin(time * 3) * (pulseAmount / baseRadius);
        const radius = baseRadius * (1 + noise1 + noise2 + noise3 + pulse);
        const x = centerX + Math.cos(angle) * radius;
        const y = centerY + Math.sin(angle) * radius;
        if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }

      ctx.closePath();

      // Create gradient fill
      const orbGradient = ctx.createRadialGradient(
        centerX - (size / 10), centerY - (size / 10), 0,
        centerX, centerY, baseRadius + pulseAmount
      );

      if (isListening) {
        orbGradient.addColorStop(0, '#34d399');
        orbGradient.addColorStop(0.3, '#60a5fa');
        orbGradient.addColorStop(0.6, '#a78bfa');
        orbGradient.addColorStop(1, '#f472b6');
      } else if (isSpeaking) {
        orbGradient.addColorStop(0, '#f472b6');
        orbGradient.addColorStop(0.3, '#a78bfa');
        orbGradient.addColorStop(0.6, '#60a5fa');
        orbGradient.addColorStop(1, '#34d399');
      } else {
        orbGradient.addColorStop(0, '#60a5fa');
        orbGradient.addColorStop(0.4, '#a78bfa');
        orbGradient.addColorStop(1, '#f472b6');
      }

      ctx.fillStyle = orbGradient;
      ctx.fill();

      // Inner glow
      const innerGlow = ctx.createRadialGradient(
        centerX - (size / 13), centerY - (size / 13), 0,
        centerX, centerY, baseRadius
      );
      innerGlow.addColorStop(0, 'rgba(255, 255, 255, 0.4)');
      innerGlow.addColorStop(0.5, 'rgba(255, 255, 255, 0.1)');
      innerGlow.addColorStop(1, 'rgba(255, 255, 255, 0)');
      ctx.fillStyle = innerGlow;
      ctx.fill();

      // Outer rings
      if ((isListening || isSpeaking) && size > 64) {
        const ringColor = isListening ? 'rgba(52, 211, 153' : 'rgba(244, 114, 182';
        const ringRadius = baseRadius + pulseAmount + (size / 20) + Math.sin(time * 4) * (size / 40);
        ctx.beginPath();
        ctx.arc(centerX, centerY, ringRadius, 0, Math.PI * 2);
        ctx.strokeStyle = `${ringColor}, ${0.3 + Math.sin(time * 2) * 0.2})`;
        ctx.lineWidth = 2;
        ctx.stroke();
      }

      time += 0.02;
      animationRef.current = requestAnimationFrame(drawOrb);
    };

    drawOrb();

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [isListening, isSpeaking, audioLevel, size]);

  // Speak function using voiceService
  const speak = useCallback(async (text: string, voiceOverride?: string | { voice?: string; audioUrl?: string }) => {
    try {
      if (voiceOverride && typeof voiceOverride === 'object' && voiceOverride.audioUrl) {
        await voiceService.playAudio(voiceOverride.audioUrl);
      } else {
        const voiceId = typeof voiceOverride === 'string'
          ? voiceOverride
          : (voiceOverride?.voice || voice || 'default');
        await voiceService.speak(text, { voice: voiceId, autoPlay: true });
      }
    } catch (err) {
      console.error('TTS failed:', err);
    }
  }, [voice]);

  // Expose speak function globally for other components
  useEffect(() => {
    if (onSpeak) {
      (window as any).__voiceOrbSpeak = (text: string, voiceOverride?: string) => speak(text, voiceOverride);
    }
    return () => { delete (window as any).__voiceOrbSpeak; };
  }, [speak, onSpeak]);

  const handleInputSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const text = isListening ? (transcriptValue || transcript || '') : inputValue;
    if (text.trim() && onTranscript) {
      onTranscript(text.trim());
      if (!isListening) {
        setInputValue('');
      } else {
        setTranscriptValue('');
      }
    }
  };

  if (simple) {
    return (
      <div className="voice-orb-wrapper simple" style={{ width: size, height: size }}>
        <button
          className={`voice-orb-button ${isListening ? 'listening' : ''} ${isSpeaking ? 'speaking' : ''}`}
          onClick={onToggleListening}
          type="button"
          style={{ width: size, height: size, padding: 0, background: 'none', border: 'none', cursor: 'pointer' }}
        >
          <canvas ref={canvasRef} className="voice-orb-canvas" />
        </button>
      </div>
    );
  }

  const displayTranscript = isListening 
    ? (transcriptValue || transcript || interimTranscript || '')
    : inputValue;

  return (
    <div className="voice-orb-wrapper">
      <div className="voice-orb-container">
        <button
          className={`voice-orb-button ${isListening ? 'listening' : ''} ${isSpeaking ? 'speaking' : ''}`}
          onClick={onToggleListening}
          type="button"
          title={isListening ? 'Stop listening' : 'Click orb to speak'}
        >
          <canvas ref={canvasRef} className="voice-orb-canvas" />
        </button>
        <div className="voice-orb-status">
          {isListening ? (
            <span className="status-listening">
              <span className="status-dot"></span>
              {interimTranscript ? interimTranscript : 'Listening...'}
            </span>
          ) : isSpeaking ? (
            <span className="status-speaking">
              <span className="status-dot speaking"></span>
              Speaking...
            </span>
          ) : (
            <span className="status-idle">Click orb to speak</span>
          )}
        </div>
      </div>
      <div className="voice-input-area">
        {isListening && (transcriptValue || interimTranscript) && (
          <div className="voice-transcript">
            <p>{transcriptValue || interimTranscript}</p>
          </div>
        )}
        <form className="voice-chat-input" onSubmit={handleInputSubmit}>
          <input
            type="text"
            className="chat-input-field"
            placeholder={isListening ? 'Listening...' : 'Type a message or click orb to speak...'}
            value={displayTranscript}
            onChange={(e) => !isListening && setInputValue(e.target.value)}
            disabled={isListening}
          />
          <button 
            type="submit" 
            className="chat-submit-btn" 
            disabled={isListening || (!inputValue.trim() && !isListening)}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z" />
            </svg>
          </button>
        </form>
      </div>
    </div>
  );
};

export default VoiceOrb;
