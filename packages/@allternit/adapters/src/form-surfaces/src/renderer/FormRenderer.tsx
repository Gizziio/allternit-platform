/**
 * Form Renderer Component
 * 
 * Renders a complete form from schema with validation and submission.
 */

import React, { useState, useCallback, useEffect, useMemo } from 'react';
import styles from './FormRenderer.module.css';
import type { FormSchema, FormField, FormAnswer, FormValidationError } from '../schema';
import { FieldRenderer } from './FieldRenderer';
import { ValidationDisplay } from './ValidationDisplay';

export interface FormRendererProps {
  /** Form schema */
  schema: FormSchema;
  /** Initial values */
  initialValues?: Record<string, unknown>;
  /** Form mode */
  mode?: 'guided' | 'advanced';
  /** Locked fields */
  locks?: string[];
  /** Submit handler */
  onSubmit?: (values: Record<string, unknown>) => void | Promise<void>;
  /** Change handler */
  onChange?: (fieldId: string, value: unknown) => void;
  /** Validation handler */
  onValidate?: (isValid: boolean, errors: FormValidationError[]) => void;
  /** Mode change handler */
  onModeChange?: (mode: 'guided' | 'advanced') => void;
  /** Loading state */
  loading?: boolean;
  /** Read-only mode */
  readOnly?: boolean;
  /** Custom submit button label */
  submitLabel?: string;
  /** Show reset button */
  showReset?: boolean;
}

/**
 * Form Renderer Component
 */
export const FormRenderer: React.FC<FormRendererProps> = ({
  schema,
  initialValues = {},
  mode = 'advanced',
  locks = [],
  onSubmit,
  onChange,
  onValidate,
  onModeChange,
  loading = false,
  readOnly = false,
  submitLabel = 'Submit',
  showReset = false,
}) => {
  // Form state
  const [values, setValues] = useState<Record<string, unknown>>(initialValues);
  const [errors, setErrors] = useState<FormValidationError[]>([]);
  const [touched, setTouched] = useState<Set<string>>(new Set());
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [currentMode, setCurrentMode] = useState<'guided' | 'advanced'>(mode);
  const [currentStep, setCurrentStep] = useState(0);

  // Initialize values from schema defaults
  useEffect(() => {
    const defaultValues: Record<string, unknown> = {};
    schema.fields.forEach((field) => {
      if (field.defaultValue !== undefined) {
        defaultValues[field.id] = field.defaultValue;
      }
    });
    setValues((prev) => ({ ...defaultValues, ...initialValues, ...prev }));
  }, [schema, initialValues]);

  // Validate form
  const validate = useCallback((): FormValidationError[] => {
    const newErrors: FormValidationError[] = [];

    schema.fields.forEach((field) => {
      const value = values[field.id];

      // Check required
      if (field.required && (value === undefined || value === '' || value === null)) {
        newErrors.push({
          fieldId: field.id,
          message: `${field.label} is required`,
          rule: 'required',
        });
        return;
      }

      // Skip other validations if empty and not required
      if (value === undefined || value === '' || value === null) {
        return;
      }

      // Field-specific validations
      if (field.validation) {
        field.validation.forEach((rule) => {
          const isValid = validateRule(value, rule, values);
          if (!isValid) {
            newErrors.push({
              fieldId: field.id,
              message: rule.message,
              rule: rule.type,
            });
          }
        });
      }
    });

    return newErrors;
  }, [schema.fields, values]);

  // Run validation on change if mode is 'onChange'
  useEffect(() => {
    if (schema.validation?.mode === 'onChange') {
      const newErrors = validate();
      setErrors(newErrors);
      onValidate?.(newErrors.length === 0, newErrors);
    }
  }, [values, schema.validation?.mode, validate, onValidate]);

  // Handle field change
  const handleChange = useCallback((fieldId: string, value: unknown) => {
    setValues((prev) => ({ ...prev, [fieldId]: value }));
    onChange?.(fieldId, value);
  }, [onChange]);

  // Handle field blur
  const handleBlur = useCallback((fieldId: string) => {
    setTouched((prev) => new Set(prev).add(fieldId));

    if (schema.validation?.mode === 'onBlur') {
      const newErrors = validate();
      setErrors(newErrors);
      onValidate?.(newErrors.length === 0, newErrors);
    }
  }, [schema.validation?.mode, validate, onValidate]);

  // Handle form submit
  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();

    const newErrors = validate();
    setErrors(newErrors);
    onValidate?.(newErrors.length === 0, newErrors);

    if (newErrors.length > 0) {
      // Mark all fields as touched to show errors
      setTouched(new Set(schema.fields.map((f) => f.id)));
      return;
    }

    setIsSubmitting(true);
    try {
      await onSubmit?.(values);
    } finally {
      setIsSubmitting(false);
    }
  }, [validate, schema.fields, values, onSubmit, onValidate]);

  // Handle form reset
  const handleReset = useCallback(() => {
    setValues(initialValues);
    setErrors([]);
    setTouched(new Set());
  }, [initialValues]);

  // Handle mode toggle
  const handleModeToggle = useCallback(() => {
    const newMode = currentMode === 'guided' ? 'advanced' : 'guided';
    setCurrentMode(newMode);
    onModeChange?.(newMode);
  }, [currentMode, onModeChange]);

  // Get visible fields based on conditions
  const visibleFields = useMemo(() => {
    return schema.fields.filter((field) => {
      if (!field.condition) return true;
      return evaluateCondition(field.condition, values);
    });
  }, [schema.fields, values]);

  // Get fields for current step (guided mode)
  const currentFields = useMemo(() => {
    if (currentMode === 'advanced') return visibleFields;
    
    if (schema.layout?.type === 'wizard' && schema.layout.sections) {
      const section = schema.layout.sections[currentStep];
      return visibleFields.filter((f) => section.fieldIds.includes(f.id));
    }
    
    // Default: one field per step
    return visibleFields.slice(currentStep, currentStep + 1);
  }, [currentMode, visibleFields, currentStep, schema.layout]);

  const totalSteps = currentMode === 'guided' ? visibleFields.length : 1;

  return (
    <form className={styles.form} onSubmit={handleSubmit}>
      {/* Header */}
      <div className={styles.header}>
        <div className={styles.titleSection}>
          <h2 className={styles.title}>{schema.title}</h2>
          {schema.description && (
            <p className={styles.description}>{schema.description}</p>
          )}
        </div>
        
        {/* Mode Toggle */}
        <button
          type="button"
          className={styles.modeToggle}
          onClick={handleModeToggle}
        >
          {currentMode === 'guided' ? 'Advanced' : 'Guided'}
        </button>
      </div>

      {/* Progress (guided mode) */}
      {currentMode === 'guided' && totalSteps > 1 && (
        <div className={styles.progress}>
          <div className={styles.progressBar}>
            <div
              className={styles.progressFill}
              style={{ width: `${((currentStep + 1) / totalSteps) * 100}%` }}
            />
          </div>
          <span className={styles.progressText}>
            Step {currentStep + 1} of {totalSteps}
          </span>
        </div>
      )}

      {/* Fields */}
      <div className={styles.fields}>
        {currentFields.map((field) => (
          <FieldRenderer
            key={field.id}
            field={field}
            value={values[field.id]}
            error={errors.find((e) => e.fieldId === field.id)?.message}
            touched={touched.has(field.id)}
            disabled={loading || isSubmitting || readOnly || locks.includes(field.id)}
            locked={locks.includes(field.id)}
            onChange={(value) => handleChange(field.id, value)}
            onBlur={() => handleBlur(field.id)}
          />
        ))}
      </div>

      {/* Validation Summary */}
      {errors.length > 0 && touched.size > 0 && (
        <ValidationDisplay errors={errors} />
      )}

      {/* Actions */}
      <div className={styles.actions}>
        {currentMode === 'guided' && currentStep > 0 && (
          <button
            type="button"
            className={styles.backBtn}
            onClick={() => setCurrentStep((s) => s - 1)}
            disabled={loading || isSubmitting}
          >
            Back
          </button>
        )}

        {showReset && (
          <button
            type="button"
            className={styles.resetBtn}
            onClick={handleReset}
            disabled={loading || isSubmitting}
          >
            Reset
          </button>
        )}

        {currentMode === 'guided' && currentStep < totalSteps - 1 ? (
          <button
            type="button"
            className={styles.nextBtn}
            onClick={() => setCurrentStep((s) => s + 1)}
            disabled={loading || isSubmitting}
          >
            Next
          </button>
        ) : (
          <button
            type="submit"
            className={styles.submitBtn}
            disabled={loading || isSubmitting}
          >
            {isSubmitting ? 'Submitting...' : submitLabel}
          </button>
        )}
      </div>
    </form>
  );
};

// ============================================================================
// Helpers
// ============================================================================

function validateRule(
  value: unknown,
  rule: { type: string; value?: unknown; validator?: (value: unknown) => boolean },
  allValues: Record<string, unknown>
): boolean {
  switch (rule.type) {
    case 'required':
      return value !== undefined && value !== '' && value !== null;
    case 'minLength':
      return typeof value === 'string' && value.length >= (rule.value as number);
    case 'maxLength':
      return typeof value === 'string' && value.length <= (rule.value as number);
    case 'min':
      return typeof value === 'number' && value >= (rule.value as number);
    case 'max':
      return typeof value === 'number' && value <= (rule.value as number);
    case 'pattern':
      return typeof value === 'string' && new RegExp(rule.value as string).test(value);
    case 'email':
      return typeof value === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
    case 'url':
      try {
        return typeof value === 'string' && Boolean(new URL(value));
      } catch {
        return false;
      }
    case 'custom':
      return rule.validator ? rule.validator(value) : true;
    default:
      return true;
  }
}

function evaluateCondition(
  condition: { field: string; operator: string; value: unknown; and?: any[]; or?: any[]; not?: boolean },
  values: Record<string, unknown>
): boolean {
  const fieldValue = values[condition.field];
  let result: boolean;

  switch (condition.operator) {
    case 'eq':
      result = fieldValue === condition.value;
      break;
    case 'ne':
      result = fieldValue !== condition.value;
      break;
    case 'gt':
      result = typeof fieldValue === 'number' && fieldValue > (condition.value as number);
      break;
    case 'lt':
      result = typeof fieldValue === 'number' && fieldValue < (condition.value as number);
      break;
    case 'gte':
      result = typeof fieldValue === 'number' && fieldValue >= (condition.value as number);
      break;
    case 'lte':
      result = typeof fieldValue === 'number' && fieldValue <= (condition.value as number);
      break;
    case 'in':
      result = Array.isArray(condition.value) && condition.value.includes(fieldValue);
      break;
    case 'contains':
      result = typeof fieldValue === 'string' && fieldValue.includes(condition.value as string);
      break;
    case 'startsWith':
      result = typeof fieldValue === 'string' && fieldValue.startsWith(condition.value as string);
      break;
    case 'endsWith':
      result = typeof fieldValue === 'string' && fieldValue.endsWith(condition.value as string);
      break;
    default:
      result = true;
  }

  if (condition.and) {
    result = result && condition.and.every((c) => evaluateCondition(c, values));
  }

  if (condition.or) {
    result = result || condition.or.some((c) => evaluateCondition(c, values));
  }

  if (condition.not) {
    result = !result;
  }

  return result;
}

export default FormRenderer;
