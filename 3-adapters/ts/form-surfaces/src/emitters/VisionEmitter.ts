/**
 * Vision.md Emitter
 * 
 * Generates project vision document from form answers.
 */

import { createEmitter } from './template';

const VISION_TEMPLATE = `# {{project_name}} - Project Vision

## Overview

{{project_description}}

### Project Type
{{project_type}}

## Goals

{{goals}}

{{#if success_criteria}}
## Success Criteria

{{success_criteria}}
{{/if}}

## Target Users

{{target_users}}

{{#if user_count}}
### Scale
{{user_count}}
{{/if}}

## Technical Approach

{{#if tech_stack}}
### Preferred Stack
{{tech_stack}}
{{/if}}

{{#if tech_constraints}}
### Constraints
{{tech_constraints}}
{{/if}}

### Requirements
{{#if needs_auth}}
- User authentication system required
{{/if}}
{{#if needs_database}}
- Database storage required
{{/if}}

## Timeline & Resources

{{#if timeline}}
**Timeline:** {{timeline}}
{{/if}}

{{#if priority}}
**Priority:** {{priority}}
{{/if}}

{{#if budget_notes}}
### Budget Considerations
{{budget_notes}}
{{/if}}

## Additional Context

{{#if notes}}
{{notes}}
{{/if}}

---

*Generated from project specification form*  
*ID: {{project_name | lowercase | replace " " "-"}}*
`;

/**
 * Vision emitter
 */
export const VisionEmitter = createEmitter(
  'Vision Document',
  'Vision.md',
  VISION_TEMPLATE
);

/**
 * Process value with filter
 */
function applyFilter(value: string, filter: string): string {
  switch (filter) {
    case 'lowercase':
      return value.toLowerCase();
    case 'uppercase':
      return value.toUpperCase();
    default:
      return value;
  }
}

export default VisionEmitter;
