/**
 * Agent Characterization Framework (ACF)
 *
 * Operational metrics and behavioral profiles for agents.
 * Not gamified - SRE-style agent performance tracking.
 */

// ============================================================================
// Operational Metrics (AOP - Agent Operational Profile)
// ============================================================================

export interface AgentOperationalProfile {
  agentId: string;
  reliability: ReliabilityMetrics;
  latency: LatencyMetrics;
  policyCompliance: ComplianceMetrics;
  memoryDepth: MemoryMetrics;
  coordinationQuality: CoordinationMetrics;
  computedAt: string;
}

export interface ReliabilityMetrics {
  missionSuccessRate: number; // 0-1
  retryRate: number; // 0-1
  failureSeverity: 'low' | 'medium' | 'high' | 'critical';
}

export interface LatencyMetrics {
  avgTimeToFirstStep: number; // ms
  avgTaskCompletionTime: number; // ms
  blockingDuration: number; // ms
}

export interface ComplianceMetrics {
  hardBanTriggers: number;
  escalationFrequency: number;
  toolMisuseAttempts: number;
}

export interface MemoryMetrics {
  activeMemoryCount: number;
  avgConfidence: number; // 0-1
  memoryWriteRate: number; // writes/hour
}

export interface CoordinationMetrics {
  successfulHandoffs: number;
  conflictFrequency: number;
  crossAgentDependencySuccess: number; // 0-1
}

// ============================================================================
// Capability Maturity (replaces "Level")
// ============================================================================

export type MaturityLevel = 'experimental' | 'stable' | 'hardened' | 'critical';
export type RiskTier = 'low' | 'medium' | 'high';
export type AutonomyTier = 'advisory' | 'assisted' | 'delegated' | 'autonomous';

export interface AgentCapabilityProfile {
  agentId: string;
  maturity: MaturityLevel;
  riskTier: RiskTier;
  autonomyTier: AutonomyTier;
  trustIndex: number; // computed: reliability × compliance × affinity
}

// ============================================================================
// Cognitive Bias Profiles (behavior shaping, not personality)
// ============================================================================

export type BiasType =
  | 'analytical'
  | 'conservative'
  | 'speed'
  | 'adversarial'
  | 'compliance'
  | 'creative';

export interface CognitiveBiasProfile {
  agentId: string;
  biases: Record<BiasType, number>; // 0-1 strength
}

// ============================================================================
// Affinity Matrix (handoff optimization)
// ============================================================================

export interface AgentAffinityMatrix {
  agentId: string;
  handoffPriority: Record<string, number>; // agentId → priority weight
  conflictProbability: Record<string, number>; // agentId → probability
  reviewerPairing: Record<string, number>; // agentId → compatibility
  mentorRouting: Record<string, number>; // agentId → mentorship score
}

// ============================================================================
// Runtime Drift Tracking
// ============================================================================

export interface AgentDriftMetrics {
  agentId: string;
  riskAverseDrift: number; // trending more/less cautious
  deploymentConfidenceDrift: number;
  reviewStrictnessDrift: number;
  creativityDrift: number;
  trackedSince: string;
}

// ============================================================================
// ACF Engine
// ============================================================================

export class AgentCharacterizationEngine {
  private profiles: Map<string, AgentOperationalProfile>;
  private capabilities: Map<string, AgentCapabilityProfile>;
  private biases: Map<string, CognitiveBiasProfile>;
  private affinityMatrices: Map<string, AgentAffinityMatrix>;
  private driftMetrics: Map<string, AgentDriftMetrics>;

  constructor() {
    this.profiles = new Map();
    this.capabilities = new Map();
    this.biases = new Map();
    this.affinityMatrices = new Map();
    this.driftMetrics = new Map();
  }

  // Update operational profile from telemetry
  updateOperationalProfile(agentId: string, metrics: Partial<AgentOperationalProfile>): void {
    const existing = this.profiles.get(agentId);
    const updated: AgentOperationalProfile = {
      agentId,
      reliability: existing?.reliability || { missionSuccessRate: 1, retryRate: 0, failureSeverity: 'low' },
      latency: existing?.latency || { avgTimeToFirstStep: 0, avgTaskCompletionTime: 0, blockingDuration: 0 },
      policyCompliance: existing?.policyCompliance || { hardBanTriggers: 0, escalationFrequency: 0, toolMisuseAttempts: 0 },
      memoryDepth: existing?.memoryDepth || { activeMemoryCount: 0, avgConfidence: 1, memoryWriteRate: 0 },
      coordinationQuality: existing?.coordinationQuality || { successfulHandoffs: 0, conflictFrequency: 0, crossAgentDependencySuccess: 1 },
      computedAt: new Date().toISOString(),
      ...metrics,
    };
    this.profiles.set(agentId, updated);
  }

  // Compute capability profile
  computeCapabilityProfile(agentId: string): AgentCapabilityProfile {
    const profile = this.profiles.get(agentId);
    if (!profile) {
      throw new Error(`No profile found for agent ${agentId}`);
    }

    const trustIndex =
      profile.reliability.missionSuccessRate *
      (1 - profile.policyCompliance.hardBanTriggers * 0.1) *
      profile.memoryDepth.avgConfidence;

    let maturity: MaturityLevel = 'experimental';
    if (profile.reliability.missionSuccessRate > 0.95 && profile.policyCompliance.hardBanTriggers === 0) {
      maturity = 'critical';
    } else if (profile.reliability.missionSuccessRate > 0.9) {
      maturity = 'hardened';
    } else if (profile.reliability.missionSuccessRate > 0.7) {
      maturity = 'stable';
    }

    let riskTier: RiskTier = 'low';
    if (profile.policyCompliance.hardBanTriggers > 5) {
      riskTier = 'high';
    } else if (profile.policyCompliance.hardBanTriggers > 1) {
      riskTier = 'medium';
    }

    let autonomyTier: AutonomyTier = 'advisory';
    if (trustIndex > 0.9) {
      autonomyTier = 'autonomous';
    } else if (trustIndex > 0.7) {
      autonomyTier = 'delegated';
    } else if (trustIndex > 0.5) {
      autonomyTier = 'assisted';
    }

    const capability: AgentCapabilityProfile = {
      agentId,
      maturity,
      riskTier,
      autonomyTier,
      trustIndex,
    };

    this.capabilities.set(agentId, capability);
    return capability;
  }

  // Set cognitive bias profile
  setBiasProfile(agentId: string, biases: Partial<Record<BiasType, number>>): void {
    const existing = this.biases.get(agentId);
    const updated: CognitiveBiasProfile = {
      agentId,
      biases: {
        analytical: 0.5,
        conservative: 0.5,
        speed: 0.5,
        adversarial: 0.5,
        compliance: 0.5,
        creative: 0.5,
        ...existing?.biases,
        ...biases,
      },
    };
    this.biases.set(agentId, updated);
  }

  // Get all profiles for dashboard
  getAllProfiles(): {
    operational: AgentOperationalProfile[];
    capabilities: AgentCapabilityProfile[];
    biases: CognitiveBiasProfile[];
  } {
    return {
      operational: Array.from(this.profiles.values()),
      capabilities: Array.from(this.capabilities.values()),
      biases: Array.from(this.biases.values()),
    };
  }
}

// ============================================================================
// Singleton
// ============================================================================

export const acfEngine = new AgentCharacterizationEngine();
