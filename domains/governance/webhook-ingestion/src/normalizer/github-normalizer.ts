/**
 * GitHub Webhook Normalizer
 * 
 * Transforms raw GitHub webhook payloads into normalized events.
 * Reverse engineered from IDE Agent Kit pattern, implemented for allternit Rails.
 */

import type {
  GitHubWebhookPayload,
  NormalizedWebhookEvent,
  WebhookSource,
} from '../types/webhook.types.js';
import { v4 as uuidv4 } from 'uuid';
import { createHash } from 'crypto';

/**
 * GitHub action to normalized action mapping
 */
const ACTION_MAP: Record<string, string> = {
  opened: 'opened',
  closed: 'closed',
  reopened: 'reopened',
  synchronize: 'updated',
  submitted: 'submitted',
  created: 'created',
  edited: 'updated',
  deleted: 'deleted',
  labeled: 'labeled',
  unlabeled: 'unlabeled',
  assigned: 'assigned',
  unassigned: 'unassigned',
  published: 'published',
  updated: 'updated',
  started: 'started',
};

/**
 * Normalize GitHub webhook payload
 */
export function normalizeGitHubWebhook(
  rawPayload: GitHubWebhookPayload
): NormalizedWebhookEvent {
  const { eventType, repository, sender, timestamp, rawPayload: originalRaw } = rawPayload;
  
  // Extract base components
  const [category, action] = eventType.split('.');
  const normalizedAction = ACTION_MAP[action as string] || action;
  
  // Build actor
  const actor = sender
    ? {
        id: String(sender.id),
        name: sender.login,
        type: sender.type === 'Bot' ? 'bot' : 'human' as const,
      }
    : undefined;
  
  // Build target based on event category
  const target = buildTarget(category, rawPayload);
  
  // Build action description
  const actionDesc = buildActionDescription(category, normalizedAction, target, actor);
  
  // Build content
  const content = buildContent(rawPayload);
  
  // Build context
  const context: Record<string, string> = {
    repository: repository.fullName,
    repositoryUrl: repository.url,
    eventType: eventType,
  };
  
  // Add PR context if applicable
  if (rawPayload.pullRequest) {
    context.pullRequestNumber = String(rawPayload.pullRequest.number);
    context.pullRequestUrl = rawPayload.pullRequest.url;
  }
  
  // Add issue context if applicable
  if (rawPayload.issue) {
    context.issueNumber = String(rawPayload.issue.number);
    context.issueUrl = rawPayload.issue.url;
  }
  
  // Generate idempotency key
  const idempotencyKey = generateIdempotencyKey(rawPayload);
  
  // Generate deterministic event ID
  const eventId = generateEventId(rawPayload);
  
  return {
    eventId,
    source: 'github' as WebhookSource,
    type: `github.${category}.${normalizedAction}`,
    timestamp: timestamp,
    actor,
    target,
    action: {
      type: mapActionType(normalizedAction),
      description: actionDesc,
    },
    content,
    context,
    idempotencyKey,
    rawPayload: originalRaw as Record<string, unknown>,
    metadata: {
      receivedAt: new Date().toISOString(),
      normalizerVersion: '1.0.0',
    },
  };
}

/**
 * Build target based on event category
 */
function buildTarget(
  category: string,
  payload: GitHubWebhookPayload
): NormalizedWebhookEvent['target'] {
  switch (category) {
    case 'pull_request':
    case 'pull_request_review':
    case 'pull_request_comment':
      return payload.pullRequest
        ? {
            type: 'pull_request',
            id: String(payload.pullRequest.number),
            name: payload.pullRequest.title,
            url: payload.pullRequest.url,
          }
        : undefined;
    
    case 'issue_comment':
    case 'issues':
      return payload.issue
        ? {
            type: 'issue',
            id: String(payload.issue.number),
            name: payload.issue.title,
            url: payload.issue.url,
          }
        : undefined;
    
    case 'push':
      return {
        type: 'repository',
        id: payload.repository.name,
        name: payload.repository.fullName,
        url: payload.repository.url,
      };
    
    case 'release':
      return {
        type: 'repository',
        id: payload.repository.name,
        name: `Release: ${payload.rawPayload.release?.['tag_name'] || 'unknown'}`,
        url: payload.repository.url,
      };
    
    default:
      return {
        type: 'repository',
        id: payload.repository.name,
        name: payload.repository.fullName,
        url: payload.repository.url,
      };
  }
}

/**
 * Build action description
 */
function buildActionDescription(
  category: string,
  action: string,
  target?: NormalizedWebhookEvent['target'],
  actor?: NormalizedWebhookEvent['actor']
): string {
  const actorName = actor?.name || 'Unknown';
  const targetName = target?.name || 'unknown';
  const targetType = target?.type || 'resource';
  
  const descriptions: Record<string, string> = {
    'pull_request.opened': `${actorName} opened pull request ${targetName}`,
    'pull_request.closed': `${actorName} closed pull request ${targetName}`,
    'pull_request.reopened': `${actorName} reopened pull request ${targetName}`,
    'pull_request.updated': `${actorName} updated pull request ${targetName}`,
    'pull_request_review.submitted': `${actorName} submitted a review on ${targetName}`,
    'issue_comment.created': `${actorName} commented on ${targetType} ${targetName}`,
    'issues.opened': `${actorName} opened issue ${targetName}`,
    'issues.closed': `${actorName} closed issue ${targetName}`,
    'issues.labeled': `${actorName} labeled issue ${targetName}`,
    'push': `${actorName} pushed to ${targetName}`,
    'release.published': `${actorName} published a release on ${targetName}`,
    'fork': `${actorName} forked ${targetName}`,
    'watch.started': `${actorName} starred ${targetName}`,
  };
  
  const key = `${category}.${action}`;
  return descriptions[key] || `${actorName} ${action} ${targetType}`;
}

/**
 * Build content from payload
 */
function buildContent(payload: GitHubWebhookPayload): NormalizedWebhookEvent['content'] {
  const content: NormalizedWebhookEvent['content'] = {};
  
  // Extract text content based on event type
  if (payload.comment?.body) {
    content.text = payload.comment.body;
  } else if (payload.pullRequest?.body) {
    content.text = payload.pullRequest.body;
  } else if (payload.issue?.body) {
    content.text = payload.issue.body;
  } else if (payload.push) {
    const commits = payload.push.commits;
    if (commits && commits.length > 0) {
      const commitMessages = commits.slice(0, 5).map(c => c.message.split('\n')[0]);
      content.text = `Pushed ${commits.length} commit(s):\n${commitMessages.join('\n')}`;
    }
  }
  
  // Extract attachments (for now, just links)
  if (payload.pullRequest?.url || payload.issue?.url) {
    content.attachments = [
      {
        type: 'link' as const,
        url: payload.pullRequest?.url || payload.issue?.url || '',
      },
    ];
  }
  
  return Object.keys(content).length > 0 ? content : undefined;
}

/**
 * Map normalized action to action type
 */
function mapActionType(action: string): NormalizedWebhookEvent['action']['type'] {
  const typeMap: Record<string, NormalizedWebhookEvent['action']['type']> = {
    opened: 'opened',
    created: 'created',
    updated: 'updated',
    edited: 'updated',
    synchronized: 'updated',
    deleted: 'deleted',
    closed: 'closed',
    reopened: 'opened',
    labeled: 'updated',
    submitted: 'created',
    published: 'created',
    started: 'created',
  };
  
  return typeMap[action] || 'updated';
}

/**
 * Generate idempotency key for deduplication
 */
function generateIdempotencyKey(payload: GitHubWebhookPayload): string {
  const components: string[] = [
    payload.source,
    payload.eventType,
    payload.repository.fullName,
  ];
  
  // Add event-specific identifiers
  if (payload.pullRequest?.number) {
    components.push(`pr:${payload.pullRequest.number}`);
  }
  if (payload.issue?.number) {
    components.push(`issue:${payload.issue.number}`);
  }
  if (payload.comment?.id) {
    components.push(`comment:${payload.comment.id}`);
  }
  if (payload.push?.after) {
    components.push(`push:${payload.push.after}`);
  }
  
  // Add timestamp rounded to minute to allow retries within same minute
  const minuteTimestamp = Math.floor(new Date(payload.timestamp).getTime() / 60000);
  components.push(`min:${minuteTimestamp}`);
  
  const keyString = components.join('|');
  return `gh_${createHash('sha256').update(keyString).digest('hex').slice(0, 16)}`;
}

/**
 * Generate deterministic event ID
 */
function generateEventId(payload: GitHubWebhookPayload): string {
  const idempotencyKey = generateIdempotencyKey(payload);
  return `evt_gh_${uuidv4()}`;
}

/**
 * Check if webhook requires agent action
 */
export function requiresAgentAction(payload: GitHubWebhookPayload): boolean {
  const actionEvents: Set<string> = new Set([
    'pull_request.opened',
    'pull_request.reopened',
    'issue_comment.created',
    'pull_request_comment.created',
    'issues.opened',
    'issues.labeled',
    'pull_request_review.submitted',
  ]);
  
  return actionEvents.has(payload.eventType);
}

/**
 * Infer agent role from webhook event
 */
export function inferAgentRole(payload: GitHubWebhookPayload): 'builder' | 'validator' | 'reviewer' | 'security' {
  const eventType = payload.eventType;
  
  // Security-related events
  if (eventType.includes('security') || eventType.includes('vulnerability')) {
    return 'security';
  }
  
  // Review events
  if (eventType.includes('review') || eventType.includes('comment')) {
    return 'reviewer';
  }
  
  // PR/Issue opened - needs builder
  if (eventType === 'pull_request.opened' || eventType === 'issues.opened') {
    return 'builder';
  }
  
  // Default to builder
  return 'builder';
}
