/**
 * Add Capability Forms
 *
 * Form overlays for creating new capabilities:
 * - Skills, Commands, Connectors, MCPs, CLI Tools, Webhooks
 */

import React, { useState } from 'react';
import {
  X,
  Plus,
} from '@phosphor-icons/react';
import { useCapabilities } from '../../plugins/useCapabilities';
import {
  buildMarketplaceManifestForPlugin,
  buildPluginManifestFromWizard,
  parseCsvList,
  slugifyPluginName,
  validateMarketplaceManifestV1,
  validatePluginManifestV1,
  type PluginManifestV1,
  type PluginMarketplaceManifestV1,
} from '../../plugins/pluginStandards';

type TabId = 'skills' | 'commands' | 'connectors' | 'mcps' | 'cli-tools' | 'webhooks' | 'plugins';

const THEME = {
  bg: 'rgba(15, 14, 13, 0.95)',
  bgElevated: 'rgba(26, 25, 23, 0.98)',
  accent: 'var(--accent-primary)',
  accentMuted: 'rgba(212,176,140,0.15)',
  textPrimary: 'var(--ui-text-primary)',
  textSecondary: 'var(--ui-text-secondary)',
  textTertiary: 'var(--ui-text-muted)',
  border: 'color-mix(in srgb, var(--accent-primary) 10%, transparent)',
};

interface AddFormProps {
  tab: TabId;
  label: string;
  onClose: () => void;
  onCreate?: (tab: TabId, payload: CapabilityFormPayload) => void | Promise<void>;
}

export interface CapabilityFormPayload {
  name: string;
  description?: string;
  content?: string;
  tags?: string[];
  category?: string;
  trigger?: string;
  triggerType?: 'mention' | 'slash';
  appName?: string;
  authType?: 'oauth' | 'apikey' | 'token' | 'none';
  appUrl?: string;
  command?: string;
  args?: string[];
  path?: string;
  eventType?: string;
  connectedSkill?: string;
  pluginManifest?: PluginManifestV1;
  marketplaceManifest?: PluginMarketplaceManifestV1;
  files?: Array<{ relativePath: string; content: string }>;
}

export function AddCapabilityForm({ tab, label, onClose, onCreate }: AddFormProps) {
  switch (tab) {
    case 'skills':
      return <AddSkillForm onClose={onClose} onCreate={onCreate} />;
    case 'commands':
      return <AddCommandForm onClose={onClose} onCreate={onCreate} />;
    case 'connectors':
      return <AddConnectorForm onClose={onClose} onCreate={onCreate} />;
    case 'mcps':
      return <AddMcpForm onClose={onClose} onCreate={onCreate} />;
    case 'cli-tools':
      return <AddCliToolForm onClose={onClose} onCreate={onCreate} />;
    case 'webhooks':
      return <AddWebhookForm onClose={onClose} onCreate={onCreate} />;
    case 'plugins':
      return <AddPluginWizardForm onClose={onClose} onCreate={onCreate} />;
    default:
      return <AddGenericForm label={label} onClose={onClose} onCreate={onCreate} tab={tab} />;
  }
}

// ============================================================================
// Form Wrapper
// ============================================================================

function FormWrapper({
  title,
  description,
  children,
  onClose,
  onSubmit,
  isSubmitDisabled = false,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
  onClose: () => void;
  onSubmit: () => void;
  isSubmitDisabled?: boolean;
}) {
  return (
    <div role="button" tabIndex={0}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'var(--shell-overlay-backdrop)',
        backdropFilter: 'blur(4px)',
        zIndex: 1001,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
      onClick={onClose}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') onClose(); }}
    >
      <div role="button" tabIndex={0}
        style={{
          width: 560,
          maxHeight: '85vh',
          overflow: 'auto',
          borderRadius: 16,
          background: THEME.bgElevated,
          border: `1px solid ${THEME.border}`,
          boxShadow: '0 25px 50px var(--shell-overlay-backdrop)',
        }}
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '20px 24px',
            borderBottom: `1px solid ${THEME.border}`,
          }}
        >
          <div>
            <h2 style={{ fontSize: 18, fontWeight: 700, color: THEME.textPrimary, margin: 0 }}>{title}</h2>
            <p style={{ fontSize: 13, color: THEME.textSecondary, margin: '4px 0 0 0' }}>{description}</p>
          </div>
          <button type="button"
            onClick={onClose}
            style={{
              padding: 8,
              borderRadius: 8,
              border: 'none',
              background: 'transparent',
              color: THEME.textTertiary,
              cursor: 'pointer',
            }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Form Content */}
        <div style={{ padding: 24 }}>{children}</div>

        {/* Footer */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'flex-end',
            gap: 12,
            padding: '16px 24px',
            borderTop: `1px solid ${THEME.border}`,
          }}
        >
          <button type="button"
            onClick={onClose}
            style={{
              padding: '10px 20px',
              borderRadius: 8,
              border: `1px solid ${THEME.border}`,
              background: 'transparent',
              color: THEME.textSecondary,
              fontSize: 14,
              cursor: 'pointer',
            }}
          >
            Cancel
          </button>
          <button type="button"
            onClick={onSubmit}
            disabled={isSubmitDisabled}
            style={{
              padding: '10px 20px',
              borderRadius: 8,
              border: 'none',
              background: THEME.accent,
              color: 'var(--surface-canvas)',
              fontSize: 14,
              fontWeight: 600,
              cursor: isSubmitDisabled ? 'not-allowed' : 'pointer',
              opacity: isSubmitDisabled ? 0.5 : 1,
            }}
          >
            Create
          </button>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// Form Inputs
// ============================================================================

function FormField({
  label,
  id,
  required,
  children,
  hint,
}: {
  label: string;
  id?: string;
  required?: boolean;
  children: React.ReactNode;
  hint?: string;
}) {
  return (
    <div style={{ marginBottom: 20 }}>
      <label htmlFor={id} style={{ display: 'block', fontSize: 13, fontWeight: 600, color: THEME.textPrimary, marginBottom: 6 }}>
        {label}
        {required && <span style={{ color: THEME.accent, marginLeft: 4 }}>*</span>}
      </label>
      {children}
      {hint && <p style={{ fontSize: 12, color: THEME.textTertiary, margin: '6px 0 0 0' }}>{hint}</p>}
    </div>
  );
}

function TextInput({
  id,
  value,
  onChange,
  placeholder,
  required,
}: {
  id?: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  required?: boolean;
}) {
  return (
    <input id={id} type="text"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      required={required}
      style={{
        width: '100%',
        padding: '10px 14px',
        borderRadius: 8,
        border: `1px solid ${THEME.border}`,
        background: 'var(--surface-hover)',
        color: THEME.textPrimary,
        fontSize: 14,
        outline: 'none',
        boxSizing: 'border-box',
      }}
    />
  );
}

function TextArea({
  id,
  value,
  onChange,
  placeholder,
  rows = 4,
  readOnly = false,
}: {
  id?: string;
  value: string;
  onChange?: (v: string) => void;
  placeholder?: string;
  rows?: number;
  readOnly?: boolean;
}) {
  return (
    <textarea id={id} value={value}
      onChange={(e) => onChange?.(e.target.value)}
      placeholder={placeholder}
      rows={rows}
      readOnly={readOnly}
      style={{
        width: '100%',
        padding: '10px 14px',
        borderRadius: 8,
        border: `1px solid ${THEME.border}`,
        background: 'var(--surface-hover)',
        color: THEME.textPrimary,
        fontSize: 14,
        outline: 'none',
        resize: 'vertical',
        boxSizing: 'border-box',
        fontFamily: 'inherit',
      }}
    />
  );
}

function Select({
  id,
  value,
  onChange,
  options,
}: {
  id?: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <select id={id} value={value}
      onChange={(e) => onChange(e.target.value)}
      style={{
        width: '100%',
        padding: '10px 14px',
        borderRadius: 8,
        border: `1px solid ${THEME.border}`,
        background: 'var(--surface-hover)',
        color: THEME.textPrimary,
        fontSize: 14,
        outline: 'none',
        cursor: 'pointer',
      }}
    >
      {options.map((opt) => (
        <option key={opt.value} value={opt.value}>
          {opt.label}
        </option>
      ))}
    </select>
  );
}

function TagInput({
  tags,
  onChange,
}: {
  tags: string[];
  onChange: (tags: string[]) => void;
}) {
  const [input, setInput] = useState('');

  const addTag = () => {
    if (input.trim() && !tags.includes(input.trim())) {
      onChange([...tags, input.trim()]);
      setInput('');
    }
  };

  const removeTag = (tag: string) => {
    onChange(tags.filter((t) => t !== tag));
  };

  return (
    <div>
      <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
        <input aria-label="Add tag" type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addTag())}
          placeholder="Add tag…"
          style={{
            flex: 1,
            padding: '8px 12px',
            borderRadius: 6,
            border: `1px solid ${THEME.border}`,
            background: 'var(--surface-hover)',
            color: THEME.textPrimary,
            fontSize: 13,
          }}
        />
        <button type="button"
          onClick={addTag}
          style={{
            padding: '8px 12px',
            borderRadius: 6,
            border: 'none',
            background: THEME.accentMuted,
            color: THEME.accent,
            cursor: 'pointer',
          }}
        >
          <Plus size={16} />
        </button>
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
        {tags.map((tag) => (
          <span
            key={tag}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 4,
              padding: '4px 10px',
              borderRadius: 12,
              background: THEME.accentMuted,
              fontSize: 12,
              color: THEME.accent,
            }}
          >
            {tag}
            <button type="button"
              onClick={() => removeTag(tag)}
              style={{
                padding: 2,
                border: 'none',
                background: 'transparent',
                color: THEME.accent,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
              }}
            >
              <X size={12} />
            </button>
          </span>
        ))}
      </div>
    </div>
  );
}

// ============================================================================
// Individual Forms
// ============================================================================

function AddSkillForm({
  onClose,
  onCreate,
}: {
  onClose: () => void;
  onCreate?: (tab: TabId, payload: CapabilityFormPayload) => void | Promise<void>;
}) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [content, setContent] = useState('# Skill Template\n\n## Overview\nDescribe what this skill does.\n\n## Steps\n1. Step one\n2. Step two\n\n## Variables\n- `variable_name`: Description\n');
  const [tags, setTags] = useState<string[]>([]);
  const [category, setCategory] = useState('general');

  const handleSubmit = () => {
    void onCreate?.('skills', { name, description, content, tags, category });
    onClose();
  };

  return (
    <FormWrapper
      title="Create Skill"
      description="Create a reusable workflow skill that agents can invoke"
      onClose={onClose}
      onSubmit={handleSubmit}
      isSubmitDisabled={!name.trim()}
    >
      <FormField label="Name" id="skill-name" required>
        <TextInput id="skill-name" value={name} onChange={setName} placeholder="e.g., Deploy Application" required />
      </FormField>

      <FormField label="Description" id="skill-desc" required>
        <TextArea
          id="skill-desc"
          value={description}
          onChange={setDescription}
          placeholder="Describe what this skill does…"
          rows={2}
        />
      </FormField>

      <FormField label="Category" id="skill-category">
        <Select
          id="skill-category"
          value={category}
          onChange={setCategory}
          options={[
            { value: 'general', label: 'General' },
            { value: 'development', label: 'Development' },
            { value: 'devops', label: 'DevOps' },
            { value: 'data', label: 'Data' },
            { value: 'web', label: 'Web' },
            { value: 'automation', label: 'Automation' },
          ]}
        />
      </FormField>

      <FormField label="Tags">
        <TagInput tags={tags} onChange={setTags} />
      </FormField>

      <FormField label="Skill Content (Markdown)" id="skill-content" hint="Use markdown to document the workflow">
        <TextArea id="skill-content" value={content} onChange={setContent} rows={12} />
      </FormField>
    </FormWrapper>
  );
}

function AddCommandForm({
  onClose,
  onCreate,
}: {
  onClose: () => void;
  onCreate?: (tab: TabId, payload: CapabilityFormPayload) => void | Promise<void>;
}) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [trigger, setTrigger] = useState('');
  const [triggerType, setTriggerType] = useState<'mention' | 'slash'>('slash');
  const [tags, setTags] = useState<string[]>([]);

  const handleSubmit = () => {
    void onCreate?.('commands', { name, description, trigger, triggerType, tags });
    onClose();
  };

  return (
    <FormWrapper
      title="Create Command"
      description="Add a @ mention or / slash command"
      onClose={onClose}
      onSubmit={handleSubmit}
      isSubmitDisabled={!name.trim() || !trigger.trim()}
    >
      <FormField label="Name" id="cmd-name" required>
        <TextInput id="cmd-name" value={name} onChange={setName} placeholder="e.g., New Chat" />
      </FormField>

      <FormField label="Description" id="cmd-desc" required>
        <TextArea id="cmd-desc" value={description} onChange={setDescription} placeholder="What does this command do?" rows={2} />
      </FormField>

      <div style={{ display: 'grid', gridTemplateColumns: '120px 1fr', gap: 12 }}>
        <FormField label="Type" id="cmd-type">
          <Select
            id="cmd-type"
            value={triggerType}
            onChange={(v) => setTriggerType(v as 'mention' | 'slash')}
            options={[
              { value: 'slash', label: '/ Slash' },
              { value: 'mention', label: '@ Mention' },
            ]}
          />
        </FormField>

        <FormField label="Trigger" id="cmd-trigger" required hint={triggerType === 'slash' ? 'e.g., /new-chat' : 'e.g., @agent'}>
          <TextInput
            id="cmd-trigger"
            value={trigger}
            onChange={setTrigger}
            placeholder={triggerType === 'slash' ? '/command-name' : '@agent-name'}
          />
        </FormField>
      </div>

      <FormField label="Tags">
        <TagInput tags={tags} onChange={setTags} />
      </FormField>
    </FormWrapper>
  );
}

function AddConnectorForm({
  onClose,
  onCreate,
}: {
  onClose: () => void;
  onCreate?: (tab: TabId, payload: CapabilityFormPayload) => void | Promise<void>;
}) {
  const [name, setName] = useState('');
  const [appName, setAppName] = useState('');
  const [description, setDescription] = useState('');
  const [authType, setAuthType] = useState<'oauth' | 'apikey' | 'token' | 'none'>('apikey');
  const [appUrl, setAppUrl] = useState('');
  const [tags, setTags] = useState<string[]>([]);

  const handleSubmit = () => {
    void onCreate?.('connectors', { name, appName, description, authType, appUrl, tags });
    onClose();
  };

  return (
    <FormWrapper
      title="Add Connector"
      description="Connect to an external application"
      onClose={onClose}
      onSubmit={handleSubmit}
      isSubmitDisabled={!name.trim() || !appName.trim()}
    >
      <FormField label="Connector Name" id="conn-name" required>
        <TextInput id="conn-name" value={name} onChange={setName} placeholder="e.g., GitHub Enterprise" />
      </FormField>

      <FormField label="App Name" id="conn-app" required hint="The official name of the application">
        <TextInput id="conn-app" value={appName} onChange={setAppName} placeholder="e.g., GitHub" />
      </FormField>

      <FormField label="Description" id="conn-desc" required>
        <TextArea id="conn-desc" value={description} onChange={setDescription} placeholder="What can you do with this connector?" rows={2} />
      </FormField>

      <FormField label="App URL" id="conn-url">
        <TextInput id="conn-url" value={appUrl} onChange={setAppUrl} placeholder="https://…" />
      </FormField>

      <FormField label="Authentication Type" id="conn-auth">
        <Select
          id="conn-auth"
          value={authType}
          onChange={(v) => setAuthType(v as typeof authType)}
          options={[
            { value: 'oauth', label: 'OAuth 2.0' },
            { value: 'apikey', label: 'API Key' },
            { value: 'token', label: 'Personal Access Token' },
            { value: 'none', label: 'No Authentication' },
          ]}
        />
      </FormField>

      <FormField label="Tags">
        <TagInput tags={tags} onChange={setTags} />
      </FormField>
    </FormWrapper>
  );
}

function AddMcpForm({
  onClose,
  onCreate,
}: {
  onClose: () => void;
  onCreate?: (tab: TabId, payload: CapabilityFormPayload) => void | Promise<void>;
}) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [command, setCommand] = useState('');
  const [args, setArgs] = useState('');
  const [tags, setTags] = useState<string[]>([]);

  const handleSubmit = () => {
    void onCreate?.('mcps', {
      name,
      description,
      command,
      args: args.split(' ').filter(Boolean),
      tags,
    });
    onClose();
  };

  return (
    <FormWrapper
      title="Add MCP Server"
      description="Configure a Model Context Protocol server"
      onClose={onClose}
      onSubmit={handleSubmit}
      isSubmitDisabled={!name.trim() || !command.trim()}
    >
      <FormField label="Name" id="mcp-name" required>
        <TextInput id="mcp-name" value={name} onChange={setName} placeholder="e.g., Filesystem MCP" />
      </FormField>

      <FormField label="Description" id="mcp-desc" required>
        <TextArea id="mcp-desc" value={description} onChange={setDescription} placeholder="What does this MCP server provide?" rows={2} />
      </FormField>

      <FormField label="Command" id="mcp-cmd" required hint="The executable command">
        <TextInput id="mcp-cmd" value={command} onChange={setCommand} placeholder="e.g., npx or docker" />
      </FormField>

      <FormField label="Arguments" id="mcp-args" hint="Space-separated arguments">
        <TextInput id="mcp-args" value={args} onChange={setArgs} placeholder="-y @modelcontextprotocol/server-filesystem /path" />
      </FormField>

      <FormField label="Tags">
        <TagInput tags={tags} onChange={setTags} />
      </FormField>
    </FormWrapper>
  );
}

function AddCliToolForm({
  onClose,
  onCreate,
}: {
  onClose: () => void;
  onCreate?: (tab: TabId, payload: CapabilityFormPayload) => void | Promise<void>;
}) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [command, setCommand] = useState('');
  const [category, setCategory] = useState('dev');
  const [tags, setTags] = useState<string[]>([]);

  const handleSubmit = () => {
    void onCreate?.('cli-tools', { name, description, command, category, tags });
    onClose();
  };

  return (
    <FormWrapper
      title="Add CLI Tool"
      description="Register a command-line tool for agents to use"
      onClose={onClose}
      onSubmit={handleSubmit}
      isSubmitDisabled={!name.trim() || !command.trim()}
    >
      <FormField label="Name" id="cli-name" required>
        <TextInput id="cli-name" value={name} onChange={setName} placeholder="e.g., Docker" />
      </FormField>

      <FormField label="Description" id="cli-desc" required>
        <TextArea id="cli-desc" value={description} onChange={setDescription} placeholder="What does this tool do?" rows={2} />
      </FormField>

      <FormField label="Command" id="cli-cmd" required hint="The executable name">
        <TextInput id="cli-cmd" value={command} onChange={setCommand} placeholder="e.g., docker" />
      </FormField>

      <FormField label="Category" id="cli-cat">
        <Select
          id="cli-cat"
          value={category}
          onChange={setCategory}
          options={[
            { value: 'shell', label: 'Shell' },
            { value: 'file', label: 'File Operations' },
            { value: 'text', label: 'Text Processing' },
            { value: 'network', label: 'Network' },
            { value: 'system', label: 'System' },
            { value: 'dev', label: 'Development' },
            { value: 'ai', label: 'AI/ML' },
          ]}
        />
      </FormField>

      <FormField label="Tags">
        <TagInput tags={tags} onChange={setTags} />
      </FormField>
    </FormWrapper>
  );
}

function AddWebhookForm({
  onClose,
  onCreate,
}: {
  onClose: () => void;
  onCreate?: (tab: TabId, payload: CapabilityFormPayload) => void | Promise<void>;
}) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [path, setPath] = useState('');
  const [eventType, setEventType] = useState('');
  const [connectedSkill, setConnectedSkill] = useState('');
  const [tags, setTags] = useState<string[]>([]);

  const { skills, enabledSkillIds } = useCapabilities();
  const enabledSkills = skills.filter((s) => enabledSkillIds.has(s.id));

  const handleSubmit = () => {
    void onCreate?.('webhooks', {
      name,
      description,
      path,
      eventType,
      connectedSkill,
      tags,
    });
    onClose();
  };

  return (
    <FormWrapper
      title="Create Webhook"
      description="Set up an incoming HTTP endpoint"
      onClose={onClose}
      onSubmit={handleSubmit}
      isSubmitDisabled={!name.trim() || !path.trim()}
    >
      <FormField label="Name" id="hook-name" required>
        <TextInput id="hook-name" value={name} onChange={setName} placeholder="e.g., GitHub Push" />
      </FormField>

      <FormField label="Description" id="hook-desc" required>
        <TextArea id="hook-desc" value={description} onChange={setDescription} placeholder="What triggers this webhook?" rows={2} />
      </FormField>

      <FormField label="Path" id="hook-path" required hint="URL path for the webhook endpoint">
        <TextInput id="hook-path" value={path} onChange={setPath} placeholder="/webhooks/github/push" />
      </FormField>

      <FormField label="Event Type" id="hook-event" hint="Identifier for the event (e.g., github.push)">
        <TextInput id="hook-event" value={eventType} onChange={setEventType} placeholder="e.g., github.push" />
      </FormField>

      <FormField label="Connected Skill" id="hook-skill" hint="Skill to trigger when webhook fires">
        <select id="hook-skill" value={connectedSkill}
          onChange={(e) => setConnectedSkill(e.target.value)}
          style={{
            width: '100%',
            padding: '10px 14px',
            borderRadius: 8,
            border: `1px solid ${THEME.border}`,
            background: 'var(--surface-hover)',
            color: THEME.textPrimary,
            fontSize: 14,
            outline: 'none',
            cursor: 'pointer',
          }}
        >
          <option value="">None</option>
          {enabledSkills.map((skill) => (
            <option key={skill.id} value={skill.id}>
              {skill.name}
            </option>
          ))}
        </select>
      </FormField>

      <FormField label="Tags">
        <TagInput tags={tags} onChange={setTags} />
      </FormField>
    </FormWrapper>
  );
}

function AddPluginWizardForm({
  onClose,
  onCreate,
}: {
  onClose: () => void;
  onCreate?: (tab: TabId, payload: CapabilityFormPayload) => void | Promise<void>;
}) {
  const [step, setStep] = useState(0);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [version, setVersion] = useState('1.0.0');
  const [category, setCategory] = useState('development');
  const [authorName, setAuthorName] = useState('User');
  const [authorEmail, setAuthorEmail] = useState('');
  const [license, setLicense] = useState('MIT');
  const [homepage, setHomepage] = useState('');
  const [repository, setRepository] = useState('');
  const [tagsCsv, setTagsCsv] = useState('');
  const [keywordsCsv, setKeywordsCsv] = useState('');
  const [commandsCsv, setCommandsCsv] = useState('');
  const [skillsCsv, setSkillsCsv] = useState('');
  const [connectorsCsv, setConnectorsCsv] = useState('');
  const [agentsCsv, setAgentsCsv] = useState('');
  const [mcpsCsv, setMcpsCsv] = useState('');
  const [webhooksCsv, setWebhooksCsv] = useState('');
  const [strict, setStrict] = useState(false);
  const [scaffoldCommandFiles, setScaffoldCommandFiles] = useState(true);
  const [scaffoldSkillFiles, setScaffoldSkillFiles] = useState(true);
  const [scaffoldMcpFiles, setScaffoldMcpFiles] = useState(true);
  const [scaffoldWebhookFiles, setScaffoldWebhookFiles] = useState(true);
  const [includeMarketplaceTemplate, setIncludeMarketplaceTemplate] = useState(true);
  const [marketplaceOwnerName, setMarketplaceOwnerName] = useState('Allternit Team');
  const [marketplaceOwnerEmail, setMarketplaceOwnerEmail] = useState('');
  const [marketplaceSourceType, setMarketplaceSourceType] = useState<'local' | 'github' | 'url'>('local');
  const [marketplaceSourceValue, setMarketplaceSourceValue] = useState('');

  const mcpEntries = parseCsvList(mcpsCsv);
  const webhookEntries = parseCsvList(webhooksCsv);

  const pluginManifest = (() => {
    const manifest = buildPluginManifestFromWizard({
      name: name || 'new-plugin',
      description: description || 'Plugin description',
      version,
      authorName,
      authorEmail,
      category,
      tags: parseCsvList(tagsCsv),
      keywords: parseCsvList(keywordsCsv),
      commands: parseCsvList(commandsCsv),
      skills: parseCsvList(skillsCsv),
      connectors: parseCsvList(connectorsCsv),
      agents: parseCsvList(agentsCsv),
      license,
      homepage,
      repository,
      strict,
    });

    if (mcpEntries.length > 0) {
      manifest.mcpServers = Object.fromEntries(
        mcpEntries.map((entry) => {
          const id = slugifyPluginName(entry.replace(/^@/, ''));
          return [id, {
            command: id,
            args: [],
            env: {},
          }];
        }),
      );
    }

    if (webhookEntries.length > 0) {
      manifest.hooks = {
        ...manifest.hooks,
        onMessage: webhookEntries.map((entry) => ({
          name: slugifyPluginName(entry),
          description: `Webhook hook for ${entry}`,
        })),
      };
    }

    return manifest;
  })();

  const marketplaceSource = (() => {
    if (marketplaceSourceType === 'github') {
      return {
        source: 'github' as const,
        repo: marketplaceSourceValue.trim() || undefined,
      };
    }
    if (marketplaceSourceType === 'url') {
      return {
        source: 'url' as const,
        url: marketplaceSourceValue.trim() || undefined,
      };
    }
    return './';
  })();

  const marketplaceManifest = buildMarketplaceManifestForPlugin(pluginManifest, {
    ownerName: marketplaceOwnerName || authorName || 'Allternit Team',
    ownerEmail: marketplaceOwnerEmail || undefined,
    source: marketplaceSource,
    name: 'allternit-plugin-marketplace',
  });

  const pluginValidation = validatePluginManifestV1(pluginManifest);
  const marketplaceValidation = validateMarketplaceManifestV1(marketplaceManifest);

  const createReadme = () => {
    const lines = [
      `# ${name || pluginManifest.name}`,
      '',
      description || 'Plugin generated with the Allternit Plugin Wizard.',
      '',
      '## Manifest',
      '- Standard: `.claude-plugin/plugin.json`',
      '- Version: ' + (version || '1.0.0'),
      '- Category: ' + (category || 'development'),
      '',
    ];

    const commands = parseCsvList(commandsCsv);
    const skills = parseCsvList(skillsCsv);
    const connectors = parseCsvList(connectorsCsv);
    const agents = parseCsvList(agentsCsv);
    const mcps = parseCsvList(mcpsCsv);
    const webhooks = parseCsvList(webhooksCsv);

    if (commands.length > 0) {
      lines.push('## Commands');
      for (const command of commands) lines.push(`- ${command}`);
      lines.push('');
    }
    if (skills.length > 0) {
      lines.push('## Skills');
      for (const skill of skills) lines.push(`- ${skill}`);
      lines.push('');
    }
    if (connectors.length > 0) {
      lines.push('## Connectors');
      for (const connector of connectors) lines.push(`- ${connector}`);
      lines.push('');
    }
    if (agents.length > 0) {
      lines.push('## Agents');
      for (const agent of agents) lines.push(`- ${agent}`);
      lines.push('');
    }
    if (mcps.length > 0) {
      lines.push('## MCP Servers');
      for (const mcp of mcps) lines.push(`- ${mcp}`);
      lines.push('');
    }
    if (webhooks.length > 0) {
      lines.push('## Webhooks');
      for (const hook of webhooks) lines.push(`- ${hook}`);
      lines.push('');
    }

    return lines.join('\n');
  };

  const handleSubmit = () => {
    if (!name.trim() || !description.trim()) return;
    if (!pluginValidation.valid) return;
    if (includeMarketplaceTemplate && !marketplaceValidation.valid) return;

    const files: Array<{ relativePath: string; content: string }> = [
      {
        relativePath: '.claude-plugin/plugin.json',
        content: JSON.stringify(pluginManifest, null, 2),
      },
    ];

    if (includeMarketplaceTemplate) {
      files.push({
        relativePath: '.claude-plugin/marketplace.template.json',
        content: JSON.stringify(marketplaceManifest, null, 2),
      });
    }

    const commandEntries = parseCsvList(commandsCsv);
    const skillEntries = parseCsvList(skillsCsv);
    if (scaffoldCommandFiles) {
      for (const command of commandEntries) {
        const commandId = slugifyPluginName(command.replace(/^\//, ''));
        files.push({
          relativePath: `commands/${commandId}.md`,
          content: `# /${commandId}\n\nDescribe how this command should behave.\n\n## Inputs\n- Add expected input arguments.\n\n## Output\n- Add expected result format.\n`,
        });
      }
    }

    if (scaffoldSkillFiles) {
      for (const skill of skillEntries) {
        const skillId = slugifyPluginName(skill.split('/').filter(Boolean).pop() || skill);
        files.push({
          relativePath: `skills/${skillId}/SKILL.md`,
          content: `# ${skillId}\n\nDefine the purpose of this skill and execution guardrails.\n\n## When to use\n- Add clear trigger conditions.\n\n## Workflow\n1. Add deterministic steps.\n2. Add constraints.\n`,
        });
      }
    }

    if (scaffoldMcpFiles) {
      for (const mcp of mcpEntries) {
        const mcpId = slugifyPluginName(mcp);
        files.push({
          relativePath: `mcp/${mcpId}.json`,
          content: JSON.stringify({
            id: mcpId,
            command: mcpId,
            args: [],
            env: {},
            description: `MCP server scaffold for ${mcp}`,
          }, null, 2),
        });
      }
    }

    if (scaffoldWebhookFiles) {
      for (const webhook of webhookEntries) {
        const hookId = slugifyPluginName(webhook);
        files.push({
          relativePath: `webhooks/${hookId}.json`,
          content: JSON.stringify({
            id: hookId,
            event: webhook,
            method: 'POST',
            path: `/webhooks/${hookId}`,
            description: `Webhook scaffold for ${webhook}`,
          }, null, 2),
        });
      }
    }

    void onCreate?.('plugins', {
      name: name.trim(),
      description: description.trim(),
      category: category.trim(),
      tags: parseCsvList(tagsCsv),
      content: createReadme(),
      pluginManifest,
      marketplaceManifest: includeMarketplaceTemplate ? marketplaceManifest : undefined,
      files,
    });
    onClose();
  };

  const canGoNext =
    (step === 0 && name.trim().length > 0 && description.trim().length > 0) ||
    step === 1 ||
    step === 2;

  return (
    <FormWrapper
      title="Create Plugin (Wizard)"
      description="Generate a production plugin manifest and optional marketplace template."
      onClose={onClose}
      onSubmit={handleSubmit}
      isSubmitDisabled={!name.trim() || !description.trim() || !pluginValidation.valid || (includeMarketplaceTemplate && !marketplaceValidation.valid)}
    >
      <div style={{ display: 'flex', gap: 8, marginBottom: 18 }}>
        {['Basics', 'Capabilities', 'Marketplace', 'Preview'].map((label, index) => (
          <button
            key={label}
            type="button"
            onClick={() => setStep(index)}
            style={{
              padding: '6px 10px',
              borderRadius: 999,
              border: `1px solid ${THEME.border}`,
              background: step === index ? THEME.accentMuted : 'transparent',
              color: step === index ? THEME.textPrimary : THEME.textSecondary,
              fontSize: 12,
              cursor: 'pointer',
            }}
          >
            {index + 1}. {label}
          </button>
        ))}
      </div>

      {step === 0 && (
        <>
          <FormField label="Plugin Name" id="plug-name" required hint="Shown in UI and used to derive manifest name.">
            <TextInput id="plug-name" value={name} onChange={setName} placeholder="e.g., Agent Rails Toolkit" required />
          </FormField>
          <FormField label="Description" id="plug-desc" required>
            <TextArea id="plug-desc" value={description} onChange={setDescription} placeholder="What this plugin does" rows={3} />
          </FormField>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <FormField label="Version" id="plug-ver" required>
              <TextInput id="plug-ver" value={version} onChange={setVersion} placeholder="1.0.0" />
            </FormField>
            <FormField label="Category" id="plug-cat">
              <TextInput id="plug-cat" value={category} onChange={setCategory} placeholder="development" />
            </FormField>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <FormField label="Author Name" id="plug-auth">
              <TextInput id="plug-auth" value={authorName} onChange={setAuthorName} placeholder="Allternit Team" />
            </FormField>
            <FormField label="Author Email" id="plug-email">
              <TextInput id="plug-email" value={authorEmail} onChange={setAuthorEmail} placeholder="plugins@allternit.dev" />
            </FormField>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <FormField label="License" id="plug-lic">
              <TextInput id="plug-lic" value={license} onChange={setLicense} placeholder="MIT" />
            </FormField>
            <FormField label="Tags (comma-separated)" id="plug-tags">
              <TextInput id="plug-tags" value={tagsCsv} onChange={setTagsCsv} placeholder="automation,workflow,agents" />
            </FormField>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <FormField label="Repository URL" id="plug-repo">
              <TextInput id="plug-repo" value={repository} onChange={setRepository} placeholder="https://github.com/org/repo" />
            </FormField>
            <FormField label="Homepage URL" id="plug-home">
              <TextInput id="plug-home" value={homepage} onChange={setHomepage} placeholder="https://example.com" />
            </FormField>
          </div>
        </>
      )}

      {step === 1 && (
        <>
          <FormField label="Commands (comma-separated)" id="plug-cmds" hint="Examples: /brief, /review-pr">
            <TextInput id="plug-cmds" value={commandsCsv} onChange={setCommandsCsv} placeholder="/brief,/agent-rails" />
          </FormField>
          <FormField label="Skills (comma-separated)" id="plug-skills" hint="Skill folder names or references.">
            <TextInput id="plug-skills" value={skillsCsv} onChange={setSkillsCsv} placeholder="./skills/agent-rails,./skills/review" />
          </FormField>
          <FormField label="Connectors (comma-separated)" id="plug-conns">
            <TextInput id="plug-conns" value={connectorsCsv} onChange={setConnectorsCsv} placeholder="github,google-drive" />
          </FormField>
          <FormField label="Agents (comma-separated)" id="plug-agents">
            <TextInput id="plug-agents" value={agentsCsv} onChange={setAgentsCsv} placeholder="./agents/reviewer,./agents/planner" />
          </FormField>
          <FormField label="MCP Servers (comma-separated)" id="plug-mcps" hint="Example: filesystem, browser-tools">
            <TextInput id="plug-mcps" value={mcpsCsv} onChange={setMcpsCsv} placeholder="filesystem,browser-tools" />
          </FormField>
          <FormField label="Webhooks (comma-separated)" id="plug-hooks" hint="Example: build.completed,deploy.failed">
            <TextInput id="plug-hooks" value={webhooksCsv} onChange={setWebhooksCsv} placeholder="build.completed,deploy.failed" />
          </FormField>
          <FormField label="Keywords (comma-separated)" id="plug-keys">
            <TextInput id="plug-keys" value={keywordsCsv} onChange={setKeywordsCsv} placeholder="rails,workflow,review" />
          </FormField>
          <label style={{ display: 'inline-flex', alignItems: 'center', gap: 8, color: THEME.textSecondary, fontSize: 13 }}>
            <input type="checkbox"
              checked={strict}
              onChange={(e) => setStrict(e.target.checked)}
            />
            Strict mode (enforce stricter plugin behavior)
          </label>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 8 }}>
            <label style={{ display: 'inline-flex', alignItems: 'center', gap: 8, color: THEME.textSecondary, fontSize: 12 }}>
              <input type="checkbox" checked={scaffoldCommandFiles} onChange={(e) => setScaffoldCommandFiles(e.target.checked)} />
              Scaffold command files
            </label>
            <label style={{ display: 'inline-flex', alignItems: 'center', gap: 8, color: THEME.textSecondary, fontSize: 12 }}>
              <input type="checkbox" checked={scaffoldSkillFiles} onChange={(e) => setScaffoldSkillFiles(e.target.checked)} />
              Scaffold skill files
            </label>
            <label style={{ display: 'inline-flex', alignItems: 'center', gap: 8, color: THEME.textSecondary, fontSize: 12 }}>
              <input type="checkbox" checked={scaffoldMcpFiles} onChange={(e) => setScaffoldMcpFiles(e.target.checked)} />
              Scaffold MCP files
            </label>
            <label style={{ display: 'inline-flex', alignItems: 'center', gap: 8, color: THEME.textSecondary, fontSize: 12 }}>
              <input type="checkbox" checked={scaffoldWebhookFiles} onChange={(e) => setScaffoldWebhookFiles(e.target.checked)} />
              Scaffold webhook files
            </label>
          </div>
        </>
      )}

      {step === 2 && (
        <>
          <label style={{ display: 'inline-flex', alignItems: 'center', gap: 8, color: THEME.textSecondary, fontSize: 13, marginBottom: 12 }}>
            <input type="checkbox"
              checked={includeMarketplaceTemplate}
              onChange={(e) => setIncludeMarketplaceTemplate(e.target.checked)}
            />
            Generate `.claude-plugin/marketplace.template.json`
          </label>

          {includeMarketplaceTemplate && (
            <>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <FormField label="Marketplace Owner" id="mkt-owner">
                  <TextInput id="mkt-owner" value={marketplaceOwnerName} onChange={setMarketplaceOwnerName} placeholder="Allternit Team" />
                </FormField>
                <FormField label="Owner Email" id="mkt-email">
                  <TextInput id="mkt-email" value={marketplaceOwnerEmail} onChange={setMarketplaceOwnerEmail} placeholder="plugins@allternit.dev" />
                </FormField>
              </div>

              <FormField label="Plugin Source Type" id="mkt-type">
                <Select
                  id="mkt-type"
                  value={marketplaceSourceType}
                  onChange={(value) => setMarketplaceSourceType(value as 'local' | 'github' | 'url')}
                  options={[
                    { value: 'local', label: 'Local (./)' },
                    { value: 'github', label: 'GitHub repo' },
                    { value: 'url', label: 'Direct URL' },
                  ]}
                />
              </FormField>

              {marketplaceSourceType !== 'local' && (
                <FormField
                  id="mkt-val"
                  label={marketplaceSourceType === 'github' ? 'Repo (owner/repo)' : 'Source URL'}
                  hint={marketplaceSourceType === 'github' ? 'Example: anthropics/claude-code' : 'Example: https://example.com/plugin.zip'}
                >
                  <TextInput
                    id="mkt-val"
                    value={marketplaceSourceValue}
                    onChange={setMarketplaceSourceValue}
                    placeholder={marketplaceSourceType === 'github' ? 'owner/repo' : 'https://...'}
                  />
                </FormField>
              )}
            </>
          )}
        </>
      )}

      {step === 3 && (
        <>
          <FormField label="plugin.json preview" id="prev-plug">
            <TextArea id="prev-plug" value={JSON.stringify(pluginManifest, null, 2)} readOnly rows={10} />
          </FormField>
          {includeMarketplaceTemplate && (
            <FormField label="marketplace.template.json preview" id="prev-mkt">
              <TextArea id="prev-mkt" value={JSON.stringify(marketplaceManifest, null, 2)} readOnly rows={10} />
            </FormField>
          )}
          {!pluginValidation.valid && (
            <div style={{ color: 'var(--status-error)', fontSize: 12, marginBottom: 8 }}>
              {pluginValidation.errors.join(' ')}
            </div>
          )}
          {includeMarketplaceTemplate && !marketplaceValidation.valid && (
            <div style={{ color: 'var(--status-error)', fontSize: 12 }}>
              {marketplaceValidation.errors.join(' ')}
            </div>
          )}
        </>
      )}

      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8 }}>
        <button
          type="button"
          onClick={() => setStep((prev) => Math.max(0, prev - 1))}
          disabled={step === 0}
          style={{
            padding: '8px 12px',
            borderRadius: 8,
            border: `1px solid ${THEME.border}`,
            background: 'transparent',
            color: THEME.textSecondary,
            cursor: step === 0 ? 'not-allowed' : 'pointer',
            opacity: step === 0 ? 0.5 : 1,
          }}
        >
          Back
        </button>
        <button
          type="button"
          onClick={() => setStep((prev) => Math.min(3, prev + 1))}
          disabled={step >= 3 || !canGoNext}
          style={{
            padding: '8px 12px',
            borderRadius: 8,
            border: `1px solid ${THEME.border}`,
            background: THEME.accentMuted,
            color: THEME.textPrimary,
            cursor: step >= 3 || !canGoNext ? 'not-allowed' : 'pointer',
            opacity: step >= 3 || !canGoNext ? 0.5 : 1,
          }}
        >
          Next
        </button>
      </div>
    </FormWrapper>
  );
}

function AddGenericForm({
  label,
  onClose,
  onCreate,
  tab,
}: {
  label: string;
  onClose: () => void;
  onCreate?: (tab: TabId, payload: CapabilityFormPayload) => void | Promise<void>;
  tab: TabId;
}) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');

  const handleSubmit = () => {
    if (!name.trim()) return;
    void onCreate?.(tab, { name: name.trim(), description: description.trim() });
    onClose();
  };

  return (
    <FormWrapper
      title={label}
      description="Create a new capability"
      onClose={onClose}
      onSubmit={handleSubmit}
      isSubmitDisabled={!name.trim()}
    >
      <FormField label="Name" id="gen-name" required>
        <TextInput id="gen-name" value={name} onChange={setName} placeholder={`e.g., ${label}`} required />
      </FormField>
      <FormField label="Description" id="gen-desc">
        <TextArea id="gen-desc" value={description} onChange={setDescription} rows={3} />
      </FormField>
    </FormWrapper>
  );
}
