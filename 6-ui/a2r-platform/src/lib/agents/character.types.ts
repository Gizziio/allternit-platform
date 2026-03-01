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

export interface AvatarConfig {
  type: "glb" | "image" | "color";
  uri?: string;
  fallbackColor: string;
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
