import { useMemo } from 'react';
import type { AnimationState, SurfaceConfig } from '../AgentModeGizzi.types';

interface GizziMotionProps {
  animState: AnimationState;
  config: SurfaceConfig;
  peekDirection: 'left' | 'right';
  barPosition: number;
  isCompanion?: boolean;
}

export function useGizziMotion({ animState, config, peekDirection, barPosition, isCompanion }: GizziMotionProps) {
  const side = config.entrySide === 'left' ? -1 : 1;

  const motionProps = useMemo(() => {
    switch (animState) {
      case 'off-screen': return { x: side * 500, y: 0, rotate: 0, scale: 0.8, opacity: 0 };
      case 'peeking': return { x: isCompanion ? 0 : side * 140, y: -10, rotate: isCompanion ? 0 : side * (peekDirection === 'left' ? -10 : 10), scale: 0.95, opacity: 1 };
      case 'skimming-in': return { x: isCompanion ? 0 : side * 30, y: 0, rotate: isCompanion ? 0 : side * 2, scale: 1, opacity: 1 };
      case 'landing': return { x: 0, y: 0, rotate: 0, scale: 1.05, opacity: 1 };
      case 'on-bar': return { x: isCompanion ? 0 : barPosition * 260, y: 0, rotate: isCompanion ? 0 : barPosition * 3, scale: 1, opacity: 1 };
      case 'skimming-out': return { x: isCompanion ? 0 : side * 80, y: 0, rotate: isCompanion ? 0 : side * 4, scale: 0.95, opacity: 1 };
      case 'tumbling-out': return { x: isCompanion ? 0 : side * 250, y: isCompanion ? 40 : 80, rotate: isCompanion ? 0 : side * 55, scale: 0.6, opacity: 0 };
      case 'the-peek': return { x: isCompanion ? 0 : side * 100, y: -15, rotate: isCompanion ? 0 : side * (peekDirection === 'left' ? -15 : 15), scale: 0.95, opacity: 1 };
      case 'pacman-trail': return { x: 0, y: 0, rotate: 0, scale: 1, opacity: 1 };
      case 'the-drop': return { x: 0, y: 0, rotate: 720, scale: 1, opacity: 1 };
      case 'wheel-out': return { x: side * 300, y: 100, rotate: side * 1080, scale: 0.6, opacity: 0 };
      case 'pipe-entry': return { x: 0, y: 0, rotate: 0, scale: 1, opacity: 1 };
      case 'power-up': return { x: 0, y: 0, rotate: 0, scale: 1, opacity: 1 };
      case 'one-up': return { x: 0, y: 0, rotate: 0, scale: 1, opacity: 1 };
      case 'checkpoint': return { x: 0, y: 0, rotate: 0, scale: 1, opacity: 1 };
      case 'warp-star': return { x: 0, y: 0, rotate: 720, scale: 1, opacity: 1 };
      case 'glitch-in': return { x: 0, y: 0, rotate: 0, scale: 1, opacity: 1 };
      case 'beam-in': return { x: 0, y: 0, rotate: 0, scale: 1, opacity: 1 };
      case 'bounce-in': return { x: 0, y: 0, rotate: 0, scale: 1, opacity: 1 };
      case 'flip-in': return { x: 0, y: 0, rotateY: 0, scale: 1, opacity: 1 };
      case 'wave-hello': return { x: 0, y: 0, rotate: 0, scale: 1, opacity: 1 };
      case 'coffee-boost': return { x: 0, y: 0, rotate: 0, scale: 1, opacity: 1 };
      case 'rocket-land': return { x: 0, y: 0, rotate: 0, scale: 1, opacity: 1 };
      case 'typing-emerge': return { x: 0, y: 0, rotate: 0, scale: 1, opacity: 1 };
      case 'wave-goodbye': return { x: 0, y: 0, rotate: 0, scale: 0.9, opacity: 0 };
      case 'sleep-curl': return { x: 0, y: 20, rotate: 0, scale: 0.8, opacity: 0 };
      case 'rocket-blast': return { x: 0, y: -200, rotate: 0, scale: 0.7, opacity: 0 };
      case 'smoke-poof': return { x: 0, y: 0, rotate: 0, scale: 1.2, opacity: 0 };
      case 'fizzle-out': return { x: 0, y: -20, rotate: side * 5, scale: 0.85, opacity: 0 };
      case 'black-hole': return { x: 0, y: 30, rotate: side * 15, scale: 0.02, opacity: 0 };
      case 'teleport-out': return { x: 0, y: -60, rotate: 0, scale: 0.15, opacity: 0 };
      case 'shrink-out': return { x: 0, y: 0, rotate: side * 25, scale: 0, opacity: 0 };
      case 'to-the-cloud': return { x: isCompanion ? 0 : barPosition * 40, y: -150, rotate: 0, scale: 0.6, opacity: 0 };
      case 'out-of-tokens': return { x: 0, y: 250, rotate: 180, scale: 1, opacity: 1 };
      case 'buffer-overflow': return { x: 0, y: 0, rotate: 0, scale: 1, opacity: 0 };
      case 'context-scatter': return { x: isCompanion ? 0 : side * 150, y: -80, rotate: isCompanion ? 0 : side * 720, scale: 0.5, opacity: 0 };
      case 'fan-spin': return { x: 0, y: 0, rotate: 0, scale: 0.3, opacity: 0 };
      case 'system-crash': return { x: 0, y: 0, rotate: 0, scale: 1, opacity: 0 };
      case 'collapse': return { x: isCompanion ? 0 : barPosition * 60, y: 70, rotate: isCompanion ? 0 : side * 8, scale: 0.01, opacity: 0 };
      default: return { x: 0, y: 0, rotate: 0, scale: 1, opacity: 1 };
    }
  }, [animState, side, peekDirection, barPosition, isCompanion]);

  const initialProps = useMemo(() => {
    if (animState === 'pacman-trail') return { opacity: 0, x: -200, y: 0, rotate: 0, scale: 0.8 };
    if (animState === 'the-drop') return { opacity: 1, x: 0, y: -600, rotate: 0, scale: 1 };
    if (animState === 'the-peek') return { opacity: 1, x: side * 500, y: 0, rotate: 0, scale: 0.8 };
    if (animState === 'pipe-entry') return { opacity: 1, x: 0, y: 60, rotate: 0, scale: 0.9 };
    if (animState === 'power-up') return { opacity: 0, x: 0, y: 40, rotate: 0, scale: 0.2 };
    if (animState === 'one-up') return { opacity: 0, x: 0, y: 0, rotate: 0, scale: 2 };
    if (animState === 'checkpoint') return { opacity: 0, x: 0, y: 0, rotate: 0, scale: 0.1 };
    if (animState === 'warp-star') return { opacity: 0, x: 0, y: 0, rotate: -360, scale: 0.3 };
    if (animState === 'glitch-in') return { opacity: 0, x: side * 30, y: 0, rotate: side * 10, scale: 0.9 };
    if (animState === 'beam-in') return { opacity: 0, x: 0, y: -40, rotate: 0, scale: 0.2 };
    if (animState === 'bounce-in') return { opacity: 0, x: 0, y: 280, rotate: 0, scale: 0.6 };
    if (animState === 'flip-in') return { opacity: 0, x: 0, y: 0, rotateY: 90, scale: 0.6 };
    if (animState === 'wave-hello') return { opacity: 0, x: side * 120, y: 40, rotate: side * -15, scale: 0.7 };
    if (animState === 'coffee-boost') return { opacity: 0, x: 0, y: 120, rotate: 0, scale: 0.5 };
    if (animState === 'rocket-land') return { opacity: 0, x: 0, y: -300, rotate: 0, scale: 0.6 };
    if (animState === 'typing-emerge') return { opacity: 0, x: 0, y: 80, rotate: 0, scale: 0.4 };
    return { opacity: 0, x: side * 500, y: 0, rotate: 0, scale: 0.8 };
  }, [animState, side]);

  const duration = useMemo(() => {
    switch (animState) {
      case 'skimming-in': return 2.0;
      case 'skimming-out': return 1.5;
      case 'tumbling-out': return 2.0;
      case 'peeking': return 0.5;
      case 'landing': return 0.4;
      case 'collapse': return 1.5;
      case 'to-the-cloud': return 2.5;
      case 'pacman-trail': return 2.0;
      case 'the-drop': return 2.2;
      case 'the-peek': return 0.8;
      case 'wheel-out': return 2.0;
      case 'pipe-entry': return 1.5;
      case 'power-up': return 2.0;
      case 'one-up': return 2.5;
      case 'checkpoint': return 2.0;
      case 'warp-star': return 1.8;
      case 'glitch-in': return 0.8;
      case 'beam-in': return 1.2;
      case 'bounce-in': return 1.0;
      case 'flip-in': return 0.7;
      case 'wave-hello': return 0.9;
      case 'coffee-boost': return 1.1;
      case 'rocket-land': return 1.4;
      case 'typing-emerge': return 1.2;
      case 'wave-goodbye': return 0.8;
      case 'sleep-curl': return 1.2;
      case 'rocket-blast': return 1.0;
      case 'smoke-poof': return 0.6;
      case 'out-of-tokens': return 2.0;
      case 'buffer-overflow': return 2.0;
      case 'context-scatter': return 2.0;
      case 'fan-spin': return 2.0;
      case 'system-crash': return 2.5;
      case 'fizzle-out': return 1.2;
      case 'black-hole': return 1.0;
      case 'teleport-out': return 1.2;
      case 'shrink-out': return 0.5;
      case 'on-bar': return 0.05;
      default: return 0.4;
    }
  }, [animState]);

  return { motionProps, initialProps, duration };
}
