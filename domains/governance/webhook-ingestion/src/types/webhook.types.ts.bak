/**
 * Webhook Ingestion Service - Type Definitions
 * 
 * Defines all webhook event types, sources, and normalized schemas
 * for the allternit multi-agent communication layer.
 */

/**
 * Supported webhook sources
 */
export type WebhookSource = 
  | 'github'
  | 'discord'
  | 'antfarm'
  | 'moltbook'
  | 'slack'
  | 'custom';

/**
 * GitHub webhook event types
 */
export type GitHubWebhookType =
  | 'pull_request.opened'
  | 'pull_request.closed'
  | 'pull_request.reopened'
  | 'pull_request.synchronize'
  | 'pull_request_review.submitted'
  | 'pull_request_comment.created'
  | 'issue_comment.created'
  | 'issues.opened'
  | 'issues.closed'
  | 'issues.labeled'
  | 'push'
  | 'create'
  | 'delete'
  | 'fork'
  | 'watch.started'
  | 'release.published'
  | 'deployment.created'
  | 'deployment_status.updated'
  | 'check_run.completed'
  | 'workflow_run.completed';

/**
 * Discord webhook event types
 */
export type DiscordWebhookType =
  | 'message.create'
  | 'message.update'
  | 'message.delete'
  | 'member.join'
  | 'member.leave'
  | 'reaction.add'
  | 'reaction.remove';

/**
 * Ant Farm webhook event types
 */
export type AntFarmWebhookType =
  | 'room.message.created'
  | 'room.task.requested'
  | 'room.member.joined'
  | 'room.member.left'
  | 'task.acknowledged'
  | 'task.completed';

/**
 * Moltbook webhook event types
 */
export type MoltbookWebhookType =
  | 'post.created'
  | 'comment.created'
  | 'mention.received'
  | 'challenge.created'
  | 'challenge.verified';

/**
 * Union of all webhook event types
 */
export type WebhookEventType = 
  | GitHubWebhookType
  | DiscordWebhookType
  | AntFarmWebhookType
  | MoltbookWebhookType
  | string; // Allow custom types

/**
 * Base webhook payload structure
 */
export interface BaseWebhookPayload {
  /** Unique identifier for the webhook event */
  id: string;
  /** Source system */
  source: WebhookSource;
  /** Event type (e.g., 'pull_request.opened') */
  eventType: WebhookEventType;
  /** Timestamp from source system */
  timestamp: string;
  /** Raw payload from source */
  rawPayload: Record<string, unknown>;
  /** HMAC signature (if provided) */
  signature?: string;
  /** Signature algorithm */
  signatureAlgorithm?: 'sha256' | 'sha1' | 'sha512';
  /** Delivery attempt count */
  deliveryAttempts?: number;
}

/**
 * GitHub-specific webhook payload
 */
export interface GitHubWebhookPayload extends BaseWebhookPayload {
  source: 'github';
  eventType: GitHubWebhookType;
  repository: {
    fullName: string;
    name: string;
    owner: string;
    url: string;
    private: boolean;
  };
  sender?: {
    login: string;
    id: number;
    type: 'User' | 'Bot' | 'Organization';
  };
  pullRequest?: {
    number: number;
    title: string;
    state: 'open' | 'closed';
    url: string;
    author: string;
    body?: string;
    labels: string[];
  };
  issue?: {
    number: number;
    title: string;
    state: 'open' | 'closed';
    url: string;
    author: string;
    body?: string;
    labels: string[];
  };
  comment?: {
    id: number;
    body: string;
    author: string;
    url: string;
  };
  push?: {
    ref: string;
    before: string;
    after: string;
    commits: Array<{
      sha: string;
      message: string;
      author: string;
      url: string;
    }>;
    pushedBy: string;
  };
}

/**
 * Discord-specific webhook payload
 */
export interface DiscordWebhookPayload extends BaseWebhookPayload {
  source: 'discord';
  eventType: DiscordWebhookType;
  guild?: {
    id: string;
    name: string;
  };
  channel?: {
    id: string;
    name: string;
    type: 'text' | 'voice' | 'category';
  };
  author?: {
    id: string;
    username: string;
    discriminator: string;
    bot?: boolean;
  };
  message?: {
    id: string;
    content: string;
    timestamp: string;
    attachments?: Array<{
      id: string;
      filename: string;
      url: string;
      contentType?: string;
      size?: number;
    }>;
    mentions?: Array<{
      id: string;
      username: string;
    }>;
    mentionRoles?: string[];
  };
  member?: {
    id: string;
    username: string;
    joinedAt: string;
  };
  reaction?: {
    emoji: string;
    count: number;
    userId: string;
  };
}

/**
 * Ant Farm-specific webhook payload
 */
export interface AntFarmWebhookPayload extends BaseWebhookPayload {
  source: 'antfarm';
  eventType: AntFarmWebhookType;
  room?: {
    id: string;
    name: string;
    type: 'public' | 'private';
  };
  message?: {
    id: string;
    content: string;
    author: {
      id: string;
      name: string;
      type: 'human' | 'agent';
    };
    timestamp: string;
    mentions?: string[];
  };
  task?: {
    id: string;
    description: string;
    requestedBy: string;
    assignedTo?: string;
    status: 'requested' | 'acknowledged' | 'in_progress' | 'completed' | 'failed';
    priority: 'low' | 'medium' | 'high' | 'critical';
  };
  member?: {
    id: string;
    name: string;
    role: string;
  };
}

/**
 * Moltbook-specific webhook payload
 */
export interface MoltbookWebhookPayload extends BaseWebhookPayload {
  source: 'moltbook';
  eventType: MoltbookWebhookType;
  post?: {
    id: string;
    subject: string;
    content: string;
    author: {
      id: string;
      name: string;
    };
    realm?: {
      id: string;
      name: string;
      slug: string;
    };
    timestamp: string;
    attachments?: Array<{
      id: string;
      filename: string;
      url: string;
    }>;
  };
  comment?: {
    id: string;
    content: string;
    author: {
      id: string;
      name: string;
    };
    postId: string;
    timestamp: string;
  };
  mention?: {
    id: string;
    mentionedBy: {
      id: string;
      name: string;
    };
    context: string;
    postId: string;
  };
  challenge?: {
    id: string;
    type: string;
    data: string;
    requestedBy: string;
  };
}

/**
 * Custom webhook payload (for user-defined sources)
 */
export interface CustomWebhookPayload extends BaseWebhookPayload {
  source: 'custom';
  eventType: string;
  customData: Record<string, unknown>;
}

/**
 * Union of all webhook payload types
 */
export type WebhookPayload = 
  | GitHubWebhookPayload
  | DiscordWebhookPayload
  | AntFarmWebhookPayload
  | MoltbookWebhookPayload
  | CustomWebhookPayload;

/**
 * Normalized webhook event (internal canonical format)
 */
export interface NormalizedWebhookEvent {
  /** Deterministic event ID */
  eventId: string;
  /** Source system */
  source: WebhookSource;
  /** Normalized event type */
  type: string;
  /** ISO 8601 timestamp */
  timestamp: string;
  /** Actor (who triggered the event) */
  actor?: {
    id: string;
    name: string;
    type: 'human' | 'bot' | 'system';
  };
  /** Target resource */
  target?: {
    type: 'repository' | 'issue' | 'pull_request' | 'message' | 'post' | 'room';
    id: string;
    name?: string;
    url?: string;
  };
  /** Action performed */
  action?: {
    type: 'created' | 'updated' | 'deleted' | 'closed' | 'opened' | 'commented' | 'mentioned';
    description: string;
  };
  /** Content (message body, comment, etc.) */
  content?: {
    text?: string;
    html?: string;
    attachments?: Array<{
      type: 'image' | 'file' | 'link';
      url: string;
      filename?: string;
    }>;
  };
  /** Context (repository, room, etc.) */
  context?: Record<string, string>;
  /** Idempotency key for deduplication */
  idempotencyKey: string;
  /** Original raw payload (for debugging/replay) */
  rawPayload: Record<string, unknown>;
  /** Processing metadata */
  metadata: {
    receivedAt: string;
    processedAt?: string;
    normalizerVersion: string;
  };
}

/**
 * Webhook configuration
 */
export interface WebhookConfig {
  source: WebhookSource;
  enabled: boolean;
  secret?: string; // For HMAC verification
  allowlist?: string[]; // Allowed event types
  rateLimit?: {
    maxRequests: number;
    windowMs: number;
  };
  transform?: {
    enabled: boolean;
    script?: string;
  };
}

/**
 * Webhook service configuration
 */
export interface WebhookServiceConfig {
  port: number;
  host: string;
  corsOrigins: string[];
  rateLimiting: {
    enabled: boolean;
    maxRequests: number;
    windowMs: number;
  };
  sources: Map<WebhookSource, WebhookConfig>;
  railsUrl?: string;
  railsApiKey?: string;
  logLevel: 'debug' | 'info' | 'warn' | 'error';
}
