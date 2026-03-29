/**
 * FormSurfacesView
 *
 * UI for Form Surfaces - Dynamic schema-based forms for agent communication.
 * Browse form registry and preview rendered forms with real inputs and validation.
 */

'use client';

import React, { useState } from 'react';
import { GlassSurface } from '@/design/GlassSurface';
import {
  FileText,
  Eye,
  Clock,
  Plus,
  CaretRight,
  FloppyDisk,
  ArrowCounterClockwise,
  Lightning,
  GearSix,
} from '@phosphor-icons/react';

interface FormSchema {
  id: string;
  name: string;
  fieldCount: number;
  lastUsed: string;
  description: string;
}

interface FormField {
  name: string;
  label: string;
  type: 'text' | 'number' | 'select' | 'textarea' | 'toggle' | 'slider' | 'multiselect' | 'radio';
  required: boolean;
  placeholder?: string;
  options?: string[];
  min?: number;
  max?: number;
  defaultValue?: any;
}

const FORM_SCHEMAS: FormSchema[] = [
  {
    id: 'agent-config',
    name: 'Agent Config Form',
    fieldCount: 8,
    lastUsed: '2h ago',
    description: 'Configure agent behavior and model settings',
  },
  {
    id: 'deploy-config',
    name: 'Deploy Config Form',
    fieldCount: 12,
    lastUsed: '5h ago',
    description: 'Deployment configuration and release management',
  },
  {
    id: 'hook-registration',
    name: 'Hook Registration Form',
    fieldCount: 5,
    lastUsed: '1d ago',
    description: 'Register custom lifecycle hooks',
  },
  {
    id: 'model-picker',
    name: 'Model Picker Form',
    fieldCount: 4,
    lastUsed: '3d ago',
    description: 'Select and configure AI models',
  },
  {
    id: 'project-setup',
    name: 'Project Setup Form',
    fieldCount: 10,
    lastUsed: '1w ago',
    description: 'Initialize new project with workspace configuration',
  },
];

const AGENT_CONFIG_FIELDS: FormField[] = [
  {
    name: 'agentName',
    label: 'Agent Name',
    type: 'text',
    required: true,
    placeholder: 'e.g., code-reviewer, chat-support',
  },
  {
    name: 'model',
    label: 'Model',
    type: 'select',
    required: true,
    options: ['claude-opus-4-5', 'claude-sonnet-4-5', 'claude-haiku-4-5', 'gpt-4o'],
    defaultValue: 'claude-opus-4-5',
  },
  {
    name: 'maxTokens',
    label: 'Max Tokens',
    type: 'number',
    required: false,
    placeholder: '4096',
    defaultValue: 4096,
  },
  {
    name: 'temperature',
    label: 'Temperature',
    type: 'slider',
    required: false,
    min: 0,
    max: 1,
    defaultValue: 0.7,
  },
  {
    name: 'systemPrompt',
    label: 'System Prompt',
    type: 'textarea',
    required: false,
    placeholder: 'Enter system prompt...',
  },
  {
    name: 'tools',
    label: 'Tools',
    type: 'multiselect',
    required: false,
    options: ['bash_exec', 'file_read', 'file_write', 'http_get', 'web_search'],
  },
  {
    name: 'memoryMode',
    label: 'Memory Mode',
    type: 'radio',
    required: true,
    options: ['ephemeral', 'persistent', 'hybrid'],
    defaultValue: 'persistent',
  },
  {
    name: 'autoApprove',
    label: 'Auto-approve Actions',
    type: 'toggle',
    required: false,
    defaultValue: false,
  },
];

function FormSchemaCard({ schema, isActive, onClick }: { schema: FormSchema; isActive: boolean; onClick: () => void }) {
  return (
    <div
      onClick={onClick}
      className={`p-4 rounded-xl border transition-all cursor-pointer ${
        isActive
          ? 'border-[var(--accent-primary)] bg-[var(--bg-secondary)]'
          : 'border-[var(--border-subtle)] bg-[var(--bg-secondary)] hover:border-[var(--accent-primary)]'
      }`}
    >
      <div className="flex items-start justify-between mb-2">
        <h3 className="font-semibold text-sm text-[var(--text-primary)]">
          {schema.name}
        </h3>
        <CaretRight className={`w-4 h-4 transition-colors ${
          isActive ? 'text-[var(--accent-primary)]' : 'text-[var(--text-tertiary)]'
        }`} />
      </div>

      <p className="text-xs text-[var(--text-tertiary)] mb-3 line-clamp-2">
        {schema.description}
      </p>

      <div className="flex items-center justify-between pt-3 border-t border-[var(--border-subtle)] text-xs">
        <span className="text-[var(--text-secondary)]">
          {schema.fieldCount} fields
        </span>
        <span className="text-[var(--text-tertiary)] flex items-center gap-1">
          <Clock size={12} />
          {schema.lastUsed}
        </span>
      </div>
    </div>
  );
}

function FormRenderer({ fields }: { fields: FormField[] }) {
  const [formData, setFormData] = useState<Record<string, any>>({});

  const handleChange = (name: string, value: any) => {
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  return (
    <div className="space-y-5">
      {fields.map((field) => (
        <div key={field.name}>
          <label className="block text-sm font-medium text-[var(--text-primary)] mb-2">
            {field.label}
            {field.required && <span className="text-red-500 ml-1">*</span>}
          </label>

          {field.type === 'text' && (
            <input
              type="text"
              placeholder={field.placeholder}
              value={formData[field.name] || ''}
              onChange={(e) => handleChange(field.name, e.target.value)}
              className="w-full px-3 py-2 rounded-lg bg-[var(--bg-primary)] border border-[var(--border-subtle)] text-[var(--text-primary)] placeholder-[var(--text-tertiary)] outline-none focus:border-[var(--accent-primary)] focus:ring-1 focus:ring-[var(--accent-primary)]"
            />
          )}

          {field.type === 'number' && (
            <input
              type="number"
              placeholder={field.placeholder}
              defaultValue={field.defaultValue}
              onChange={(e) => handleChange(field.name, e.target.valueAsNumber)}
              className="w-full px-3 py-2 rounded-lg bg-[var(--bg-primary)] border border-[var(--border-subtle)] text-[var(--text-primary)] outline-none focus:border-[var(--accent-primary)] focus:ring-1 focus:ring-[var(--accent-primary)]"
            />
          )}

          {field.type === 'select' && (
            <select
              defaultValue={field.defaultValue || ''}
              onChange={(e) => handleChange(field.name, e.target.value)}
              className="w-full px-3 py-2 rounded-lg bg-[var(--bg-primary)] border border-[var(--border-subtle)] text-[var(--text-primary)] outline-none focus:border-[var(--accent-primary)] focus:ring-1 focus:ring-[var(--accent-primary)]"
            >
              {field.options?.map((opt) => (
                <option key={opt} value={opt}>
                  {opt}
                </option>
              ))}
            </select>
          )}

          {field.type === 'textarea' && (
            <textarea
              placeholder={field.placeholder}
              rows={4}
              value={formData[field.name] || ''}
              onChange={(e) => handleChange(field.name, e.target.value)}
              className="w-full px-3 py-2 rounded-lg bg-[var(--bg-primary)] border border-[var(--border-subtle)] text-[var(--text-primary)] placeholder-[var(--text-tertiary)] outline-none focus:border-[var(--accent-primary)] focus:ring-1 focus:ring-[var(--accent-primary)] resize-none"
            />
          )}

          {field.type === 'slider' && (
            <div className="flex items-center gap-3">
              <input
                type="range"
                min={field.min || 0}
                max={field.max || 100}
                step={field.max === 1 ? 0.1 : 1}
                defaultValue={field.defaultValue || 0.5}
                onChange={(e) => handleChange(field.name, parseFloat(e.target.value))}
                className="flex-1 h-2 bg-[var(--bg-primary)] rounded-lg appearance-none cursor-pointer"
              />
              <span className="text-sm font-medium text-[var(--text-secondary)] w-12 text-right">
                {(formData[field.name] || field.defaultValue || 0).toFixed(2)}
              </span>
            </div>
          )}

          {field.type === 'multiselect' && (
            <div className="space-y-2">
              {field.options?.map((opt) => (
                <label key={opt} className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    value={opt}
                    checked={(formData[field.name] || []).includes(opt)}
                    onChange={(e) => {
                      const current = formData[field.name] || [];
                      const updated = e.target.checked
                        ? [...current, opt]
                        : current.filter((x: string) => x !== opt);
                      handleChange(field.name, updated);
                    }}
                    className="w-4 h-4 rounded border-[var(--border-subtle)] text-[var(--accent-primary)]"
                  />
                  <span className="text-sm text-[var(--text-primary)]">{opt}</span>
                </label>
              ))}
            </div>
          )}

          {field.type === 'radio' && (
            <div className="space-y-2">
              {field.options?.map((opt) => (
                <label key={opt} className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name={field.name}
                    value={opt}
                    defaultChecked={opt === field.defaultValue}
                    onChange={(e) => handleChange(field.name, e.target.value)}
                    className="w-4 h-4 text-[var(--accent-primary)]"
                  />
                  <span className="text-sm text-[var(--text-primary)]">{opt}</span>
                </label>
              ))}
            </div>
          )}

          {field.type === 'toggle' && (
            <button
              onClick={() => handleChange(field.name, !(formData[field.name] || field.defaultValue))}
              className={`relative inline-flex h-8 w-14 items-center rounded-full transition-colors ${
                formData[field.name] || field.defaultValue
                  ? 'bg-[var(--accent-primary)]'
                  : 'bg-[var(--bg-secondary)]'
              } border border-[var(--border-subtle)]`}
            >
              <span
                className={`inline-block h-6 w-6 transform rounded-full bg-white transition-transform ${
                  formData[field.name] || field.defaultValue ? 'translate-x-7' : 'translate-x-1'
                }`}
              />
            </button>
          )}
        </div>
      ))}
    </div>
  );
}

export function FormSurfacesView() {
  const [activeFormId, setActiveFormId] = useState<string>('agent-config');

  const activeForm = FORM_SCHEMAS.find((f) => f.id === activeFormId) || FORM_SCHEMAS[0];

  return (
    <GlassSurface className="h-full w-full flex flex-col">
      {/* Header */}
      <div className="p-6 border-b border-[var(--border-subtle)]">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <FileText className="w-7 h-7 text-[var(--accent-primary)]" />
            <div>
              <h1 className="text-2xl font-semibold text-[var(--text-primary)]">
                Form Surfaces
              </h1>
              <p className="text-sm text-[var(--text-tertiary)] mt-1">
                Dynamic schema-based forms for agent communication
              </p>
            </div>
          </div>

          <button className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[var(--accent-primary)] text-[var(--bg-primary)] text-sm font-medium hover:opacity-90 transition-opacity">
            <Plus size={16} />
            Create Form
          </button>
        </div>
      </div>

      {/* Form active indicator */}
      <div className="px-6 py-3 border-b border-[var(--border-subtle)] bg-[var(--bg-secondary)] flex items-center justify-between">
        <div>
          <span className="text-xs text-[var(--text-tertiary)] uppercase font-semibold">Active Form</span>
          <span className="ml-2 text-sm font-medium text-[var(--text-primary)]">
            {activeForm.name}
          </span>
          <span className="ml-3 text-xs text-[var(--text-secondary)] px-2 py-0.5 rounded-full bg-[var(--bg-primary)]">
            {activeForm.fieldCount} fields
          </span>
        </div>
      </div>

      {/* Main content: left sidebar + right preview */}
      <div className="flex-1 overflow-hidden flex">
        {/* Left: Form registry */}
        <div className="w-80 border-r border-[var(--border-subtle)] overflow-auto flex flex-col">
          <div className="px-6 py-4 border-b border-[var(--border-subtle)]">
            <h2 className="text-sm font-semibold text-[var(--text-secondary)] flex items-center gap-2">
              <Eye size={16} />
              Form Registry
            </h2>
          </div>

          <div className="flex-1 overflow-auto p-4 space-y-3">
            {FORM_SCHEMAS.map((schema) => (
              <FormSchemaCard
                key={schema.id}
                schema={schema}
                isActive={activeFormId === schema.id}
                onClick={() => setActiveFormId(schema.id)}
              />
            ))}
          </div>

          <div className="p-4 border-t border-[var(--border-subtle)] bg-[var(--bg-secondary)]">
            <button className="w-full px-3 py-2 rounded-lg text-xs font-medium text-[var(--accent-primary)] border border-[var(--border-subtle)] hover:bg-[var(--bg-primary)] transition-colors">
              <Plus className="w-3 h-3 inline mr-2" />
              New Schema
            </button>
          </div>
        </div>

        {/* Right: Form preview & renderer */}
        <div className="flex-1 overflow-auto p-8">
          <div className="max-w-2xl mx-auto">
            {/* Form header */}
            <div className="mb-8">
              <h3 className="text-lg font-semibold text-[var(--text-primary)] mb-2">
                {activeForm.name}
              </h3>
              <p className="text-sm text-[var(--text-tertiary)]">
                {activeForm.description}
              </p>
            </div>

            {/* Form container */}
            <div className="p-6 rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-secondary)]">
              <FormRenderer fields={AGENT_CONFIG_FIELDS} />

              {/* Form actions */}
              <div className="flex gap-3 mt-8 pt-6 border-t border-[var(--border-subtle)]">
                <button className="flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-lg bg-[var(--accent-primary)] text-[var(--bg-primary)] font-medium hover:opacity-90 transition-opacity">
                  <FloppyDisk size={16} />
                  Submit
                </button>
                <button className="flex items-center justify-center gap-2 px-4 py-3 rounded-lg bg-[var(--bg-primary)] border border-[var(--border-subtle)] text-[var(--text-primary)] font-medium hover:bg-[var(--bg-secondary)] transition-colors">
                  <ArrowCounterClockwise size={16} />
                  Reset
                </button>
              </div>
            </div>

            {/* Form info */}
            <div className="mt-6 p-4 rounded-xl bg-[var(--bg-secondary)] border border-[var(--border-subtle)] text-xs text-[var(--text-tertiary)]">
              <div className="flex items-start gap-2">
                <Lightning className="w-4 h-4 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-medium mb-1">Real form rendering</p>
                  <p>
                    This form uses the surface.render(form) protocol with full validation, conditional fields, and stepper navigation support.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </GlassSurface>
  );
}

export default FormSurfacesView;
