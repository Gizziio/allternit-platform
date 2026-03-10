/**
 * Skill Builder Wizard
 * 
 * Comprehensive wizard for creating new agent skills with:
 * - Skill metadata definition
 * - Interface specification (inputs/outputs)
 * - Execution configuration
 * - Requirements specification
 * - Example scenarios
 * - Generates SKILL.md and contract.json
 */

import React, { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Wrench,
  Plus,
  Trash2,
  ChevronRight,
  ChevronLeft,
  Check,
  FileText,
  Code,
  Settings,
  Play,
  Save,
  X,
  AlertCircle,
  Tag,
  User,
  Clock,
  Shield,
  Box,
} from 'lucide-react';
import { agentWorkspaceService } from '@/lib/agents/agent-workspace.service';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';

interface SkillBuilderWizardProps {
  agentId: string;
  onClose: () => void;
  onSkillCreated?: (skillId: string) => void;
  theme?: {
    textPrimary: string;
    textSecondary: string;
    textMuted: string;
    accent: string;
    bgCard: string;
    bg: string;
    borderSubtle: string;
  };
}

const STUDIO_THEME = {
  textPrimary: '#ECECEC',
  textSecondary: '#A0A0A0',
  textMuted: '#6B6B6B',
  accent: '#D4956A',
  bgCard: 'rgba(42, 33, 26, 0.6)',
  bg: '#0E0D0C',
  borderSubtle: 'rgba(255,255,255,0.08)',
};

type StepId = 'metadata' | 'interface' | 'execution' | 'examples' | 'review';

interface SkillFormData {
  // Metadata
  id: string;
  name: string;
  description: string;
  version: string;
  author: string;
  tags: string[];
  
  // Interface
  inputs: Array<{
    id: string;
    name: string;
    type: 'string' | 'number' | 'boolean' | 'array' | 'object';
    required: boolean;
    description: string;
  }>;
  outputs: Array<{
    id: string;
    name: string;
    type: 'string' | 'number' | 'boolean' | 'array' | 'object';
    description: string;
  }>;
  
  // Execution
  mode: 'sync' | 'async' | 'streaming';
  timeout: number;
  retries: number;
  
  // Requirements
  requiredTools: string[];
  requiredPermissions: string[];
  
  // Examples
  examples: Array<{
    id: string;
    name: string;
    input: string;
    output: string;
  }>;
  
  // Documentation
  whenToUse: string;
  procedure: string[];
  errorHandling: string;
}

const INITIAL_FORM_DATA: SkillFormData = {
  id: '',
  name: '',
  description: '',
  version: '1.0.0',
  author: '',
  tags: [],
  inputs: [],
  outputs: [],
  mode: 'sync',
  timeout: 30,
  retries: 3,
  requiredTools: [],
  requiredPermissions: [],
  examples: [],
  whenToUse: '',
  procedure: ['', '', ''],
  errorHandling: '',
};

const STEPS: { id: StepId; label: string; description: string }[] = [
  { id: 'metadata', label: 'Metadata', description: 'Basic skill information' },
  { id: 'interface', label: 'Interface', description: 'Inputs and outputs' },
  { id: 'execution', label: 'Execution', description: 'Runtime configuration' },
  { id: 'examples', label: 'Examples', description: 'Usage scenarios' },
  { id: 'review', label: 'Review', description: 'Generate skill files' },
];

// Generate skill ID from name
function generateSkillId(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

// Generate SKILL.md content
function generateSkillMarkdown(data: SkillFormData): string {
  const lines = [
    `# SKILL.md - ${data.name}`,
    '',
    '## Overview',
    '',
    data.description,
    '',
    '## Purpose',
    '',
    `This skill enables the agent to ${data.description.toLowerCase()}.`,
    '',
    '## When to Use',
    '',
    data.whenToUse || `Use this skill when you need to ${data.description.toLowerCase()}.`,
    '',
    '## Procedure',
    '',
    ...data.procedure.filter(Boolean).map((step, i) => `### Step ${i + 1}\n${step}`),
    '',
    '## Inputs',
    '',
    '| Name | Type | Required | Description |',
    '|------|------|----------|-------------|',
    ...data.inputs.map(input => 
      `| ${input.name} | ${input.type} | ${input.required ? 'Yes' : 'No'} | ${input.description} |`
    ),
    '',
    '## Outputs',
    '',
    '| Name | Type | Description |',
    '|------|------|-------------|',
    ...data.outputs.map(output => 
      `| ${output.name} | ${output.type} | ${output.description} |`
    ),
    '',
    '## Examples',
    '',
    ...data.examples.flatMap((ex, i) => [
      `### Example ${i + 1}: ${ex.name}`,
      '```',
      `Input: ${ex.input}`,
      `Output: ${ex.output}`,
      '```',
      '',
    ]),
    '## Error Handling',
    '',
    data.errorHandling || 'Common errors and their solutions will be documented here.',
    '',
    '## Requirements',
    '',
    '### Required Tools',
    ...data.requiredTools.map(tool => `- ${tool}`),
    '',
    '### Required Permissions',
    ...data.requiredPermissions.map(perm => `- ${perm}`),
    '',
    '## Version History',
    '',
    `- ${data.version} - Initial skill`,
    '',
  ];
  
  return lines.join('\n');
}

// Generate contract.json content
function generateContractJson(data: SkillFormData): object {
  return {
    schema_version: '1.0.0',
    skill: {
      id: data.id || generateSkillId(data.name),
      name: data.name,
      description: data.description,
      version: data.version,
      author: data.author,
      tags: data.tags,
    },
    interface: {
      inputs: data.inputs.map(input => ({
        name: input.name,
        type: input.type,
        required: input.required,
        description: input.description,
      })),
      outputs: data.outputs.map(output => ({
        name: output.name,
        type: output.type,
        description: output.description,
      })),
    },
    execution: {
      mode: data.mode,
      timeout: data.timeout,
      retries: data.retries,
    },
    requirements: {
      tools: data.requiredTools,
      permissions: data.requiredPermissions,
    },
    examples: data.examples.map(ex => {
      let input: Record<string, unknown> = {};
      let output: Record<string, unknown> = {};
      try {
        input = JSON.parse(ex.input || '{}') as Record<string, unknown>;
      } catch {
        input = { error: 'Invalid input JSON' };
      }
      try {
        output = JSON.parse(ex.output || '{}') as Record<string, unknown>;
      } catch {
        output = { error: 'Invalid output JSON' };
      }
      return {
        name: ex.name,
        input,
        output,
      };
    }),
  };
}

export function SkillBuilderWizard({ agentId, onClose, onSkillCreated, theme = STUDIO_THEME }: SkillBuilderWizardProps) {
  const [currentStep, setCurrentStep] = useState<StepId>('metadata');
  const [formData, setFormData] = useState<SkillFormData>(INITIAL_FORM_DATA);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [newTag, setNewTag] = useState('');
  const [newTool, setNewTool] = useState('');
  const [newPermission, setNewPermission] = useState('');

  const currentStepIndex = STEPS.findIndex(s => s.id === currentStep);

  const updateForm = useCallback(<K extends keyof SkillFormData>(key: K, value: SkillFormData[K]) => {
    setFormData(prev => ({ ...prev, [key]: value }));
  }, []);

  const addInput = () => {
    setFormData(prev => ({
      ...prev,
      inputs: [...prev.inputs, { id: Date.now().toString(), name: '', type: 'string', required: true, description: '' }],
    }));
  };

  const removeInput = (id: string) => {
    setFormData(prev => ({ ...prev, inputs: prev.inputs.filter(i => i.id !== id) }));
  };

  const updateInput = (id: string, updates: Partial<SkillFormData['inputs'][0]>) => {
    setFormData(prev => ({
      ...prev,
      inputs: prev.inputs.map(i => i.id === id ? { ...i, ...updates } : i),
    }));
  };

  const addOutput = () => {
    setFormData(prev => ({
      ...prev,
      outputs: [...prev.outputs, { id: Date.now().toString(), name: '', type: 'string', description: '' }],
    }));
  };

  const removeOutput = (id: string) => {
    setFormData(prev => ({ ...prev, outputs: prev.outputs.filter(o => o.id !== id) }));
  };

  const updateOutput = (id: string, updates: Partial<SkillFormData['outputs'][0]>) => {
    setFormData(prev => ({
      ...prev,
      outputs: prev.outputs.map(o => o.id === id ? { ...o, ...updates } : o),
    }));
  };

  const addExample = () => {
    setFormData(prev => ({
      ...prev,
      examples: [...prev.examples, { id: Date.now().toString(), name: '', input: '', output: '' }],
    }));
  };

  const removeExample = (id: string) => {
    setFormData(prev => ({ ...prev, examples: prev.examples.filter(e => e.id !== id) }));
  };

  const updateExample = (id: string, updates: Partial<SkillFormData['examples'][0]>) => {
    setFormData(prev => ({
      ...prev,
      examples: prev.examples.map(e => e.id === id ? { ...e, ...updates } : e),
    }));
  };

  const addTag = () => {
    if (newTag && !formData.tags.includes(newTag)) {
      setFormData(prev => ({ ...prev, tags: [...prev.tags, newTag] }));
      setNewTag('');
    }
  };

  const removeTag = (tag: string) => {
    setFormData(prev => ({ ...prev, tags: prev.tags.filter(t => t !== tag) }));
  };

  const addTool = () => {
    if (newTool && !formData.requiredTools.includes(newTool)) {
      setFormData(prev => ({ ...prev, requiredTools: [...prev.requiredTools, newTool] }));
      setNewTool('');
    }
  };

  const addPermission = () => {
    if (newPermission && !formData.requiredPermissions.includes(newPermission)) {
      setFormData(prev => ({ ...prev, requiredPermissions: [...prev.requiredPermissions, newPermission] }));
      setNewPermission('');
    }
  };

  const goToNextStep = () => {
    if (currentStepIndex < STEPS.length - 1) {
      setCurrentStep(STEPS[currentStepIndex + 1].id);
    }
  };

  const goToPreviousStep = () => {
    if (currentStepIndex > 0) {
      setCurrentStep(STEPS[currentStepIndex - 1].id);
    }
  };

  const saveSkill = async () => {
    setIsSaving(true);
    setError(null);
    try {
      const skillId = formData.id || generateSkillId(formData.name);
      const skillPath = `.a2r/skills/${skillId}`;

      // Generate and save SKILL.md
      const skillMarkdown = generateSkillMarkdown(formData);
      await agentWorkspaceService.writeFile(agentId, `${skillPath}/SKILL.md`, skillMarkdown);

      // Generate and save contract.json
      const contractJson = generateContractJson(formData);
      await agentWorkspaceService.writeFile(agentId, `${skillPath}/contract.json`, JSON.stringify(contractJson, null, 2));

      onSkillCreated?.(skillId);
      onClose();
    } catch (e) {
      setError('Failed to save skill files');
      console.error(e);
    } finally {
      setIsSaving(false);
    }
  };

  const canProceed = () => {
    switch (currentStep) {
      case 'metadata':
        return formData.name.trim() && formData.description.trim();
      case 'interface':
        return formData.inputs.length > 0 && formData.inputs.every(i => i.name.trim());
      case 'execution':
        return true;
      case 'examples':
        return true;
      default:
        return true;
    }
  };

  // Render step content
  const renderStepContent = () => {
    switch (currentStep) {
      case 'metadata':
        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              <div>
                <label style={{ fontSize: '13px', color: theme.textSecondary, marginBottom: '6px', display: 'block' }}>
                  Skill Name *
                </label>
                <Input
                  value={formData.name}
                  onChange={(e) => {
                    const name = e.target.value;
                    setFormData(prev => ({ 
                      ...prev, 
                      name,
                      id: generateSkillId(name),
                    }));
                  }}
                  placeholder="e.g., Generate Report"
                  style={{ background: theme.bg, border: `1px solid ${theme.borderSubtle}`, color: theme.textPrimary }}
                />
              </div>
              <div>
                <label style={{ fontSize: '13px', color: theme.textSecondary, marginBottom: '6px', display: 'block' }}>
                  Skill ID
                </label>
                <Input
                  value={formData.id || generateSkillId(formData.name)}
                  readOnly
                  style={{ background: theme.bg, border: `1px solid ${theme.borderSubtle}`, color: theme.textMuted }}
                />
              </div>
            </div>

            <div>
              <label style={{ fontSize: '13px', color: theme.textSecondary, marginBottom: '6px', display: 'block' }}>
                Description *
              </label>
              <Textarea
                value={formData.description}
                onChange={(e) => updateForm('description', e.target.value)}
                placeholder="What does this skill do?"
                rows={3}
                style={{ background: theme.bg, border: `1px solid ${theme.borderSubtle}`, color: theme.textPrimary }}
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              <div>
                <label style={{ fontSize: '13px', color: theme.textSecondary, marginBottom: '6px', display: 'block' }}>
                  Version
                </label>
                <Input
                  value={formData.version}
                  onChange={(e) => updateForm('version', e.target.value)}
                  style={{ background: theme.bg, border: `1px solid ${theme.borderSubtle}`, color: theme.textPrimary }}
                />
              </div>
              <div>
                <label style={{ fontSize: '13px', color: theme.textSecondary, marginBottom: '6px', display: 'block' }}>
                  Author
                </label>
                <Input
                  value={formData.author}
                  onChange={(e) => updateForm('author', e.target.value)}
                  placeholder="Your name"
                  style={{ background: theme.bg, border: `1px solid ${theme.borderSubtle}`, color: theme.textPrimary }}
                />
              </div>
            </div>

            <div>
              <label style={{ fontSize: '13px', color: theme.textSecondary, marginBottom: '6px', display: 'block' }}>
                Tags
              </label>
              <div style={{ display: 'flex', gap: '8px', marginBottom: '8px', flexWrap: 'wrap' }}>
                {formData.tags.map(tag => (
                  <Badge key={tag} variant="secondary" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    {tag}
                    <button onClick={() => removeTag(tag)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
                      <X style={{ width: 12, height: 12 }} />
                    </button>
                  </Badge>
                ))}
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                <Input
                  value={newTag}
                  onChange={(e) => setNewTag(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && addTag()}
                  placeholder="Add tag..."
                  style={{ background: theme.bg, border: `1px solid ${theme.borderSubtle}`, color: theme.textPrimary, flex: 1 }}
                />
                <Button variant="outline" size="sm" onClick={addTag}>
                  <Plus style={{ width: 16, height: 16 }} />
                </Button>
              </div>
            </div>

            <div>
              <label style={{ fontSize: '13px', color: theme.textSecondary, marginBottom: '6px', display: 'block' }}>
                When to Use
              </label>
              <Textarea
                value={formData.whenToUse}
                onChange={(e) => updateForm('whenToUse', e.target.value)}
                placeholder="Describe scenarios where this skill should be used"
                rows={3}
                style={{ background: theme.bg, border: `1px solid ${theme.borderSubtle}`, color: theme.textPrimary }}
              />
            </div>
          </div>
        );

      case 'interface':
        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            {/* Inputs */}
            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                <h4 style={{ fontSize: '14px', fontWeight: 600, color: theme.textPrimary, margin: 0 }}>
                  Inputs
                </h4>
                <Button size="sm" variant="outline" onClick={addInput}>
                  <Plus style={{ width: 14, height: 14, marginRight: '6px' }} />
                  Add Input
                </Button>
              </div>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {formData.inputs.map((input, index) => (
                  <div
                    key={input.id}
                    style={{
                      padding: '16px',
                      background: theme.bg,
                      borderRadius: '8px',
                      border: `1px solid ${theme.borderSubtle}`,
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                      <span style={{ fontSize: '13px', fontWeight: 500, color: theme.textSecondary }}>
                        Input {index + 1}
                      </span>
                      <button
                        onClick={() => removeInput(input.id)}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: theme.textMuted }}
                      >
                        <Trash2 style={{ width: 14, height: 14 }} />
                      </button>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: '12px' }}>
                      <Input
                        value={input.name}
                        onChange={(e) => updateInput(input.id, { name: e.target.value })}
                        placeholder="Name"
                        style={{ background: theme.bgCard, border: `1px solid ${theme.borderSubtle}`, color: theme.textPrimary }}
                      />
                      <select
                        value={input.type}
                        onChange={(e) => updateInput(input.id, { type: e.target.value as any })}
                        style={{ background: theme.bgCard, border: `1px solid ${theme.borderSubtle}`, color: theme.textPrimary, padding: '8px', borderRadius: '6px' }}
                      >
                        <option value="string">string</option>
                        <option value="number">number</option>
                        <option value="boolean">boolean</option>
                        <option value="array">array</option>
                        <option value="object">object</option>
                      </select>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <Switch
                          checked={input.required}
                          onCheckedChange={(checked) => updateInput(input.id, { required: checked })}
                        />
                        <span style={{ fontSize: '12px', color: theme.textSecondary }}>Required</span>
                      </div>
                    </div>
                    <Input
                      value={input.description}
                      onChange={(e) => updateInput(input.id, { description: e.target.value })}
                      placeholder="Description"
                      style={{ background: theme.bgCard, border: `1px solid ${theme.borderSubtle}`, color: theme.textPrimary, marginTop: '8px' }}
                    />
                  </div>
                ))}
              </div>
            </div>

            {/* Outputs */}
            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                <h4 style={{ fontSize: '14px', fontWeight: 600, color: theme.textPrimary, margin: 0 }}>
                  Outputs
                </h4>
                <Button size="sm" variant="outline" onClick={addOutput}>
                  <Plus style={{ width: 14, height: 14, marginRight: '6px' }} />
                  Add Output
                </Button>
              </div>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {formData.outputs.map((output, index) => (
                  <div
                    key={output.id}
                    style={{
                      padding: '16px',
                      background: theme.bg,
                      borderRadius: '8px',
                      border: `1px solid ${theme.borderSubtle}`,
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                      <span style={{ fontSize: '13px', fontWeight: 500, color: theme.textSecondary }}>
                        Output {index + 1}
                      </span>
                      <button
                        onClick={() => removeOutput(output.id)}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: theme.textMuted }}
                      >
                        <Trash2 style={{ width: 14, height: 14 }} />
                      </button>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '12px' }}>
                      <Input
                        value={output.name}
                        onChange={(e) => updateOutput(output.id, { name: e.target.value })}
                        placeholder="Name"
                        style={{ background: theme.bgCard, border: `1px solid ${theme.borderSubtle}`, color: theme.textPrimary }}
                      />
                      <select
                        value={output.type}
                        onChange={(e) => updateOutput(output.id, { type: e.target.value as any })}
                        style={{ background: theme.bgCard, border: `1px solid ${theme.borderSubtle}`, color: theme.textPrimary, padding: '8px', borderRadius: '6px' }}
                      >
                        <option value="string">string</option>
                        <option value="number">number</option>
                        <option value="boolean">boolean</option>
                        <option value="array">array</option>
                        <option value="object">object</option>
                      </select>
                    </div>
                    <Input
                      value={output.description}
                      onChange={(e) => updateOutput(output.id, { description: e.target.value })}
                      placeholder="Description"
                      style={{ background: theme.bgCard, border: `1px solid ${theme.borderSubtle}`, color: theme.textPrimary, marginTop: '8px' }}
                    />
                  </div>
                ))}
              </div>
            </div>
          </div>
        );

      case 'execution':
        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            {/* Execution Mode */}
            <div>
              <label style={{ fontSize: '13px', color: theme.textSecondary, marginBottom: '12px', display: 'block' }}>
                Execution Mode
              </label>
              <div style={{ display: 'flex', gap: '12px' }}>
                {(['sync', 'async', 'streaming'] as const).map(mode => (
                  <button
                    key={mode}
                    onClick={() => updateForm('mode', mode)}
                    style={{
                      flex: 1,
                      padding: '16px',
                      borderRadius: '8px',
                      border: `1px solid ${formData.mode === mode ? theme.accent : theme.borderSubtle}`,
                      background: formData.mode === mode ? `${theme.accent}15` : theme.bg,
                      cursor: 'pointer',
                      textAlign: 'center',
                    }}
                  >
                    <span style={{ 
                      fontSize: '14px', 
                      fontWeight: 600, 
                      color: formData.mode === mode ? theme.accent : theme.textPrimary,
                      textTransform: 'capitalize',
                    }}>
                      {mode}
                    </span>
                    <p style={{ fontSize: '12px', color: theme.textMuted, margin: '4px 0 0 0' }}>
                      {mode === 'sync' && 'Wait for completion'}
                      {mode === 'async' && 'Run in background'}
                      {mode === 'streaming' && 'Stream results'}
                    </p>
                  </button>
                ))}
              </div>
            </div>

            {/* Timeout and Retries */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              <div>
                <label style={{ fontSize: '13px', color: theme.textSecondary, marginBottom: '6px', display: 'block' }}>
                  Timeout (seconds)
                </label>
                <Input
                  type="number"
                  value={formData.timeout}
                  onChange={(e) => updateForm('timeout', parseInt(e.target.value) || 30)}
                  min={1}
                  max={3600}
                  style={{ background: theme.bg, border: `1px solid ${theme.borderSubtle}`, color: theme.textPrimary }}
                />
              </div>
              <div>
                <label style={{ fontSize: '13px', color: theme.textSecondary, marginBottom: '6px', display: 'block' }}>
                  Max Retries
                </label>
                <Input
                  type="number"
                  value={formData.retries}
                  onChange={(e) => updateForm('retries', parseInt(e.target.value) || 0)}
                  min={0}
                  max={10}
                  style={{ background: theme.bg, border: `1px solid ${theme.borderSubtle}`, color: theme.textPrimary }}
                />
              </div>
            </div>

            {/* Required Tools */}
            <div>
              <label style={{ fontSize: '13px', color: theme.textSecondary, marginBottom: '6px', display: 'block' }}>
                Required Tools
              </label>
              <div style={{ display: 'flex', gap: '8px', marginBottom: '8px', flexWrap: 'wrap' }}>
                {formData.requiredTools.map(tool => (
                  <Badge key={tool} variant="secondary" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <Box style={{ width: 12, height: 12 }} />
                    {tool}
                    <button onClick={() => updateForm('requiredTools', formData.requiredTools.filter(t => t !== tool))} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
                      <X style={{ width: 12, height: 12 }} />
                    </button>
                  </Badge>
                ))}
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                <Input
                  value={newTool}
                  onChange={(e) => setNewTool(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && addTool()}
                  placeholder="e.g., file-system, web-search"
                  style={{ background: theme.bg, border: `1px solid ${theme.borderSubtle}`, color: theme.textPrimary, flex: 1 }}
                />
                <Button variant="outline" size="sm" onClick={addTool}>
                  <Plus style={{ width: 16, height: 16 }} />
                </Button>
              </div>
            </div>

            {/* Required Permissions */}
            <div>
              <label style={{ fontSize: '13px', color: theme.textSecondary, marginBottom: '6px', display: 'block' }}>
                Required Permissions
              </label>
              <div style={{ display: 'flex', gap: '8px', marginBottom: '8px', flexWrap: 'wrap' }}>
                {formData.requiredPermissions.map(perm => (
                  <Badge key={perm} variant="secondary" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <Shield style={{ width: 12, height: 12 }} />
                    {perm}
                    <button onClick={() => updateForm('requiredPermissions', formData.requiredPermissions.filter(p => p !== perm))} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
                      <X style={{ width: 12, height: 12 }} />
                    </button>
                  </Badge>
                ))}
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                <Input
                  value={newPermission}
                  onChange={(e) => setNewPermission(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && addPermission()}
                  placeholder="e.g., file-write, network-access"
                  style={{ background: theme.bg, border: `1px solid ${theme.borderSubtle}`, color: theme.textPrimary, flex: 1 }}
                />
                <Button variant="outline" size="sm" onClick={addPermission}>
                  <Plus style={{ width: 16, height: 16 }} />
                </Button>
              </div>
            </div>
          </div>
        );

      case 'examples':
        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <h4 style={{ fontSize: '14px', fontWeight: 600, color: theme.textPrimary, margin: 0 }}>
                Usage Examples
              </h4>
              <Button size="sm" variant="outline" onClick={addExample}>
                <Plus style={{ width: 14, height: 14, marginRight: '6px' }} />
                Add Example
              </Button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {formData.examples.map((example, index) => (
                <div
                  key={example.id}
                  style={{
                    padding: '16px',
                    background: theme.bg,
                    borderRadius: '8px',
                    border: `1px solid ${theme.borderSubtle}`,
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                    <Input
                      value={example.name}
                      onChange={(e) => updateExample(example.id, { name: e.target.value })}
                      placeholder={`Example ${index + 1} Name`}
                      style={{ background: theme.bgCard, border: `1px solid ${theme.borderSubtle}`, color: theme.textPrimary, flex: 1, marginRight: '12px' }}
                    />
                    <button
                      onClick={() => removeExample(example.id)}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: theme.textMuted }}
                    >
                      <Trash2 style={{ width: 14, height: 14 }} />
                    </button>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                    <div>
                      <label style={{ fontSize: '11px', color: theme.textMuted, marginBottom: '4px', display: 'block' }}>
                        Input (JSON)
                      </label>
                      <Textarea
                        value={example.input}
                        onChange={(e) => updateExample(example.id, { input: e.target.value })}
                        placeholder='{"query": "example"}'
                        rows={4}
                        style={{ 
                          background: theme.bgCard, 
                          border: `1px solid ${theme.borderSubtle}`, 
                          color: theme.textPrimary,
                          fontFamily: 'monospace',
                          fontSize: '12px',
                        }}
                      />
                    </div>
                    <div>
                      <label style={{ fontSize: '11px', color: theme.textMuted, marginBottom: '4px', display: 'block' }}>
                        Output (JSON)
                      </label>
                      <Textarea
                        value={example.output}
                        onChange={(e) => updateExample(example.id, { output: e.target.value })}
                        placeholder='{"result": "success"}'
                        rows={4}
                        style={{ 
                          background: theme.bgCard, 
                          border: `1px solid ${theme.borderSubtle}`, 
                          color: theme.textPrimary,
                          fontFamily: 'monospace',
                          fontSize: '12px',
                        }}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {formData.examples.length === 0 && (
              <div style={{ textAlign: 'center', padding: '40px', color: theme.textMuted }}>
                <Play style={{ width: 32, height: 32, margin: '0 auto 12px', opacity: 0.5 }} />
                <p style={{ fontSize: '13px', margin: 0 }}>Add examples to help users understand how to use this skill</p>
              </div>
            )}
          </div>
        );

      case 'review':
        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            {/* Summary */}
            <div style={{ padding: '16px', background: theme.bg, borderRadius: '8px', border: `1px solid ${theme.borderSubtle}` }}>
              <h4 style={{ fontSize: '14px', fontWeight: 600, color: theme.textPrimary, margin: '0 0 12px 0' }}>
                Skill Summary
              </h4>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', fontSize: '13px' }}>
                <div>
                  <span style={{ color: theme.textMuted }}>Name: </span>
                  <span style={{ color: theme.textPrimary }}>{formData.name}</span>
                </div>
                <div>
                  <span style={{ color: theme.textMuted }}>ID: </span>
                  <span style={{ color: theme.textPrimary }}>{formData.id || generateSkillId(formData.name)}</span>
                </div>
                <div>
                  <span style={{ color: theme.textMuted }}>Version: </span>
                  <span style={{ color: theme.textPrimary }}>{formData.version}</span>
                </div>
                <div>
                  <span style={{ color: theme.textMuted }}>Mode: </span>
                  <span style={{ color: theme.textPrimary, textTransform: 'capitalize' }}>{formData.mode}</span>
                </div>
                <div>
                  <span style={{ color: theme.textMuted }}>Inputs: </span>
                  <span style={{ color: theme.textPrimary }}>{formData.inputs.length}</span>
                </div>
                <div>
                  <span style={{ color: theme.textMuted }}>Outputs: </span>
                  <span style={{ color: theme.textPrimary }}>{formData.outputs.length}</span>
                </div>
              </div>
            </div>

            {/* Generated Files Preview */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <h4 style={{ fontSize: '14px', fontWeight: 600, color: theme.textPrimary, margin: 0 }}>
                Files to be Created
              </h4>
              
              <div style={{ padding: '12px', background: theme.bg, borderRadius: '8px', border: `1px solid ${theme.borderSubtle}` }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                  <FileText style={{ width: 16, height: 16, color: theme.accent }} />
                  <span style={{ fontSize: '13px', color: theme.textPrimary, fontFamily: 'monospace' }}>
                    .a2r/skills/{formData.id || generateSkillId(formData.name)}/SKILL.md
                  </span>
                </div>
                <pre style={{ 
                  margin: 0, 
                  padding: '12px', 
                  background: theme.bgCard, 
                  borderRadius: '4px',
                  fontSize: '11px',
                  color: theme.textSecondary,
                  overflow: 'auto',
                  maxHeight: '150px',
                }}>
                  {generateSkillMarkdown(formData).slice(0, 500)}...
                </pre>
              </div>

              <div style={{ padding: '12px', background: theme.bg, borderRadius: '8px', border: `1px solid ${theme.borderSubtle}` }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                  <Code style={{ width: 16, height: 16, color: theme.accent }} />
                  <span style={{ fontSize: '13px', color: theme.textPrimary, fontFamily: 'monospace' }}>
                    .a2r/skills/{formData.id || generateSkillId(formData.name)}/contract.json
                  </span>
                </div>
                <pre style={{ 
                  margin: 0, 
                  padding: '12px', 
                  background: theme.bgCard, 
                  borderRadius: '4px',
                  fontSize: '11px',
                  color: theme.textSecondary,
                  overflow: 'auto',
                  maxHeight: '150px',
                }}>
                  {JSON.stringify(generateContractJson(formData), null, 2).slice(0, 500)}...
                </pre>
              </div>
            </div>

            {error && (
              <div style={{ padding: '12px', background: 'rgba(239, 68, 68, 0.1)', borderRadius: '8px', border: '1px solid rgba(239, 68, 68, 0.2)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <AlertCircle style={{ width: 16, height: 16, color: '#ef4444' }} />
                  <span style={{ fontSize: '13px', color: '#ef4444' }}>{error}</span>
                </div>
              </div>
            )}
          </div>
        );
    }
  };

  return (
    <div style={{ 
      position: 'fixed', 
      inset: 0, 
      background: 'rgba(0,0,0,0.7)', 
      display: 'flex', 
      alignItems: 'center', 
      justifyContent: 'center',
      zIndex: 100,
    }}>
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        style={{
          width: '90%',
          maxWidth: '800px',
          maxHeight: '90vh',
          background: theme.bgCard,
          borderRadius: '12px',
          border: `1px solid ${theme.borderSubtle}`,
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {/* Header */}
        <div style={{
          padding: '20px',
          borderBottom: `1px solid ${theme.borderSubtle}`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{
              width: 40,
              height: 40,
              borderRadius: '8px',
              background: `${theme.accent}20`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}>
              <Wrench style={{ width: 20, height: 20, color: theme.accent }} />
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 600, color: theme.textPrimary }}>
                Skill Builder
              </h3>
              <p style={{ margin: '2px 0 0 0', fontSize: '13px', color: theme.textSecondary }}>
                {STEPS[currentStepIndex].description}
              </p>
            </div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: theme.textMuted }}>
            <X style={{ width: 20, height: 20 }} />
          </button>
        </div>

        {/* Progress Steps */}
        <div style={{
          padding: '16px 20px',
          borderBottom: `1px solid ${theme.borderSubtle}`,
          display: 'flex',
          gap: '8px',
        }}>
          {STEPS.map((step, index) => (
            <div
              key={step.id}
              style={{
                flex: 1,
                height: '4px',
                borderRadius: '2px',
                background: index <= currentStepIndex ? theme.accent : theme.borderSubtle,
                transition: 'background 0.2s',
              }}
            />
          ))}
        </div>

        {/* Content */}
        <div style={{ flex: 1, overflow: 'auto', padding: '24px' }}>
          {renderStepContent()}
        </div>

        {/* Footer */}
        <div style={{
          padding: '16px 20px',
          borderTop: `1px solid ${theme.borderSubtle}`,
          display: 'flex',
          justifyContent: 'space-between',
        }}>
          <Button
            variant="outline"
            onClick={goToPreviousStep}
            disabled={currentStepIndex === 0}
          >
            <ChevronLeft style={{ width: 16, height: 16, marginRight: '6px' }} />
            Back
          </Button>

          {currentStep === 'review' ? (
            <Button
              onClick={saveSkill}
              disabled={isSaving}
              style={{ background: theme.accent }}
            >
              {isSaving ? (
                <>
                  <div style={{ width: 16, height: 16, border: '2px solid rgba(255,255,255,0.3)', borderTopColor: '#fff', borderRadius: '50%', animation: 'spin 1s linear infinite', marginRight: '8px' }} />
                  Creating...
                </>
              ) : (
                <>
                  <Save style={{ width: 16, height: 16, marginRight: '6px' }} />
                  Create Skill
                </>
              )}
            </Button>
          ) : (
            <Button
              onClick={goToNextStep}
              disabled={!canProceed()}
              style={{ background: canProceed() ? theme.accent : undefined }}
            >
              Next
              <ChevronRight style={{ width: 16, height: 16, marginLeft: '6px' }} />
            </Button>
          )}
        </div>
      </motion.div>
    </div>
  );
}

export default SkillBuilderWizard;
