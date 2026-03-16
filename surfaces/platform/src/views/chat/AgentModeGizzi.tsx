import React, { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  GizziMascot,
  type GizziAttention,
  type GizziEmotion,
  type GizziLocomotion,
} from '@/components/ai-elements/GizziMascot';
import type { AgentModeSurface } from '@/stores/agent-surface-mode.store';

interface AgentModeGizziTheme {
  accent: string;
  glow: string;
  soft: string;
}

interface AgentModeGizziProps {
  active: boolean;
  pulse: number;
  surface: AgentModeSurface;
  selectedAgentName?: string | null;
  theme: AgentModeGizziTheme;
  hasActionPills?: boolean;
}

type AnimationState =
  | 'off-screen'
  | 'peeking'           // At edge, looking left/right
  | 'skimming-in'       // Linear motion to bar
  | 'landing'           // Landing on bar with bounce
  | 'on-bar'            // On bar, can skim full width
  | 'skimming-out'      // Linear motion to edge
  | 'tumbling-out'      // Jumping and falling
  | 'the-peek'          // Entry: polished peek animation
  | 'pacman-trail'      // Entry: Gizzi consuming trail of tokens (was quantum-leap)
  | 'the-drop'          // Entry: drops from top with AI/circuit trail
  // ENTRY ANIMATIONS (nostalgic video game style):
  | 'pipe-entry'        // Entry: rises from below through pipe (Gizzi behind pipe initially)
  | 'power-up'          // Entry: pops up with GPU chip on back
  | 'one-up'            // Entry: token refresh with progress bar
  | 'checkpoint'        // Entry: pulse/glow with save progress bar
  | 'warp-star'         // Entry: rainbow flash teleport with 12 sparkles
  // EXIT ANIMATIONS (nostalgic video game style):
  | 'to-the-cloud'      // Exit: fly up with data packets to cloud
  | 'wheel-out'         // Exit: spin out with dust cloud and longer screech marks
  | 'out-of-tokens'     // Exit: TOKENS DEPLETED text center, funny message
  | 'buffer-overflow'   // Exit: binary code rain (Matrix style)
  | 'context-scatter'   // Exit: 20 tokens with sparkle on impact
  | 'fan-spin'          // Exit: overheating CPU fan with smoke (was processing)
  | 'system-crash'      // Exit: BSOD style blue screen
  | 'collapse';         // Exit: TV turn-off pixel collapse (was duck-cover)

const SURFACE_CONFIG: Record<AgentModeSurface, {
  entrySide: 'left' | 'right';
  mascotSize: number;
  baseEmotion: GizziEmotion;
  selectedEmotion: GizziEmotion;
  peekEmotion: GizziEmotion;
}> = {
  chat: {
    entrySide: 'left',
    mascotSize: 78,
    baseEmotion: 'curious',
    selectedEmotion: 'pleased',
    peekEmotion: 'mischief',
  },
  cowork: {
    entrySide: 'right',
    mascotSize: 74,
    baseEmotion: 'focused',
    selectedEmotion: 'proud',
    peekEmotion: 'mischief',
  },
  code: {
    entrySide: 'left',
    mascotSize: 68,
    baseEmotion: 'alert',
    selectedEmotion: 'focused',
    peekEmotion: 'mischief',
  },
  browser: {
    entrySide: 'right',
    mascotSize: 68,
    baseEmotion: 'curious',
    selectedEmotion: 'focused',
    peekEmotion: 'mischief',
  },
};

const SURFACE_THOUGHTS: Record<AgentModeSurface, string[]> = {
  chat: [
    'Agent on. Keep the ask sharp and I will keep the drift under control.',
    'I like warm prompts, clear intent, and fewer plot twists.',
    'Conversation mode is easy. Making it useful is the fun part.',
    '{agent} is on deck. I will keep the room from wandering off topic.',
    'If this gets vague, I start making suspicious little faces.',
    'I can ride the chat rail all day if the outcome is worth it.',
  ],
  cowork: [
    'Cowork mode means we move with the task, not around it.',
    'Hand-offs clean. Context tighter. That is the whole pitch.',
    '{agent} is active. I am watching the blockers before they watch us.',
    'Progress first. Posturing later.',
    'If the workflow stalls, I start side-eyeing the bottleneck.',
    'This rail is for momentum, receipts, and less thrashing.',
  ],
  code: [
    'Agent on. Keep the delta scoped and the excuses shorter.',
    'I perched here so the patch does not sprint past the plan.',
    '{agent} is wired in. Branches first, heroics later.',
    'If the diff gets noisy, I tap the rail until it behaves.',
    'Small patches. Clear rollback. Better sleep.',
    'This is the part where tests stop being optional mythology.',
  ],
  browser: [
    'Agent on. Tabs behave better when I am watching the lane.',
    'I like browser work that leaves a trail and not a mystery.',
    '{agent} is active. I will keep the clicks honest.',
    'If a flow loops, I start getting very judgmental.',
    'We can automate this. We just should not automate confusion.',
    'I am here for deliberate clicks, not digital wandering.',
  ],
};

function resolveThoughts(surface: AgentModeSurface, selectedAgentName?: string | null) {
  const fallbackAgent = selectedAgentName || 'your agent';
  return SURFACE_THOUGHTS[surface].map((line) => line.replace('{agent}', fallbackAgent));
}

export function AgentModeGizzi({
  active,
  pulse,
  surface,
  selectedAgentName,
  theme,
  hasActionPills = false,
}: AgentModeGizziProps) {
  const config = SURFACE_CONFIG[surface];
  // Always start off-screen; the useEffect will trigger the entry animation
  const [animState, setAnimState] = useState<AnimationState>('off-screen');
  // Generate unique key on mount to force framer-motion remount with fresh initial position
  const [uniqueKey, setUniqueKey] = useState(() => `${surface}-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`);
  const [isHovered, setIsHovered] = useState(false);
  const [isBubblePinned, setIsBubblePinned] = useState(false);
  const [peekDirection, setPeekDirection] = useState<'left' | 'right'>('left');
  
  // Randomly selected animations for variety - change each time active toggles

  
  // Use ref for immediate position tracking (no React lag)
  const barPositionRef = useRef(0);
  const [barPosition, setBarPosition] = useState(0);

  
  // Track movement for leg animation
  const isMovingRef = useRef(false);
  const moveTimeoutRef = useRef<number | null>(null);
  const lastMouseXRef = useRef<number | null>(null);
  
  const containerRef = useRef<HTMLDivElement>(null);
  const prevActiveRef = useRef(active);
  const prevSurfaceRef = useRef(surface);
  const didInitRef = useRef(false);
  // Separate ref for tracking surface in the surface-change effect
  const entryTimerRef = useRef<number | null>(null);
  const exitTimerRef = useRef<number | null>(null);
  const peekTimerRef = useRef<number | null>(null);
  const fastToggleRef = useRef<number>(0);
  
  // Track if we're in a fast toggle sequence
  const isFastToggleSequence = useRef(false);

  const thoughts = useMemo(
    () => resolveThoughts(surface, selectedAgentName),
    [selectedAgentName, surface]
  );
  const [thoughtIndex, setThoughtIndex] = useState(() => pulse % thoughts.length);

  const activeThought = thoughts[thoughtIndex] ?? thoughts[0];
  const bubbleVisible = isHovered || isBubblePinned;

  // Determine emotion based on state
  const emotion: GizziEmotion = useMemo(() => {
    if (animState === 'peeking') return config.peekEmotion;
    if (animState === 'tumbling-out') return 'alert';
    if (animState === 'collapse') return 'alert';
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
      return {
        state: 'startled',
        target: { x: 0, y: 0.5 }
      };
    }
    if (selectedAgentName) return { state: 'tracking', target: { x: 0.04, y: -0.06 } };
    return null;
  }, [animState, peekDirection, selectedAgentName]);

  // Get locomotion phase - legs move when mascot is actively moving or hovered
  const locomotionPhase: GizziLocomotion['phase'] = useMemo(() => {
    if (animState === 'skimming-in') return 'crawl';
    if (animState === 'skimming-out') return 'crawl';
    if (animState === 'landing') return 'walk-in';
    if (animState === 'tumbling-out') return 'walk-out';
    // When hovered: legs move (excited wiggle)
    if (animState === 'on-bar' && isHovered) return 'crawl';
    // When not hovered: legs only move if actively being dragged/moved
    if (animState === 'on-bar' && isMovingRef.current) return 'crawl';
    return 'idle';
  }, [animState, isHovered]);

  const locomotionDirection: GizziLocomotion['direction'] = useMemo(() => {
    if (animState === 'skimming-in') return config.entrySide === 'left' ? 'forward' : 'reverse';
    if (animState === 'skimming-out') return config.entrySide === 'left' ? 'reverse' : 'forward';
    if (animState === 'on-bar') {
      // Direction based on position - positive = forward (right), negative = reverse (left)
      return barPosition >= 0 ? 'forward' : 'reverse';
    }
    return 'forward';
  }, [animState, config.entrySide, barPosition]);

  // Clear all timers
  const clearAllTimers = useCallback(() => {
    if (entryTimerRef.current) window.clearTimeout(entryTimerRef.current);
    if (exitTimerRef.current) window.clearTimeout(exitTimerRef.current);
    if (peekTimerRef.current) window.clearTimeout(peekTimerRef.current);
    if (moveTimeoutRef.current) window.clearTimeout(moveTimeoutRef.current);
    entryTimerRef.current = null;
    exitTimerRef.current = null;
    peekTimerRef.current = null;
    moveTimeoutRef.current = null;
  }, []);

  // Update position immediately for 1:1 tracking (no lag)
  const updatePositionImmediate = useCallback((clientX: number) => {
    if (!containerRef.current) return;
    
    const rect = containerRef.current.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const halfWidth = rect.width / 2;
    const normalized = Math.max(-1, Math.min(1, (clientX - centerX) / halfWidth));
    
    // Update ref immediately
    barPositionRef.current = normalized;
    
    // Update React state for locomotion
    setBarPosition(normalized);
    
    // Mark as moving for leg animation
    isMovingRef.current = true;
    if (moveTimeoutRef.current) window.clearTimeout(moveTimeoutRef.current);
    moveTimeoutRef.current = window.setTimeout(() => {
      isMovingRef.current = false;
    }, 150);
  }, []);

  // Handle entry/exit sequence with improved fast toggle handling
  useEffect(() => {
    const wasActive = prevActiveRef.current;
    const wasSurface = prevSurfaceRef.current;
    prevActiveRef.current = active;
    prevSurfaceRef.current = surface;

    // Initial mount with active=true: trigger entry animation from off-screen
    // This ensures mascot animates in rather than appearing instantly
    if (active && animState === 'off-screen' && !didInitRef.current) {
      didInitRef.current = true;
      clearAllTimers();
      isFastToggleSequence.current = false;
      setAnimState('peeking');
      setBarPosition(0);
      barPositionRef.current = 0;

      // Peeking phase with direction changes
      let peekCount = 0;
      const doPeek = () => {
        setPeekDirection(peekCount % 2 === 0 ? 'left' : 'right');
        peekCount++;
        if (peekCount < 4) {
          peekTimerRef.current = window.setTimeout(doPeek, 500);
        }
      };
      doPeek();

      // Entry sequence: peeking (2s) → skimming-in (2s) → on-bar
      entryTimerRef.current = window.setTimeout(() => {
        setAnimState('skimming-in');

        entryTimerRef.current = window.setTimeout(() => {
          setAnimState('on-bar');
        }, 2000);
      }, 2000);
      return;
    }

    // Handle surface change while agent mode is active
    if (active && wasSurface !== surface && wasActive) {
      // Mode switch: peeking (1s) → skimming-in (1s) → on-bar
      clearAllTimers();
      isFastToggleSequence.current = false;
      setAnimState('peeking');
      setBarPosition(0);
      barPositionRef.current = 0;

      // Peeking phase with direction changes
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

    if (!wasActive && active) {
      // Turning ON
      clearAllTimers();
      
      // Record toggle time for fast toggle detection
      const now = Date.now();
      const timeSinceLastToggle = now - fastToggleRef.current;
      fastToggleRef.current = now;
      
      // Fast re-entry: if we just turned off (< 800ms ago), skip to on-bar
      if (timeSinceLastToggle < 800 && (animState === 'collapse' || animState === 'off-screen')) {
        isFastToggleSequence.current = true;
        setAnimState('on-bar');
        setBarPosition(0);
        barPositionRef.current = 0;
        // Clear fast toggle flag after a moment
        entryTimerRef.current = window.setTimeout(() => {
          isFastToggleSequence.current = false;
        }, 500);
      } else {
        // Normal entry - randomly choose between animations
        isFastToggleSequence.current = false;
        setBarPosition(0);
        barPositionRef.current = 0;

        // Randomly choose entry: 8 options (12.5% each)
        const rand = Math.random();
        const entryAnim = Math.floor(rand * 8); // 0-7

        switch (entryAnim) {
          case 0:
            // PACMAN TRAIL entry - Gizzi consuming tokens
            setAnimState('pacman-trail');
            entryTimerRef.current = window.setTimeout(() => setAnimState('on-bar'), 2000);
            break;
          case 1:
            // THE DROP entry - falls from top with AI/circuit trail
            setAnimState('the-drop');
            entryTimerRef.current = window.setTimeout(() => setAnimState('on-bar'), 2200);
            break;
          case 2:
            // PIPE ENTRY - Gizzi rises through pipe
            setAnimState('pipe-entry');
            entryTimerRef.current = window.setTimeout(() => setAnimState('on-bar'), 2500);
            break;
          case 3:
            // POWER-UP - pops up with GPU chip
            setAnimState('power-up');
            entryTimerRef.current = window.setTimeout(() => setAnimState('on-bar'), 2000);
            break;
          case 4:
            // 1-UP - Token refresh with progress bar
            setAnimState('one-up');
            entryTimerRef.current = window.setTimeout(() => setAnimState('on-bar'), 2500);
            break;
          case 5:
            // CHECKPOINT - with save progress bar
            setAnimState('checkpoint');
            entryTimerRef.current = window.setTimeout(() => setAnimState('on-bar'), 2000);
            break;
          case 6:
            // WARP STAR - rainbow teleport with 12 sparkles
            setAnimState('warp-star');
            entryTimerRef.current = window.setTimeout(() => setAnimState('on-bar'), 1800);
            break;
          default:
            // THE PEEK - polished peek entry with larger eyes
            setAnimState('the-peek');
            entryTimerRef.current = window.setTimeout(() => setAnimState('on-bar'), 800);
            break;
        }
      }

      // Show thought bubble on entry
      setThoughtIndex((current) => (current + 1) % thoughts.length);
      setIsBubblePinned(true);
      const bubbleTimer = window.setTimeout(() => setIsBubblePinned(false), 3500);
      return () => {
        clearAllTimers();
        window.clearTimeout(bubbleTimer);
      };
    }

    if (wasActive && !active) {
      // Turning OFF - randomly pick an exit animation (8 options, 12.5% each)
      clearAllTimers();

      isFastToggleSequence.current = true;
      
      const exitAnim = Math.floor(Math.random() * 8); // 0-7
      
      switch (exitAnim) {
        case 0:
          // TO THE CLOUD - data packets floating to cloud
          setAnimState('to-the-cloud');
          exitTimerRef.current = window.setTimeout(() => {
            setAnimState('off-screen');
            isFastToggleSequence.current = false;
          }, 2500);
          break;
        case 1:
          // WHEEL OUT - dust cloud and longer screech marks
          setAnimState('wheel-out');
          exitTimerRef.current = window.setTimeout(() => {
            setAnimState('off-screen');
            isFastToggleSequence.current = false;
          }, 2000);
          break;
        case 2:
          // OUT OF TOKENS - TOKENS DEPLETED text centered with funny message
          setAnimState('out-of-tokens');
          exitTimerRef.current = window.setTimeout(() => {
            setAnimState('off-screen');
            isFastToggleSequence.current = false;
          }, 2000);
          break;
        case 3:
          // BUFFER OVERFLOW - binary code rain (Matrix style)
          setAnimState('buffer-overflow');
          exitTimerRef.current = window.setTimeout(() => {
            setAnimState('off-screen');
            isFastToggleSequence.current = false;
          }, 2000);
          break;
        case 4:
          // CONTEXT SCATTER - 20 tokens with sparkle impact
          setAnimState('context-scatter');
          exitTimerRef.current = window.setTimeout(() => {
            setAnimState('off-screen');
            isFastToggleSequence.current = false;
          }, 2000);
          break;
        case 5:
          // FAN SPIN - overheating CPU fan with smoke
          setAnimState('fan-spin');
          exitTimerRef.current = window.setTimeout(() => {
            setAnimState('off-screen');
            isFastToggleSequence.current = false;
          }, 2000);
          break;
        case 6:
          // SYSTEM CRASH - BSOD style
          setAnimState('system-crash');
          exitTimerRef.current = window.setTimeout(() => {
            setAnimState('off-screen');
            isFastToggleSequence.current = false;
          }, 2500);
          break;
        default:
          // COLLAPSE - TV turn-off pixel effect
          setAnimState('collapse');
          exitTimerRef.current = window.setTimeout(() => {
            setAnimState('off-screen');
            isFastToggleSequence.current = false;
          }, 1500);
          break;
      }
    }

    return clearAllTimers;
  }, [active, surface]);

  // Handle surface change while agent mode stays active (e.g. user switches chat → cowork with agent on)
  // This must be a separate effect from the [active] effect, because surface can change
  // independently of active, and the [active] effect won't re-run in that case.
  // Note: Mode switch with agent ON is now handled by the [active, surface] effect above

  // Handle pulse updates (new thought bubble)
  useEffect(() => {
    if (!active) return;
    setThoughtIndex(pulse % thoughts.length);
    setIsBubblePinned(true);
    const t = window.setTimeout(() => setIsBubblePinned(false), 2600);
    return () => window.clearTimeout(t);
  }, [active, pulse, thoughts.length]);

  // Handle mouse movement - 1:1 direct tracking
  const handleMouseMove = useCallback((event: React.MouseEvent) => {
    if (animState !== 'on-bar') return;
    updatePositionImmediate(event.clientX);
  }, [animState, updatePositionImmediate]);

  // Framer motion position per state
  const side = config.entrySide === 'left' ? -1 : 1;
  // Position mascot so it sits cleanly ON TOP of the bar edge
  const mascotBottom = hasActionPills ? -4 : -8; // negative = below the container edge, sitting on bar

  const getMotionProps = () => {
    switch (animState) {
      case 'off-screen':
        return { x: side * 500, y: 0, rotate: 0, scale: 0.8, opacity: 0 };

      case 'peeking':
        return {
          x: side * 140,
          y: -10,
          rotate: side * (peekDirection === 'left' ? -10 : 10),
          scale: 0.95,
          opacity: 1,
        };

      case 'skimming-in':
        return {
          x: side * 30,
          y: 0,
          rotate: side * 2,
          scale: 1,
          opacity: 1,
        };

      case 'landing':
        return { x: 0, y: 0, rotate: 0, scale: 1.05, opacity: 1 };

      case 'on-bar':
        return {
          x: barPosition * 260,
          y: 0,
          rotate: barPosition * 3,
          scale: 1,
          opacity: 1,
        };

      case 'skimming-out':
        return {
          x: side * 80,
          y: 0,
          rotate: side * 4,
          scale: 0.95,
          opacity: 1,
        };

      case 'tumbling-out':
        return {
          x: side * 250,
          y: 80,
          rotate: side * 55,
          scale: 0.6,
          opacity: 0,
        };

      case 'the-peek':
        // THE PEEK - Polished peek entry with larger 24px eyes
        return {
          x: side * 100,
          y: -15,
          rotate: side * (peekDirection === 'left' ? -15 : 15),
          scale: 0.95,
          opacity: 1,
        };

      case 'pacman-trail':
        // PACMAN TRAIL - Gizzi moving RIGHT eating horizontal tokens
        return {
          x: 0,
          y: 0,
          rotate: 0,
          scale: 1,
          opacity: 1,
        };

      case 'the-drop':
        // THE DROP - Falls from top with AI/circuit trail
        return {
          x: 0,
          y: 0,
          rotate: 720,
          scale: 1,
          opacity: 1,
        };

      case 'wheel-out':
        // WHEEL OUT - Spin out with tire marks and realistic smoke
        return {
          x: side * 300,
          y: 100,
          rotate: side * 1080,
          scale: 0.6,
          opacity: 0,
        };

      // ========== NEW ENTRY ANIMATIONS (NOSTALGIC VIDEO GAME STYLE) ==========

      case 'pipe-entry':
        // PIPE ENTRY - Gizzi rises UP from inside stationary pipe, then moves to center
        // Phase 1: Rises up from inside pipe (handled by initial position)
        // Phase 2: Moves horizontally to center position on bar
        return {
          x: 0, // Move to center
          y: 0,
          rotate: 0,
          scale: 1,
          opacity: 1,
        };

      case 'power-up':
        // POWER-UP - Pops up with GPU chip on back
        return {
          x: 0,
          y: 0,
          rotate: 0,
          scale: 1,
          opacity: 1,
        };

      case 'one-up':
        // 1-UP - Token refresh with progress bar
        return {
          x: 0,
          y: 0,
          rotate: 0,
          scale: 1,
          opacity: 1,
        };

      case 'checkpoint':
        // CHECKPOINT - Save progress bar
        return {
          x: 0,
          y: 0,
          rotate: 0,
          scale: 1,
          opacity: 1,
        };

      case 'warp-star':
        // WARP STAR - Star stays stationary, Gizzi spins into it
        return {
          x: 0,
          y: 0,
          rotate: 720, // Gizzi spins as it enters
          scale: 1,
          opacity: 1,
        };

      // ========== NEW EXIT ANIMATIONS (NOSTALGIC VIDEO GAME STYLE) ==========

      case 'to-the-cloud':
        // TO THE CLOUD - Data packets floating to cloud
        return {
          x: barPositionRef.current * 40,
          y: -150,
          rotate: 0,
          scale: 0.6,
          opacity: 0,
        };

      case 'out-of-tokens':
        // OUT OF TOKENS - TOKENS DEPLETED centered, funny message
        return {
          x: 0,
          y: 250,
          rotate: 180,
          scale: 1,
          opacity: 1,
        };

      case 'buffer-overflow':
        // BUFFER OVERFLOW - Binary code rain
        return {
          x: 0,
          y: 0,
          rotate: 0,
          scale: 1,
          opacity: 0,
        };

      case 'context-scatter':
        // CONTEXT SCATTER - 20 tokens with sparkle
        return {
          x: side * 150,
          y: -80,
          rotate: side * 720,
          scale: 0.5,
          opacity: 0,
        };

      case 'fan-spin':
        // FAN SPIN - Overheating CPU fan
        return {
          x: 0,
          y: 0,
          rotate: 0,
          scale: 0.3,
          opacity: 0,
        };

      case 'system-crash':
        // SYSTEM CRASH - BSOD style
        return {
          x: 0,
          y: 0,
          rotate: 0,
          scale: 1,
          opacity: 0,
        };

      case 'collapse':
        // COLLAPSE - TV turn-off pixel effect
        return {
          x: barPositionRef.current * 60,
          y: 70,
          rotate: side * 8,
          scale: 0.01,
          opacity: 0,
        };

      default:
        return { x: 0, y: 0, rotate: 0, scale: 1, opacity: 1 };
    }
  };

  const motionProps = getMotionProps();

  // Initial position depends on entry animation type
  const initialProps = (() => {
    if (animState === 'pacman-trail') {
      // Pacman trail: starts at left, moves RIGHT eating horizontal tokens
      return { opacity: 0, x: -200, y: 0, rotate: 0, scale: 0.8 };
    }
    if (animState === 'the-drop') {
      // The drop: starts at top of page, above viewport
      return { opacity: 1, x: 0, y: -600, rotate: 0, scale: 1 };
    }
    if (animState === 'the-peek') {
      // The peek: starts off-screen at edge
      return { opacity: 1, x: side * 500, y: 0, rotate: 0, scale: 0.8 };
    }
    // NEW ENTRY INITIAL POSITIONS:
    if (animState === 'pipe-entry') {
      // Pipe entry: starts completely hidden INSIDE the pipe (below the rim)
      return { opacity: 1, x: 0, y: 60, rotate: 0, scale: 0.9 };
    }
    if (animState === 'power-up') {
      // Power-up: starts small below, pops up
      return { opacity: 0, x: 0, y: 40, rotate: 0, scale: 0.2 };
    }
    if (animState === 'one-up') {
      // 1-up: starts invisible, flashes in
      return { opacity: 0, x: 0, y: 0, rotate: 0, scale: 2 };
    }
    if (animState === 'checkpoint') {
      // Checkpoint: starts as glow dot
      return { opacity: 0, x: 0, y: 0, rotate: 0, scale: 0.1 };
    }
    if (animState === 'warp-star') {
      // Warp star: Gizzi starts small and spins into stationary star
      return { opacity: 0, x: 0, y: 0, rotate: -360, scale: 0.3 };
    }
    // Default (peeking): starts off-screen
    return { opacity: 0, x: side * 500, y: 0, rotate: 0, scale: 0.8 };
  })();

  // Transition duration per state - coordinated with leg animations
  const duration =
    animState === 'skimming-in'    ? 2.0 :
    animState === 'skimming-out'   ? 1.5 :
    animState === 'tumbling-out'   ? 2.0 :
    animState === 'peeking'        ? 0.5 :
    animState === 'landing'        ? 0.4 :
    animState === 'collapse'       ? 1.5 :
    animState === 'to-the-cloud'   ? 2.5 :
    animState === 'pacman-trail'   ? 2.0 :
    animState === 'the-drop'       ? 2.2 :
    animState === 'the-peek'       ? 0.8 :
    animState === 'wheel-out'      ? 2.0 :
    animState === 'pipe-entry'     ? 1.5 :
    animState === 'power-up'       ? 2.0 :
    animState === 'one-up'         ? 2.5 :
    animState === 'checkpoint'     ? 2.0 :
    animState === 'warp-star'      ? 1.8 :
    animState === 'out-of-tokens'  ? 2.0 :
    animState === 'buffer-overflow' ? 2.0 :
    animState === 'context-scatter' ? 2.0 :
    animState === 'fan-spin'       ? 2.0 :
    animState === 'system-crash'   ? 2.5 :
    animState === 'on-bar'         ? 0.05 :
    0.4;

  const isVisible = animState !== 'off-screen';
  const isBehindBar = animState === 'collapse' || animState === 'pipe-entry';
  const isInPipe = animState === 'pipe-entry';

  return (
    <div
      ref={containerRef}
      data-testid="agent-mode-gizzi-container"
      style={{
        position: 'absolute',
        bottom: '100%',
        left: 0,
        right: 0,
        height: 120, // Extended height for better mouse tracking
        overflow: 'visible',
        zIndex: isBehindBar ? 1 : 10, // Lower z-index so dropdowns appear above (dropdowns typically z-50+)
        pointerEvents: 'none',
      }}
      onMouseMove={handleMouseMove}
      onMouseEnter={() => animState === 'on-bar' && setIsHovered(true)}
      onMouseLeave={() => {
        setIsHovered(false);
        // Immediately stop leg movement when hover ends
        isMovingRef.current = false;
        if (moveTimeoutRef.current) {
          window.clearTimeout(moveTimeoutRef.current);
          moveTimeoutRef.current = null;
        }
        // Return Gizzi to center (home) position
        barPositionRef.current = 0;
        setBarPosition(0);
      }}
    >
      <AnimatePresence>
        {isVisible && (
          <motion.div

            key={uniqueKey}
            data-testid="agent-mode-gizzi"
            data-surface={surface}
            data-state={animState}
            data-emotion={emotion}
            initial={initialProps}
            animate={{
              x: motionProps.x,
              y: motionProps.y,
              rotate: motionProps.rotate,
              scale: motionProps.scale,
              opacity: motionProps.opacity,
            }}
            exit={{
              opacity: 0,
              transition: { duration: 0 },
            }}
            transition={{
              ...(animState === 'on-bar' 
                ? { 
                    // Use spring physics for smooth return to center when on-bar
                    type: 'spring',
                    stiffness: 80,
                    damping: 12,
                    mass: 0.8,
                  }
                : {
                    type: 'tween',
                    duration,
                  }
              ),
              ease: (() => {
                // EXIT ANIMATIONS:
                if (animState === 'collapse') return [0.4, 0, 0.6, 1];
                if (animState === 'to-the-cloud') return [0.25, 0.1, 0.25, 1];
                if (animState === 'wheel-out') return [0.3, 0, 0.7, 1.2];
                if (animState === 'out-of-tokens') return [0.2, 0.5, 0.8, 1];
                if (animState === 'buffer-overflow') return [0.4, 0, 0.6, 1];
                if (animState === 'context-scatter') return [0.3, 0, 0.5, 1.2];
                if (animState === 'fan-spin') return [0.6, 0, 0.8, 1];
                if (animState === 'system-crash') return [0.4, 0, 1, 1];
                
                // ENTRY ANIMATIONS:
                if (animState === 'pacman-trail') return [0.175, 0.885, 0.32, 1.275];
                if (animState === 'the-drop') return [0.5, 0, 0.2, 1.4];
                if (animState === 'the-peek') return [0.34, 1.56, 0.64, 1];
                // NEW ENTRY EASINGS:
                if (animState === 'pipe-entry') return [0.4, 0, 0.2, 1]; // smooth pipe slide
                if (animState === 'power-up') return [0.34, 1.56, 0.64, 1]; // mushroom bounce
                if (animState === 'one-up') return [0.68, -0.55, 0.265, 1.55]; // elastic flash
                if (animState === 'checkpoint') return [0.4, 0, 0.2, 1]; // glow expand
                if (animState === 'warp-star') return [0.175, 0.885, 0.32, 1.275]; // warp bounce
                if (animState === 'landing') return [0.34, 1.56, 0.64, 1];
                
                return 'easeInOut';
              })(),
            }}
            style={{
              position: 'absolute',
              bottom: mascotBottom,
              left: '50%',
              marginLeft: -(config.mascotSize / 2),
              zIndex: isInPipe ? 2 : (isBehindBar ? 1 : 8), // Gizzi behind dropdowns (z-50+) but above composer bar
              // pointer events on when on-bar or landing - mascot is interactive!
              pointerEvents: animState === 'on-bar' || animState === 'landing' ? 'auto' : 'none',
              willChange: animState === 'on-bar' ? 'transform' : undefined,
            }}
          >
            {/* Thought Bubble */}
            <AnimatePresence>
              {bubbleVisible && (animState === 'on-bar' || animState === 'peeking' || animState === 'skimming-in') && (
                <motion.div
                  key={`bubble-${thoughtIndex}`}
                  initial={{ opacity: 0, y: 8, scale: 0.94 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 6, scale: 0.96 }}
                  transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
                  style={{
                    position: 'absolute',
                    bottom: '100%',
                    left: '50%',
                    transform: 'translateX(-50%)',
                    marginBottom: 8,
                    pointerEvents: 'none',
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'flex-start',
                      gap: 6,
                      width: 236,
                      padding: '10px 12px',
                      borderRadius: 18,
                      border: `1px solid ${theme.soft}`,
                      background: 'rgba(14, 17, 20, 0.82)',
                      boxShadow: `0 14px 32px ${theme.glow}`,
                      backdropFilter: 'blur(12px)',
                    }}
                  >
                    <div
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 8,
                        color: 'rgba(236,236,236,0.72)',
                        fontSize: 10,
                        fontWeight: 700,
                        letterSpacing: '0.18em',
                        textTransform: 'uppercase',
                      }}
                    >
                      <span style={{ color: theme.accent }}>Gizzi</span>
                      <span style={{ opacity: 0.4 }}>/</span>
                      <span>A:// agent</span>
                    </div>
                    <div
                      data-testid="agent-mode-gizzi-thought"
                      style={{
                        fontSize: 12,
                        lineHeight: 1.45,
                        color: 'rgba(236,236,236,0.9)',
                        textAlign: 'left',
                        letterSpacing: '-0.01em',
                      }}
                    >
                      {activeThought}
                    </div>
                  </div>
                  {/* Bubble tail */}
                  <div
                    style={{
                      position: 'relative',
                      width: 34,
                      height: 28,
                      margin: '4px auto 0',
                    }}
                  >
                    <span style={{ position: 'absolute', top: 0, left: 14, width: 8, height: 8, borderRadius: '999px', background: theme.soft }} />
                    <span style={{ position: 'absolute', top: 10, left: 8, width: 5, height: 5, borderRadius: '999px', background: theme.soft, opacity: 0.78 }} />
                    <span style={{ position: 'absolute', top: 20, left: 3, width: 3, height: 3, borderRadius: '999px', background: theme.soft, opacity: 0.58 }} />
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* ============================================
                ENTRY ANIMATION VISUAL EFFECTS
            ============================================ */}

            {/* PIPE ENTRY - Stationary Mario pipe, Gizzi rises from inside */}
            {animState === 'pipe-entry' && (
              <>
                {/* Pipe body - stationary, extends down behind chat bar */}
                <div
                  style={{
                    position: 'absolute',
                    bottom: -80, // Extends down behind the bar
                    left: '50%',
                    transform: 'translateX(-50%)',
                    width: 70,
                    height: 100, // Tall pipe body
                    background: 'linear-gradient(90deg, #1a5c1a 0%, #2d7a2d 20%, #4ade80 40%, #86efac 50%, #4ade80 60%, #2d7a2d 80%, #1a5c1a 100%)',
                    borderRadius: '4px 4px 0 0',
                    boxShadow: `inset -6px 0 12px rgba(0,0,0,0.4), inset 6px 0 12px rgba(255,255,255,0.3)`,
                    pointerEvents: 'none',
                    zIndex: 2, // Behind chat input bar
                  }}
                />
                {/* Pipe rim - only top 20-30px protrudes from behind bar */}
                <div
                  style={{
                    position: 'absolute',
                    bottom: 15, // Just above the bar (only rim visible)
                    left: '50%',
                    transform: 'translateX(-50%)',
                    width: 85,
                    height: 20,
                    background: 'linear-gradient(90deg, #0f3d0f 0%, #1f5c1f 20%, #3ddc84 40%, #86efac 50%, #3ddc84 60%, #1f5c1f 80%, #0f3d0f 100%)',
                    borderRadius: '10px',
                    boxShadow: '0 3px 12px rgba(0,0,0,0.5), inset 0 2px 4px rgba(255,255,255,0.3)',
                    zIndex: 9, // Just above bar but below Gizzi when he pops out
                  }}
                />
                {/* Pipe inner darkness (shows depth) */}
                <div
                  style={{
                    position: 'absolute',
                    bottom: 28,
                    left: '50%',
                    transform: 'translateX(-50%)',
                    width: 55,
                    height: 8,
                    background: 'radial-gradient(ellipse, rgba(0,0,0,0.8) 0%, rgba(0,0,0,0.4) 50%, transparent 100%)',
                    borderRadius: '50%',
                    zIndex: 8,
                  }}
                />
              </>
            )}

            {/* POWER-UP - NVIDIA RTX 4090 Founders Edition style GPU */}
            {animState === 'power-up' && (
              <>
                {/* RTX 4090 GPU on Gizzi's back */}
                <motion.div
                  initial={{ opacity: 0, scale: 0, y: 20 }}
                  animate={{ opacity: 1, scale: 1, y: -55 }}
                  transition={{ duration: 0.6, delay: 0.3, ease: [0.34, 1.56, 0.64, 1] }}
                  style={{
                    position: 'absolute',
                    bottom: '50%',
                    left: '50%',
                    transform: 'translateX(-50%)',
                    width: 100,
                    height: 45,
                    zIndex: 40,
                    pointerEvents: 'none',
                  }}
                >
                  {/* GPU Blower-style casing - Black/silver like RTX 4090 Founders Edition */}
                  <div
                    style={{
                      width: '100%',
                      height: '100%',
                      background: 'linear-gradient(135deg, #1a1a1a 0%, #2d2d2d 20%, #1f1f1f 50%, #151515 100%)',
                      borderRadius: 6,
                      border: '2px solid #3a3a3a',
                      boxShadow: `0 0 30px rgba(0,0,0,0.8), inset 0 0 20px rgba(255,255,255,0.05)`,
                      position: 'relative',
                      overflow: 'hidden',
                    }}
                  >
                    {/* Metallic silver accent stripe (Founders Edition style) */}
                    <div style={{
                      position: 'absolute',
                      top: '15%',
                      left: 0,
                      right: 0,
                      height: '25%',
                      background: 'linear-gradient(90deg, transparent 0%, rgba(192,192,192,0.3) 20%, rgba(220,220,220,0.4) 50%, rgba(192,192,192,0.3) 80%, transparent 100%)',
                    }} />
                    
                    {/* Heatsink fins visible on side */}
                    <div style={{
                      position: 'absolute',
                      right: 8,
                      top: '20%',
                      width: 25,
                      height: '60%',
                      background: 'repeating-linear-gradient(0deg, #0a0a0a 0px, #0a0a0a 2px, #1a1a1a 2px, #1a1a1a 4px)',
                      borderRadius: 2,
                      opacity: 0.8,
                    }} />
                    
                    {/* NVIDIA Logo */}
                    <div style={{
                      position: 'absolute',
                      top: '50%',
                      left: 12,
                      transform: 'translateY(-50%)',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 4,
                    }}>
                      {/* NVIDIA eye logo */}
                      <div style={{
                        width: 16,
                        height: 12,
                        background: '#76b900',
                        borderRadius: '0 50% 50% 0',
                        position: 'relative',
                      }}>
                        <div style={{
                          position: 'absolute',
                          left: -2,
                          top: '50%',
                          transform: 'translateY(-50%)',
                          width: 6,
                          height: 6,
                          background: '#76b900',
                          borderRadius: '50%',
                        }} />
                      </div>
                    </div>
                    
                    {/* RTX 4090 Text */}
                    <div style={{
                      position: 'absolute',
                      top: '50%',
                      left: '50%',
                      transform: 'translate(-50%, -50%)',
                      fontSize: 10,
                      fontWeight: 900,
                      color: '#e0e0e0',
                      fontFamily: 'Arial, sans-serif',
                      letterSpacing: '1px',
                      textShadow: '0 1px 2px rgba(0,0,0,0.8)',
                    }}>
                      RTX 4090
                    </div>
                    
                    {/* 16-Pin PCIe power connector */}
                    <div style={{
                      position: 'absolute',
                      top: '50%',
                      right: 4,
                      transform: 'translateY(-50%)',
                      width: 12,
                      height: 20,
                      background: '#1a1a1a',
                      border: '1px solid #333',
                      borderRadius: 2,
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'center',
                      alignItems: 'center',
                      gap: 1,
                    }}>
                      {[...Array(4)].map((_, i) => (
                        <div key={i} style={{ width: 6, height: 2, background: '#333', borderRadius: 1 }} />
                      ))}
                    </div>
                    
                    {/* Metallic vent grille */}
                    <div style={{
                      position: 'absolute',
                      bottom: 4,
                      left: '15%',
                      width: '40%',
                      height: 6,
                      background: 'repeating-linear-gradient(90deg, #0f0f0f 0px, #0f0f0f 3px, #2a2a2a 3px, #2a2a2a 5px)',
                      borderRadius: 1,
                      opacity: 0.6,
                    }} />
                  </div>
                </motion.div>
                {/* Spark effects */}
                {[...Array(8)].map((_, i) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, scale: 0, x: 0, y: 0 }}
                    animate={{
                      opacity: [0, 1, 0],
                      scale: [0, 1.2, 0],
                      x: Math.cos((i * Math.PI) / 4) * 60,
                      y: Math.sin((i * Math.PI) / 4) * 60,
                    }}
                    transition={{
                      duration: 0.6,
                      delay: i * 0.05,
                      ease: 'easeOut',
                    }}
                    style={{
                      position: 'absolute',
                      bottom: '50%',
                      left: '50%',
                      width: 10,
                      height: 10,
                      marginLeft: -5,
                      marginBottom: -5,
                      borderRadius: '50%',
                      background: `radial-gradient(circle, ${theme.accent} 0%, ${theme.glow} 100%)`,
                      boxShadow: `0 0 16px ${theme.accent}, 0 0 32px ${theme.glow}`,
                      pointerEvents: 'none',
                      zIndex: 45,
                    }}
                  />
                ))}
              </>
            )}

            {/* ONE-UP - Token refresh with stationary text/bar above Gizzi */}
            {animState === 'one-up' && (
              <>
                {/* Stationary Progress bar above Gizzi's head - does NOT rotate with Gizzi */}
                <div
                  style={{
                    position: 'absolute',
                    bottom: '110%',
                    left: '50%',
                    transform: 'translateX(-50%)',
                    width: 100,
                    height: 12,
                    background: 'rgba(14, 17, 20, 0.9)',
                    border: `2px solid ${theme.accent}`,
                    borderRadius: 6,
                    overflow: 'hidden',
                    zIndex: 50,
                    pointerEvents: 'none',
                  }}
                >
                  <motion.div
                    initial={{ width: '0%' }}
                    animate={{ width: '100%' }}
                    transition={{ duration: 2, ease: 'linear' }}
                    style={{
                      height: '100%',
                      background: `linear-gradient(90deg, #22c55e 0%, #4ade80 50%, #22c55e 100%)`,
                      boxShadow: `0 0 12px #22c55e`,
                    }}
                  />
                </div>
                {/* Animated squiggly lines during compaction - stationary */}
                {[...Array(4)].map((_, i) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, pathLength: 0 }}
                    animate={{ opacity: [0, 1, 0], pathLength: 1 }}
                    transition={{ duration: 0.8, delay: 0.5 + i * 0.2 }}
                    style={{
                      position: 'absolute',
                      bottom: '130%',
                      left: '50%',
                      transform: `translateX(-50%) rotate(${i * 45}deg)`,
                      width: 60,
                      height: 20,
                      zIndex: 48,
                      pointerEvents: 'none',
                    }}
                  >
                    <svg width="60" height="20" viewBox="0 0 60 20" style={{ overflow: 'visible' }}>
                      <motion.path
                        d="M0,10 Q15,0 30,10 T60,10"
                        fill="none"
                        stroke={theme.accent}
                        strokeWidth="2"
                        initial={{ pathLength: 0 }}
                        animate={{ pathLength: [0, 1, 0] }}
                        transition={{ duration: 1, delay: i * 0.15, repeat: 1 }}
                      />
                    </svg>
                  </motion.div>
                ))}
                {/* Tech data packet / memory chip being uploaded */}
                <motion.div
                  initial={{ opacity: 0, scale: 0.8, y: -30, x: 0 }}
                  animate={{ 
                    opacity: [0, 1, 1, 0], 
                    scale: [0.8, 1, 0.9, 0.6],
                    y: [-30, -15, -5, 0],
                    x: [0, 0, 0, 0],
                    rotate: [0, 5, -5, 0],
                  }}
                  transition={{ duration: 2, times: [0, 0.3, 0.6, 1] }}
                  style={{
                    position: 'absolute',
                    bottom: '100%',
                    left: '50%',
                    transform: 'translateX(-50%)',
                    width: 48,
                    height: 36,
                    zIndex: 55,
                    pointerEvents: 'none',
                  }}
                >
                  {/* Memory chip with circuit pattern */}
                  <div style={{
                    width: '100%',
                    height: '100%',
                    background: 'linear-gradient(135deg, #2d3748 0%, #1a202c 50%, #171923 100%)',
                    border: '2px solid #4a5568',
                    borderRadius: 4,
                    boxShadow: '0 0 20px rgba(74, 85, 104, 0.6), inset 0 1px 0 rgba(255,255,255,0.1)',
                    position: 'relative',
                    overflow: 'hidden',
                  }}>
                    {/* Circuit traces */}
                    <div style={{
                      position: 'absolute',
                      top: 6,
                      left: 6,
                      right: 6,
                      height: 2,
                      background: '#48bb78',
                      borderRadius: 1,
                      boxShadow: '0 0 4px #48bb78',
                    }} />
                    <div style={{
                      position: 'absolute',
                      top: 6,
                      left: 6,
                      width: 2,
                      height: 10,
                      background: '#48bb78',
                      borderRadius: 1,
                      boxShadow: '0 0 4px #48bb78',
                    }} />
                    <div style={{
                      position: 'absolute',
                      top: 6,
                      right: 6,
                      width: 2,
                      height: 10,
                      background: '#48bb78',
                      borderRadius: 1,
                      boxShadow: '0 0 4px #48bb78',
                    }} />
                    <div style={{
                      position: 'absolute',
                      bottom: 6,
                      left: '50%',
                      transform: 'translateX(-50%)',
                      width: 20,
                      height: 2,
                      background: '#48bb78',
                      borderRadius: 1,
                      boxShadow: '0 0 4px #48bb78',
                    }} />
                    {/* Chip center */}
                    <div style={{
                      position: 'absolute',
                      top: '50%',
                      left: '50%',
                      transform: 'translate(-50%, -50%)',
                      width: 14,
                      height: 14,
                      background: '#1a202c',
                      border: '1px solid #4a5568',
                      borderRadius: 2,
                    }} />
                    {/* Data indicator */}
                    <div style={{
                      position: 'absolute',
                      top: '50%',
                      left: '50%',
                      transform: 'translate(-50%, -50%)',
                      fontSize: 7,
                      fontWeight: 800,
                      color: '#48bb78',
                      fontFamily: 'monospace',
                    }}>
                      01
                    </div>
                    {/* Data transfer lines animation */}
                    <motion.div
                      animate={{ 
                        opacity: [0.3, 1, 0.3],
                        x: [-10, 10],
                      }}
                      transition={{ duration: 0.4, repeat: 4 }}
                      style={{
                        position: 'absolute',
                        top: '35%',
                        left: 0,
                        width: 8,
                        height: 1,
                        background: '#48bb78',
                        boxShadow: '0 0 4px #48bb78',
                      }}
                    />
                    <motion.div
                      animate={{ 
                        opacity: [0.3, 1, 0.3],
                        x: [10, -10],
                      }}
                      transition={{ duration: 0.4, repeat: 4, delay: 0.2 }}
                      style={{
                        position: 'absolute',
                        bottom: '35%',
                        right: 0,
                        width: 8,
                        height: 1,
                        background: '#48bb78',
                        boxShadow: '0 0 4px #48bb78',
                      }}
                    />
                  </div>
                  {/* Pin connectors */}
                  <div style={{
                    position: 'absolute',
                    bottom: -4,
                    left: 4,
                    right: 4,
                    display: 'flex',
                    justifyContent: 'space-between',
                  }}>
                    {[0, 1, 2, 3].map((i) => (
                      <div key={i} style={{
                        width: 4,
                        height: 4,
                        background: '#718096',
                        borderRadius: '0 0 1px 1px',
                      }} />
                    ))}
                  </div>
                </motion.div>
                {/* Data bytes streaming effect */}
                {[0, 1, 2, 3, 4].map((i) => (
                  <motion.div
                    key={`byte-${i}`}
                    initial={{ opacity: 0, y: -20 }}
                    animate={{ 
                      opacity: [0, 1, 0],
                      y: [-20 + i * 8, -10 + i * 4],
                    }}
                    transition={{ 
                      duration: 0.4, 
                      delay: 0.5 + i * 0.15,
                      repeat: 2,
                    }}
                    style={{
                      position: 'absolute',
                      bottom: '110%',
                      left: `calc(50% + ${(i - 2) * 15}px)`,
                      fontSize: 8,
                      fontFamily: 'monospace',
                      fontWeight: 700,
                      color: '#48bb78',
                      textShadow: '0 0 4px #48bb78',
                      zIndex: 54,
                    }}
                  >
                    {['0x1A', '0xFF', '0x42', '0x7E', '0x01'][i]}
                  </motion.div>
                ))}
                {/* Stationary text - does NOT rotate with Gizzi */}
                <div
                  style={{
                    position: 'absolute',
                    bottom: '140%',
                    left: '50%',
                    transform: 'translateX(-50%)',
                    pointerEvents: 'none',
                    zIndex: 50,
                  }}
                >
                  <motion.div
                    initial={{ opacity: 0, y: 10, scale: 0.8 }}
                    animate={{ opacity: [0, 1, 1, 0], y: [10, 0, 0, -10], scale: [0.8, 1, 1, 0.9] }}
                    transition={{ duration: 2.5, ease: 'easeOut' }}
                    style={{
                      padding: '8px 16px',
                      background: 'linear-gradient(135deg, #22c55e 0%, #16a34a 100%)',
                      borderRadius: '14px',
                      boxShadow: `0 4px 20px rgba(34, 197, 94, 0.6), 0 0 40px ${theme.glow}`,
                      fontSize: 16,
                      fontWeight: 800,
                      color: '#fff',
                      textShadow: '0 2px 4px rgba(0,0,0,0.3)',
                      letterSpacing: '0.05em',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    TOKENS REFRESHED +1
                  </motion.div>
                </div>
              </>
            )}

            {/* CHECKPOINT - Glowing ring pulse effect with save progress bar */}
            {animState === 'checkpoint' && (
              <>
                {/* Save progress bar / cache indicator */}
                <motion.div
                  initial={{ opacity: 0, y: 10, scale: 0.9 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  transition={{ duration: 0.3 }}
                  style={{
                    position: 'absolute',
                    bottom: '120%',
                    left: '50%',
                    transform: 'translateX(-50%)',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: 6,
                    zIndex: 50,
                  }}
                >
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    fontSize: 12,
                    fontWeight: 700,
                    color: theme.accent,
                    textTransform: 'uppercase',
                    letterSpacing: '0.1em',
                  }}>
                    <span>💾</span>
                    <span>SAVING...</span>
                  </div>
                  <div style={{
                    width: 90,
                    height: 10,
                    background: 'rgba(14, 17, 20, 0.9)',
                    border: `2px solid ${theme.soft}`,
                    borderRadius: 5,
                    overflow: 'hidden',
                  }}>
                    <motion.div
                      initial={{ width: '0%' }}
                      animate={{ width: '100%' }}
                      transition={{ duration: 1.5, ease: 'easeInOut' }}
                      style={{
                        height: '100%',
                        background: `linear-gradient(90deg, ${theme.accent} 0%, ${theme.glow} 100%)`,
                        boxShadow: `0 0 10px ${theme.glow}`,
                      }}
                    />
                  </div>
                </motion.div>
                {[...Array(3)].map((_, i) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, scale: 0.5 }}
                    animate={{
                      opacity: [0, 0.8, 0],
                      scale: [0.5, 2 + i * 0.5, 3],
                    }}
                    transition={{
                      duration: 2.0,
                      delay: i * 0.2,
                      ease: 'easeOut',
                    }}
                    style={{
                      position: 'absolute',
                      bottom: '50%',
                      left: '50%',
                      transform: 'translate(-50%, 50%)',
                      width: 60,
                      height: 60,
                      borderRadius: '50%',
                      border: `3px solid ${theme.accent}`,
                      boxShadow: `0 0 20px ${theme.glow}, inset 0 0 20px ${theme.soft}`,
                      pointerEvents: 'none',
                      zIndex: 35,
                    }}
                  />
                ))}
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: [0, 1, 0] }}
                  transition={{ duration: 0.3, delay: 0.4 }}
                  style={{
                    position: 'absolute',
                    bottom: '50%',
                    left: '50%',
                    transform: 'translate(-50%, 50%)',
                    width: 20,
                    height: 20,
                    borderRadius: '50%',
                    background: `radial-gradient(circle, ${theme.accent} 0%, transparent 70%)`,
                    boxShadow: `0 0 30px ${theme.accent}`,
                    pointerEvents: 'none',
                    zIndex: 36,
                  }}
                />
                {/* Cache indicator badge */}
                <motion.div
                  initial={{ opacity: 0, scale: 0 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ duration: 0.4, delay: 1.5 }}
                  style={{
                    position: 'absolute',
                    bottom: '140%',
                    left: '50%',
                    transform: 'translateX(-50%)',
                    padding: '4px 10px',
                    background: theme.accent,
                    borderRadius: 10,
                    fontSize: 10,
                    fontWeight: 800,
                    color: '#000',
                    zIndex: 50,
                  }}
                >
                  ✓ SAVED
                </motion.div>
              </>
            )}

            {/* WARP STAR - Rainbow trail particles with 12 sparkles */}
            {animState === 'warp-star' && (
              <>
                {/* 12 sparkles */}
                {['#ff0040', '#ff4000', '#ff8000', '#ffc000', '#ffff00', '#c0ff00', '#00ff00', '#00ff80', '#0080ff', '#4000ff', '#8000ff', '#ff00ff'].map((color, i) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, x: 0, y: 0, scale: 0 }}
                    animate={{
                      opacity: [0, 1, 0],
                      x: Math.cos((i * Math.PI * 2) / 12) * 120,
                      y: Math.sin((i * Math.PI * 2) / 12) * 120,
                      scale: [0, 1.5, 0],
                    }}
                    transition={{
                      duration: 1.8,
                      delay: i * 0.05,
                      ease: 'easeOut',
                    }}
                    style={{
                      position: 'absolute',
                      bottom: '50%',
                      left: '50%',
                      width: 14,
                      height: 14,
                      marginLeft: -7,
                      marginBottom: -7,
                      borderRadius: '50%',
                      background: color,
                      boxShadow: `0 0 20px ${color}, 0 0 40px ${color}`,
                      pointerEvents: 'none',
                      zIndex: 40,
                    }}
                  />
                ))}
                {/* Stationary rainbow star at center */}
                <motion.div
                  initial={{ opacity: 0, scale: 0.5, rotate: 0 }}
                  animate={{ opacity: 1, scale: 1.0, rotate: 360 }}
                  transition={{ duration: 1.8, ease: 'linear' }}
                  style={{
                    position: 'absolute',
                    bottom: '50%',
                    left: '50%',
                    transform: 'translate(-50%, 50%)',
                    width: 80,
                    height: 80,
                    pointerEvents: 'none',
                    zIndex: 38,
                  }}
                >
                  <svg width="80" height="80" viewBox="0 0 100 100">
                    <polygon
                      points="50,5 60,35 95,35 67,55 77,85 50,68 23,85 33,55 5,35 40,35"
                      fill="url(#rainbow2)"
                      style={{ filter: 'drop-shadow(0 0 8px rgba(255,255,255,0.5))' }}
                    />
                    <defs>
                      <linearGradient id="rainbow2" x1="0%" y1="0%" x2="100%" y2="100%">
                        <stop offset="0%" stopColor="#e63950" />
                        <stop offset="17%" stopColor="#e08a4a" />
                        <stop offset="33%" stopColor="#d4c850" />
                        <stop offset="50%" stopColor="#4ac54a" />
                        <stop offset="67%" stopColor="#4a8ac5" />
                        <stop offset="83%" stopColor="#8a4ac5" />
                        <stop offset="100%" stopColor="#c54a6a" />
                      </linearGradient>
                    </defs>
                  </svg>
                </motion.div>
              </>
            )}

            {/* PACMAN TRAIL - Gizzi moving RIGHT eating horizontal tokens */}
            {animState === 'pacman-trail' && (
              <>
                {/* 6 Stationary tokens arranged HORIZONTALLY to the right of center */}
                {[40, 80, 120, 160, 200, 240].map((xPos, i) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 1, scale: 1 }}
                    animate={{
                      opacity: [1, 1, 0],
                      scale: [1, 1.1, 0],
                    }}
                    transition={{
                      duration: 0.3,
                      delay: 0.4 + i * 0.28, // Staggered based on when Gizzi reaches each token
                      times: [0, 0.6, 1],
                    }}
                    style={{
                      position: 'absolute',
                      bottom: '50%',
                      left: `calc(50% + ${xPos}px)`,
                      width: 22,
                      height: 22,
                      marginLeft: -11,
                      marginBottom: -11,
                      borderRadius: '50%',
                      background: 'linear-gradient(135deg, #fbbf24 0%, #f59e0b 100%)',
                      border: '2px solid #fcd34d',
                      boxShadow: `0 0 12px rgba(251, 191, 36, 0.8)`,
                      pointerEvents: 'none',
                      zIndex: 35,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <span style={{
                      fontSize: 10,
                      fontWeight: 800,
                      color: '#000',
                      fontFamily: 'monospace',
                    }}>
                      ⟨/⟩
                    </span>
                  </motion.div>
                ))}
                {/* Chomp effect at Gizzi's position */}
                {[0, 1, 2, 3, 4, 5].map((i) => (
                  <motion.div
                    key={`chomp-${i}`}
                    initial={{ opacity: 0, scale: 0.5 }}
                    animate={{ opacity: [0, 0.7, 0], scale: [0.5, 1.3, 1.6] }}
                    transition={{
                      duration: 0.3,
                      delay: 0.4 + i * 0.28,
                      times: [0, 0.5, 1],
                    }}
                    style={{
                      position: 'absolute',
                      bottom: '50%',
                      left: `calc(50% + ${40 + i * 40}px)`,
                      transform: 'translate(-50%, 50%)',
                      width: 35,
                      height: 35,
                      borderRadius: '50%',
                      background: `radial-gradient(circle, ${theme.accent} 0%, transparent 70%)`,
                      pointerEvents: 'none',
                      zIndex: 36,
                    }}
                  />
                ))}
                {/* Score popups at each eaten token */}
                {[0, 1, 2, 3, 4, 5].map((i) => (
                  <motion.div
                    key={`score-${i}`}
                    initial={{ opacity: 0, y: 0 }}
                    animate={{ opacity: [0, 1, 0], y: -30 }}
                    transition={{ duration: 0.6, delay: 0.5 + i * 0.28 }}
                    style={{
                      position: 'absolute',
                      bottom: '100%',
                      left: `calc(50% + ${40 + i * 40}px)`,
                      transform: 'translateX(-50%)',
                      fontSize: 14,
                      fontWeight: 800,
                      color: '#fbbf24',
                      fontFamily: 'monospace',
                      textShadow: '0 0 10px rgba(251, 191, 36, 0.8)',
                      zIndex: 50,
                    }}
                  >
                    200
                  </motion.div>
                ))}
              </>
            )}

            {/* THE DROP - Gizzi drops through stationary AI trail */}
            {animState === 'the-drop' && (
              <>
                {/* Stationary light trail from top to bar */}
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: [0, 0.8, 0.6, 0] }}
                  transition={{ duration: 2.2, times: [0, 0.2, 0.8, 1] }}
                  style={{
                    position: 'absolute',
                    bottom: '50%',
                    left: '50%',
                    transform: 'translateX(-50%)',
                    width: 50,
                    height: 500, // Fixed height - stationary
                    background: `linear-gradient(to top, ${theme.accent} 0%, ${theme.glow} 30%, ${theme.soft} 60%, rgba(20,184,166,0.2) 80%, transparent 100%)`,
                    borderRadius: '25px 25px 0 0',
                    filter: 'blur(4px)',
                    pointerEvents: 'none',
                    zIndex: 5,
                  }}
                />
                {/* Binary code particles */}
                {['1', '0', '1', '0', '1', '0', '1', '0'].map((bit, i) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, y: -200, x: 0 }}
                    animate={{
                      opacity: [0, 1, 0],
                      y: [-(200 - i * 25), 0, 80],
                      x: (Math.random() - 0.5) * 50,
                    }}
                    transition={{
                      duration: 0.8,
                      delay: 0.3 + i * 0.1,
                      ease: 'easeOut',
                    }}
                    style={{
                      position: 'absolute',
                      bottom: '50%',
                      left: '50%',
                      fontSize: 14,
                      fontFamily: 'monospace',
                      fontWeight: 700,
                      color: theme.accent,
                      textShadow: `0 0 8px ${theme.glow}`,
                      pointerEvents: 'none',
                      zIndex: 6,
                    }}
                  >
                    {bit}
                  </motion.div>
                ))}
                {/* Circuit pattern lines */}
                <motion.svg
                  initial={{ opacity: 0 }}
                  animate={{ opacity: [0, 0.6, 0] }}
                  transition={{ duration: 2.2 }}
                  width="100"
                  height="300"
                  style={{
                    position: 'absolute',
                    bottom: '30%',
                    left: '50%',
                    transform: 'translateX(-50%)',
                    zIndex: 4,
                  }}
                >
                  <motion.path
                    d="M20,0 L20,100 L40,120 L40,200"
                    fill="none"
                    stroke={theme.soft}
                    strokeWidth="1.5"
                    strokeDasharray="4,4"
                    initial={{ pathLength: 0 }}
                    animate={{ pathLength: 1 }}
                    transition={{ duration: 1.5 }}
                  />
                  <motion.path
                    d="M80,0 L80,80 L60,100 L60,180"
                    fill="none"
                    stroke={theme.soft}
                    strokeWidth="1.5"
                    strokeDasharray="4,4"
                    initial={{ pathLength: 0 }}
                    animate={{ pathLength: 1 }}
                    transition={{ duration: 1.5, delay: 0.2 }}
                  />
                  <motion.circle cx="40" cy="120" r="4" fill={theme.accent}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.8 }}
                  />
                  <motion.circle cx="60" cy="100" r="4" fill={theme.accent}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 1 }}
                  />
                </motion.svg>
                {/* Impact particles */}
                {[...Array(6)].map((_, i) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, scale: 0 }}
                    animate={{
                      opacity: [0, 1, 0],
                      scale: [0, 1, 0],
                      x: Math.cos((i * Math.PI * 2) / 6) * 60,
                      y: Math.sin((i * Math.PI * 2) / 6) * 30,
                    }}
                    transition={{
                      duration: 0.5,
                      delay: 1.8,
                    }}
                    style={{
                      position: 'absolute',
                      bottom: '40%',
                      left: '50%',
                      width: 6,
                      height: 6,
                      borderRadius: '50%',
                      background: theme.glow,
                      boxShadow: `0 0 10px ${theme.accent}`,
                      pointerEvents: 'none',
                      zIndex: 7,
                    }}
                  />
                ))}
              </>
            )}

            {/* THE PEEK - Boot sequence with terminal typing effect */}
            {animState === 'the-peek' && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.3 }}
                style={{
                  position: 'absolute',
                  bottom: '100%',
                  left: '50%',
                  transform: 'translateX(-50%)',
                  pointerEvents: 'none',
                  zIndex: 45,
                }}
              >
                {/* Terminal window */}
                <div
                  style={{
                    width: 180,
                    background: 'rgba(10, 12, 14, 0.95)',
                    border: `1px solid ${theme.soft}`,
                    borderRadius: 8,
                    boxShadow: `0 4px 20px ${theme.glow}`,
                    overflow: 'hidden',
                    fontFamily: 'monospace',
                  }}
                >
                  {/* Terminal header */}
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    padding: '6px 10px',
                    background: 'rgba(255,255,255,0.05)',
                    borderBottom: `1px solid ${theme.soft}`,
                  }}>
                    <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#ff5f56' }} />
                    <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#ffbd2e' }} />
                    <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#27ca40' }} />
                    <span style={{ marginLeft: 'auto', fontSize: 10, color: 'rgba(236,236,236,0.5)' }}>gizzi_boot.sh</span>
                  </div>
                  {/* Terminal content */}
                  <div style={{ padding: '10px 12px' }}>
                    <div style={{ fontSize: 11, color: theme.accent, marginBottom: 4 }}>$ initializing...</div>
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: '100%' }}
                      transition={{ duration: 0.6, delay: 0.2 }}
                      style={{
                        height: 6,
                        background: `linear-gradient(90deg, ${theme.accent} 0%, ${theme.glow} 100%)`,
                        borderRadius: 3,
                        marginBottom: 8,
                      }}
                    />
                    {/* Typing commands */}
                    {['loading modules...', 'mounting /dev/gizzi...', 'ready.'].map((text, i) => (
                      <motion.div
                        key={i}
                        initial={{ opacity: 0, x: -5 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ duration: 0.2, delay: 0.4 + i * 0.15 }}
                        style={{ fontSize: 10, color: 'rgba(236,236,236,0.7)', marginTop: 3 }}
                      >
                        <span style={{ color: '#27ca40' }}>✓</span> {text}
                      </motion.div>
                    ))}
                    {/* Blinking cursor */}
                    <motion.div
                      animate={{ opacity: [1, 0] }}
                      transition={{ duration: 0.5, repeat: 2 }}
                      style={{
                        display: 'inline-block',
                        width: 6,
                        height: 12,
                        background: theme.accent,
                        marginTop: 6,
                        verticalAlign: 'middle',
                      }}
                    />
                  </div>
                </div>
              </motion.div>
            )}

            {/* ============================================
                EXIT ANIMATION VISUAL EFFECTS
            ============================================ */}

            {/* TO THE CLOUD - Data packets floating up to cloud */}
            {animState === 'to-the-cloud' && (
              <>
                {/* Data packets floating up */}
                {[...Array(6)].map((_, i) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, y: 0, x: 0, scale: 0.5 }}
                    animate={{
                      opacity: [0, 1, 1, 0],
                      y: [-20, -80 - i * 30, -150 - i * 20],
                      x: (Math.random() - 0.5) * 80,
                      scale: [0.5, 1, 0.8],
                      rotate: [0, 15, -15, 0],
                    }}
                    transition={{
                      duration: 2.5,
                      delay: i * 0.15,
                      ease: 'easeOut',
                    }}
                    style={{
                      position: 'absolute',
                      bottom: '60%',
                      left: '50%',
                      fontSize: 24,
                      zIndex: 45,
                    }}
                  >
                    📦
                  </motion.div>
                ))}
                {/* Cloud at top */}
                <motion.div
                  initial={{ opacity: 0, y: -50, scale: 0.8 }}
                  animate={{ opacity: [0, 1, 1, 0], y: -200, scale: [0.8, 1.2, 1.5] }}
                  transition={{ duration: 2.5, delay: 0.5 }}
                  style={{
                    position: 'absolute',
                    bottom: '100%',
                    left: '50%',
                    transform: 'translateX(-50%)',
                    fontSize: 60,
                    zIndex: 40,
                    filter: `drop-shadow(0 0 20px ${theme.glow})`,
                  }}
                >
                  ☁️
                </motion.div>
                {/* Upload progress indicator */}
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: [0, 1, 0] }}
                  transition={{ duration: 2.5 }}
                  style={{
                    position: 'absolute',
                    bottom: '140%',
                    left: '50%',
                    transform: 'translateX(-50%)',
                    fontSize: 14,
                    fontWeight: 700,
                    color: theme.accent,
                    zIndex: 50,
                  }}
                >
                  UPLOADING...
                </motion.div>
              </>
            )}

            {/* WHEEL OUT - Longer tire screech marks with dust cloud */}
            {animState === 'wheel-out' && (
              <>
                {/* Extended tire screech marks - darker and more realistic */}
                <motion.div
                  initial={{ opacity: 0, scaleX: 0 }}
                  animate={{ opacity: [0, 0.95, 0.6, 0], scaleX: [0, 1, 1.6, 2] }}
                  transition={{ duration: 2.0 }}
                  style={{
                    position: 'absolute',
                    bottom: -10,
                    left: '50%',
                    transform: 'translateX(-50%) rotate(-5deg)',
                    width: 80,
                    height: 12,
                    background: `repeating-linear-gradient(90deg, #0a0a0a 0px, #0a0a0a 5px, transparent 5px, transparent 9px)`,
                    borderRadius: 2,
                    filter: 'blur(1px)',
                    pointerEvents: 'none',
                    zIndex: 3,
                  }}
                />
                <motion.div
                  initial={{ opacity: 0, scaleX: 0 }}
                  animate={{ opacity: [0, 0.9, 0.55, 0], scaleX: [0, 1, 1.5, 1.9] }}
                  transition={{ duration: 2.0, delay: 0.1 }}
                  style={{
                    position: 'absolute',
                    bottom: -18,
                    left: '45%',
                    transform: 'translateX(-50%) rotate(-10deg)',
                    width: 70,
                    height: 10,
                    background: `repeating-linear-gradient(90deg, #0d0d0d 0px, #0d0d0d 4px, transparent 4px, transparent 8px)`,
                    borderRadius: 2,
                    filter: 'blur(0.5px)',
                    pointerEvents: 'none',
                    zIndex: 3,
                  }}
                />
                {/* Additional long skid mark - darker rubber */}
                <motion.div
                  initial={{ opacity: 0, scaleX: 0 }}
                  animate={{ opacity: [0, 0.85, 0.4, 0], scaleX: [0, 1, 1.4, 1.8] }}
                  transition={{ duration: 2.0, delay: 0.05 }}
                  style={{
                    position: 'absolute',
                    bottom: -25,
                    left: '48%',
                    transform: 'translateX(-50%) rotate(-3deg)',
                    width: 90,
                    height: 8,
                    background: `repeating-linear-gradient(90deg, #111 0px, #111 6px, transparent 6px, transparent 12px)`,
                    borderRadius: 2,
                    filter: 'blur(0.5px)',
                    pointerEvents: 'none',
                    zIndex: 3,
                  }}
                />
                {/* Realistic smoke clouds with CSS radial gradients */}
                {[0, 1, 2, 3, 4].map((i) => (
                  <motion.div
                    key={`smoke-${i}`}
                    initial={{ opacity: 0, scale: 0.3, x: 0 }}
                    animate={{ 
                      opacity: [0, 0.7 - i * 0.1, 0.4 - i * 0.05, 0], 
                      scale: [0.3, 1.2 + i * 0.3, 1.8 + i * 0.4, 2.5 + i * 0.5],
                      x: i % 2 === 0 ? [0, -30 - i * 10, -60 - i * 15] : [0, 25 + i * 8, 50 + i * 12],
                      y: [0, -10 - i * 5, -25 - i * 10],
                    }}
                    transition={{ 
                      duration: 2.0, 
                      delay: i * 0.1,
                      ease: 'easeOut',
                    }}
                    style={{
                      position: 'absolute',
                      bottom: `${10 + i * 5}%`,
                      left: i % 2 === 0 ? `${15 + i * 5}%` : 'auto',
                      right: i % 2 === 1 ? `${10 + i * 4}%` : 'auto',
                      width: 50 + i * 15,
                      height: 40 + i * 12,
                      borderRadius: '50%',
                      background: `radial-gradient(ellipse at center, 
                        rgba(${60 + i * 10}, ${60 + i * 10}, ${60 + i * 10}, ${0.6 - i * 0.08}) 0%, 
                        rgba(${40 + i * 5}, ${40 + i * 5}, ${40 + i * 5}, ${0.4 - i * 0.06}) 30%, 
                        rgba(20, 20, 20, ${0.2 - i * 0.03}) 60%, 
                        transparent 100%)`,
                      filter: `blur(${4 + i}px)`,
                      zIndex: 44 - i,
                      pointerEvents: 'none',
                    }}
                  />
                ))}
                {/* Dense dark smoke core */}
                <motion.div
                  initial={{ opacity: 0, scale: 0.5 }}
                  animate={{ 
                    opacity: [0, 0.9, 0.6, 0], 
                    scale: [0.5, 1.8, 2.8, 3.5],
                    x: [-10, -40, -80],
                  }}
                  transition={{ duration: 2.0, delay: 0.15 }}
                  style={{
                    position: 'absolute',
                    bottom: '5%',
                    left: '20%',
                    width: 70,
                    height: 55,
                    borderRadius: '50%',
                    background: 'radial-gradient(ellipse at center, rgba(30,30,30,0.85) 0%, rgba(20,20,20,0.6) 25%, rgba(10,10,10,0.3) 50%, transparent 100%)',
                    filter: 'blur(6px)',
                    zIndex: 45,
                    pointerEvents: 'none',
                  }}
                />
                {/* Rubber burnout particles */}
                {[...Array(12)].map((_, i) => {
                  const angle = (i * Math.PI * 2) / 12 + Math.random() * 0.5;
                  const distance = 40 + Math.random() * 60;
                  return (
                    <motion.div
                      key={`particle-${i}`}
                      initial={{ opacity: 0, scale: 0, x: 0, y: 0 }}
                      animate={{ 
                        opacity: [0, 1, 0.8, 0], 
                        scale: [0, 0.8, 1, 0.6],
                        x: Math.cos(angle) * distance,
                        y: Math.sin(angle) * distance * 0.6 - 20,
                        rotate: Math.random() * 360,
                      }}
                      transition={{ 
                        duration: 1.2, 
                        delay: 0.3 + i * 0.05,
                        ease: 'easeOut',
                      }}
                      style={{
                        position: 'absolute',
                        bottom: '15%',
                        left: i % 2 === 0 ? '25%' : '75%',
                        width: 3 + Math.random() * 4,
                        height: 3 + Math.random() * 4,
                        background: i % 3 === 0 ? '#1a1a1a' : i % 3 === 1 ? '#2d2d2d' : '#0f0f0f',
                        borderRadius: '30% 70% 70% 30% / 30% 30% 70% 70%',
                        zIndex: 46,
                        pointerEvents: 'none',
                      }}
                    />
                  );
                })}
                {/* SCREECH text indicator */}
                <motion.div
                  initial={{ opacity: 0, x: 0 }}
                  animate={{ opacity: [0, 1, 0], x: [-10, 0, 10] }}
                  transition={{ duration: 0.15, repeat: 4 }}
                  style={{
                    position: 'absolute',
                    bottom: '100%',
                    left: '50%',
                    transform: 'translateX(-50%)',
                    padding: '4px 12px',
                    background: 'rgba(30, 30, 30, 0.9)',
                    border: '1px solid #444',
                    borderRadius: 10,
                    fontSize: 12,
                    fontWeight: 800,
                    color: '#aaa',
                    pointerEvents: 'none',
                    zIndex: 50,
                    whiteSpace: 'nowrap',
                    fontFamily: 'monospace',
                    letterSpacing: '0.05em',
                  }}
                >
                  ▓▒░ SCREECH! ░▒▓
                </motion.div>
              </>
            )}

            {/* Skull icon - stays with Gizzi */}
            {animState === 'out-of-tokens' && (
              <motion.div
                initial={{ opacity: 0, scale: 0 }}
                animate={{ opacity: [0, 1, 0], scale: [0, 1.5, 0], rotate: [0, 180] }}
                transition={{ duration: 0.8, delay: 0.5 }}
                style={{
                  position: 'absolute',
                  bottom: '50%',
                  left: '50%',
                  transform: 'translate(-50%, 50%)',
                  fontSize: 32,
                  pointerEvents: 'none',
                  zIndex: 45,
                }}
              >
                💀
              </motion.div>
            )}

            {/* BUFFER OVERFLOW - Binary code rain (Matrix style) */}
            {animState === 'buffer-overflow' && (
              <>
                {/* Binary rain columns */}
                {[...Array(8)].map((_, col) => (
                  <motion.div
                    key={col}
                    initial={{ opacity: 0, y: -100 }}
                    animate={{ 
                      opacity: [0, 0.8, 0.6, 0],
                      y: [-100, 50, 150, 300],
                    }}
                    transition={{ 
                      duration: 2.0, 
                      delay: col * 0.1,
                      times: [0, 0.3, 0.7, 1],
                    }}
                    style={{
                      position: 'absolute',
                      bottom: '50%',
                      left: `${15 + col * 10}%`,
                      fontFamily: 'monospace',
                      fontSize: 12,
                      fontWeight: 700,
                      color: '#00ff41',
                      textShadow: '0 0 8px #00ff41',
                      zIndex: 45,
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 2,
                    }}
                  >
                    {['1', '0', '1', '0', '1', '0', '1', '0'].map((bit, i) => (
                      <motion.span
                        key={i}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: [0, 1, 0.5, 1] }}
                        transition={{ duration: 0.3, delay: i * 0.05 }}
                      >
                        {bit}
                      </motion.span>
                    ))}
                  </motion.div>
                ))}
                {/* Glitch overlay */}
                <motion.div
                  animate={{
                    x: [0, -4, 4, -2, 2, 0],
                    opacity: [1, 0.6, 1, 0.4, 1, 0],
                  }}
                  transition={{ duration: 2.0, times: [0, 0.15, 0.3, 0.45, 0.6, 1] }}
                  style={{
                    position: 'absolute',
                    inset: -30,
                    border: `3px solid #00ff41`,
                    borderRadius: 12,
                    pointerEvents: 'none',
                    zIndex: 40,
                    boxShadow: '0 0 20px rgba(0, 255, 65, 0.5)',
                  }}
                />
                <motion.div
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: [0, 1, 1, 0], scale: [0.8, 1.05, 1] }}
                  transition={{ duration: 2.0 }}
                  style={{
                    position: 'absolute',
                    bottom: '120%',
                    left: '50%',
                    transform: 'translateX(-50%)',
                    padding: '8px 16px',
                    background: '#000',
                    border: '2px solid #00ff41',
                    borderRadius: 8,
                    pointerEvents: 'none',
                    zIndex: 55,
                  }}
                >
                  <div style={{
                    fontSize: 14,
                    fontWeight: 800,
                    color: '#00ff41',
                    fontFamily: 'monospace',
                    letterSpacing: '0.05em',
                  }}>
                    BUFFER OVERFLOW
                  </div>
                  <div style={{
                    fontSize: 10,
                    color: '#00ff41',
                    fontFamily: 'monospace',
                    marginTop: 2,
                    opacity: 0.8,
                  }}>
                    0xDEADBEEF
                  </div>
                </motion.div>
              </>
            )}

            {/* CONTEXT SCATTER - 20 tokens with sparkle on impact */}
            {animState === 'context-scatter' && (
              <>
                {[...Array(20)].map((_, i) => {
                  const angle = (i * Math.PI * 2) / 20;
                  const distance = 80 + Math.random() * 80;
                  return (
                    <motion.div
                      key={i}
                      initial={{ opacity: 0, x: 0, y: 0, scale: 0.5 }}
                      animate={{
                        opacity: [0, 1, 1, 0],
                        x: Math.cos(angle) * distance,
                        y: Math.sin(angle) * distance - 40,
                        scale: [0.5, 1, 0.6],
                        rotate: Math.random() * 720,
                      }}
                      transition={{
                        duration: 2.0,
                        ease: [0.3, 0, 0.5, 1.2],
                      }}
                      style={{
                        position: 'absolute',
                        bottom: '50%',
                        left: '50%',
                        width: 16,
                        height: 20,
                        marginLeft: -8,
                        marginBottom: -10,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        background: i % 4 === 0 ? '#fbbf24' : i % 4 === 1 ? '#60a5fa' : i % 4 === 2 ? '#a78bfa' : '#f472b6',
                        borderRadius: '50%',
                        fontSize: 9,
                        fontWeight: 800,
                        color: '#000',
                        boxShadow: `0 3px 12px rgba(0,0,0,0.3)`,
                        pointerEvents: 'none',
                        zIndex: 40,
                      }}
                    >
                      ⟨/⟩
                    </motion.div>
                  );
                })}
                {/* Sparkle on impact */}
                <motion.div
                  initial={{ opacity: 0, scale: 0 }}
                  animate={{ opacity: [0, 1, 0], scale: [0, 2, 0] }}
                  transition={{ duration: 0.5, delay: 0.3 }}
                  style={{
                    position: 'absolute',
                    bottom: '50%',
                    left: '50%',
                    transform: 'translate(-50%, 50%)',
                    width: 100,
                    height: 100,
                    background: `radial-gradient(circle, ${theme.glow} 0%, transparent 70%)`,
                    pointerEvents: 'none',
                    zIndex: 38,
                  }}
                />
                {[...Array(8)].map((_, i) => (
                  <motion.div
                    key={`sparkle-${i}`}
                    initial={{ opacity: 0, scale: 0 }}
                    animate={{ 
                      opacity: [0, 1, 0], 
                      scale: [0, 1, 0],
                      rotate: [0, 180],
                    }}
                    transition={{ duration: 0.6, delay: 0.3 + i * 0.05 }}
                    style={{
                      position: 'absolute',
                      bottom: '50%',
                      left: '50%',
                      width: 20,
                      height: 20,
                      marginLeft: -10,
                      marginBottom: -10,
                      zIndex: 42,
                    }}
                  >
                    <svg width="20" height="20" viewBox="0 0 20 20">
                      <path
                        d="M10,0 L12,8 L20,10 L12,12 L10,20 L8,12 L0,10 L8,8 Z"
                        fill={theme.accent}
                        transform={`rotate(${i * 45} 10 10) translate(${Math.cos(i * Math.PI / 4) * 30}, ${Math.sin(i * Math.PI / 4) * 30})`}
                      />
                    </svg>
                  </motion.div>
                ))}
                <motion.div
                  initial={{ opacity: 0, scale: 1 }}
                  animate={{ opacity: [0, 0.5, 0], scale: [1, 1.4, 1.8] }}
                  transition={{ duration: 0.5 }}
                  style={{
                    position: 'absolute',
                    bottom: '50%',
                    left: '50%',
                    transform: 'translate(-50%, 50%)',
                    width: 60,
                    height: 60,
                    borderRadius: '50%',
                    border: `3px dashed ${theme.accent}`,
                    pointerEvents: 'none',
                    zIndex: 35,
                  }}
                />
              </>
            )}

            {/* FAN SPIN - Realistic overheating CPU cooler fan with RGB */}
            {animState === 'fan-spin' && (
              <>
                {/* Fan housing/frame */}
                <motion.div
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ duration: 0.3 }}
                  style={{
                    position: 'absolute',
                    bottom: '50%',
                    left: '50%',
                    transform: 'translate(-50%, 50%)',
                    width: 100,
                    height: 100,
                    zIndex: 48,
                  }}
                >
                  <svg width="100" height="100" viewBox="0 0 100 100">
                    {/* Outer frame with mounting holes */}
                    <circle cx="50" cy="50" r="48" fill="none" stroke="#2a2a2a" strokeWidth="4" />
                    <circle cx="50" cy="50" r="42" fill="none" stroke="#3a3a3a" strokeWidth="1" />
                    {/* Mounting holes */}
                    <circle cx="15" cy="15" r="3" fill="#1a1a1a" stroke="#444" strokeWidth="1" />
                    <circle cx="85" cy="15" r="3" fill="#1a1a1a" stroke="#444" strokeWidth="1" />
                    <circle cx="15" cy="85" r="3" fill="#1a1a1a" stroke="#444" strokeWidth="1" />
                    <circle cx="85" cy="85" r="3" fill="#1a1a1a" stroke="#444" strokeWidth="1" />
                    {/* Fan corners (frame struts) */}
                    <line x1="15" y1="15" x2="35" y2="35" stroke="#2a2a2a" strokeWidth="4" />
                    <line x1="85" y1="15" x2="65" y2="35" stroke="#2a2a2a" strokeWidth="4" />
                    <line x1="15" y1="85" x2="35" y2="65" stroke="#2a2a2a" strokeWidth="4" />
                    <line x1="85" y1="85" x2="65" y2="65" stroke="#2a2a2a" strokeWidth="4" />
                  </svg>
                </motion.div>
                
                {/* RGB ring removed - fan without RGB lighting */}
                
                {/* Spinning fan with curved blades */}
                <motion.div
                  initial={{ opacity: 0, rotate: 0 }}
                  animate={{ opacity: 1, rotate: 2880 }}
                  transition={{ duration: 2.0, ease: 'linear' }}
                  style={{
                    position: 'absolute',
                    bottom: '50%',
                    left: '50%',
                    transform: 'translate(-50%, 50%)',
                    width: 85,
                    height: 85,
                    zIndex: 50,
                  }}
                >
                  <svg width="85" height="85" viewBox="0 0 85 85">
                    {/* 9 curved fan blades (Noctua/Corsair style) */}
                    {[0, 40, 80, 120, 160, 200, 240, 280, 320].map((angle, i) => (
                      <g key={angle} transform={`rotate(${angle} 42.5 42.5)`}>
                        {/* Curved blade shape */}
                        <path
                          d="M42.5,42.5 Q38,25 35,12 Q42.5,8 50,12 Q47,25 42.5,42.5"
                          fill={`hsl(${i * 40}, 70%, 45%)`}
                          stroke="#222"
                          strokeWidth="0.5"
                          opacity={0.9}
                        />
                      </g>
                    ))}
                  </svg>
                </motion.div>
                
                {/* Motion blur effect for spinning */}
                <motion.div
                  animate={{ opacity: [0, 0.3, 0.3, 0], rotate: 2880 }}
                  transition={{ duration: 2.0, ease: 'linear' }}
                  style={{
                    position: 'absolute',
                    bottom: '50%',
                    left: '50%',
                    transform: 'translate(-50%, 50%)',
                    width: 80,
                    height: 80,
                    borderRadius: '50%',
                    background: 'conic-gradient(from 0deg, transparent, rgba(255,255,255,0.1), transparent, rgba(255,255,255,0.1), transparent)',
                    zIndex: 51,
                    pointerEvents: 'none',
                  }}
                />
                
                {/* Center hub with sticker */}
                <motion.div
                  initial={{ opacity: 0, scale: 0 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ duration: 0.4, delay: 0.1 }}
                  style={{
                    position: 'absolute',
                    bottom: '50%',
                    left: '50%',
                    transform: 'translate(-50%, 50%)',
                    width: 24,
                    height: 24,
                    zIndex: 52,
                  }}
                >
                  {/* Hub background */}
                  <div style={{
                    width: '100%',
                    height: '100%',
                    borderRadius: '50%',
                    background: 'linear-gradient(135deg, #3a3a3a 0%, #1a1a1a 100%)',
                    border: '2px solid #555',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}>
                    {/* Logo area */}
                    <span style={{
                      fontSize: 8,
                      fontWeight: 900,
                      color: '#fff',
                      fontFamily: 'Arial, sans-serif',
                    }}>G</span>
                  </div>
                </motion.div>
                {/* Smoke coming out */}
                {[...Array(5)].map((_, i) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, y: 0, scale: 0.5 }}
                    animate={{ 
                      opacity: [0, 0.6, 0],
                      y: [-20, -60 - i * 20],
                      x: (Math.random() - 0.5) * 40,
                      scale: [0.5, 1.5, 2],
                    }}
                    transition={{ 
                      duration: 1.5, 
                      delay: 0.5 + i * 0.15,
                      repeat: 1,
                    }}
                    style={{
                      position: 'absolute',
                      bottom: '60%',
                      left: '50%',
                      width: 25,
                      height: 25,
                      marginLeft: -12,
                      borderRadius: '50%',
                      background: 'radial-gradient(circle, rgba(150,150,150,0.6) 0%, transparent 70%)',
                      filter: 'blur(4px)',
                      zIndex: 51,
                    }}
                  />
                ))}
                {/* Temperature warning */}
                <motion.div
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: [0, 1, 1, 0], scale: [0.8, 1, 1, 0.9] }}
                  transition={{ duration: 2.0 }}
                  style={{
                    position: 'absolute',
                    bottom: '130%',
                    left: '50%',
                    transform: 'translateX(-50%)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    padding: '8px 14px',
                    background: '#dc2626',
                    borderRadius: 10,
                    zIndex: 55,
                  }}
                >
                  <span style={{ fontSize: 18 }}>🌡️</span>
                  <span style={{ fontSize: 13, fontWeight: 800, color: '#fff' }}>
                    OVERHEATING!
                  </span>
                </motion.div>
                {/* CPU temperature display */}
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: [0, 1, 1, 0] }}
                  transition={{ duration: 2.0 }}
                  style={{
                    position: 'absolute',
                    bottom: '160%',
                    left: '50%',
                    transform: 'translateX(-50%)',
                    fontSize: 20,
                    fontWeight: 900,
                    color: '#dc2626',
                    fontFamily: 'monospace',
                    zIndex: 55,
                  }}
                >
                  98°C
                </motion.div>
              </>
            )}

            {/* SYSTEM CRASH - BSOD style */}
            {animState === 'system-crash' && (
              <>
                {/* Blue screen overlay */}
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: [0, 1, 1, 0] }}
                  transition={{ duration: 2.5 }}
                  style={{
                    position: 'fixed',
                    inset: 0,
                    background: '#0078D7',
                    zIndex: 1000,
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: 40,
                  }}
                >
                  {/* Sad face */}
                  <motion.div
                    initial={{ opacity: 0, scale: 0.5 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ duration: 0.5, delay: 0.2 }}
                    style={{
                      fontSize: 100,
                      marginBottom: 30,
                    }}
                  >
                    :(
                  </motion.div>
                  {/* Main message */}
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5, delay: 0.4 }}
                    style={{
                      fontSize: 24,
                      fontWeight: 500,
                      color: '#fff',
                      marginBottom: 20,
                      textAlign: 'center',
                    }}
                  >
                    Your PC ran into a problem and needs to restart.
                  </motion.div>
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ duration: 0.5, delay: 0.6 }}
                    style={{
                      fontSize: 14,
                      color: '#fff',
                      opacity: 0.9,
                      textAlign: 'center',
                      maxWidth: 500,
                      lineHeight: 1.6,
                    }}
                  >
                    We're just collecting some error info, and then we'll restart for you.
                  </motion.div>
                  {/* Progress percentage */}
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ duration: 0.3, delay: 0.8 }}
                    style={{
                      fontSize: 16,
                      color: '#fff',
                      marginTop: 30,
                    }}
                  >
                    <motion.span
                      animate={{ opacity: [1, 0.5, 1] }}
                      transition={{ duration: 1, repeat: 2 }}
                    >
                      0% complete
                    </motion.span>
                  </motion.div>
                  {/* QR code placeholder */}
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ duration: 0.5, delay: 1 }}
                    style={{
                      marginTop: 40,
                      padding: 10,
                      background: '#fff',
                      borderRadius: 4,
                    }}
                  >
                    <div style={{
                      width: 80,
                      height: 80,
                      background: '#000',
                      display: 'grid',
                      gridTemplateColumns: 'repeat(5, 1fr)',
                      gridTemplateRows: 'repeat(5, 1fr)',
                      gap: 2,
                      padding: 4,
                    }}>
                      {[...Array(25)].map((_, i) => (
                        <div
                          key={i}
                          style={{
                            background: Math.random() > 0.5 ? '#000' : '#fff',
                          }}
                        />
                      ))}
                    </div>
                  </motion.div>
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 0.8 }}
                    transition={{ duration: 0.5, delay: 1.2 }}
                    style={{
                      fontSize: 11,
                      color: '#fff',
                      marginTop: 15,
                      textAlign: 'center',
                    }}
                  >
                    For more information about this issue and possible fixes, visit https://www.windows.com/stopcode
                  </motion.div>
                </motion.div>
              </>
            )}

            {/* COLLAPSE - CRT TV turn-off effect */}
            {animState === 'collapse' && (
              <>
                {/* CRT Screen glow effect */}
                <motion.div
                  initial={{ opacity: 0.3 }}
                  animate={{ opacity: [0.3, 0.1, 0] }}
                  transition={{ duration: 0.3 }}
                  style={{
                    position: 'absolute',
                    inset: -60,
                    background: 'radial-gradient(ellipse at 50% 50%, rgba(255,255,255,0.1) 0%, transparent 70%)',
                    zIndex: 40,
                    pointerEvents: 'none',
                  }}
                />
                {/* Bright horizontal white line - the classic CRT collapse */}
                <motion.div
                  initial={{ opacity: 0, scaleY: 0.8 }}
                  animate={{ 
                    opacity: [0, 1, 1, 0.8, 0],
                    scaleY: [0.8, 0.08, 0.04, 0.01, 0],
                    scaleX: [1, 1, 0.9, 0.7, 0.3],
                  }}
                  transition={{ duration: 0.8, times: [0, 0.1, 0.3, 0.6, 1] }}
                  style={{
                    position: 'absolute',
                    bottom: '50%',
                    left: '5%',
                    right: '5%',
                    height: 6,
                    background: 'linear-gradient(90deg, transparent 0%, #fff 10%, #fff 90%, transparent 100%)',
                    boxShadow: '0 0 30px #fff, 0 0 60px rgba(255,255,255,0.8), 0 0 100px rgba(255,255,255,0.4)',
                    borderRadius: '3px',
                    zIndex: 50,
                  }}
                />
                {/* Screen curve/bulge effect during collapse */}
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: [0, 0.3, 0.2, 0] }}
                  transition={{ duration: 0.8 }}
                  style={{
                    position: 'absolute',
                    inset: -40,
                    background: 'radial-gradient(ellipse at 50% 50%, rgba(255,255,255,0.15) 0%, transparent 60%)',
                    borderRadius: '50%',
                    zIndex: 45,
                    pointerEvents: 'none',
                  }}
                />
                {/* Brief white flash at start */}
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: [0, 0.6, 0] }}
                  transition={{ duration: 0.15 }}
                  style={{
                    position: 'absolute',
                    inset: -50,
                    background: '#fff',
                    zIndex: 49,
                    pointerEvents: 'none',
                  }}
                />
              </>
            )}

            {/* Mascot — legs animate when moving */}
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
          </motion.div>
        )}
      </AnimatePresence>

      {/* Visual rail glow line - only visible when on bar */}
      {(animState === 'on-bar' || animState === 'landing') && (
        <div
          style={{
            position: 'absolute',
            bottom: 0,
            left: '50%',
            transform: 'translateX(-50%)',
            width: '100%',
            maxWidth: 720,
            height: 3,
            borderRadius: 999,
            background: `linear-gradient(90deg, transparent 0%, ${theme.soft} 10%, ${theme.glow} 50%, ${theme.soft} 90%, transparent 100%)`,
            opacity: 0.5,
            pointerEvents: 'none',
          }}
        />
      )}

      {/* OUT OF TOKENS - TUI-style subtle notification (fixed position, doesn't move with Gizzi) */}
      <AnimatePresence>
        {animState === 'out-of-tokens' && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: [0, 1, 1, 1, 0], y: [10, 0, 0, 0, -5] }}
            exit={{ opacity: 0 }}
            transition={{ duration: 2.0, times: [0, 0.15, 0.5, 0.8, 1] }}
            style={{
              position: 'fixed',
              top: '30%',
              left: '50%',
              transform: 'translateX(-50%)',
              pointerEvents: 'none',
              zIndex: 9999,
            }}
          >
            <div
              style={{
                padding: '8px 16px',
                background: 'rgba(40, 44, 52, 0.95)',
                borderRadius: 8,
                border: '1px solid rgba(100, 100, 100, 0.3)',
                boxShadow: '0 4px 16px rgba(0, 0, 0, 0.4)',
                textAlign: 'center',
                fontFamily: 'monospace',
                fontSize: 12,
                color: 'rgba(200, 200, 200, 0.9)',
                letterSpacing: '0.02em',
                whiteSpace: 'nowrap',
              }}
            >
              You've hit your limit · replenishes Q4 2085 (approx. 24,847 days remaining)
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
