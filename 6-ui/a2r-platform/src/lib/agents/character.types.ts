export type HardBanCategory =
  | "publishing"
  | "deploy"
  | "data_exfil"
  | "payments"
  | "email_send"
  | "file_delete"
  | "other";

export type EnforcementMode = "tool-block" | "prompt-only";

export type AgentSetup =
  | "coding"
  | "creative"
  | "research"
  | "operations"
  | "generalist";

export interface CharacterBlueprint {
  setup: AgentSetup;
  specialtySkills: string[];
  temperament: "precision" | "exploratory" | "systemic" | "balanced";
}

export interface CharacterIdentity {
  setup: AgentSetup;
  className: string;
  specialtySkills: string[];
  temperament: "precision" | "exploratory" | "systemic" | "balanced";
}

export interface RoleHardBan {
  id: string;
  label: string;
  category: HardBanCategory;
  description: string;
  severity: "warning" | "critical";
  enforcement: EnforcementMode;
  triggerPhrases: string[];
}

export interface RoleCardConfig {
  agentId: string;
  domain: string;
  inputs: string[];
  outputs: string[];
  definitionOfDone: string[];
  hardBans: RoleHardBan[];
  escalation: string[];
  metrics: string[];
}

export interface VoiceConfigLayer {
  style: string;
  rules: string[];
  microBans: string[];
  conflictBias: {
    prefersChallengeWith: string[];
  };
}

export interface RelationshipPair {
  agentA: string;
  agentB: string;
  affinity: number; // [0.1, 0.95]
}

export interface RelationshipConfig {
  defaults: {
    affinityFloor: number;
    affinityCeiling: number;
  };
  pairs: RelationshipPair[];
}

export interface ProgressionStatRule {
  source: string;
  formula: string;
}

export interface ProgressionConfig {
  stats: Record<string, ProgressionStatRule>;
  relevantStats: string[];
  level: {
    maxLevel: number;
    xpFormula: string;
  };
  class: string;
}

// Avatar Configuration Types - Extended for Rich Avatar System

export type AvatarBodyShape = "round" | "square" | "hex" | "diamond" | "cloud";

export type EyePreset = 
  | "round"      // Friendly, approachable
  | "wide"       // Alert, attentive
  | "narrow"     // Focused, intense
  | "focused"    // Concentrated attention
  | "curious"    // Questioning, asymmetrical
  | "pleased"    // Happy, content
  | "skeptical"  // Raised eyebrow, questioning
  | "mischief"   // Playful, scheming
  | "proud"      // Confident, assured
  | "dizzy"      // Confused, overwhelmed
  | "sleepy"     // Relaxed, half-closed
  | "starry"     // Excited, amazed
  | "pixel";     // Digital, retro

export type PupilStyle = "dot" | "ring" | "slit" | "star" | "heart" | "plus";

export type BlinkRate = "slow" | "normal" | "fast" | "never";

export type AntennaStyle = "straight" | "curved" | "coiled" | "zigzag" | "leaf" | "bolt";

export type AntennaAnimation = "static" | "wiggle" | "pulse" | "sway" | "bounce";

export type AvatarEmotion = 
  | "alert"      // Quick hop, bright glow
  | "curious"    // Head tilt, questioning
  | "focused"    // Steady hold, narrow eyes
  | "steady"     // Gentle breathe, soft glow
  | "pleased"    // Happy bounce, warm glow
  | "skeptical"  // Lean back, raised eyebrow
  | "mischief"   // Playful sway, quick twitches
  | "proud"      // Lifted posture, strong glow
  | "narrow"     // Narrowed eyes, intense focus
  | "sleepy";    // Droopy eyes, relaxed state

export interface AvatarEyeConfig {
  preset?: EyePreset;
  size?: number;        // 0.5 - 1.5
  color?: string;       // Hex color
  pupilStyle?: PupilStyle;
  blinkRate?: BlinkRate;
}

export interface AvatarAntennaConfig {
  count?: 0 | 1 | 2 | 3;
  style?: AntennaStyle;
  animation?: AntennaAnimation;
  tipDecoration?: "none" | "ball" | "glow" | "star" | "diamond";
}

export interface AvatarColorScheme {
  primary?: string;     // Body fill
  secondary?: string;   // Eye/accent color
  glow?: string;        // Beacon/emission color
  outline?: string;     // Stroke color
}

export interface AvatarPersonalityConfig {
  bounce?: number;      // 0-1 idle bounce intensity
  sway?: number;        // 0-1 rotation sway
  breathing?: boolean;  // Scale pulsing
}

export interface AvatarAccessory {
  id: string;
  type: "glasses" | "hat" | "neck" | "other";
  style: string;
  position: { x: number; y: number };
}

/**
 * Rich Avatar Configuration
 * Supports video game-style character customization
 */
export interface AvatarConfig {
  version?: "1.0";
  
  // Base Appearance
  baseShape?: AvatarBodyShape;
  
  // Eye System
  eyes?: AvatarEyeConfig;
  
  // Antennas/Accessories
  antennas?: AvatarAntennaConfig;
  
  // Color Palette
  colors?: AvatarColorScheme;
  
  // Personality-Driven Animation
  personality?: AvatarPersonalityConfig;
  
  // Unlockable Decorations
  accessories?: string[];  // IDs of unlocked accessories
  
  // Current Display State
  currentEmotion?: AvatarEmotion;
  
  // Legacy/simple config support
  type?: "glb" | "image" | "color";
  uri?: string;
  fallbackColor?: string;
}

/**
 * Legacy Avatar Config (for backward compatibility)
 * @deprecated Use AvatarConfig instead
 */
export interface LegacyAvatarConfig {
  type: "glb" | "image" | "color";
  uri?: string;
  fallbackColor: string;
}

/**
 * Simple Avatar Config (for backward compatibility with minimal config)
 */
export interface SimpleAvatarConfig {
  type: "color";
  fallbackColor: string;
}

/**
 * Default avatar configuration for new agents
 */
export const DEFAULT_AVATAR_CONFIG: AvatarConfig = {
  version: "1.0",
  baseShape: "round",
  eyes: {
    preset: "round",
    size: 1.0,
    color: "#ECECEC",
    pupilStyle: "dot",
    blinkRate: "normal"
  },
  antennas: {
    count: 2,
    style: "curved",
    animation: "sway",
    tipDecoration: "none"
  },
  colors: {
    primary: "#14B8A6",
    secondary: "#34D399",
    glow: "#2DD4BF",
    outline: "#0F766E"
  },
  personality: {
    bounce: 0.3,
    sway: 0.15,
    breathing: true
  },
  accessories: [],
  currentEmotion: "steady"
};

/**
 * Create default avatar config based on agent setup
 */
export function createDefaultAvatarConfig(setup: AgentSetup): AvatarConfig {
  const base = { ...DEFAULT_AVATAR_CONFIG };
  
  switch (setup) {
    case "coding":
      return {
        ...base,
        baseShape: "hex",
        eyes: { ...(base.eyes ?? {}), preset: "narrow", color: "#22D3EE" },
        antennas: { ...(base.antennas ?? {}), style: "straight", animation: "pulse" },
        colors: {
          primary: "#1E293B",
          secondary: "#22D3EE",
          glow: "#06B6D4",
          outline: "#0E7490"
        },
        personality: { bounce: 0.1, sway: 0.05, breathing: true }
      };
      
    case "creative":
      return {
        ...base,
        baseShape: "cloud",
        eyes: { ...(base.eyes ?? {}), preset: "wide", color: "#ECECEC", pupilStyle: "star" },
        antennas: { ...(base.antennas ?? {}), style: "leaf", animation: "sway" },
        colors: {
          primary: "#8B5CF6",
          secondary: "#EC4899",
          glow: "#E879F9",
          outline: "#7C3AED"
        },
        personality: { bounce: 0.4, sway: 0.3, breathing: true }
      };
      
    case "research":
      return {
        ...base,
        baseShape: "diamond",
        eyes: { ...(base.eyes ?? {}), preset: "curious", color: "#1E40AF", pupilStyle: "ring" },
        antennas: { ...(base.antennas ?? {}), style: "coiled", animation: "bounce" },
        colors: {
          primary: "#F59E0B",
          secondary: "#1E40AF",
          glow: "#EAB308",
          outline: "#B45309"
        },
        personality: { bounce: 0.15, sway: 0.1, breathing: true }
      };
      
    case "operations":
      return {
        ...base,
        baseShape: "square",
        eyes: { ...(base.eyes ?? {}), preset: "narrow", color: "#ECECEC" },
        antennas: { ...(base.antennas ?? {}), style: "zigzag", animation: "wiggle" },
        colors: {
          primary: "#DC2626",
          secondary: "#F59E0B",
          glow: "#EF4444",
          outline: "#991B1B"
        },
        personality: { bounce: 0.05, sway: 0.02, breathing: false }
      };
      
    case "generalist":
    default:
      return base;
  }
}

export interface CharacterLayerConfig {
  identity: CharacterIdentity;
  roleCard: RoleCardConfig;
  voice: VoiceConfigLayer;
  relationships: RelationshipConfig;
  progression: ProgressionConfig;
  avatar: AvatarConfig;
}

export interface CharacterLintIssue {
  level: "error" | "warning";
  code: string;
  message: string;
}

export interface CharacterCompiledConfig {
  agentId: string;
  compiledAt: string;
  hash: string;
  promptBlocks: {
    role: string;
    bans: string;
    voice: string;
    modifiers: string;
  };
  hardBans: RoleHardBan[];
  escalationRules: string[];
  lint: CharacterLintIssue[];
}

export interface CharacterArtifactFile {
  path: string;
  content: string;
}

export type CharacterTelemetryEventType =
  | "mission_created"
  | "mission_completed"
  | "mission_failed"
  | "step_started"
  | "step_completed"
  | "memory_written"
  | "ban_triggered"
  | "escalation_requested"
  | "interaction";

export interface CharacterTelemetryEvent {
  id: string;
  type: CharacterTelemetryEventType;
  timestamp: number;
  runId?: string;
  payload: Record<string, unknown>;
}

export interface CharacterStats {
  level: number;
  xp: number;
  class: string;
  stats: Record<string, number>;
  relevantStats: string[];
  statDefinitions: CharacterStatDefinition[];
  specialtyScores: Record<string, number>;
}

export interface CharacterStatDefinition {
  key: string;
  label: string;
  description: string;
  signals: string[];
}

export interface BanViolation {
  banId: string;
  label: string;
  category: HardBanCategory;
  reason: string;
  severity: "warning" | "critical";
}
