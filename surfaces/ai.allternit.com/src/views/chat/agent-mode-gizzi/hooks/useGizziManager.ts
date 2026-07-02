import { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import type { AgentModeSurface } from '@/stores/agent-surface-mode.store';
import { SURFACE_CONFIG, type AnimationState } from '../AgentModeGizzi.types';
import { resolveThoughts } from '../AgentModeGizzi.utils';

interface GizziManagerProps {
  active: boolean;
  surface: AgentModeSurface;
  pulse: number;
  selectedAgentName?: string | null;
}

export function useGizziManager({ active, surface, pulse, selectedAgentName }: GizziManagerProps) {
  const config = SURFACE_CONFIG[surface];
  
  const [animState, setAnimState] = useState<AnimationState>('off-screen');
  const [uniqueKey, setUniqueKey] = useState("");
  const [isHovered, setIsHovered] = useState(false);
  const [isBubblePinned, setIsBubblePinned] = useState(false);
  const [peekDirection, setPeekDirection] = useState<'left' | 'right'>('left');
  const [barPosition, setBarPosition] = useState(0);
  
  const barPositionRef = useRef(0);
  const isMovingRef = useRef(false);
  const moveTimeoutRef = useRef<number | null>(null);
  const didInitRef = useRef(false);
  const entryTimerRef = useRef<number | null>(null);
  const exitTimerRef = useRef<number | null>(null);
  const peekTimerRef = useRef<number | null>(null);
  const fastToggleRef = useRef<number>(0);
  const isFastToggleSequence = useRef(false);

  // Inline state adjustment for surface change (uniqueKey)
  const [prevSurface, setPrevSurface] = useState(surface);
  if (surface !== prevSurface) {
    setPrevSurface(surface);
    setUniqueKey(`${surface}-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`);
  }

  // Inline state adjustment for active change
  const [prevActive, setPrevActive] = useState(active);
  if (active !== prevActive) {
    setPrevActive(active);
    if (!active) {
      isFastToggleSequence.current = true;
    } else {
      setBarPosition(0);
      barPositionRef.current = 0;
    }
  }

  const [thoughtIndex, setThoughtIndex] = useState(0);

  const thoughts = useMemo(
    () => resolveThoughts(surface, selectedAgentName),
    [surface, selectedAgentName],
  );

  const [prevPulse, setPrevPulse] = useState(pulse);
  if (pulse !== prevPulse) {
    setPrevPulse(pulse);
    setThoughtIndex(pulse % thoughts.length);
  }

  const clearAllTimers = useCallback(() => {
    if (entryTimerRef.current) {
      window.clearTimeout(entryTimerRef.current);
      entryTimerRef.current = null;
    }
    if (exitTimerRef.current) {
      window.clearTimeout(exitTimerRef.current);
      exitTimerRef.current = null;
    }
    if (peekTimerRef.current) {
      window.clearTimeout(peekTimerRef.current);
      peekTimerRef.current = null;
    }
    if (moveTimeoutRef.current) {
      window.clearTimeout(moveTimeoutRef.current);
      moveTimeoutRef.current = null;
    }
  }, []);

  // We use useEffect for complex animation sequences because they involve timers
  
  useEffect(() => {
    // Initial mount with active=true
    if (active && animState === 'off-screen' && !didInitRef.current) {
      didInitRef.current = true;
      clearAllTimers();
      isFastToggleSequence.current = false;
      setAnimState('peeking');

      let peekCount = 0;
      const doPeek = () => {
        setPeekDirection(peekCount % 2 === 0 ? 'left' : 'right');
        peekCount++;
        if (peekCount < 4) {
          peekTimerRef.current = window.setTimeout(doPeek, 500);
        }
      };
      doPeek();

      entryTimerRef.current = window.setTimeout(() => {
        setAnimState('skimming-in');
        entryTimerRef.current = window.setTimeout(() => {
          setAnimState('on-bar');
        }, 2000);
      }, 2000);
      return;
    }

    // Handle surface change while active
    if (active && prevSurface !== surface) {
      clearAllTimers();
      isFastToggleSequence.current = false;
      setAnimState('peeking');

      let peekCount = 0;
      const doPeek = () => {
        setPeekDirection(peekCount % 2 === 0 ? 'left' : 'right');
        peekCount++;
        if (peekCount < 2) {
          peekTimerRef.current = window.setTimeout(doPeek, 300);
        }
      };
      doPeek();

      entryTimerRef.current = window.setTimeout(() => {
        setAnimState('skimming-in');
        entryTimerRef.current = window.setTimeout(() => {
          setAnimState('on-bar');
        }, 1000);
      }, 1000);
      return;
    }

    if (active && prevActive !== active && didInitRef.current) {
      // Turning ON (not initial)
      clearAllTimers();
      const now = Date.now();
      const timeSinceLastToggle = now - fastToggleRef.current;
      fastToggleRef.current = now;
      
      if (timeSinceLastToggle < 800 && (animState === 'collapse' || animState === 'off-screen')) {
        isFastToggleSequence.current = true;
        setAnimState('on-bar');
        entryTimerRef.current = window.setTimeout(() => {
          isFastToggleSequence.current = false;
        }, 500);
      } else {
        isFastToggleSequence.current = false;

        const entryAnim = Math.floor(Math.random() * 8);
        switch (entryAnim) {
          case 0: setAnimState('pacman-trail'); entryTimerRef.current = window.setTimeout(() => setAnimState('on-bar'), 2000); break;
          case 1: setAnimState('the-drop'); entryTimerRef.current = window.setTimeout(() => setAnimState('on-bar'), 2200); break;
          case 2: setAnimState('pipe-entry'); entryTimerRef.current = window.setTimeout(() => setAnimState('on-bar'), 2500); break;
          case 3: setAnimState('power-up'); entryTimerRef.current = window.setTimeout(() => setAnimState('on-bar'), 2000); break;
          case 4: setAnimState('one-up'); entryTimerRef.current = window.setTimeout(() => setAnimState('on-bar'), 2500); break;
          case 5: setAnimState('checkpoint'); entryTimerRef.current = window.setTimeout(() => setAnimState('on-bar'), 2000); break;
          case 6: setAnimState('warp-star'); entryTimerRef.current = window.setTimeout(() => setAnimState('on-bar'), 1800); break;
          default: setAnimState('the-peek'); entryTimerRef.current = window.setTimeout(() => setAnimState('on-bar'), 800); break;
        }

        setThoughtIndex((current) => (current + 1) % thoughts.length);
        setIsBubblePinned(true);
        const bubbleTimer = window.setTimeout(() => setIsBubblePinned(false), 3500);
        return () => {
          clearAllTimers();
          window.clearTimeout(bubbleTimer);
        };
      }
    }

    if (!active && prevActive !== active) {
      // Turning OFF
      clearAllTimers();
      const exitAnim = Math.floor(Math.random() * 8);
      
      switch (exitAnim) {
        case 0: setAnimState('to-the-cloud'); exitTimerRef.current = window.setTimeout(() => { setAnimState('off-screen'); isFastToggleSequence.current = false; }, 2500); break;
        case 1: setAnimState('wheel-out'); exitTimerRef.current = window.setTimeout(() => { setAnimState('off-screen'); isFastToggleSequence.current = false; }, 2000); break;
        case 2: setAnimState('out-of-tokens'); exitTimerRef.current = window.setTimeout(() => { setAnimState('off-screen'); isFastToggleSequence.current = false; }, 2000); break;
        case 3: setAnimState('buffer-overflow'); exitTimerRef.current = window.setTimeout(() => { setAnimState('off-screen'); isFastToggleSequence.current = false; }, 2000); break;
        case 4: setAnimState('context-scatter'); exitTimerRef.current = window.setTimeout(() => { setAnimState('off-screen'); isFastToggleSequence.current = false; }, 2000); break;
        case 5: setAnimState('fan-spin'); exitTimerRef.current = window.setTimeout(() => { setAnimState('off-screen'); isFastToggleSequence.current = false; }, 2000); break;
        case 6: setAnimState('system-crash'); exitTimerRef.current = window.setTimeout(() => { setAnimState('off-screen'); isFastToggleSequence.current = false; }, 2000); break;
        default: setAnimState('collapse'); exitTimerRef.current = window.setTimeout(() => { setAnimState('off-screen'); isFastToggleSequence.current = false; }, 1000); break;
      }
    }
  }, [active, surface, animState, clearAllTimers, prevActive, prevSurface, thoughts.length]); // Depend on active and surface

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (animState !== 'on-bar') return;
    
    const rect = e.currentTarget.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const halfWidth = rect.width / 2;
    const normalized = Math.max(-1, Math.min(1, (e.clientX - centerX) / halfWidth));
    
    barPositionRef.current = normalized;
    setBarPosition(normalized);
    
    isMovingRef.current = true;
    if (moveTimeoutRef.current) window.clearTimeout(moveTimeoutRef.current);
    moveTimeoutRef.current = window.setTimeout(() => {
      isMovingRef.current = false;
    }, 150);
  }, [animState]);

  return {
    animState,
    uniqueKey,
    isHovered,
    setIsHovered,
    isBubblePinned,
    peekDirection,
    barPosition,
    barPositionRef,
    isMovingRef,
    thoughts,
    thoughtIndex,
    handleMouseMove,
    config,
  };
}
