import { useMemo } from 'react';
import type { AnimationState, SurfaceConfig } from '../AgentModeGizzi.types';

interface GizziMotionProps {
  animState: AnimationState;
  config: SurfaceConfig;
  peekDirection: 'left' | 'right';
  barPosition: number;
}

export function useGizziMotion({ animState, config, peekDirection, barPosition }: GizziMotionProps) {
  const side = config.entrySide === 'left' ? -1 : 1;

  const motionProps = useMemo(() => {
    switch (animState) {
      case 'off-screen': return { x: side * 500, y: 0, rotate: 0, scale: 0.8, opacity: 0 };
      case 'peeking': return { x: side * 140, y: -10, rotate: side * (peekDirection === 'left' ? -10 : 10), scale: 0.95, opacity: 1 };
      case 'skimming-in': return { x: side * 30, y: 0, rotate: side * 2, scale: 1, opacity: 1 };
      case 'landing': return { x: 0, y: 0, rotate: 0, scale: 1.05, opacity: 1 };
      case 'on-bar': return { x: barPosition * 260, y: 0, rotate: barPosition * 3, scale: 1, opacity: 1 };
      case 'skimming-out': return { x: side * 80, y: 0, rotate: side * 4, scale: 0.95, opacity: 1 };
      case 'tumbling-out': return { x: side * 250, y: 80, rotate: side * 55, scale: 0.6, opacity: 0 };
      case 'the-peek': return { x: side * 100, y: -15, rotate: side * (peekDirection === 'left' ? -15 : 15), scale: 0.95, opacity: 1 };
      case 'pacman-trail': return { x: 0, y: 0, rotate: 0, scale: 1, opacity: 1 };
      case 'the-drop': return { x: 0, y: 0, rotate: 720, scale: 1, opacity: 1 };
      case 'wheel-out': return { x: side * 300, y: 100, rotate: side * 1080, scale: 0.6, opacity: 0 };
      case 'pipe-entry': return { x: 0, y: 0, rotate: 0, scale: 1, opacity: 1 };
      case 'power-up': return { x: 0, y: 0, rotate: 0, scale: 1, opacity: 1 };
      case 'one-up': return { x: 0, y: 0, rotate: 0, scale: 1, opacity: 1 };
      case 'checkpoint': return { x: 0, y: 0, rotate: 0, scale: 1, opacity: 1 };
      case 'warp-star': return { x: 0, y: 0, rotate: 720, scale: 1, opacity: 1 };
      case 'to-the-cloud': return { x: barPosition * 40, y: -150, rotate: 0, scale: 0.6, opacity: 0 };
      case 'out-of-tokens': return { x: 0, y: 250, rotate: 180, scale: 1, opacity: 1 };
      case 'buffer-overflow': return { x: 0, y: 0, rotate: 0, scale: 1, opacity: 0 };
      case 'context-scatter': return { x: side * 150, y: -80, rotate: side * 720, scale: 0.5, opacity: 0 };
      case 'fan-spin': return { x: 0, y: 0, rotate: 0, scale: 0.3, opacity: 0 };
      case 'system-crash': return { x: 0, y: 0, rotate: 0, scale: 1, opacity: 0 };
      case 'collapse': return { x: barPosition * 60, y: 70, rotate: side * 8, scale: 0.01, opacity: 0 };
      default: return { x: 0, y: 0, rotate: 0, scale: 1, opacity: 1 };
    }
  }, [animState, side, peekDirection, barPosition]);

  const initialProps = useMemo(() => {
    if (animState === 'pacman-trail') return { opacity: 0, x: -200, y: 0, rotate: 0, scale: 0.8 };
    if (animState === 'the-drop') return { opacity: 1, x: 0, y: -600, rotate: 0, scale: 1 };
    if (animState === 'the-peek') return { opacity: 1, x: side * 500, y: 0, rotate: 0, scale: 0.8 };
    if (animState === 'pipe-entry') return { opacity: 1, x: 0, y: 60, rotate: 0, scale: 0.9 };
    if (animState === 'power-up') return { opacity: 0, x: 0, y: 40, rotate: 0, scale: 0.2 };
    if (animState === 'one-up') return { opacity: 0, x: 0, y: 0, rotate: 0, scale: 2 };
    if (animState === 'checkpoint') return { opacity: 0, x: 0, y: 0, rotate: 0, scale: 0.1 };
    if (animState === 'warp-star') return { opacity: 0, x: 0, y: 0, rotate: -360, scale: 0.3 };
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
      case 'out-of-tokens': return 2.0;
      case 'buffer-overflow': return 2.0;
      case 'context-scatter': return 2.0;
      case 'fan-spin': return 2.0;
      case 'system-crash': return 2.5;
      case 'on-bar': return 0.05;
      default: return 0.4;
    }
  }, [animState]);

  return { motionProps, initialProps, duration };
}
