/**
 * Agent Role Definitions for A2R UI Development
 */

import type { AgentRole } from '../types';

export interface AgentManifest {
  agent_id: AgentRole;
  name: string;
  version: string;
  description: string;
  domain: string;
  permissions: {
    read: string[];
    write: string[];
    execute: string[];
    forbidden: string[];
  };
  tools: string[];
  constraints: string[];
  acceptance_criteria: string[];
}

// Role hierarchy (lower = more authority)
export const ROLE_HIERARCHY: Record<AgentRole, number> = {
  'UI_REVIEWER': 0,
  'UI_ARCHITECT': 1,
  'UI_TESTER': 2,
  'UI_IMPLEMENTER': 3,
};

// Check if role A can override role B
export function canOverride(roleA: AgentRole, roleB: AgentRole): boolean {
  return ROLE_HIERARCHY[roleA] < ROLE_HIERARCHY[roleB];
}

// Check if role can modify path
export function canModify(role: AgentRole, path: string): boolean {
  switch (role) {
    case 'UI_ARCHITECT':
      return path.includes('.types.ts') || path.includes('.schema.ts') || path.includes('docs/');
    case 'UI_IMPLEMENTER':
      return path.includes('.tsx') || path.includes('.css') || path.includes('.test.tsx');
    case 'UI_TESTER':
      return path.includes('.test.tsx') || path.includes('.spec.tsx');
    case 'UI_REVIEWER':
      return false; // Reviewers cannot modify code
    default:
      return false;
  }
}

// Get allowed tools for role
export function getAllowedTools(role: AgentRole): string[] {
  switch (role) {
    case 'UI_ARCHITECT':
      return ['file_read', 'file_write', 'schema_generate', 'storybook_preview', 'a11y_audit'];
    case 'UI_IMPLEMENTER':
      return ['file_read', 'file_write', 'component_scaffold', 'test_generate', 'story_generate'];
    case 'UI_TESTER':
      return ['file_read', 'file_write', 'test_generate', 'coverage_report', 'visual_diff'];
    case 'UI_REVIEWER':
      return ['file_read', 'review_comment', 'approve', 'reject', 'storybook_preview'];
    default:
      return [];
  }
}
