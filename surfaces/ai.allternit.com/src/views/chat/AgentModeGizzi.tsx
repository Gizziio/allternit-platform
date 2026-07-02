// @ts-nocheck
'use client';

import React, { useMemo, useRef } from 'react';
import { AnimatePresence, LazyMotion, domAnimation, m } from 'framer-motion';
import { useIsClient } from '@/lib/hooks/use-is-client';
import { GizziMascot, type GizziAttention } from '@/components/ai-elements/GizziMascot';

import { 
  type AgentModeGizziProps, 
  SURFACE_CONFIG 
} from './agent-mode-gizzi/AgentModeGizzi.types';
import { useGizziManager } from './agent-mode-gizzi/hooks/useGizziManager';
import { useGizziMotion } from './agent-mode-gizzi/hooks/useGizziMotion';
import { GizziThoughtBubble } from './agent-mode-gizzi/components/GizziThoughtBubble';
import { EntryEffects } from './agent-mode-gizzi/components/EntryEffects';
import { ExitEffects } from './agent-mode-gizzi/components/ExitEffects';
import { OutOfTokensNotice } from './agent-mode-gizzi/components/OutOfTokensNotice';

export function AgentModeGizzi(props: AgentModeGizziProps) {
  const { surface, selectedAgentName, theme, hasActionPills = false } = props;
  const isClient = useIsClient();
  
  const {
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
  } = useGizziManager(props);

  const { motionProps, initialProps, duration } = useGizziMotion({
    animState,
    config,
    peekDirection,
    barPosition,
  });

  const activeThought = thoughts[thoughtIndex] ?? thoughts[0];
  const bubbleVisible = isHovered || isBubblePinned;

  // Determine emotion based on state
  const emotion = useMemo(() => {
    if (animState === 'peeking') return config.peekEmotion;
    if (animState === 'tumbling-out' || animState === 'collapse') return 'alert';
    if (selectedAgentName) return config.selectedEmotion;
    return config.baseEmotion;
  }, [animState, config, selectedAgentName]);

  const attention: GizziAttention | null = useMemo(() => {
    if (animState === 'peeking') {
      return {
        state: 'startled',
        target: { x: peekDirection === 'left' ? -0.2 : 0.2, y: -0.1 }
      };
    }
    if (animState === 'collapse') {
      return { state: 'startled', target: { x: 0, y: 0.5 } };
    }
    if (selectedAgentName) return { state: 'tracking', target: { x: 0.04, y: -0.06 } };
    return null;
  }, [animState, peekDirection, selectedAgentName]);

  const locomotionPhase = useMemo(() => {
    if (['skimming-in', 'skimming-out', 'on-bar'].includes(animState) && (isHovered || isMovingRef.current)) return 'crawl';
    if (animState === 'landing') return 'walk-in';
    if (animState === 'tumbling-out') return 'walk-out';
    return 'idle';
  }, [animState, isHovered]);

  const locomotionDirection = useMemo(() => {
    if (animState === 'skimming-in') return config.entrySide === 'left' ? 'forward' : 'reverse';
    if (animState === 'skimming-out') return config.entrySide === 'left' ? 'reverse' : 'forward';
    if (animState === 'on-bar') return barPosition >= 0 ? 'forward' : 'reverse';
    return 'forward';
  }, [animState, config.entrySide, barPosition]);

  const isVisible = animState !== 'off-screen';
  const isBehindBar = animState === 'collapse' || animState === 'pipe-entry';
  const isInPipe = animState === 'pipe-entry';
  const mascotBottom = hasActionPills ? -4 : -8;

  return (
    <LazyMotion features={domAnimation}>
      <div
        data-testid="agent-mode-gizzi-container"
        className={`absolute bottom-full left-0 right-0 h-[120px] overflow-visible pointer-events-none ${isBehindBar ? 'z-[1]' : 'z-10'}`}
        onMouseMove={handleMouseMove}
        onMouseEnter={() => animState === 'on-bar' && setIsHovered(true)}
        onMouseLeave={() => {
          setIsHovered(false);
          isMovingRef.current = false;
        }}
      >
        <AnimatePresence>
          {isVisible && (
            <m.div
              key={uniqueKey}
              data-testid="agent-mode-gizzi"
              initial={initialProps}
              animate={motionProps}
              exit={{ opacity: 0, transition: { duration: 0 } }}
              transition={{
                ...(animState === 'on-bar' 
                  ? { type: 'spring', stiffness: 80, damping: 12, mass: 0.8 }
                  : { type: 'tween', duration }
                ),
                ease: getEasing(animState),
              }}
              className="absolute left-1/2 -ml-[calc(var(--mascot-size)/2)]"
              style={{
                bottom: mascotBottom,
                '--mascot-size': `${config.mascotSize}px`,
                zIndex: isInPipe ? 2 : (isBehindBar ? 1 : 8),
                pointerEvents: animState === 'on-bar' || animState === 'landing' ? 'auto' : 'none',
              } as React.CSSProperties}
            >
              <AnimatePresence>
                {bubbleVisible && ['on-bar', 'peeking', 'skimming-in'].includes(animState) && (
                  <GizziThoughtBubble thought={activeThought} thoughtIndex={thoughtIndex} theme={theme} />
                )}
              </AnimatePresence>

              <EntryEffects animState={animState} theme={theme} isClient={isClient} />
              <ExitEffects animState={animState} theme={theme} isClient={isClient} />

              <GizziMascot
                size={config.mascotSize}
                emotion={emotion}
                attention={attention}
                locomotion={{
                  style: surface === 'cowork' ? 'cowork' : 'chat',
                  phase: locomotionPhase,
                  direction: locomotionDirection,
                }}
                label={`Gizzi agent guide for ${surface} mode`}
              />
            </m.div>
          )}
        </AnimatePresence>

        {(animState === 'on-bar' || animState === 'landing') && (
          <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[720px] h-[3px] rounded-full opacity-50 pointer-events-none bg-[linear-gradient(90deg,transparent_0%,var(--glow-soft)_10%,var(--glow-primary)_50%,var(--glow-soft)_90%,transparent_100%)]"
            style={{ '--glow-soft': theme.soft, '--glow-primary': theme.glow } as React.CSSProperties}
          />
        )}

        <OutOfTokensNotice isVisible={animState === 'out-of-tokens'} />
      </div>
    </LazyMotion>
  );
}

function getEasing(animState: string) {
  const easings: Record<string, any> = {
    collapse: [0.4, 0, 0.6, 1],
    'to-the-cloud': [0.25, 0.1, 0.25, 1],
    'wheel-out': [0.3, 0, 0.7, 1.2],
    'out-of-tokens': [0.2, 0.5, 0.8, 1],
    'buffer-overflow': [0.4, 0, 0.6, 1],
    'context-scatter': [0.3, 0, 0.5, 1.2],
    'fan-spin': [0.6, 0, 0.8, 1],
    'system-crash': [0.4, 0, 1, 1],
    'pacman-trail': [0.175, 0.885, 0.32, 1.275],
    'the-drop': [0.5, 0, 0.2, 1.4],
    'the-peek': [0.34, 1.56, 0.64, 1],
    'pipe-entry': [0.4, 0, 0.2, 1],
    'power-up': [0.34, 1.56, 0.64, 1],
    'one-up': [0.68, -0.55, 0.265, 1.55],
    checkpoint: [0.4, 0, 0.2, 1],
    'warp-star': [0.175, 0.885, 0.32, 1.275],
    landing: [0.34, 1.56, 0.64, 1],
  };
  return easings[animState] || 'easeInOut';
}
