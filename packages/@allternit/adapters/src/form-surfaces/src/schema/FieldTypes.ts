/**
 * Form Field Types
 * 
 * All supported form field types.
 */

/**
 * Base field properties
 */
export interface BaseField {
  /** Unique field ID */
  id: string;
  /** Field type */
  type: string;
  /** Field label */
  label: string;
  /** Field description/help text */
  description?: string;
  /** Placeholder text */
  placeholder?: string;
  /** Whether field is required */
  required?: boolean;
  /** Whether field is disabled */
  disabled?: boolean;
  /** Whether field is read-only */
  readOnly?: boolean;
  /** Default value */
  defaultValue?: unknown;
  /** Validation rules */
  validation?: FieldValidation[];
  /** Conditional visibility */
  condition?: FieldCondition;
  /** Field width (1-12) */
  width?: number;
  /** Custom CSS class */
  className?: string;
}

/**
 * Text field (single line)
 */
export interface TextField extends BaseField {
  type: 'text';
  /** Minimum length */
  minLength?: number;
  /** Maximum length */
  maxLength?: number;
  /** Input pattern (regex) */
  pattern?: string;
  /** Auto-complete hint */
  autoComplete?: string;
}

/**
 * Text area (multi-line)
 */
export interface TextAreaField extends BaseField {
  type: 'textarea';
  /** Number of rows */
  rows?: number;
  /** Minimum length */
  minLength?: number;
  /** Maximum length */
  maxLength?: number;
  /** Enable rich text editing */
  richText?: boolean;
}

/**
 * Number field
 */
export interface NumberField extends BaseField {
  type: 'number';
  /** Minimum value */
  min?: number;
  /** Maximum value */
  max?: number;
  /** Step increment */
  step?: number;
  /** Allow decimals */
  decimals?: boolean;
  /** Number format */
  format?: 'integer' | 'decimal' | 'currency' | 'percentage';
  /** Currency code (for currency format) */
  currency?: string;
}

/**
 * Select field (dropdown)
 */
export interface SelectField extends BaseField {
  type: 'select';
  /** Available options */
  options: SelectOption[];
  /** Allow clearing selection */
  clearable?: boolean;
  /** Enable search/filter */
  searchable?: boolean;
  /** Allow creating new options */
  creatable?: boolean;
}

/**
 * Select option
 */
export interface SelectOption {
  /** Option value */
  value: string;
  /** Option label */
  label: string;
  /** Option disabled */
  disabled?: boolean;
  /** Option group */
  group?: string;
  /** Option metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Multi-select field
 */
export interface MultiSelectField extends BaseField {
  type: 'multiselect';
  /** Available options */
  options: SelectOption[];
  /** Minimum selections */
  minSelections?: number;
  /** Maximum selections */
  maxSelections?: number;
  /** Display as checkboxes */
  asCheckboxes?: boolean;
  /** Display as tags */
  asTags?: boolean;
}

/**
 * Radio field (single choice)
 */
export interface RadioField extends BaseField {
  type: 'radio';
  /** Available options */
  options: SelectOption[];
  /** Display inline */
  inline?: boolean;
}

/**
 * Checkbox field (boolean)
 */
export interface CheckboxField extends BaseField {
  type: 'checkbox';
  /** Checkbox label */
  checkboxLabel?: string;
  /** Checked value */
  checkedValue?: unknown;
  /** Unchecked value */
  uncheckedValue?: unknown;
}

/**
 * Date field
 */
export interface DateField extends BaseField {
  type: 'date';
  /** Minimum date */
  minDate?: Date | string;
  /** Maximum date */
  maxDate?: Date | string;
  /** Date format */
  format?: string;
  /** Show time picker */
  showTime?: boolean;
}

/**
 * File upload field
 */
export interface FileField extends BaseField {
  type: 'file';
  /** Accepted file types */
  accept?: string[];
  /** Maximum file size (bytes) */
  maxSize?: number;
  /** Allow multiple files */
  multiple?: boolean;
  /** Maximum number of files */
  maxFiles?: number;
  /** Show file preview */
  preview?: boolean;
}

/**
 * Custom field (component reference)
 */
export interface CustomField extends BaseField {
  type: 'custom';
  /** Custom component identifier */
  component: string;
  /** Component props */
  props?: Record<string, unknown>;
}

/**
 * Array field (list of items)
 */
export interface ArrayField extends BaseField {
  type: 'array';
  /** Field schema for array items */
  itemSchema: FormField;
  /** Minimum items */
  minItems?: number;
  /** Maximum items */
  maxItems?: number;
  /** Add button label */
  addLabel?: string;
  /** Remove button label */
  removeLabel?: string;
}

/**
 * Object field (nested form)
 */
export interface ObjectField extends BaseField {
  type: 'object';
  /** Nested field schemas */
  properties: FormField[];
}

/**
 * All field types union
 */
export type FormField =
  | TextField
  | TextAreaField
  | NumberField
  | SelectField
  | MultiSelectField
  | RadioField
  | CheckboxField
  | DateField
  | FileField
  | CustomField
  | ArrayField
  | ObjectField;

/**
 * Field validation rule
 */
export interface FieldValidation {
  /** Rule type */
  type: 'required' | 'min' | 'max' | 'minLength' | 'maxLength' | 'pattern' | 'email' | 'url' | 'custom';
  /** Rule value */
  value?: unknown;
  /** Error message */
  message: string;
  /** Custom validator (for 'custom' type) */
  validator?: (value: unknown) => boolean;
}

/**
 * Field condition for conditional visibility
 */
export interface FieldCondition {
  /** Field to watch */
  field: string;
  /** Operator */
  operator: 'eq' | 'ne' | 'gt' | 'lt' | 'gte' | 'lte' | 'in' | 'contains' | 'startsWith' | 'endsWith';
  /** Value to compare */
  value: unknown;
  /** Multiple conditions (AND logic) */
  and?: FieldCondition[];
  /** Multiple conditions (OR logic) */
  or?: FieldCondition[];
  /** Negate condition */
  not?: boolean;
}

/**
 * Field dependency for invalidation
 */
export interface FieldDependency {
  /** Field ID */
  fieldId: string;
  /** Fields this depends on */
  dependsOn: string[];
  /** Fields this invalidates when changed */
  invalidates: string[];
  /** Fields that invalidate this when changed */
  invalidatedBy: string[];
  /** Condition for dependency */
  condition?: FieldCondition;
}

/**
 * Create a text field
 */
export function createTextField(id: string, label: string, partial?: Partial<TextField>): TextField {
  return { type: 'text', id, label, ...partial };
}

/**
 * Create a select field
 */
export function createSelectField(
  id: string,
  label: string,
  options: SelectOption[],
  partial?: Partial<SelectField>
): SelectField {
  return { type: 'select', id, label, options, ...partial };
}

/**
 * Create a checkbox field
 */
export function createCheckboxField(id: string, label: string, partial?: Partial<CheckboxField>): CheckboxField {
  return { type: 'checkbox', id, label, ...partial };
}

/**
 * Create a textarea field
 */
export function createTextAreaField(id: string, label: string, partial?: Partial<TextAreaField>): TextAreaField {
  return { type: 'textarea', id, label, rows: 4, ...partial };
}
