import type { GizziEmotion } from '@/components/ai-elements/GizziMascot';
import type { AgentModeSurface } from '@/stores/agent-surface-mode.store';

export interface AgentModeGizziTheme {
  accent: string;
  glow: string;
  soft: string;
}

export interface AgentModeGizziProps {
  active: boolean;
  pulse: number;
  surface: AgentModeSurface;
  selectedAgentName?: string | null;
  theme: AgentModeGizziTheme;
  hasActionPills?: boolean;
}

export type AnimationState =
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

export interface SurfaceConfig {
  entrySide: 'left' | 'right';
  mascotSize: number;
  baseEmotion: GizziEmotion;
  selectedEmotion: GizziEmotion;
  peekEmotion: GizziEmotion;
}

export const SURFACE_CONFIG: Record<AgentModeSurface, SurfaceConfig> = {
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
  design: {
    entrySide: 'left',
    mascotSize: 72,
    baseEmotion: 'pleased',
    selectedEmotion: 'proud',
    peekEmotion: 'mischief',
  },
};

export const SURFACE_THOUGHTS: Record<AgentModeSurface, string[]> = {
  chat: [
    "Ready to optimize your workflow!",
    "I've got some smart suggestions for you.",
    "Let's make this conversation productive.",
    "Analyzing context for better answers...",
    "Did you know I can help with code too?",
    "Need a summary? Just ask!",
    "I'm keeping an eye on things.",
    "Waiting for your next brilliant idea.",
  ],
  cowork: [
    "Co-pilot mode: Active.",
    "Analyzing project milestones...",
    "Let's knock out those tasks.",
    "I've mapped out the next few steps.",
    "Need help coordinating the team?",
    "Efficiency is my middle name.",
    "Everything is running smoothly.",
    "I've got the DAG under control.",
  ],
  code: [
    "Debugging brain engaged.",
    "Checking for syntax errors...",
    "Optimizing that algorithm in my head.",
    "Let's write some clean code today.",
    "I love a good refactor session.",
    "Imports look healthy.",
    "Don't forget to commit often!",
    "Analyzing your latest changes...",
  ],
  browser: [
    "Scanning the web for you.",
    "Found some interesting insights!",
    "Keeping track of your citations.",
    "Need a quick summary of this page?",
    "Browsing at the speed of thought.",
    "Analysis complete. Ready for more?",
    "I've organized those research notes.",
    "The web is a big place, let me help.",
  ],
  design: [
    "Pixel-perfect mode activated.",
    "That layout is looking sharp!",
    "Analyzing color contrast...",
    "Need a creative spark?",
    "I've got some design tokens for you.",
    "Let's build something beautiful.",
    "Typography is the soul of design.",
    "Reviewing accessibility standards.",
  ],
};
