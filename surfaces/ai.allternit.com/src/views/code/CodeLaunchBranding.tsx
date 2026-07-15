import React, { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, LazyMotion, domAnimation, m } from 'framer-motion';
import { GizziMascot, type GizziAttention, type GizziLocomotion } from '@/components/ai-elements/GizziMascot';
import {
  getCodeModeGreetingStorage,
  getNextCodeModeGreeting,
} from './codeModeBrand';
import { getAgentModeSurfaceTheme } from '../chat/agentModeSurfaceTheme';

interface CodeLaunchBrandingProps {
  workspaceReady: boolean;
  attention?: GizziAttention | null;
  agentModeEnabled?: boolean;
  agentModePulse?: number;
  selectedAgentName?: string | null;
  variant?: 'hero' | 'companion';
}

const brandingAnimationStyles = `
@keyframes codeBrandFadeRise {
  from {
    opacity: 0;
    transform: translateY(24px);
  }
  to {
    opacity: 1;
    transform: translateY(0px);
  }
}

@keyframes codeBrandSlideLeft {
  from {
    opacity: 0;
    transform: translateX(-40px);
  }
  to {
    opacity: 1;
    transform: translateX(0px);
  }
}

@keyframes codeBrandSlideRight {
  from {
    opacity: 0;
    transform: translateX(40px);
  }
  to {
    opacity: 1;
    transform: translateX(0px);
  }
}

@keyframes codeBrandScaleIn {
  from {
    opacity: 0;
    transform: scale(0.92);
  }
  to {
    opacity: 1;
    transform: scale(1);
  }
}

@keyframes codeBrandBlurIn {
  from {
    opacity: 0;
    filter: blur(12px);
    transform: translateY(12px) scale(1.03);
  }
  to {
    opacity: 1;
    filter: blur(0px);
    transform: translateY(0px) scale(1);
  }
}

@keyframes codeBrandClipIn {
  from {
    opacity: 0;
    clip-path: inset(0 100% 0 0);
  }
  to {
    opacity: 1;
    clip-path: inset(0 0 0 0);
  }
}

@keyframes codeBrandTrackingIn {
  from {
    opacity: 0;
    letter-spacing: 0.24em;
    transform: translateY(12px);
  }
  to {
    opacity: 1;
    letter-spacing: -0.03em;
    transform: translateY(0px);
  }
}

@keyframes codeBrandSoftReveal {
  from {
    opacity: 0;
    transform: translateY(10px);
  }
  to {
    opacity: 1;
    transform: translateY(0px);
  }
}

@keyframes codeBrandGizziPulse {
  0% {
    transform: translateY(0px) scale(1);
  }
  22% {
    transform: translateY(-8px) scale(1.04);
  }
  54% {
    transform: translateY(2px) scale(0.98);
  }
  100% {
    transform: translateY(0px) scale(1);
  }
}

@keyframes gizzi-action-salute {
  0% { transform: translateY(0) rotate(0deg) scale(1); }
  25% { transform: translateY(-14px) rotate(-12deg) scale(1.08); }
  50% { transform: translateY(-10px) rotate(-8deg) scale(1.05); }
  75% { transform: translateY(-4px) rotate(-3deg) scale(1.02); }
  100% { transform: translateY(0) rotate(0deg) scale(1); }
}

@keyframes gizzi-action-jump {
  0% { transform: translateY(0) scale(1); }
  30% { transform: translateY(-22px) scale(1.1, 0.95); }
  50% { transform: translateY(0) scale(0.95, 1.1); }
  70% { transform: translateY(-8px) scale(1.03); }
  100% { transform: translateY(0) scale(1); }
}

@keyframes gizzi-action-spin {
  0% { transform: rotate(0deg) scale(1); }
  40% { transform: rotate(180deg) scale(1.12); }
  70% { transform: rotate(340deg) scale(1.05); }
  100% { transform: rotate(360deg) scale(1); }
}

@keyframes gizzi-action-wave {
  0% { transform: translateX(0) rotate(0deg); }
  20% { transform: translateX(-10px) rotate(-14deg); }
  40% { transform: translateX(8px) rotate(10deg); }
  60% { transform: translateX(-6px) rotate(-8deg); }
  80% { transform: translateX(4px) rotate(4deg); }
  100% { transform: translateX(0) rotate(0deg); }
}

@keyframes gizzi-action-flip {
  0% { transform: perspective(120px) rotateY(0deg); }
  40% { transform: perspective(120px) rotateY(180deg) scale(1.1); }
  60% { transform: perspective(120px) rotateY(270deg) scale(1.05); }
  100% { transform: perspective(120px) rotateY(360deg) scale(1); }
}

@keyframes gizzi-action-computer {
  0% { transform: translateY(0) rotate(0deg) scale(1); }
  10% { transform: translateY(-4px) rotate(-4deg) scale(1.02); }
  20% { transform: translateY(0) rotate(3deg) scale(1); }
  30% { transform: translateY(-5px) rotate(-3deg) scale(1.03); }
  40% { transform: translateY(0) rotate(4deg) scale(1); }
  50% { transform: translateY(-6px) rotate(-4deg) scale(1.04); }
  60% { transform: translateY(0) rotate(3deg) scale(1); }
  70% { transform: translateY(-5px) rotate(-3deg) scale(1.03); }
  80% { transform: translateY(0) rotate(4deg) scale(1); }
  90% { transform: translateY(-2px) rotate(-1deg) scale(1.01); }
  100% { transform: translateY(0) rotate(0deg) scale(1); }
}
`;

const titleAnimations = [
  'codeBrandFadeRise 720ms cubic-bezier(0.22, 1, 0.36, 1) forwards',
  'codeBrandSlideLeft 780ms cubic-bezier(0.22, 1, 0.36, 1) forwards',
  'codeBrandSlideRight 780ms cubic-bezier(0.22, 1, 0.36, 1) forwards',
  'codeBrandScaleIn 680ms cubic-bezier(0.34, 1.56, 0.64, 1) forwards',
  'codeBrandBlurIn 900ms cubic-bezier(0.22, 1, 0.36, 1) forwards',
  'codeBrandClipIn 760ms cubic-bezier(0.22, 1, 0.36, 1) forwards',
  'codeBrandTrackingIn 820ms cubic-bezier(0.22, 1, 0.36, 1) forwards',
  'codeBrandFadeRise 720ms cubic-bezier(0.22, 1, 0.36, 1) forwards',
];

const taglineAnimations = [
  'codeBrandSoftReveal 700ms cubic-bezier(0.22, 1, 0.36, 1) forwards',
  'codeBrandBlurIn 820ms cubic-bezier(0.22, 1, 0.36, 1) forwards',
  'codeBrandSlideLeft 720ms cubic-bezier(0.22, 1, 0.36, 1) forwards',
  'codeBrandSlideRight 720ms cubic-bezier(0.22, 1, 0.36, 1) forwards',
  'codeBrandClipIn 760ms cubic-bezier(0.22, 1, 0.36, 1) forwards',
  'codeBrandSoftReveal 700ms cubic-bezier(0.22, 1, 0.36, 1) forwards',
];

const GIZZI_THOUGHTS = [
  'A:// ready. Keep the diff small and the bragging rights large.',
  'Pick the repo first. I like knowing which branch I am haunting.',
  'Tiny patches, clear receipts, fewer 2 a.m. regrets.',
  'If this turns into a vibes-only refactor, I will start blinking suspiciously.',
  'Preview first. Regret later is not an architecture pattern.',
  'I can smell an unscoped patch from three folders away.',
  'Worktree locked. Sass levels nominal. Proceed carefully.',
  'Show me the files and I will pretend the merge conflict never happened.',
  'I do my best work when the plan is sharper than the caffeine.',
  'A:// means business. Also mild sarcasm. Mostly business.',
] as const;

const GIZZI_AGENT_THOUGHTS = [
  'Agent lane armed. Keep the scope tight and I will keep the branch civilized.',
  'A:// agent sync complete. We can move now, but we still move clean.',
  '{agent} is attached. I am watching for noisy diffs and fake confidence.',
  'Good. An agent is live. Bad patches now have less room to hide.',
  'Agent on means I stop smiling at vague asks and start tracing the delta.',
] as const;

function AnimatedLine({
  animation,
  children,
  delay = 0,
  style,
}: {
  animation: string;
  children: React.ReactNode;
  delay?: number;
  style?: React.CSSProperties;
}) {
  return (
    <div
      style={{
        opacity: 0,
        animation,
        animationDelay: `${delay}ms`,
        ...style,
      }}
    >
      {children}
    </div>
  );
}

export function CodeLaunchBranding({
  workspaceReady,
  attention = null,
  agentModeEnabled = false,
  agentModePulse = 0,
  selectedAgentName = null,
  variant = 'hero',
}: CodeLaunchBrandingProps) {
  const isCompanion = variant === 'companion';
  const greeting = useMemo(() => getNextCodeModeGreeting(getCodeModeGreetingStorage()), []);
  const [showThoughtBubble, setShowThoughtBubble] = useState(false);
  const [thoughtIndex, setThoughtIndex] = useState(() => greeting.index % GIZZI_THOUGHTS.length);
  const [actionAnim, setActionAnim] = useState<string | null>(null);
  const actionTimerRef = useRef<number | null>(null);
  const actionAnimations = useMemo(
    () => ['gizzi-action-salute', 'gizzi-action-jump', 'gizzi-action-spin', 'gizzi-action-wave', 'gizzi-action-flip', 'gizzi-action-computer'],
    [],
  );
  const activeThoughts = useMemo(
    () =>
      agentModeEnabled
        ? GIZZI_AGENT_THOUGHTS.map((line) => line.replace('{agent}', selectedAgentName || 'your agent'))
        : GIZZI_THOUGHTS,
    [agentModeEnabled, selectedAgentName],
  );
  const derivedAttention = attention
    ?? (isCompanion
      ? null
      : agentModeEnabled
        ? {
            state: selectedAgentName ? 'locked-on' : 'startled',
            target: selectedAgentName ? { x: 0.06, y: -0.08 } : { x: 0, y: -0.1 },
          }
        : null);
  const bubbleVisible = showThoughtBubble || Boolean(derivedAttention);
  const activeThought = activeThoughts[thoughtIndex % activeThoughts.length] ?? activeThoughts[0];
  const bubbleTheme = agentModeEnabled
    ? getAgentModeSurfaceTheme('code')
    : getAgentModeSurfaceTheme('chat');
  const mascotEmotion = agentModeEnabled
    ? selectedAgentName
      ? 'proud'
      : 'alert'
    : greeting.emotion;
  const mascotLocomotion: GizziLocomotion | null =
    actionAnim === 'gizzi-action-computer'
      ? { style: 'chat', phase: 'crawl', direction: 'forward' }
      : null;

  useEffect(() => {
    if (agentModePulse === 0) {
      return;
    }

    setThoughtIndex((current) => {
      if (selectedAgentName) {
        const selectedAgentThoughtIndex = activeThoughts.findIndex((line) =>
          line.includes(selectedAgentName),
        );
        if (selectedAgentThoughtIndex >= 0) {
          return selectedAgentThoughtIndex;
        }
      }
      return (current + 1) % activeThoughts.length;
    });
    setShowThoughtBubble(true);

    const nextAction = actionAnimations[agentModePulse % actionAnimations.length];
    setActionAnim(nextAction);
    if (actionTimerRef.current) {
      window.clearTimeout(actionTimerRef.current);
    }
    actionTimerRef.current = window.setTimeout(() => {
      setActionAnim(null);
      actionTimerRef.current = null;
    }, 1000);

    const bubbleTimeoutId = window.setTimeout(() => {
      setShowThoughtBubble(false);
    }, 2400);

    return () => {
      window.clearTimeout(bubbleTimeoutId);
    };
  }, [activeThoughts, agentModeEnabled, agentModePulse, selectedAgentName]);

  useEffect(() => {
    return () => {
      if (actionTimerRef.current) {
        window.clearTimeout(actionTimerRef.current);
      }
    };
  }, []);

  const revealNextThought = () => {
    setThoughtIndex((current) => (current + 1) % activeThoughts.length);
    setShowThoughtBubble(true);
  };

  const isVisible = true;

  return (
    <LazyMotion features={domAnimation}>
      <AnimatePresence>
        {isVisible && (
          <m.div
            initial={{ opacity: 0, scale: 0.7, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.8, y: 10 }}
            transition={{
              type: 'spring',
              stiffness: 260,
              damping: 20,
            }}
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: isCompanion ? 'flex-start' : 'center',
              textAlign: isCompanion ? 'left' : 'center',
            }}
          >
            <style>{brandingAnimationStyles}</style>
            <div
              style={{
                position: 'relative',
                marginTop: isCompanion ? 0 : 10,
                paddingTop: isCompanion ? 0 : 26,
                display: 'flex',
                justifyContent: isCompanion ? 'flex-start' : 'center',
                overflow: 'visible',
              }}
            >
        {bubbleVisible ? (
          <div
            data-testid="gizzi-thought-bubble"
            style={{
              position: 'absolute',
              top: -10,
              left: '50%',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              transform: 'translate(-50%, -100%)',
              pointerEvents: 'none',
              zIndex: 100,
            }}
          >
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'flex-start',
                gap: 6,
                width: 280,
                padding: '10px 12px',
                borderRadius: 18,
                border: `1px solid ${bubbleTheme.edge}`,
                background: 'rgba(14, 17, 20, 0.34)',
                color: 'rgba(236, 236, 236, 0.76)',
                boxShadow: `0 12px 30px ${bubbleTheme.shadow}`,
                backdropFilter: 'blur(14px)',
                WebkitBackdropFilter: 'blur(14px)',
              }}
            >
              <div
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 8,
                  color: 'rgba(236, 236, 236, 0.72)',
                  fontSize: 12,
                  fontWeight: 700,
                  letterSpacing: '0.18em',
                  textTransform: 'uppercase',
                }}
              >
                <span style={{ color: bubbleTheme.accent }}>Gizzi</span>
                <span style={{ opacity: 0.4 }}>/</span>
                <span>A://</span>
              </div>
              <div
                data-testid="gizzi-thought-text"
                style={{
                  fontSize: 12,
                  lineHeight: 1.45,
                  color: 'rgba(236, 236, 236, 0.9)',
                  textAlign: 'left',
                  letterSpacing: '-0.01em',
                  textWrap: 'pretty',
                }}
              >
                {activeThought}
              </div>
            </div>
            <div
              style={{
                position: 'relative',
                width: 40,
                height: 34,
                marginTop: 4,
              }}
            >
              <span
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 18,
                  width: 8,
                  height: 8,
                  borderRadius: '999px',
                  background: bubbleTheme.soft,
                }}
              />
              <span
                style={{
                  position: 'absolute',
                  top: 12,
                  left: 11,
                  width: 5,
                  height: 5,
                  borderRadius: '999px',
                  background: bubbleTheme.edge,
                }}
              />
              <span
                style={{
                  position: 'absolute',
                  top: 24,
                  left: 5,
                  width: 3,
                  height: 3,
                  borderRadius: '999px',
                  background: bubbleTheme.panelTint,
                }}
              />
            </div>
          </div>
        ) : null}

        <div
          data-testid="gizzi-hover-zone"
          onMouseEnter={revealNextThought}
          onMouseLeave={() => setShowThoughtBubble(false)}
          onFocus={revealNextThought}
          onBlur={() => setShowThoughtBubble(false)}
          style={{
            display: 'inline-flex',
            outline: 'none',
            position: 'relative',
            zIndex: 1,
            transformOrigin: 'center bottom',
            animation: actionAnim
              ? `${actionAnim} 1000ms cubic-bezier(0.22, 1, 0.36, 1)`
              : undefined,
          }}
          tabIndex={0}
        >
          <GizziMascot
            size={isCompanion ? 56 : 96}
            emotion={mascotEmotion}
            attention={derivedAttention}
            locomotion={mascotLocomotion}
          />
        </div>
      </div>

      {!isCompanion && (
        <>
          <AnimatedLine
            animation={titleAnimations[greeting.titleAnimation % titleAnimations.length]}
            delay={120}
            style={{
              marginTop: 20,
              maxWidth: 620,
              fontSize: 32,
              lineHeight: 1.08,
              fontWeight: 600,
              letterSpacing: '-0.03em',
              color: 'var(--text-primary)',
              fontFamily: 'var(--font-research)',
            }}
          >
            {greeting.title}
          </AnimatedLine>

          <AnimatedLine
            animation={taglineAnimations[greeting.taglineAnimation % taglineAnimations.length]}
            delay={260}
            style={{
              marginTop: 12,
              maxWidth: 620,
              fontSize: 13,
              lineHeight: 1.6,
              color: 'var(--text-secondary)',
            }}
          >
            {greeting.tagline}
          </AnimatedLine>
        </>
      )}
          </m.div>
        )}
      </AnimatePresence>
    </LazyMotion>
  );
}
