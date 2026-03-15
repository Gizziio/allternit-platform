/**
 * Work Request Creator
 * 
 * Creates work requests from normalized webhook events.
 * Determines appropriate role, execution mode, and requirements.
 */

import type { NormalizedWebhookEvent } from '../types/webhook.types.js';

/**
 * Work request configuration
 */
export interface WorkRequestConfig {
  /** Agent role */
  role: 'builder' | 'validator' | 'reviewer' | 'security';
  /** Execution mode */
  executionMode: 'PLAN_ONLY' | 'REQUIRE_APPROVAL' | 'ACCEPT_EDITS' | 'BYPASS_PERMISSIONS';
  /** Priority (0 = normal) */
  priority: number;
  /** Required gates */
  requiredGates: string[];
  /** Required evidence types */
  requiredEvidence: string[];
  /** Whether lease is required */
  leaseRequired: boolean;
  /** Lease scope */
  leaseScope?: {
    allowedPaths: string[];
    allowedTools: string[];
  };
}

/**
 * Infer work request config from normalized event
 */
export function inferWorkRequestConfig(
  event: NormalizedWebhookEvent
): WorkRequestConfig {
  const { source, type, actor, action, content } = event;
  
  // Determine role based on event characteristics
  const role = inferRole(source, type, actor, content);
  
  // Determine execution mode
  const executionMode = inferExecutionMode(source, type, action);
  
  // Determine priority
  const priority = inferPriority(source, type, content);
  
  // Determine required gates
  const requiredGates = determineGates(role, executionMode);
  
  // Determine required evidence
  const requiredEvidence = determineEvidence(role);
  
  // Determine lease requirements
  const leaseRequired = role === 'builder' && executionMode !== 'PLAN_ONLY';
  const leaseScope = leaseRequired ? {
    allowedPaths: ['**/*'],
    allowedTools: getRequiredTools(role),
  } : undefined;
  
  return {
    role,
    executionMode,
    priority,
    requiredGates,
    requiredEvidence,
    leaseRequired,
    leaseScope,
  };
}

/**
 * Infer agent role from event
 */
function inferRole(
  source: string,
  type: string,
  actor?: NormalizedWebhookEvent['actor'],
  content?: NormalizedWebhookEvent['content']
): 'builder' | 'validator' | 'reviewer' | 'security' {
  // Check content for keywords
  const text = content?.text?.toLowerCase() || '';
  
  // Security-related keywords
  if (text.includes('security') || text.includes('vulnerability') || 
      text.includes('exploit') || text.includes('cve') ||
      type.includes('security')) {
    return 'security';
  }
  
  // Review-related keywords
  if (text.includes('review') || text.includes('pr') || 
      text.includes('pull request') || text.includes('feedback') ||
      type.includes('review') || type.includes('comment')) {
    return 'reviewer';
  }
  
  // Validation-related keywords
  if (text.includes('test') || text.includes('validate') || 
      text.includes('verify') || text.includes('check') ||
      type.includes('challenge')) {
    return 'validator';
  }
  
  // Default to builder for most events
  return 'builder';
}

/**
 * Infer execution mode from event
 */
function inferExecutionMode(
  source: string,
  type: string,
  action?: NormalizedWebhookEvent['action']
): 'PLAN_ONLY' | 'REQUIRE_APPROVAL' | 'ACCEPT_EDITS' | 'BYPASS_PERMISSIONS' {
  // PR events typically require approval
  if (type.includes('pull_request')) {
    return 'REQUIRE_APPROVAL';
  }
  
  // Comment events can accept edits
  if (type.includes('comment')) {
    return 'ACCEPT_EDITS';
  }
  
  // Security events may bypass permissions
  if (type.includes('security')) {
    return 'BYPASS_PERMISSIONS';
  }
  
  // Default to plan only for safety
  return 'PLAN_ONLY';
}

/**
 * Infer priority from event
 */
function inferPriority(
  source: string,
  type: string,
  content?: NormalizedWebhookEvent['content']
): number {
  const text = content?.text?.toLowerCase() || '';
  
  // Critical keywords
  if (text.includes('critical') || text.includes('urgent') || 
      text.includes('emergency') || text.includes('production')) {
    return 100;
  }
  
  // High priority keywords
  if (text.includes('high') || text.includes('important') ||
      type.includes('critical')) {
    return 50;
  }
  
  // Medium priority keywords
  if (text.includes('medium') || text.includes('normal')) {
    return 10;
  }
  
  // Default priority
  return 0;
}

/**
 * Determine required gates based on role and mode
 */
function determineGates(
  role: string,
  executionMode: string
): string[] {
  const gates = ['policy_check'];
  
  // All writes require gate check
  if (executionMode !== 'PLAN_ONLY') {
    gates.push('write_gate');
  }
  
  // Approval mode requires review gate
  if (executionMode === 'REQUIRE_APPROVAL') {
    gates.push('review_gate');
  }
  
  // Security role requires security gate
  if (role === 'security') {
    gates.push('security_gate');
  }
  
  return gates;
}

/**
 * Determine required evidence based on role
 */
function determineEvidence(role: string): string[] {
  const evidence: string[] = [];
  
  // All roles need tool call receipts
  evidence.push('tool_call_post');
  
  // Builder needs build report
  if (role === 'builder') {
    evidence.push('build_report');
  }
  
  // Validator needs validator report
  if (role === 'validator') {
    evidence.push('validator_report');
  }
  
  // Reviewer needs review decision
  if (role === 'reviewer') {
    evidence.push('review_decision');
  }
  
  // Security needs security report
  if (role === 'security') {
    evidence.push('security_report');
  }
  
  return evidence;
}

/**
 * Get required tools for role
 */
function getRequiredTools(role: string): string[] {
  const baseTools = ['bash', 'read_file', 'write_file'];
  
  switch (role) {
    case 'builder':
      return [...baseTools, 'run_tests', 'build'];
    case 'validator':
      return [...baseTools, 'run_tests', 'validate'];
    case 'reviewer':
      return [...baseTools, 'read_file', 'comment'];
    case 'security':
      return [...baseTools, 'scan', 'audit'];
    default:
      return baseTools;
  }
}

/**
 * Check if event requires agent action
 */
export function requiresAgentAction(event: NormalizedWebhookEvent): boolean {
  const { type, action } = event;
  
  // Events that always require action
  const actionTypes = new Set([
    'github.pull_request.opened',
    'github.issues.opened',
    'github.issue_comment.created',
    'github.pull_request_comment.created',
    'discord.message.create',
    'antfarm.room.task.requested',
    'antfarm.room.message.created',
    'moltbook.post.created',
    'moltbook.comment.created',
    'moltbook.mention.received',
  ]);
  
  if (actionTypes.has(type)) {
    return true;
  }
  
  // Events with "created" action typically require action
  if (action?.type === 'created') {
    return true;
  }
  
  return false;
}
