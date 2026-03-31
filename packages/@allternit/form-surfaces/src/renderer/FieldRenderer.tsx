/**
 * Field Renderer Component
 *
 * Renders individual form fields based on type.
 */

import React, { useCallback } from 'react';
import type { FormField } from '../schema/FieldTypes';

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

  const hasError = Boolean(error && touched);
  const isDisabled = Boolean(disabled || locked);

  return (
    <div
      className={`field ${hasError ? 'error' : ''} ${locked ? 'locked' : ''}`}
      style={{ width: field.width ? `${(field.width / 12) * 100}%` : '100%' }}
    >
      <label className="label">
        {field.label}
        {field.required && <span className="required">*</span>}
        {locked && <span className="lock-icon">🔒</span>}
      </label>

      {field.description && (
        <p className="description">{field.description}</p>
      )}

      <div className="input-wrapper">
        {renderInput(field, value, handleChange, onBlur, isDisabled)}
      </div>

      {hasError && (
        <span className="error-message">{error}</span>
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
          className="input"
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
          className="textarea"
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
          className="input"
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
          className="select"
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
        <div className="checkbox-group">
          {field.options.map((option) => {
            const values = (value as string[]) || [];
            const isSelected = values.includes(option.value);

            return (
              <label key={option.value} className="checkbox-label">
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
        <div className={`radio-group ${field.inline ? 'inline' : ''}`}>
          {field.options.map((option) => (
            <label key={option.value} className="radio-label">
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
        <label className="checkbox-label">
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
          className="input"
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
          className="input"
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
        <div className="custom-field">
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
    <div className="array-field">
      {items.map((item, index) => (
        <div key={index} className="array-item">
          <FieldRenderer
            field={{ ...itemSchema, id: `${field.id}[${index}]`, label: `#${index + 1}` }}
            value={item}
            onChange={(v) => updateItem(index, v)}
            onBlur={onBlur}
            disabled={disabled}
          />
          <button
            type="button"
            className="remove-btn"
            onClick={() => removeItem(index)}
            disabled={disabled}
          >
            ×
          </button>
        </div>
      ))}
      <button
        type="button"
        className="add-btn"
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
    <div className="object-field">
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
