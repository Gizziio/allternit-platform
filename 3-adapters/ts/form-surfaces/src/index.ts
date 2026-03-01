/**
 * Form Surfaces
 * 
 * Forms as first-class agent communication surface.
 * 
 * @example
 * ```tsx
 * import { FormRenderer, projectSpecSchema } from '@a2r/form-surfaces';
 * 
 * <FormRenderer
 *   schema={projectSpecSchema}
 *   onSubmit={async (values) => {
 *     console.log('Form submitted:', values);
 *   }}
 * />
 * ```
 */

// Schema
export type {
  FormSurface,
  FormSchema,
  FormLayout,
  FormSection,
  FormTab,
  FormValidation,
  ValidationRule,
  FormMetadata,
  FormSubmission,
  SubmissionMetadata,
  FormAnswer,
  AnswerMetadata,
  AnswerEdit,
  FormFieldChangeEvent,
  FormSubmitEvent,
  FormModeChangeEvent,
  FormValidationError,
  FormSurfaceMessage,
} from './schema/FormSchema';

export {
  createFormSchema,
  createFormAnswer,
} from './schema/FormSchema';

// Field Types
export type {
  FormField,
  TextField,
  TextAreaField,
  NumberField,
  SelectField,
  SelectOption,
  MultiSelectField,
  RadioField,
  CheckboxField,
  DateField,
  FileField,
  CustomField,
  ArrayField,
  ObjectField,
  FieldValidation,
  FieldCondition,
  FieldDependency,
} from './schema/FieldTypes';

export {
  createTextField,
  createSelectField,
  createCheckboxField,
  createTextAreaField,
} from './schema/FieldTypes';

// Renderer
export type { FormRendererProps } from './renderer/FormRenderer';
export { FormRenderer } from './renderer/FormRenderer';

export type { FieldRendererProps } from './renderer/FieldRenderer';
export { FieldRenderer } from './renderer/FieldRenderer';

// Answer Store
export type { AnswerStore } from './answer-store/store';
export { getAnswerStore, resetAnswerStore } from './answer-store/store';

// Emitters
export type { ArtifactEmitter, TemplateFunction } from './emitters/template';
export {
  renderTemplate,
  createEmitter,
  emitArtifact,
  exportToArtifacts,
} from './emitters/template';

export { VisionEmitter } from './emitters/VisionEmitter';

// Templates
export {
  projectSpecSchema,
  projectSpecDefaults,
  getProjectSpecSchema,
} from './templates/project-spec/schema';

// Version
export const FORM_SURFACES_VERSION = '1.0.0';
