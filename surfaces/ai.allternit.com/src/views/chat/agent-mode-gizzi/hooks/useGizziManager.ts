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
  const prevActiveRef = useRef(active);
  const prevSurfaceRef = useRef(surface);

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

  // Update uniqueKey when surface changes so AnimatePresence remounts for a fresh entry
  useEffect(() => {
    if (surface !== prevSurfaceRef.current) {
      setUniqueKey(`${surface}-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`);
    }
  }, [surface]);

  // We use useEffect for complex animation sequences because they involve timers

  useEffect(() => {
    const prevActive = prevActiveRef.current;
    const prevSurface = prevSurfaceRef.current;
    const justTurnedOn = active && !prevActive;
    const justTurnedOff = !active && prevActive;
    const surfaceChanged = surface !== prevSurface;

    // Update refs immediately for transitions we are about to handle so that
    // state updates below do not cause this effect to re-handle the same event.
    if (justTurnedOn || justTurnedOff) {
      prevActiveRef.current = active;
    }
    if (surfaceChanged) {
      prevSurfaceRef.current = surface;
    }

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
    if (active && surfaceChanged) {
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

    if (justTurnedOn && didInitRef.current) {
      // Turning ON (not initial)
      clearAllTimers();
      setBarPosition(0);
      barPositionRef.current = 0;
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

        const entryAnim = Math.floor(Math.random() * 16);
        switch (entryAnim) {
          case 0: setAnimState('pacman-trail'); entryTimerRef.current = window.setTimeout(() => setAnimState('on-bar'), 2000); break;
          case 1: setAnimState('the-drop'); entryTimerRef.current = window.setTimeout(() => setAnimState('on-bar'), 2200); break;
          case 2: setAnimState('pipe-entry'); entryTimerRef.current = window.setTimeout(() => setAnimState('on-bar'), 2500); break;
          case 3: setAnimState('power-up'); entryTimerRef.current = window.setTimeout(() => setAnimState('on-bar'), 2000); break;
          case 4: setAnimState('one-up'); entryTimerRef.current = window.setTimeout(() => setAnimState('on-bar'), 2500); break;
          case 5: setAnimState('checkpoint'); entryTimerRef.current = window.setTimeout(() => setAnimState('on-bar'), 2000); break;
          case 6: setAnimState('warp-star'); entryTimerRef.current = window.setTimeout(() => setAnimState('on-bar'), 1800); break;
          case 7: setAnimState('glitch-in'); entryTimerRef.current = window.setTimeout(() => setAnimState('on-bar'), 800); break;
          case 8: setAnimState('beam-in'); entryTimerRef.current = window.setTimeout(() => setAnimState('on-bar'), 1200); break;
          case 9: setAnimState('bounce-in'); entryTimerRef.current = window.setTimeout(() => setAnimState('on-bar'), 1000); break;
          case 10: setAnimState('flip-in'); entryTimerRef.current = window.setTimeout(() => setAnimState('on-bar'), 700); break;
          case 11: setAnimState('wave-hello'); entryTimerRef.current = window.setTimeout(() => setAnimState('on-bar'), 900); break;
          case 12: setAnimState('coffee-boost'); entryTimerRef.current = window.setTimeout(() => setAnimState('on-bar'), 1100); break;
          case 13: setAnimState('rocket-land'); entryTimerRef.current = window.setTimeout(() => setAnimState('on-bar'), 1400); break;
          case 14: setAnimState('typing-emerge'); entryTimerRef.current = window.setTimeout(() => setAnimState('on-bar'), 1200); break;
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
      return;
    }

    if (justTurnedOff) {
      // Turning OFF
      clearAllTimers();
      isFastToggleSequence.current = true;
      const exitAnim = Math.floor(Math.random() * 16);

      switch (exitAnim) {
        case 0: setAnimState('to-the-cloud'); exitTimerRef.current = window.setTimeout(() => { setAnimState('off-screen'); isFastToggleSequence.current = false; }, 2500); break;
        case 1: setAnimState('wheel-out'); exitTimerRef.current = window.setTimeout(() => { setAnimState('off-screen'); isFastToggleSequence.current = false; }, 2000); break;
        case 2: setAnimState('out-of-tokens'); exitTimerRef.current = window.setTimeout(() => { setAnimState('off-screen'); isFastToggleSequence.current = false; }, 2000); break;
        case 3: setAnimState('buffer-overflow'); exitTimerRef.current = window.setTimeout(() => { setAnimState('off-screen'); isFastToggleSequence.current = false; }, 2000); break;
        case 4: setAnimState('context-scatter'); exitTimerRef.current = window.setTimeout(() => { setAnimState('off-screen'); isFastToggleSequence.current = false; }, 2000); break;
        case 5: setAnimState('fan-spin'); exitTimerRef.current = window.setTimeout(() => { setAnimState('off-screen'); isFastToggleSequence.current = false; }, 2000); break;
        case 6: setAnimState('system-crash'); exitTimerRef.current = window.setTimeout(() => { setAnimState('off-screen'); isFastToggleSequence.current = false; }, 2000); break;
        case 7: setAnimState('fizzle-out'); exitTimerRef.current = window.setTimeout(() => { setAnimState('off-screen'); isFastToggleSequence.current = false; }, 1200); break;
        case 8: setAnimState('black-hole'); exitTimerRef.current = window.setTimeout(() => { setAnimState('off-screen'); isFastToggleSequence.current = false; }, 1000); break;
        case 9: setAnimState('teleport-out'); exitTimerRef.current = window.setTimeout(() => { setAnimState('off-screen'); isFastToggleSequence.current = false; }, 1200); break;
        case 10: setAnimState('shrink-out'); exitTimerRef.current = window.setTimeout(() => { setAnimState('off-screen'); isFastToggleSequence.current = false; }, 500); break;
        case 11: setAnimState('wave-goodbye'); exitTimerRef.current = window.setTimeout(() => { setAnimState('off-screen'); isFastToggleSequence.current = false; }, 800); break;
        case 12: setAnimState('sleep-curl'); exitTimerRef.current = window.setTimeout(() => { setAnimState('off-screen'); isFastToggleSequence.current = false; }, 1200); break;
        case 13: setAnimState('rocket-blast'); exitTimerRef.current = window.setTimeout(() => { setAnimState('off-screen'); isFastToggleSequence.current = false; }, 1000); break;
        case 14: setAnimState('smoke-poof'); exitTimerRef.current = window.setTimeout(() => { setAnimState('off-screen'); isFastToggleSequence.current = false; }, 600); break;
        default: setAnimState('collapse'); exitTimerRef.current = window.setTimeout(() => { setAnimState('off-screen'); isFastToggleSequence.current = false; }, 1000); break;
      }
      return;
    }
  }, [active, surface, animState, clearAllTimers, thoughts.length]);

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
