/**
 * EnvironmentForm.tsx
 * 
 * Form component for creating and editing environments.
 */

import React, { useState, useCallback } from 'react';
import {
  environmentApi,
  type Environment,
  type EnvironmentTemplate,
  type EnvironmentType,
} from '@/api/infrastructure/environments';

export interface EnvironmentFormProps {
  initialData?: Partial<Environment>;
  templates?: EnvironmentTemplate[];
  onSubmit?: (environment: Environment) => void;
  onCancel?: () => void;
  isEditing?: boolean;
}

interface FormData {
  name: string;
  template_id: string;
  type: EnvironmentType;
}

export function EnvironmentForm({
  initialData,
  templates = [],
  onSubmit,
  onCancel,
  isEditing = false,
}: EnvironmentFormProps) {
  const [formData, setFormData] = useState<FormData>({
    name: initialData?.name || '',
    template_id: initialData?.template_id || '',
    type: initialData?.type || 'devcontainer',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      let environment: Environment;

      if (isEditing && initialData?.id) {
        environment = await environmentApi.update(initialData.id, formData);
      } else {
        environment = await environmentApi.provision(
          formData.template_id,
          formData.name
        );
      }

      onSubmit?.(environment);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save environment');
    } finally {
      setLoading(false);
    }
  }, [formData, isEditing, initialData, onSubmit]);

  const handleChange = useCallback((field: keyof FormData, value: unknown) => {
    setFormData((prev) => ({
      ...prev,
      [field]: value,
    }));
  }, []);

  return (
    <form onSubmit={handleSubmit} className="environment-form">
      <h2>{isEditing ? 'Edit Environment' : 'Create Environment'}</h2>

      {error && (
        <div className="error-message" role="alert">
          {error}
        </div>
      )}

      <div className="form-field">
        <label htmlFor="env-name">Name</label>
        <input
          id="env-name"
          type="text"
          value={formData.name}
          onChange={(e) => handleChange('name', e.target.value)}
          placeholder="Enter environment name"
          required
          disabled={loading}
        />
      </div>

      <div className="form-field">
        <label htmlFor="env-template">Template</label>
        <select
          id="env-template"
          value={formData.template_id}
          onChange={(e) => handleChange('template_id', e.target.value)}
          required
          disabled={loading || templates.length === 0}
        >
          <option value="">Select a template</option>
          {templates.map((template) => (
            <option key={template.id} value={template.id}>
              {template.name} ({template.type})
            </option>
          ))}
        </select>
        {templates.length === 0 && (
          <span className="hint">No templates available</span>
        )}
      </div>

      <div className="form-field">
        <label htmlFor="env-type">Environment Type</label>
        <select
          id="env-type"
          value={formData.type}
          onChange={(e) => handleChange('type', e.target.value as EnvironmentType)}
          required
          disabled={loading}
        >
          <option value="devcontainer">DevContainer</option>
          <option value="nix">Nix</option>
          <option value="sandbox">Sandbox</option>
          <option value="platform">Platform</option>
        </select>
      </div>

      <div className="form-actions">
        <button
          type="button"
          onClick={onCancel}
          disabled={loading}
          className="btn-secondary"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={loading || !formData.name || !formData.template_id}
          className="btn-primary"
        >
          {loading ? 'Saving...' : isEditing ? 'Update' : 'Create'}
        </button>
      </div>
    </form>
  );
}

export default EnvironmentForm;
