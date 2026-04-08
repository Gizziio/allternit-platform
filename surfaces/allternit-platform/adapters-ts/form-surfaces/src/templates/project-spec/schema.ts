/**
 * Project Specification Form Schema
 * 
 * MVP form template for project intake.
 */

import { createFormSchema } from '../../schema/FormSchema';
import {
  createTextField,
  createTextAreaField,
  createSelectField,
  createCheckboxField,
} from '../../schema/FieldTypes';

/**
 * Project specification form schema
 */
export const projectSpecSchema = createFormSchema({
  id: 'project-spec-intake',
  title: 'New Project Specification',
  description: 'Define your project requirements and specifications',
  fields: [
    // Section: Basic Info
    {
      id: 'section-basic',
      type: 'text',
      label: 'Basic Information',
      disabled: true,
      className: 'section-header',
    },
    
    createTextField('project_name', 'Project Name', {
      required: true,
      placeholder: 'Enter project name',
      validation: [
        { type: 'required', message: 'Project name is required' },
        { type: 'minLength', value: 3, message: 'Name must be at least 3 characters' },
      ],
    }),

    createTextAreaField('project_description', 'Project Description', {
      required: true,
      placeholder: 'Describe what this project does and why it matters',
      rows: 4,
      validation: [
        { type: 'required', message: 'Description is required' },
        { type: 'minLength', value: 50, message: 'Description must be at least 50 characters' },
      ],
    }),

    createSelectField('project_type', 'Project Type', [
      { value: 'web_app', label: 'Web Application' },
      { value: 'mobile_app', label: 'Mobile Application' },
      { value: 'api', label: 'API / Backend' },
      { value: 'cli', label: 'CLI Tool' },
      { value: 'library', label: 'Library / Package' },
      { value: 'infrastructure', label: 'Infrastructure' },
      { value: 'other', label: 'Other' },
    ], {
      required: true,
    }),

    // Section: Goals
    {
      id: 'section-goals',
      type: 'text',
      label: 'Goals & Objectives',
      disabled: true,
      className: 'section-header',
    },

    createTextAreaField('goals', 'Primary Goals', {
      required: true,
      placeholder: 'List the main goals this project should achieve',
      rows: 3,
    }),

    createTextAreaField('success_criteria', 'Success Criteria', {
      placeholder: 'How will we measure success?',
      rows: 3,
    }),

    // Section: Target Users
    {
      id: 'section-users',
      type: 'text',
      label: 'Target Users',
      disabled: true,
      className: 'section-header',
    },

    createTextAreaField('target_users', 'Who will use this?', {
      required: true,
      placeholder: 'Describe your target users (e.g., developers, end users, specific roles)',
      rows: 3,
    }),

    createTextField('user_count', 'Expected User Count', {
      placeholder: 'e.g., 100 users, 10k requests/day',
    }),

    // Section: Technical
    {
      id: 'section-technical',
      type: 'text',
      label: 'Technical Preferences',
      disabled: true,
      className: 'section-header',
    },

    createSelectField('tech_stack', 'Preferred Tech Stack', [
      { value: 'typescript', label: 'TypeScript / Node.js' },
      { value: 'python', label: 'Python' },
      { value: 'rust', label: 'Rust' },
      { value: 'go', label: 'Go' },
      { value: 'java', label: 'Java / Kotlin' },
      { value: 'dotnet', label: '.NET' },
      { value: 'other', label: 'Other / Flexible' },
    ]),

    createTextAreaField('tech_constraints', 'Technical Constraints', {
      placeholder: 'Any specific technical requirements or constraints?',
      rows: 2,
    }),

    createCheckboxField('needs_auth', 'Requires Authentication', {
      checkboxLabel: 'This project needs user authentication',
    }),

    createCheckboxField('needs_database', 'Requires Database', {
      checkboxLabel: 'This project needs a database',
    }),

    // Section: Timeline & Budget
    {
      id: 'section-timeline',
      type: 'text',
      label: 'Timeline & Resources',
      disabled: true,
      className: 'section-header',
    },

    createSelectField('timeline', 'Expected Timeline', [
      { value: '1_week', label: '1 Week' },
      { value: '2_weeks', label: '2 Weeks' },
      { value: '1_month', label: '1 Month' },
      { value: '2_months', label: '2 Months' },
      { value: '3_months', label: '3 Months' },
      { value: '6_months', label: '6 Months' },
      { value: 'flexible', label: 'Flexible' },
    ]),

    createSelectField('priority', 'Priority Level', [
      { value: 'critical', label: 'Critical - Blocking other work' },
      { value: 'high', label: 'High - Important for Q goals' },
      { value: 'medium', label: 'Medium - Nice to have' },
      { value: 'low', label: 'Low - Backlog item' },
    ]),

    createTextAreaField('budget_notes', 'Budget Considerations', {
      placeholder: 'Any budget constraints or cost considerations?',
      rows: 2,
    }),

    // Section: Additional
    {
      id: 'section-additional',
      type: 'text',
      label: 'Additional Information',
      disabled: true,
      className: 'section-header',
    },

    createTextAreaField('notes', 'Additional Notes', {
      placeholder: 'Any other details, references, or context?',
      rows: 4,
    }),
  ],
  layout: {
    type: 'sections',
    sections: [
      {
        id: 'basic',
        title: 'Basic Information',
        fieldIds: ['section-basic', 'project_name', 'project_description', 'project_type'],
      },
      {
        id: 'goals',
        title: 'Goals & Objectives',
        fieldIds: ['section-goals', 'goals', 'success_criteria'],
      },
      {
        id: 'users',
        title: 'Target Users',
        fieldIds: ['section-users', 'target_users', 'user_count'],
      },
      {
        id: 'technical',
        title: 'Technical Preferences',
        fieldIds: ['section-technical', 'tech_stack', 'tech_constraints', 'needs_auth', 'needs_database'],
      },
      {
        id: 'timeline',
        title: 'Timeline & Resources',
        fieldIds: ['section-timeline', 'timeline', 'priority', 'budget_notes'],
      },
      {
        id: 'additional',
        title: 'Additional Information',
        fieldIds: ['section-additional', 'notes'],
      },
    ],
  },
  validation: {
    mode: 'onSubmit',
    stopOnFirstError: false,
  },
});

/**
 * Get project spec schema
 */
export function getProjectSpecSchema() {
  return projectSpecSchema;
}

/**
 * Default values for project spec
 */
export const projectSpecDefaults: Record<string, unknown> = {
  project_type: 'web_app',
  tech_stack: 'typescript',
  timeline: '1_month',
  priority: 'medium',
  needs_auth: true,
  needs_database: true,
};
