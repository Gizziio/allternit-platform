import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useBrain, type BrainEvent } from '../../runtime/BrainContext';
import { useBrainEventCursor } from '../../hooks/brain/useBrainEventCursor';

// UX State Types
export type UXState = 
  | { type: 'idle'; animated?: boolean }
  | { type: 'thinking'; message?: string }
  | { type: 'searching'; query: string; progress?: number }
  | { type: 'tool_use'; tool_name: string; status: 'pending' | 'running' | 'completed' }
  | { type: 'generating'; progress: number; speed?: 'slow' | 'normal' | 'fast' }
  | { type: 'writing'; text_length: number }
  | { type: 'reasoning'; step: number; total_steps: number; description: string }
  | { type: 'error'; message: string; retryable: boolean };

interface BrainUXProps {
  sessionId: string;
  onUXStateChange?: (state: UXState) => void;
  showAnimations?: boolean;
  enableSound?: boolean;
}

// Animation configurations
const ANIMATION_DURATIONS = {
  fadeIn: 150,
  fadeOut: 200,
  pulse: 800,
  spin: 1000,
  shimmer: 2000,
  ripple: 600,
} as const;

// Sound effects (optional Web Audio API)
class SoundManager {
  private audioContext: AudioContext | null = null;
  private enabled: boolean = false;

  enable() {
    this.enabled = true;
    if (!this.audioContext) {
      this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
  }

  disable() {
    this.enabled = false;
  }

  playTone(frequency: number, duration: number, type: OscillatorType = 'sine') {
    if (!this.enabled || !this.audioContext) return;
    
    const oscillator = this.audioContext.createOscillator();
    const gainNode = this.audioContext.createGain();
    
    oscillator.connect(gainNode);
    gainNode.connect(this.audioContext.destination);
    
    oscillator.frequency.value = frequency;
    oscillator.type = type;
    
    gainNode.gain.setValueAtTime(0.1, this.audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + duration);
    
    oscillator.start();
    oscillator.stop(this.audioContext.currentTime + duration);
  }

  playBlip() {
    this.playTone(800, 0.1);
  }

  playThinking() {
    this.playTone(400, 0.15);
    setTimeout(() => this.playTone(500, 0.15), 150);
    setTimeout(() => this.playTone(600, 0.15), 300);
  }

  playGenerate() {
    this.playTone(300, 0.05);
  }

  playComplete() {
    this.playTone(600, 0.1);
    setTimeout(() => this.playTone(800, 0.15), 100);
  }

  playError() {
    this.playTone(200, 0.3, 'sawtooth');
  }
}

const soundManager = new SoundManager();

// Context for UX state
const UXStateContext = React.createContext<{
  uxState: UXState;
  setUXState: (state: UXState) => void;
  isAnimating: boolean;
} | null>(null);

export const useUXState = () => {
  const context = React.useContext(UXStateContext);
  if (!context) {
    throw new Error('useUXState must be used within BrainUXProvider');
  }
  return context;
};

// BrainUX Provider
export const BrainUXProvider: React.FC<{ children: React.ReactNode; enableSound?: boolean }> = ({
  children,
  enableSound = false,
}) => {
  const [uxState, setUXStateRaw] = useState<UXState>({ type: 'idle' });
  const [isAnimating, setIsAnimating] = useState(false);

  useEffect(() => {
    if (enableSound) {
      soundManager.enable();
    } else {
      soundManager.disable();
    }
  }, [enableSound]);

  const setUXState = useCallback((state: UXState) => {
    setIsAnimating(true);
    setUXStateRaw(state);
    setTimeout(() => setIsAnimating(false), ANIMATION_DURATIONS.fadeIn);
  }, []);

  return (
    <UXStateContext.Provider value={{ uxState, setUXState, isAnimating }}>
      {children}
    </UXStateContext.Provider>
  );
};

// Thinking Animation Component
const ThinkingAnimation: React.FC<{ message?: string }> = ({ message }) => {
  const [dotIndex, setDotIndex] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setDotIndex((prev) => (prev + 1) % 4);
    }, 400);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="brainux-thinking">
      <div className="brainux-thinking-orb">
        <div className="brainux-orb-core" />
        <div className="brainux-orb-ring brainux-ring-1" />
        <div className="brainux-orb-ring brainux-ring-2" />
        <div className="brainux-orb-ring brainux-ring-3" />
      </div>
      {message && <span className="brainux-thinking-message">{message}</span>}
      <div className="brainux-thinking-dots">
        {[0, 1, 2, 3].map((i) => (
          <span
            key={i}
            className={`brainux-dot ${i <= dotIndex ? 'brainux-dot-active' : ''}`}
          />
        ))}
      </div>
    </div>
  );
};

// Web Search Animation Component
const SearchingAnimation: React.FC<{ query: string; progress?: number }> = ({ query, progress }) => {
  const [scanLine, setScanLine] = useState(0);

  useEffect(() => {
    const animate = () => {
      setScanLine((prev) => (prev + 1) % 100);
      requestAnimationFrame(animate);
    };
    const rafId = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(rafId);
  }, []);

  return (
    <div className="brainux-searching">
      <div className="brainux-search-icon">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="11" cy="11" r="8" />
          <path d="M21 21l-4.35-4.35" />
        </svg>
      </div>
      <div className="brainux-search-query">"{query}"</div>
      <div className="brainux-search-scanner">
        <div 
          className="brainux-scan-line" 
          style={{ top: `${scanLine}%` }}
        />
        <div className="brainux-scan-result">
          {progress !== undefined && (
            <div className="brainux-search-progress">
              <div 
                className="brainux-progress-fill"
                style={{ width: `${progress}%` }}
              />
            </div>
          )}
        </div>
      </div>
      <div className="brainux-search-status">
        {progress !== undefined ? `Searching... ${progress}%` : 'Searching...'}
      </div>
    </div>
  );
};

// Tool Use Animation Component
const ToolUseAnimation: React.FC<{ tool_name: string; status: 'pending' | 'running' | 'completed' }> = ({
  tool_name,
  status,
}) => {
  const [rotation, setRotation] = useState(0);

  useEffect(() => {
    if (status === 'running') {
      const interval = setInterval(() => {
        setRotation((prev) => (prev + 30) % 360);
      }, 50);
      return () => clearInterval(interval);
    }
  }, [status]);

  return (
    <div className={`brainux-tool-use brainux-tool-${status}`}>
      <div 
        className="brainux-tool-icon"
        style={{ transform: `rotate(${rotation}deg)` }}
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M12 2L2 7l10 5 10-5-10-5z" />
          <path d="M2 17l10 5 10-5" />
          <path d="M2 12l10 5 10-5" />
        </svg>
      </div>
      <div className="brainux-tool-info">
        <span className="brainux-tool-name">{tool_name}</span>
        <span className="brainux-tool-status">
          {status === 'pending' && '⏳ Pending'}
          {status === 'running' && '⚡ Running'}
          {status === 'completed' && '✓ Completed'}
        </span>
      </div>
      {status === 'running' && (
        <div className="brainux-tool-progress">
          <div className="brainux-progress-bar">
            <div className="brainux-progress-fill brainux-indeterminate" />
          </div>
        </div>
      )}
    </div>
  );
};

// Generating Animation Component
const GeneratingAnimation: React.FC<{ progress: number; speed?: 'slow' | 'normal' | 'fast' }> = ({
  progress,
  speed = 'normal',
}) => {
  const [particles, setParticles] = useState<Array<{ id: number; x: number; y: number }>>([]);

  useEffect(() => {
    // Generate particles
    const interval = setInterval(() => {
      const newParticle = {
        id: Date.now(),
        x: Math.random() * 100,
        y: 100,
      };
      setParticles((prev) => [...prev.slice(-20), newParticle]);
    }, 200);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="brainux-generating">
      <div className="brainux-generate-container">
        <div className="brainux-generate-ring">
          {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => (
            <div
              key={i}
              className="brainux-generate-dot"
              style={{
                animationDelay: `${i * 0.1}s`,
                animationDuration: speed === 'fast' ? '0.6s' : speed === 'slow' ? '1.2s' : '0.8s',
              }}
            />
          ))}
        </div>
        <div className="brainux-generate-core">
          <span className="brainux-generate-percent">{Math.round(progress)}%</span>
        </div>
      </div>
      <div className="brainux-generate-particles">
        {particles.map((p) => (
          <div
            key={p.id}
            className="brainux-particle"
            style={{
              left: `${p.x}%`,
              top: `${p.y}%`,
              opacity: 1 - (100 - p.y) / 100,
            }}
          />
        ))}
      </div>
      <div className="brainux-generate-status">
        {speed === 'fast' ? '⚡ Generating quickly...' : 'Generating...'}
      </div>
    </div>
  );
};

// Reasoning Animation Component
const ReasoningAnimation: React.FC<{ step: number; total_steps: number; description: string }> = ({
  step,
  total_steps,
  description,
}) => {
  return (
    <div className="brainux-reasoning">
      <div className="brainux-reasoning-steps">
        {Array.from({ length: total_steps }).map((_, i) => (
          <div
            key={i}
            className={`brainux-reasoning-step ${
              i < step ? 'brainux-step-complete' : i === step ? 'brainux-step-active' : 'brainux-step-pending'
            }`}
          >
            <div className="brainux-step-indicator">
              {i < step ? '✓' : i + 1}
            </div>
            {i === step && (
              <div className="brainux-step-connector">
                <div className="brainux-connector-line" />
              </div>
            )}
          </div>
        ))}
      </div>
      <div className="brainux-reasoning-description">
        {description || `Step ${step + 1} of ${total_steps}`}
      </div>
    </div>
  );
};

// Error Animation Component
const ErrorAnimation: React.FC<{ message: string; retryable: boolean; onRetry?: () => void }> = ({
  message,
  retryable,
  onRetry,
}) => {
  const [shake, setShake] = useState(false);

  useEffect(() => {
    setShake(true);
    const timer = setTimeout(() => setShake(false), 500);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div className={`brainux-error ${shake ? 'brainux-error-shake' : ''}`}>
      <div className="brainux-error-icon">⚠️</div>
      <div className="brainux-error-message">{message}</div>
      {retryable && onRetry && (
        <button className="brainux-error-retry" onClick={onRetry}>
          Try Again
        </button>
      )}
    </div>
  );
};

// Writing Animation Component
const WritingAnimation: React.FC<{ text_length: number }> = ({ text_length }) => {
  const [cursorVisible, setCursorVisible] = useState(true);

  useEffect(() => {
    const interval = setInterval(() => {
      setCursorVisible((prev) => !prev);
    }, 500);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="brainux-writing">
      <div className="brainux-writing-indicator">
        <span className="brainux-writing-char">
          {cursorVisible ? '▋' : ' '}
        </span>
        <span className="brainux-writing-count">{text_length} chars</span>
      </div>
    </div>
  );
};

// Main BrainUX Component
export const BrainUX: React.FC<BrainUXProps> = ({
  sessionId,
  onUXStateChange,
  showAnimations = true,
  enableSound = false,
}) => {
  const { sessions } = useBrain();
  const { newEvents } = useBrainEventCursor('brainux');
  const [uxState, setUXState] = useState<UXState>({ type: 'idle' });
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    soundManager.enable();
  }, [enableSound]);

  // Process events and update UX state
  useEffect(() => {
    if (newEvents.length === 0) return;

    const latestEvent = newEvents[newEvents.length - 1];

    switch (latestEvent.type) {
      case 'session.status':
        if (latestEvent.payload.status === 'running') {
          setUXState({ type: 'thinking', message: 'Preparing...' });
          soundManager.playThinking();
        }
        break;

      case 'tool.call':
        setUXState({
          type: 'tool_use',
          tool_name: latestEvent.payload.tool_id,
          status: 'pending',
        });
        soundManager.playBlip();
        break;

      case 'tool.result':
        setUXState({
          type: 'tool_use',
          tool_name: latestEvent.payload.tool_id,
          status: 'completed',
        });
        soundManager.playComplete();
        // Auto-clear after delay
        timeoutRef.current = setTimeout(() => {
          setUXState({ type: 'idle' });
        }, 2000);
        break;

      case 'chat.delta':
        setUXState({
          type: 'generating',
          progress: 100,
          speed: 'normal',
        });
        soundManager.playGenerate();
        break;

      case 'chat.message.completed':
        setUXState({ type: 'idle' });
        soundManager.playComplete();
        break;

      case 'error':
        setUXState({
          type: 'error',
          message: latestEvent.payload.message,
          retryable: true,
        });
        soundManager.playError();
        break;
    }

    onUXStateChange?.(uxState);
  }, [newEvents, onUXStateChange]);

  // Cleanup
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(Number(timeoutRef.current));
      }
    };
  }, []);

  if (!showAnimations || uxState.type === 'idle') {
    return null;
  }

  return (
    <div className="brainux-container">
      <style>{`
        .brainux-container {
          position: fixed;
          bottom: 20px;
          right: 20px;
          z-index: 9999;
          pointer-events: none;
        }

        .brainux-thinking {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 16px 24px;
          background: linear-gradient(135deg, #667eea20, #764ba220);
          border: 1px solid #667eea40;
          border-radius: 24px;
          backdrop-filter: blur(10px);
        }

        .brainux-thinking-orb {
          position: relative;
          width: 32px;
          height: 32px;
        }

        .brainux-orb-core {
          position: absolute;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          width: 12px;
          height: 12px;
          background: linear-gradient(135deg, #667eea, #764ba2);
          border-radius: 50%;
          animation: pulse 1.5s ease-in-out infinite;
        }

        .brainux-orb-ring {
          position: absolute;
          top: 50%;
          left: 50%;
          border: 2px solid transparent;
          border-top-color: #667eea;
          border-radius: 50%;
          animation: spin 3s linear infinite;
        }

        .brainux-ring-1 {
          width: 20px;
          height: 20px;
          transform: translate(-50%, -50%);
        }

        .brainux-ring-2 {
          width: 26px;
          height: 26px;
          transform: translate(-50%, -50%);
          animation-direction: reverse;
          animation-duration: 2s;
        }

        .brainux-ring-3 {
          width: 32px;
          height: 32px;
          transform: translate(-50%, -50%);
          opacity: 0.5;
        }

        .brainux-thinking-message {
          color: #667eea;
          font-size: 14px;
          font-weight: 500;
        }

        .brainux-thinking-dots {
          display: flex;
          gap: 4px;
        }

        .brainux-dot {
          width: 6px;
          height: 6px;
          background: #667eea40;
          border-radius: 50%;
          transition: all 0.2s ease;
        }

        .brainux-dot-active {
          background: #667eea;
        }

        @keyframes pulse {
          0%, 100% { transform: translate(-50%, -50%) scale(1); opacity: 1; }
          50% { transform: translate(-50%, -50%) scale(1.2); opacity: 0.8; }
        }

        @keyframes spin {
          from { transform: translate(-50%, -50%) rotate(0deg); }
          to { transform: translate(-50%, -50%) rotate(360deg); }
        }

        .brainux-searching {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 12px;
          padding: 20px 28px;
          background: linear-gradient(135deg, #11998e20, #38ef7d20);
          border: 1px solid #11998e40;
          border-radius: 20px;
          backdrop-filter: blur(10px);
          min-width: 200px;
        }

        .brainux-search-icon {
          width: 32px;
          height: 32px;
          color: #11998e;
        }

        .brainux-search-query {
          color: #11998e;
          font-size: 14px;
          font-weight: 500;
          font-style: italic;
        }

        .brainux-search-scanner {
          position: relative;
          width: 100%;
          height: 60px;
          background: #11998e10;
          border-radius: 8px;
          overflow: hidden;
        }

        .brainux-scan-line {
          position: absolute;
          left: 0;
          right: 0;
          height: 2px;
          background: linear-gradient(90deg, transparent, #11998e, transparent);
          animation: scan 1.5s ease-in-out infinite;
        }

        @keyframes scan {
          0%, 100% { top: 0; }
          50% { top: calc(100% - 2px); }
        }

        .brainux-search-progress {
          position: absolute;
          bottom: 8px;
          left: 8px;
          right: 8px;
          height: 4px;
          background: #11998e20;
          border-radius: 2px;
          overflow: hidden;
        }

        .brainux-progress-fill {
          height: 100%;
          background: linear-gradient(90deg, #11998e, #38ef7d);
          transition: width 0.3s ease;
        }

        .brainux-indeterminate {
          animation: indeterminate 1s ease-in-out infinite;
        }

        @keyframes indeterminate {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(200%); }
        }

        .brainux-tool-use {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 12px 20px;
          background: linear-gradient(135deg, #f093fb20, #f5576c20);
          border: 1px solid #f093fb40;
          border-radius: 16px;
          backdrop-filter: blur(10px);
          transition: all 0.3s ease;
        }

        .brainux-tool-icon {
          width: 28px;
          height: 28px;
          color: #f093fb;
        }

        .brainux-tool-info {
          display: flex;
          flex-direction: column;
          gap: 2px;
        }

        .brainux-tool-name {
          color: #f093fb;
          font-size: 14px;
          font-weight: 600;
        }

        .brainux-tool-status {
          color: #f093fb80;
          font-size: 12px;
        }

        .brainux-generating {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 16px;
          padding: 24px 32px;
          background: linear-gradient(135deg, #4facfe20, #00f2fe20);
          border: 1px solid #4facfe40;
          border-radius: 24px;
          backdrop-filter: blur(10px);
        }

        .brainux-generate-container {
          position: relative;
          width: 80px;
          height: 80px;
        }

        .brainux-generate-ring {
          position: absolute;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          width: 60px;
          height: 60px;
        }

        .brainux-generate-dot {
          position: absolute;
          width: 8px;
          height: 8px;
          background: #4facfe;
          border-radius: 50%;
          animation: dot-pulse 0.8s ease-in-out infinite;
        }

        @keyframes dot-pulse {
          0%, 100% { transform: scale(1); opacity: 1; }
          50% { transform: scale(0.5); opacity: 0.5; }
        }

        .brainux-generate-core {
          position: absolute;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          width: 40px;
          height: 40px;
          background: linear-gradient(135deg, #4facfe, #00f2fe);
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .brainux-generate-percent {
          color: white;
          font-size: 12px;
          font-weight: 700;
        }

        .brainux-reasoning {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 12px;
          padding: 16px 24px;
          background: linear-gradient(135deg, #fa709a20, #fee14020);
          border: 1px solid #fa709a40;
          border-radius: 20px;
          backdrop-filter: blur(10px);
        }

        .brainux-reasoning-steps {
          display: flex;
          gap: 8px;
        }

        .brainux-reasoning-step {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 4px;
        }

        .brainux-step-indicator {
          width: 24px;
          height: 24px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 12px;
          font-weight: 600;
          transition: all 0.3s ease;
        }

        .brainux-step-pending .brainux-step-indicator {
          background: #fa709a20;
          color: #fa709a80;
        }

        .brainux-step-active .brainux-step-indicator {
          background: linear-gradient(135deg, #fa709a, #fee140);
          color: white;
          animation: step-pulse 1s ease-in-out infinite;
        }

        .brainux-step-complete .brainux-step-indicator {
          background: #38ef7d;
          color: white;
        }

        @keyframes step-pulse {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.1); }
        }

        .brainux-error {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 12px;
          padding: 16px 24px;
          background: linear-gradient(135deg, #ff6b6b20, #ee5a2420);
          border: 1px solid #ff6b6b40;
          border-radius: 16px;
          backdrop-filter: blur(10px);
        }

        .brainux-error-shake {
          animation: shake 0.5s ease-in-out;
        }

        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          25% { transform: translateX(-5px); }
          75% { transform: translateX(5px); }
        }

        .brainux-error-icon {
          font-size: 24px;
        }

        .brainux-error-message {
          color: #ff6b6b;
          font-size: 14px;
          text-align: center;
        }

        .brainux-error-retry {
          padding: 8px 16px;
          background: #ff6b6b;
          color: white;
          border: none;
          border-radius: 8px;
          font-size: 14px;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.2s ease;
        }

        .brainux-error-retry:hover {
          background: #ff6b6bdd;
          transform: scale(1.05);
        }

        .brainux-writing {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 8px 16px;
          background: linear-gradient(135deg, #a8edea20, #fed6e320);
          border: 1px solid #a8edea40;
          border-radius: 12px;
        }

        .brainux-writing-char {
          color: #a8edea;
          font-size: 16px;
          animation: blink 1s step-end infinite;
        }

        @keyframes blink {
          0%, 100% { opacity: 1; }
          50% { opacity: 0; }
        }
      `}</style>
      
      {uxState.type === 'thinking' && <ThinkingAnimation message={uxState.message} />}
      {uxState.type === 'searching' && (
        <SearchingAnimation query={uxState.query} progress={uxState.progress} />
      )}
      {uxState.type === 'tool_use' && (
        <ToolUseAnimation tool_name={uxState.tool_name} status={uxState.status} />
      )}
      {uxState.type === 'generating' && (
        <GeneratingAnimation progress={uxState.progress} speed={uxState.speed} />
      )}
      {uxState.type === 'reasoning' && (
        <ReasoningAnimation
          step={uxState.step}
          total_steps={uxState.total_steps}
          description={uxState.description}
        />
      )}
      {uxState.type === 'writing' && <WritingAnimation text_length={uxState.text_length} />}
      {uxState.type === 'error' && (
        <ErrorAnimation
          message={uxState.message}
          retryable={uxState.retryable}
          onRetry={() => setUXState({ type: 'idle' })}
        />
      )}
    </div>
  );
};

export default BrainUX;
