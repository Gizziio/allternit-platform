/**
 * Rails Event Types
 * 
 * Defines event types that are emitted to the Rails ledger
 * when webhooks are processed.
 */

/**
 * Base event envelope for all Rails events
 */
export interface RailsEventEnvelope {
  /** Unique event ID (sortable) */
  eventId: string;
  /** Transaction time (ISO 8601) */
  timestamp: string;
  /** Actor (user | agent | system) */
  actor: string;
  /** Scope identifiers */
  scope: {
    projectId?: string;
    dagId?: string;
    nodeId?: string;
    wihId?: string;
    runId?: string;
    threadId?: string;
  };
  /** Event type name */
  type: string;
  /** Event payload */
  payload: Record<string, unknown>;
  /** Provenance information */
  provenance?: {
    promptId?: string;
    deltaId?: string;
    agentDecisionId?: string;
    parentEventId?: string;
    correlationId?: string;
  };
}

/**
 * ExternalEventReceived - Emitted when any external webhook is received
 */
export interface ExternalEventReceived extends RailsEventEnvelope {
  type: 'ExternalEventReceived';
  payload: {
    /** Source system */
    source: string;
    /** Original event type from source */
    sourceEventType: string;
    /** Normalized event data */
    normalizedData: Record<string, unknown>;
    /** Idempotency key for deduplication */
    idempotencyKey: string;
    /** Reference to raw payload in vault */
    rawPayloadRef?: string;
    /** Signature verification status */
    signatureVerified: boolean;
  };
}

/**
 * WorkRequestCreated - Emitted when webhook requires agent action
 */
export interface WorkRequestCreated extends RailsEventEnvelope {
  type: 'WorkRequestCreated';
  payload: {
    /** Request ID */
    requestId: string;
    /** DAG ID (if associated) */
    dagId?: string;
    /** Node ID (if associated) */
    nodeId?: string;
    /** Role needed */
    role: 'builder' | 'validator' | 'planner' | 'reviewer' | 'security';
    /** Execution mode */
    executionMode: 'PLAN_ONLY' | 'REQUIRE_APPROVAL' | 'ACCEPT_EDITS' | 'BYPASS_PERMISSIONS';
    /** Priority (0 = normal, higher = more urgent) */
    priority: number;
    /** Whether dependencies are satisfied */
    depsSatisfied: boolean;
    /** Required gates to pass */
    requiredGates: string[];
    /** Required evidence (receipt kinds) */
    requiredEvidence: string[];
    /** Whether lease is required */
    leaseRequired: boolean;
    /** Lease scope if required */
    leaseScope?: {
      allowedPaths: string[];
      allowedTools: string[];
    };
    /** External event reference */
    externalEventRef: string;
    /** Correlation ID */
    correlationId: string;
  };
}

/**
 * AgentMentioned - Emitted when an agent is @mentioned in external message
 */
export interface AgentMentioned extends RailsEventEnvelope {
  type: 'AgentMentioned';
  payload: {
    /** Mentioned agent role or ID */
    mentionedRole: string;
    /** Mentioned agent ID (if resolved) */
    mentionedAgentId?: string;
    /** Original message content */
    message: string;
    /** Source of mention */
    source: string;
    /** Thread/room ID */
    threadId?: string;
    /** Correlation ID */
    correlationId: string;
  };
}

/**
 * GitHubEventReceived - Specialized event for GitHub webhooks
 */
export interface GitHubEventReceived extends RailsEventEnvelope {
  type: 'GitHubEventReceived';
  payload: {
    /** GitHub event type */
    githubEvent: string;
    /** Repository full name */
    repository: string;
    /** Sender login */
    sender?: string;
    /** PR number (if applicable) */
    pullRequestNumber?: number;
    /** Issue number (if applicable) */
    issueNumber?: number;
    /** Comment ID (if applicable) */
    commentId?: number;
    /** Action performed */
    action: string;
    /** Idempotency key */
    idempotencyKey: string;
  };
}

/**
 * DiscordEventReceived - Specialized event for Discord webhooks
 */
export interface DiscordEventReceived extends RailsEventEnvelope {
  type: 'DiscordEventReceived';
  payload: {
    /** Discord event type */
    discordEvent: string;
    /** Guild ID */
    guildId?: string;
    /** Channel ID */
    channelId?: string;
    /** Message ID */
    messageId?: string;
    /** Author ID */
    authorId?: string;
    /** Message content */
    content?: string;
    /** Idempotency key */
    idempotencyKey: string;
  };
}

/**
 * AntFarmEventReceived - Specialized event for Ant Farm webhooks
 */
export interface AntFarmEventReceived extends RailsEventEnvelope {
  type: 'AntFarmEventReceived';
  payload: {
    /** Ant Farm event type */
    antFarmEvent: string;
    /** Room ID */
    roomId?: string;
    /** Message ID */
    messageId?: string;
    /** Task ID */
    taskId?: string;
    /** Task status */
    taskStatus?: string;
    /** Idempotency key */
    idempotencyKey: string;
  };
}

/**
 * MoltbookEventReceived - Specialized event for Moltbook webhooks
 */
export interface MoltbookEventReceived extends RailsEventEnvelope {
  type: 'MoltbookEventReceived';
  payload: {
    /** Moltbook event type */
    moltbookEvent: string;
    /** Post ID */
    postId?: string;
    /** Comment ID */
    commentId?: string;
    /** Realm ID */
    realmId?: string;
    /** Idempotency key */
    idempotencyKey: string;
  };
}

/**
 * ReceiptWritten - Emitted when a receipt is recorded
 */
export interface ReceiptWritten extends RailsEventEnvelope {
  type: 'ReceiptWritten';
  payload: {
    /** Receipt ID */
    receiptId: string;
    /** Receipt kind */
    kind: string;
    /** Run ID */
    runId?: string;
    /** DAG ID */
    dagId?: string;
    /** Node ID */
    nodeId?: string;
    /** WIH ID */
    wihId?: string;
    /** Payload reference */
    payloadRef: string;
    /** Hash */
    hash?: string;
    /** Correlation ID */
    correlationId: string;
  };
}

/**
 * Union of all Rails event types
 */
export type RailsEvent = 
  | ExternalEventReceived
  | WorkRequestCreated
  | AgentMentioned
  | GitHubEventReceived
  | DiscordEventReceived
  | AntFarmEventReceived
  | MoltbookEventReceived
  | ReceiptWritten;

/**
 * Event type to constructor map
 */
export type RailsEventType = RailsEvent['type'];

/**
 * Extract payload type from event type
 */
export type EventPayload<T extends RailsEventType> = Extract<RailsEvent, { type: T }>['payload'];
