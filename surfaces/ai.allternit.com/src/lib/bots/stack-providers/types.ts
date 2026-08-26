/**
 * Agent Stack Provider Types
 *
 * Defines the contract for bringing external agents (Hermes, OpenClaw, Kimi, …)
 * into Allternit as first-class bots. Each provider is responsible for discovery,
 * execution, and optional memory/usage sync.
 *
 * @module stack-providers/types
 */

export type StackProviderCapability = 'chat' | 'tools' | 'memory' | 'cron';

export interface ExternalAgentReference {
  /** Provider slug, e.g. 'hermes', 'openclaw', 'kimi' */
  providerId: string;
  /** Stable identifier within the provider's namespace */
  externalId: string;
  /** User-facing name */
  displayName: string;
  /** Short description / tagline */
  tagline?: string;
  /** Avatar or icon URL (data URL or http URL) */
  avatarUrl?: string;
  /** What this external agent can do inside Allternit */
  capabilities: StackProviderCapability[];
  /** Optional pricing hint */
  pricing?: ExternalAgentPricing;
  /** Provider-specific metadata */
  metadata?: Record<string, unknown>;
}

export interface ExternalAgentPricing {
  model: 'free' | 'per_message' | 'per_token';
  unitCost?: number;
  currency?: string;
}

export interface ProviderUsage {
  /** Number of messages or invocations */
  messageCount?: number;
  /** Estimated or reported token count */
  tokenCount?: number;
  /** Cost in the provider's currency */
  cost?: number;
  currency?: string;
  /** ISO timestamp of the usage period start */
  since: string;
}

export interface BotMemoryBundle {
  /** Free-form memory entries, e.g. from MEMORY.md or conversation history */
  entries: BotMemoryEntry[];
  /** Skills/blueprints the external agent knows */
  skills?: BotSkillBundle[];
}

export interface BotMemoryEntry {
  id: string;
  content: string;
  source: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface BotSkillBundle {
  id: string;
  name: string;
  description?: string;
  source: string;
  content?: string;
}

/**
 * Provider interface. Implementations live in this directory.
 */
export interface AgentStackProvider {
  readonly id: string;
  readonly name: string;

  /** True if the provider is installed/available on this machine */
  isInstalled(): Promise<boolean>;

  /** List agents available from this provider */
  listAgents(): Promise<ExternalAgentReference[]>;

  /** Send a message to an external agent and stream the reply */
  sendMessage(
    externalId: string,
    session: string,
    message: string,
  ): AsyncIterable<string>;

  /** Current runtime status of an external agent */
  getStatus(externalId: string): Promise<'idle' | 'working' | 'error'>;

  /** Optional: pull memory/skills from the external agent into Allternit */
  syncMemory?(externalId: string): Promise<BotMemoryBundle>;

  /** Optional: report usage since a point in time */
  getUsage?(externalId: string, since: Date): Promise<ProviderUsage>;
}

/**
 * Factory that can create a provider instance (allows dependency injection in tests).
 */
export type AgentStackProviderFactory = () => AgentStackProvider;
