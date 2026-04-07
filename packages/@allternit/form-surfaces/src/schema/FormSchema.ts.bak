/**
 * Form Schema Definitions
 *
 * Core types for form surfaces.
 */

import type { FormField } from './FieldTypes';

/**
 * Form surface type extending base surface
 */
export interface FormSurface {
  type: 'form';
  schema: FormSchema;
  initialValues?: Record<string, unknown>;
  mode: 'guided' | 'advanced';
  locks?: string[];
}

/**
 * Complete form schema definition
 */
export interface FormSchema {
  /** Unique form identifier */
  id: string;
  /** Schema version */
  version: string;
  /** Form title */
  title: string;
  /** Form description */
  description?: string;
  /** Form fields */
  fields: FormField[];
  /** Layout configuration */
  layout?: FormLayout;
  /** Validation configuration */
  validation?: FormValidation;
  /** Form metadata */
  metadata?: FormMetadata;
}

/**
 * Form layout configuration
 */
export interface FormLayout {
  /** Layout type */
  type: 'single' | 'tabs' | 'wizard' | 'sections';
  /** Sections for section-based layouts */
  sections?: FormSection[];
  /** Tab configuration for tab layouts */
  tabs?: FormTab[];
  /** Column configuration */
  columns?: number;
  /** Field order (field IDs) */
  fieldOrder?: string[];
}

/**
 * Form section
 */
export interface FormSection {
  id: string;
  title: string;
  description?: string;
  fieldIds: string[];
  collapsible?: boolean;
  collapsed?: boolean;
}

/**
 * Form tab
 */
export interface FormTab {
  id: string;
  title: string;
  fieldIds: string[];
}

/**
 * Form validation configuration
 */
export interface FormValidation {
  /** Global validation rules */
  rules?: ValidationRule[];
  /** Validation mode */
  mode: 'onChange' | 'onBlur' | 'onSubmit';
  /** Stop on first error */
  stopOnFirstError?: boolean;
}

/**
 * Validation rule
 */
export interface ValidationRule {
  /** Field ID or '*' for all fields */
  fieldId: string;
  /** Rule type */
  type: 'required' | 'min' | 'max' | 'minLength' | 'maxLength' | 'pattern' | 'email' | 'custom';
  /** Rule value */
  value?: unknown;
  /** Error message */
  message: string;
  /** Custom validator function (for 'custom' type) */
  validator?: (value: unknown, values: Record<string, unknown>) => boolean;
}

/**
 * Form metadata
 */
export interface FormMetadata {
  /** Creation timestamp */
  createdAt: Date;
  /** Last updated timestamp */
  updatedAt: Date;
  /** Author/Creator */
  author?: string;
  /** Tags */
  tags?: string[];
  /** Category */
  category?: string;
}

/**
 * Form submission data
 */
export interface FormSubmission {
  /** Form ID */
  formId: string;
  /** Submission ID */
  id: string;
  /** Submitted values */
  values: Record<string, unknown>;
  /** Submission timestamp */
  submittedAt: Date;
  /** Submitter info */
  submittedBy?: string;
  /** Submission metadata */
  metadata?: SubmissionMetadata;
}

/**
 * Submission metadata
 */
export interface SubmissionMetadata {
  /** Submission source */
  source?: string;
  /** Time spent on form (ms) */
  timeSpent?: number;
  /** Number of edits */
  editCount?: number;
  /** User agent */
  userAgent?: string;
}

/**
 * Form mode toggle event
 */
export interface FormModeChangeEvent {
  formId: string;
  previousMode: 'guided' | 'advanced';
  newMode: 'guided' | 'advanced';
}

/**
 * Form field change event
 */
export interface FormFieldChangeEvent {
  formId: string;
  fieldId: string;
  value: unknown;
  previousValue: unknown;
  isValid: boolean;
  errors?: string[];
}

/**
 * Form submission event
 */
export interface FormSubmitEvent {
  formId: string;
  submission: FormSubmission;
  isValid: boolean;
  errors?: FormValidationError[];
}

/**
 * Form validation error
 */
export interface FormValidationError {
  fieldId: string;
  message: string;
  rule: string;
}

/**
 * Form answer (stored submission)
 */
export interface FormAnswer {
  /** Answer ID */
  id: string;
  /** Form ID */
  formId: string;
  /** Answer values */
  values: Record<string, unknown>;
  /** Version number */
  version: number;
  /** Created timestamp */
  createdAt: Date;
  /** Updated timestamp */
  updatedAt: Date;
  /** Locked fields */
  locks: string[];
  /** Answer metadata */
  metadata?: AnswerMetadata;
}

/**
 * Answer metadata
 */
export interface AnswerMetadata {
  /** Creation source */
  source?: string;
  /** Number of versions */
  versionCount?: number;
  /** Last editor */
  lastEditedBy?: string;
  /** Edit history */
  editHistory?: AnswerEdit[];
}

/**
 * Answer edit record
 */
export interface AnswerEdit {
  timestamp: Date;
  editedBy?: string;
  changes: Record<string, { from: unknown; to: unknown }>;
}

/**
 * Form surface message types
 */
export type FormSurfaceMessage =
  | { type: 'form:request'; formId: string }
  | { type: 'form:render'; surface: FormSurface }
  | { type: 'form:submit'; submission: FormSubmission }
  | { type: 'form:validate'; formId: string; values: Record<string, unknown> }
  | { type: 'form:validate:response'; isValid: boolean; errors?: FormValidationError[] }
  | { type: 'form:change'; event: FormFieldChangeEvent }
  | { type: 'form:mode:change'; event: FormModeChangeEvent };

/**
 * Create empty form schema
 */
export function createFormSchema(partial: Partial<FormSchema> & { id: string; title: string }): FormSchema {
  return {
    version: '1.0.0',
    fields: [],
    layout: { type: 'single' },
    validation: { mode: 'onSubmit' },
    metadata: {
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    ...partial,
  };
}

/**
 * Create form answer
 */
export function createFormAnswer(
  formId: string,
  values: Record<string, unknown>,
  id?: string
): FormAnswer {
  const now = new Date();
  return {
    id: id || `answer-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    formId,
    values,
    version: 1,
    createdAt: now,
    updatedAt: now,
    locks: [],
  };
}
