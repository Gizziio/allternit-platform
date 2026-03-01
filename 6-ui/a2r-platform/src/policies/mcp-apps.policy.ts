/**
 * MCP Apps Policy
 * 
 * Defines default permissions and capability validation for Interactive Capsules.
 */

import { CapsulePermission } from '@a2r/mcp-apps-adapter';

export type PermissionType = 
  | 'tool:invoke'
  | 'tool:subscribe'
  | 'state:read'
  | 'state:write'
  | 'event:emit'
  | 'event:subscribe';

export interface PermissionCheck {
  permission_type: PermissionType;
  resource: string;
  action?: string;
}

export interface PermissionCheckResult {
  allowed: boolean;
  reason?: string;
  matchedRule?: CapsulePermission;
}

export const DEFAULT_CAPSULE_PERMISSIONS: CapsulePermission[] = [
  { permission_type: 'event:emit', resource: '*' },
  { permission_type: 'event:subscribe', resource: '*' },
  { permission_type: 'state:read', resource: '*' },
];

export function checkPermission(
  permissions: CapsulePermission[],
  check: PermissionCheck
): PermissionCheckResult {
  const matchingRule = permissions.find((perm) => {
    if (perm.permission_type !== check.permission_type) return false;
    if (!matchResource(perm.resource, check.resource)) return false;
    if (check.action && perm.actions && !perm.actions.includes(check.action) && !perm.actions.includes('*')) {
      return false;
    }
    return true;
  });

  return matchingRule 
    ? { allowed: true, matchedRule: matchingRule }
    : { allowed: false, reason: `No permission for ${check.permission_type} on ${check.resource}` };
}

function matchResource(pattern: string, resource: string): boolean {
  if (pattern === '*') return true;
  if (pattern === resource) return true;
  if (pattern.endsWith('*')) return resource.startsWith(pattern.slice(0, -1));
  if (pattern.startsWith('*')) return resource.endsWith(pattern.slice(1));
  return false;
}

export function canInvokeTool(permissions: CapsulePermission[], toolName: string): PermissionCheckResult {
  return checkPermission(permissions, { permission_type: 'tool:invoke', resource: toolName, action: 'invoke' });
}

export function validateSurface(surface: { html: string; js?: string }): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  const content = `${surface.html} ${surface.js || ''}`;
  
  const dangerousPatterns = [
    { pattern: /<script[^>]*src=/i, message: 'External scripts not allowed' },
    { pattern: /eval\s*\(/i, message: 'eval() not allowed' },
    { pattern: /window\.parent/i, message: 'window.parent access not allowed' },
    { pattern: /document\.cookie/i, message: 'Cookie access not allowed' },
    { pattern: /localStorage/i, message: 'localStorage access not allowed' },
  ];

  for (const { pattern, message } of dangerousPatterns) {
    if (pattern.test(content)) errors.push(message);
  }

  return { valid: errors.length === 0, errors };
}
