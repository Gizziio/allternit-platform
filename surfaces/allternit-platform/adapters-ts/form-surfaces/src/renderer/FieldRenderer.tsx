/**
 * Field Renderer Component
 * 
 * Renders individual form fields based on type.
 */

import React, { useCallback } from 'react';
import styles from './FieldRenderer.module.css';
import type { FormField, SelectOption } from '../schema/FieldTypes';

export interface FieldRendererProps {
  /** Field schema */
  field: FormField;
  /** Current value */
  value: unknown;
  /** Error message */
  error?: string;
  /** Whether field has been touched */
  touched?: boolean;
  /** Disabled state */
  disabled?: boolean;
  /** Whether field is locked */
  locked?: boolean;
  /** Change handler */
  onChange: (value: unknown) => void;
  /** Blur handler */
  onBlur: () => void;
}

/**
 * Field Renderer Component
 */
export const FieldRenderer: React.FC<FieldRendererProps> = ({
  field,
  value,
  error,
  touched,
  disabled,
  locked,
  onChange,
  onBlur,
}) => {
  const handleChange = useCallback((newValue: unknown) => {
    if (!locked) {
      onChange(newValue);
    }
  }, [locked, onChange]);

  const hasError = error && touched;

  return (
    <div 
      className={`${styles.field} ${hasError ? styles.error : ''} ${locked ? styles.locked : ''}`}
      style={{ width: field.width ? `${(field.width / 12) * 100}%` : '100%' }}
    >
      <label className={styles.label}>
        {field.label}
        {field.required && <span className={styles.required}>*</span>}
        {locked && <span className={styles.lockIcon}>🔒</span>}
      </label>

      {field.description && (
        <p className={styles.description}>{field.description}</p>
      )}

      <div className={styles.inputWrapper}>
        {renderInput(field, value, handleChange, onBlur, disabled || locked)}
      </div>

      {hasError && (
        <span className={styles.errorMessage}>{error}</span>
      )}
    </div>
  );
};

// ============================================================================
// Input Renderers
// ============================================================================

function renderInput(
  field: FormField,
  value: unknown,
  onChange: (value: unknown) => void,
  onBlur: () => void,
  disabled: boolean
): React.ReactNode {
  switch (field.type) {
    case 'text':
      return (
        <input
          type="text"
          className={styles.input}
          value={(value as string) || ''}
          onChange={(e) => onChange(e.target.value)}
          onBlur={onBlur}
          disabled={disabled}
          placeholder={field.placeholder}
          minLength={field.minLength}
          maxLength={field.maxLength}
          pattern={field.pattern}
          autoComplete={field.autoComplete}
        />
      );

    case 'textarea':
      return (
        <textarea
          className={styles.textarea}
          value={(value as string) || ''}
          onChange={(e) => onChange(e.target.value)}
          onBlur={onBlur}
          disabled={disabled}
          placeholder={field.placeholder}
          rows={field.rows}
          minLength={field.minLength}
          maxLength={field.maxLength}
        />
      );

    case 'number':
      return (
        <input
          type="number"
          className={styles.input}
          value={(value as number) ?? ''}
          onChange={(e) => onChange(e.target.valueAsNumber)}
          onBlur={onBlur}
          disabled={disabled}
          placeholder={field.placeholder}
          min={field.min}
          max={field.max}
          step={field.step}
        />
      );

    case 'select':
      return (
        <select
          className={styles.select}
          value={(value as string) || ''}
          onChange={(e) => onChange(e.target.value)}
          onBlur={onBlur}
          disabled={disabled}
        >
          <option value="">Select...</option>
          {field.options.map((option) => (
            <option key={option.value} value={option.value} disabled={option.disabled}>
              {option.label}
            </option>
          ))}
        </select>
      );

    case 'multiselect':
      return (
        <div className={styles.checkboxGroup}>
          {field.options.map((option) => {
            const values = (value as string[]) || [];
            const isSelected = values.includes(option.value);
            
            return (
              <label key={option.value} className={styles.checkboxLabel}>
                <input
                  type="checkbox"
                  checked={isSelected}
                  onChange={() => {
                    if (isSelected) {
                      onChange(values.filter((v) => v !== option.value));
                    } else {
                      onChange([...values, option.value]);
                    }
                  }}
                  onBlur={onBlur}
                  disabled={disabled || option.disabled}
                />
                <span>{option.label}</span>
              </label>
            );
          })}
        </div>
      );

    case 'radio':
      return (
        <div className={`${styles.radioGroup} ${field.inline ? styles.inline : ''}`}>
          {field.options.map((option) => (
            <label key={option.value} className={styles.radioLabel}>
              <input
                type="radio"
                name={field.id}
                value={option.value}
                checked={value === option.value}
                onChange={() => onChange(option.value)}
                onBlur={onBlur}
                disabled={disabled || option.disabled}
              />
              <span>{option.label}</span>
            </label>
          ))}
        </div>
      );

    case 'checkbox':
      return (
        <label className={styles.checkboxLabel}>
          <input
            type="checkbox"
            checked={Boolean(value)}
            onChange={(e) => onChange(e.target.checked)}
            onBlur={onBlur}
            disabled={disabled}
          />
          <span>{field.checkboxLabel || field.label}</span>
        </label>
      );

    case 'date':
      return (
        <input
          type={field.showTime ? 'datetime-local' : 'date'}
          className={styles.input}
          value={formatDateValue(value, field.showTime)}
          onChange={(e) => onChange(e.target.value)}
          onBlur={onBlur}
          disabled={disabled}
          min={field.minDate ? formatDateValue(field.minDate, field.showTime) : undefined}
          max={field.maxDate ? formatDateValue(field.maxDate, field.showTime) : undefined}
        />
      );

    case 'file':
      return (
        <input
          type="file"
          className={styles.input}
          onChange={(e) => onChange(e.target.files?.[0])}
          onBlur={onBlur}
          disabled={disabled}
          accept={field.accept?.join(',')}
          multiple={field.multiple}
        />
      );

    case 'array':
      return (
        <ArrayFieldRenderer
          field={field}
          value={value}
          onChange={onChange}
          onBlur={onBlur}
          disabled={disabled}
        />
      );

    case 'object':
      return (
        <ObjectFieldRenderer
          field={field}
          value={value}
          onChange={onChange}
          onBlur={onBlur}
          disabled={disabled}
        />
      );

    case 'custom':
      return (
        <div className={styles.customField}>
          Custom component: {field.component}
        </div>
      );

    default:
      return <div>Unknown field type: {(field as any).type}</div>;
  }
}

// ============================================================================
// Complex Field Renderers
// ============================================================================

interface ArrayFieldRendererProps {
  field: any;
  value: unknown;
  onChange: (value: unknown) => void;
  onBlur: () => void;
  disabled: boolean;
}

const ArrayFieldRenderer: React.FC<ArrayFieldRendererProps> = ({
  field,
  value,
  onChange,
  onBlur,
  disabled,
}) => {
  const items = (value as unknown[]) || [];
  const itemSchema = field.itemSchema;

  const addItem = () => {
    onChange([...items, getDefaultValue(itemSchema.type)]);
  };

  const removeItem = (index: number) => {
    onChange(items.filter((_, i) => i !== index));
  };

  const updateItem = (index: number, newValue: unknown) => {
    const newItems = [...items];
    newItems[index] = newValue;
    onChange(newItems);
  };

  return (
    <div className={styles.arrayField}>
      {items.map((item, index) => (
        <div key={index} className={styles.arrayItem}>
          <FieldRenderer
            field={{ ...itemSchema, id: `${field.id}[${index}]`, label: `#${index + 1}` }}
            value={item}
            onChange={(v) => updateItem(index, v)}
            onBlur={onBlur}
            disabled={disabled}
          />
          <button
            type="button"
            className={styles.removeBtn}
            onClick={() => removeItem(index)}
            disabled={disabled}
          >
            ×
          </button>
        </div>
      ))}
      <button
        type="button"
        className={styles.addBtn}
        onClick={addItem}
        disabled={disabled || (field.maxItems && items.length >= field.maxItems)}
      >
        {field.addLabel || '+ Add'}
      </button>
    </div>
  );
};

interface ObjectFieldRendererProps {
  field: any;
  value: unknown;
  onChange: (value: unknown) => void;
  onBlur: () => void;
  disabled: boolean;
}

const ObjectFieldRenderer: React.FC<ObjectFieldRendererProps> = ({
  field,
  value,
  onChange,
  onBlur,
  disabled,
}) => {
  const objectValue = (value as Record<string, unknown>) || {};

  const updateProperty = (propId: string, propValue: unknown) => {
    onChange({ ...objectValue, [propId]: propValue });
  };

  return (
    <div className={styles.objectField}>
      {field.properties.map((prop: FormField) => (
        <FieldRenderer
          key={prop.id}
          field={prop}
          value={objectValue[prop.id]}
          onChange={(v) => updateProperty(prop.id, v)}
          onBlur={onBlur}
          disabled={disabled}
        />
      ))}
    </div>
  );
};

// ============================================================================
// Helpers
// ============================================================================

function formatDateValue(value: unknown, showTime?: boolean): string {
  if (!value) return '';
  
  const date = value instanceof Date ? value : new Date(value as string);
  if (isNaN(date.getTime())) return '';

  if (showTime) {
    return date.toISOString().slice(0, 16);
  }
  return date.toISOString().slice(0, 10);
}

function getDefaultValue(type: string): unknown {
  switch (type) {
    case 'text':
    case 'textarea':
      return '';
    case 'number':
      return 0;
    case 'checkbox':
      return false;
    case 'select':
    case 'radio':
      return '';
    case 'multiselect':
    case 'array':
      return [];
    case 'object':
      return {};
    default:
      return null;
  }
}

export default FieldRenderer;
