/**
 * Permission System for MCP Apps
 * 
 * Validates capsule permissions for tool invocation, state access, and events.
 */

import type { CapsulePermission } from './types/index.js';

export interface PermissionCheck {
  permissionType: string;
  resource: string;
  action?: string;
}

export interface PermissionContext {
  capsuleId: string;
  agentId?: string;
  toolId: string;
  permissions: CapsulePermission[];
}

/**
 * Check if a capsule has a specific permission
 */
export function hasPermission(
  context: PermissionContext,
  check: PermissionCheck
): boolean {
  return context.permissions.some((perm) => {
    // Check permission type matches
    if (perm.permission_type !== check.permissionType) {
      return false;
    }

    // Check resource matches (supports wildcards)
    if (perm.resource !== '*' && perm.resource !== check.resource) {
      // Check for prefix wildcards like "tool:*"
      if (perm.resource.endsWith(':*')) {
        const prefix = perm.resource.slice(0, -2);
        if (!check.resource.startsWith(prefix)) {
          return false;
        }
      } else {
        return false;
      }
    }

    // Check action if specified
    if (check.action && perm.actions) {
      if (!perm.actions.includes('*') && !perm.actions.includes(check.action)) {
        return false;
      }
    }

    return true;
  });
}

/**
 * Check if capsule can invoke a tool
 */
export function canInvokeTool(
  context: PermissionContext,
  toolName: string
): boolean {
  return hasPermission(context, {
    permissionType: 'tool:invoke',
    resource: toolName,
  });
}

/**
 * Check if capsule can read state
 */
export function canReadState(
  context: PermissionContext,
  statePath: string
): boolean {
  return hasPermission(context, {
    permissionType: 'state:read',
    resource: statePath,
  });
}

/**
 * Check if capsule can write state
 */
export function canWriteState(
  context: PermissionContext,
  statePath: string
): boolean {
  return hasPermission(context, {
    permissionType: 'state:write',
    resource: statePath,
  });
}

/**
 * Check if capsule can emit an event
 */
export function canEmitEvent(
  context: PermissionContext,
  eventType: string
): boolean {
  return hasPermission(context, {
    permissionType: 'event:emit',
    resource: eventType,
  });
}

/**
 * Check if capsule can subscribe to events
 */
export function canSubscribeToEvents(
  context: PermissionContext,
  eventType: string
): boolean {
  return hasPermission(context, {
    permissionType: 'event:subscribe',
    resource: eventType,
  });
}

/**
 * Validate all permissions for a capsule surface
 * Returns array of validation errors (empty if valid)
 */
export function validatePermissions(
  permissions: CapsulePermission[]
): string[] {
  const errors: string[] = [];
  const validPermissionTypes = [
    'tool:invoke',
    'tool:subscribe',
    'state:read',
    'state:write',
    'event:emit',
    'event:subscribe',
  ];

  for (const perm of permissions) {
    // Validate permission type
    if (!validPermissionTypes.includes(perm.permission_type)) {
      errors.push(`Invalid permission type: ${perm.permission_type}`);
    }

    // Validate resource is not empty
    if (!perm.resource || perm.resource.trim() === '') {
      errors.push(`Empty resource for permission: ${perm.permission_type}`);
    }

    // Validate actions if provided
    if (perm.actions) {
      for (const action of perm.actions) {
        if (!isValidAction(action)) {
          errors.push(`Invalid action: ${action}`);
        }
      }
    }
  }

  return errors;
}

/**
 * Security scanner for surface content
 * Returns array of security warnings
 */
export function scanSurfaceSecurity(
  html: string,
  _css: string,
  js: string
): string[] {
  const warnings: string[] = [];

  // Check for dangerous JavaScript patterns
  const dangerousPatterns = [
    { pattern: /eval\s*\(/i, name: 'eval()' },
    { pattern: /new\s+Function\s*\(/i, name: 'Function constructor' },
    { pattern: /document\.write/i, name: 'document.write' },
    { pattern: /window\.parent/i, name: 'window.parent access' },
    { pattern: /window\.top/i, name: 'window.top access' },
    { pattern: /postMessage.*\*/i, name: 'wildcard postMessage target' },
    { pattern: /localStorage/i, name: 'localStorage access' },
    { pattern: /sessionStorage/i, name: 'sessionStorage access' },
    { pattern: /indexedDB/i, name: 'IndexedDB access' },
    { pattern: /fetch\s*\(/i, name: 'fetch API' },
    { pattern: /XMLHttpRequest/i, name: 'XMLHttpRequest' },
    { pattern: /WebSocket/i, name: 'WebSocket' },
  ];

  for (const { pattern, name } of dangerousPatterns) {
    if (pattern.test(js)) {
      warnings.push(`Potentially unsafe: ${name}`);
    }
  }

  // Check for inline event handlers in HTML
  if (/on\w+\s*=/i.test(html)) {
    warnings.push('Inline event handlers detected in HTML');
  }

  // Check for external resources
  if (/src\s*=\s*["']https?:/i.test(html)) {
    warnings.push('External resources detected in HTML');
  }

  return warnings;
}

function isValidAction(action: string): boolean {
  const validActions = ['create', 'read', 'update', 'delete', 'execute', '*'];
  return validActions.includes(action);
}

/**
 * Create a permission context from capsule data
 */
export function createPermissionContext(
  capsuleId: string,
  toolId: string,
  permissions: CapsulePermission[],
  agentId?: string
): PermissionContext {
  return {
    capsuleId,
    agentId,
    toolId,
    permissions,
  };
}

export default {
  hasPermission,
  canInvokeTool,
  canReadState,
  canWriteState,
  canEmitEvent,
  canSubscribeToEvents,
  validatePermissions,
  scanSurfaceSecurity,
  createPermissionContext,
};
