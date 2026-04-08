/**
 * Templates View - Agent Configuration Templates
 * 
 * Features:
 * - Browse and search templates
 * - Create new templates from scratch or agents
 * - Edit and duplicate templates
 * - Import/export templates
 * - Quick-apply templates to create agents
 */

import React, { useState, useMemo, useCallback } from 'react';
import {
  Brain, Robot, Cpu, ClipboardText,
  MagnifyingGlass, Upload, Export, Plus, Stack, PencilSimple, Copy, Trash,
} from '@phosphor-icons/react';
import { TEXT, MODE_COLORS, STATUS, BACKGROUND } from '@/design/allternit.tokens';

const ROLE_ICON_MAP: Record<string, React.ElementType> = {
  brain: Brain, robot: Robot, microchip: Cpu, 'clipboard-check': ClipboardText,
};
function RoleIcon({ icon, color, size = 14 }: { icon: string; color: string; size?: number }) {
  const Icon = ROLE_ICON_MAP[icon] ?? Robot;
  return <Icon size={size} color={color} weight="duotone" />;
}
import type { AgentTemplate, AgentRole } from '../types';
import { templateStorage } from '../lib/template-storage';
import { toast } from '@/hooks/use-toast';

interface TemplatesViewProps {
  modeColors: { accent: string };
  onApplyTemplate?: (template: AgentTemplate) => void;
}

const ROLE_COLORS: Record<AgentRole, string> = {
  orchestrator: '#c17817',
  worker: STATUS.info,
  specialist: '#a78bfa',
  reviewer: STATUS.success,
};

const ROLE_ICONS: Record<AgentRole, string> = {
  orchestrator: 'brain',
  worker: 'robot',
  specialist: 'microchip',
  reviewer: 'clipboard-check',
};


export function TemplatesView({ modeColors, onApplyTemplate }: TemplatesViewProps) {
  const [templates, setTemplates] = useState<AgentTemplate[]>(() => templateStorage.getAll());
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedRole, setSelectedRole] = useState<AgentRole | 'all'>('all');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<AgentTemplate | null>(null);
  const [isImporting, setIsImporting] = useState(false);

  // Subscribe to template changes
  React.useEffect(() => {
    return templateStorage.subscribe(newTemplates => {
      setTemplates(newTemplates);
    });
  }, []);

  // Filter templates
  const filteredTemplates = useMemo(() => {
    return templates.filter(t => {
      const matchesSearch = 
        t.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        t.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
        t.capabilities.some(c => c.toLowerCase().includes(searchQuery.toLowerCase()));
      
      const matchesRole = selectedRole === 'all' || t.role === selectedRole;
      
      return matchesSearch && matchesRole;
    });
  }, [templates, searchQuery, selectedRole]);

  const handleCreate = useCallback((template: Omit<AgentTemplate, 'id' | 'createdAt' | 'usageCount'>) => {
    const newTemplate = templateStorage.create(template);
    setShowCreateModal(false);
    toast({
      title: 'Template Created',
      description: `"${newTemplate.name}" has been saved`,
    });
  }, []);

  const handleUpdate = useCallback((id: string, updates: Partial<AgentTemplate>) => {
    const updated = templateStorage.update(id, updates);
    if (updated) {
      setEditingTemplate(null);
      toast({
        title: 'Template Updated',
        description: `"${updated.name}" has been updated`,
      });
    }
  }, []);

  const handleDelete = useCallback((id: string) => {
    const template = templateStorage.getById(id);
    if (template && confirm(`Are you sure you want to delete "${template.name}"?`)) {
      templateStorage.delete(id);
      toast({
        title: 'Template Deleted',
        description: `"${template.name}" has been removed`,
      });
    }
  }, []);

  const handleDuplicate = useCallback((id: string) => {
    const duplicated = templateStorage.duplicate(id);
    if (duplicated) {
      toast({
        title: 'Template Duplicated',
        description: `"${duplicated.name}" has been created`,
      });
    }
  }, []);

  const handleExport = useCallback(() => {
    const json = templateStorage.exportToJSON();
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    
    const link = document.createElement('a');
    link.href = url;
    link.download = `agent-templates-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    
    toast({
      title: 'Templates Exported',
      description: 'Your templates have been downloaded',
    });
  }, []);

  const handleImport = useCallback(async (file: File) => {
    setIsImporting(true);
    try {
      const text = await file.text();
      const result = templateStorage.importFromJSON(text);
      
      toast({
        title: 'Import Complete',
        description: `${result.success} templates imported, ${result.failed} failed`,
      });
    } catch {
      toast({
        title: 'Import Failed',
        description: 'The file could not be parsed',
        variant: 'destructive',
      });
    } finally {
      setIsImporting(false);
    }
  }, []);

  const handleApply = useCallback((template: AgentTemplate) => {
    templateStorage.recordUsage(template.id);
    onApplyTemplate?.(template);
    toast({
      title: 'Template Applied',
      description: `Creating agent from "${template.name}"`,
    });
  }, [onApplyTemplate]);

  return (
    <div className="h-full flex flex-col" style={{ background: BACKGROUND.primary }}>
      {/* Header */}
      <div 
        className="px-6 py-4 border-b flex items-center justify-between"
        style={{ borderColor: 'rgba(255,255,255,0.05)' }}
      >
        <div className="flex items-center gap-4">
          {/* Search */}
          <div className="relative">
            <MagnifyingGlass
              size={13}
              color={TEXT.tertiary}
              className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
            />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search templates..."
              className="pl-9 pr-4 py-2 rounded-lg text-sm outline-none w-64"
              style={{
                background: 'rgba(255,255,255,0.03)',
                border: '1px solid rgba(255,255,255,0.08)',
                color: TEXT.primary,
              }}
            />
          </div>

          {/* Role Filter */}
          <div className="flex items-center gap-1">
            {(['all', 'orchestrator', 'worker', 'specialist', 'reviewer'] as const).map(role => (
              <button
                key={role}
                onClick={() => setSelectedRole(role)}
                className="px-3 py-1.5 rounded-md text-xs font-medium transition-all capitalize"
                style={{
                  background: selectedRole === role ? `${modeColors.accent}20` : 'rgba(255,255,255,0.03)',
                  color: selectedRole === role ? modeColors.accent : TEXT.secondary,
                  border: `1px solid ${selectedRole === role ? `${modeColors.accent}40` : 'transparent'}`,
                }}
              >
                {role === 'all' ? 'All' : role}
              </button>
            ))}
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2">
          <label className="px-3 py-1.5 rounded-md text-xs font-medium transition-all hover:bg-white/5 cursor-pointer"
            style={{ background: 'rgba(255,255,255,0.03)', color: TEXT.secondary }}
          >
            <Upload size={12} weight="duotone" style={{ marginRight: 6, display: 'inline' }} />
            Import
            <input
              type="file"
              accept=".json"
              onChange={(e) => e.target.files?.[0] && handleImport(e.target.files[0])}
              className="hidden"
              disabled={isImporting}
            />
          </label>
          <button
            onClick={handleExport}
            className="px-3 py-1.5 rounded-md text-xs font-medium transition-all hover:bg-white/5"
            style={{ background: 'rgba(255,255,255,0.03)', color: TEXT.secondary }}
          >
            <Export size={12} weight="duotone" style={{ marginRight: 6 }} />
            Export
          </button>
          <button
            onClick={() => setShowCreateModal(true)}
            className="px-3 py-1.5 rounded-md text-xs font-medium transition-all hover:opacity-80"
            style={{ background: `${modeColors.accent}20`, color: modeColors.accent }}
          >
            <Plus size={12} weight="bold" style={{ marginRight: 6 }} />
            New Template
          </button>
        </div>
      </div>

      {/* Templates Grid */}
      <div className="flex-1 overflow-auto p-6">
        {filteredTemplates.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center">
            <div 
              className="w-16 h-16 rounded-2xl flex items-center justify-center mb-4"
              style={{ background: 'rgba(255,255,255,0.03)' }}
            >
              <Stack size={28} color={TEXT.tertiary} weight="duotone" />
            </div>
            <h3 className="text-base font-medium mb-2" style={{ color: TEXT.primary }}>
              No Templates Found
            </h3>
            <p className="text-sm" style={{ color: TEXT.secondary }}>
              {searchQuery ? 'Try a different search term' : 'Create your first template to get started'}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {filteredTemplates.map(template => (
              <TemplateCard
                key={template.id}
                template={template}
                modeColors={modeColors}
                onApply={handleApply}
                onEdit={setEditingTemplate}
                onDuplicate={handleDuplicate}
                onDelete={handleDelete}
              />
            ))}
          </div>
        )}
      </div>

      {/* Create/Edit Modal */}
      {(showCreateModal || editingTemplate) && (
        <TemplateModal
          template={editingTemplate}
          modeColors={modeColors}
          onSave={editingTemplate 
            ? (updates) => handleUpdate(editingTemplate.id, updates)
            : handleCreate
          }
          onClose={() => {
            setShowCreateModal(false);
            setEditingTemplate(null);
          }}
        />
      )}
    </div>
  );
}

// ============================================================================
// Template Card
// ============================================================================

interface TemplateCardProps {
  template: AgentTemplate;
  modeColors: { accent: string };
  onApply: (template: AgentTemplate) => void;
  onEdit: (template: AgentTemplate) => void;
  onDuplicate: (id: string) => void;
  onDelete: (id: string) => void;
}

function TemplateCard({ template, modeColors, onApply, onEdit, onDuplicate, onDelete }: TemplateCardProps) {
  const roleColor = ROLE_COLORS[template.role];
  
  return (
    <div 
      className="p-4 rounded-xl border transition-all hover:border-white/20 group"
      style={{ 
        background: 'rgba(255,255,255,0.02)',
        borderColor: 'rgba(255,255,255,0.05)',
      }}
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div 
          className="w-10 h-10 rounded-xl flex items-center justify-center"
          style={{ background: `${roleColor}20` }}
        >
          <RoleIcon icon={ROLE_ICONS[template.role]} color={roleColor} size={16} />
        </div>
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            onClick={() => onEdit(template)}
            className="w-7 h-7 rounded flex items-center justify-center text-xs hover:bg-white/5"
            style={{ color: TEXT.tertiary }}
            title="Edit"
          >
            <PencilSimple size={12} weight="bold" />
          </button>
          <button
            onClick={() => onDuplicate(template.id)}
            className="w-7 h-7 rounded flex items-center justify-center text-xs hover:bg-white/5"
            style={{ color: TEXT.tertiary }}
            title="Duplicate"
          >
            <Copy size={12} weight="bold" />
          </button>
          <button
            onClick={() => onDelete(template.id)}
            className="w-7 h-7 rounded flex items-center justify-center text-xs hover:bg-white/5"
            style={{ color: TEXT.tertiary }}
            title="Delete"
          >
            <Trash size={12} weight="bold" />
          </button>
        </div>
      </div>

      {/* Info */}
      <h3 className="font-medium text-sm mb-1">{template.name}</h3>
      <p className="text-xs mb-3 line-clamp-2" style={{ color: TEXT.secondary }}>
        {template.description}
      </p>

      {/* Meta */}
      <div className="flex items-center gap-2 mb-3">
        <span 
          className="text-[10px] px-2 py-0.5 rounded-full uppercase tracking-wider"
          style={{ background: `${roleColor}20`, color: roleColor }}
        >
          {template.role}
        </span>
        <span className="text-[10px]" style={{ color: TEXT.tertiary }}>
          {template.model}
        </span>
      </div>

      {/* Capabilities */}
      <div className="flex flex-wrap gap-1 mb-3">
        {template.capabilities.slice(0, 3).map(cap => (
          <span 
            key={cap}
            className="text-[10px] px-1.5 py-0.5 rounded"
            style={{ background: 'rgba(255,255,255,0.03)', color: TEXT.tertiary }}
          >
            {cap}
          </span>
        ))}
        {template.capabilities.length > 3 && (
          <span className="text-[10px] px-1.5 py-0.5 rounded" style={{ color: TEXT.tertiary }}>
            +{template.capabilities.length - 3}
          </span>
        )}
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between pt-3 border-t" style={{ borderColor: 'rgba(255,255,255,0.05)' }}>
        <span className="text-[10px]" style={{ color: TEXT.tertiary }}>
          Used {template.usageCount} times
        </span>
        <button
          onClick={() => onApply(template)}
          className="px-3 py-1.5 rounded-lg text-xs font-medium transition-all hover:opacity-80"
          style={{ background: `${modeColors.accent}20`, color: modeColors.accent }}
        >
          Use Template
        </button>
      </div>
    </div>
  );
}

// ============================================================================
// Template Modal
// ============================================================================

interface TemplateModalProps {
  template: AgentTemplate | null;
  modeColors: { accent: string };
  onSave: (template: Omit<AgentTemplate, 'id' | 'createdAt' | 'usageCount'>) => void;
  onClose: () => void;
}

function TemplateModal({ template, modeColors, onSave, onClose }: TemplateModalProps) {
  const isEditing = !!template;
  const [form, setForm] = useState({
    name: template?.name || '',
    description: template?.description || '',
    role: template?.role || 'worker',
    model: template?.model || 'gpt-4o',
    capabilities: template?.capabilities?.join(', ') || '',
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({
      ...form,
      capabilities: form.capabilities.split(',').map(c => c.trim()).filter(Boolean),
      config: {},
    });
  };

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)' }}
      onClick={onClose}
    >
      <div 
        className="w-full max-w-md p-6 rounded-2xl border"
        style={{ 
          background: BACKGROUND.primary,
          borderColor: 'rgba(255,255,255,0.1)',
        }}
        onClick={e => e.stopPropagation()}
      >
        <h2 className="text-lg font-bold mb-4" style={{ color: TEXT.primary }}>
          {isEditing ? 'Edit Template' : 'Create Template'}
        </h2>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-medium mb-1.5" style={{ color: TEXT.secondary }}>
              Name
            </label>
            <input
              type="text"
              value={form.name}
              onChange={e => setForm({ ...form, name: e.target.value })}
              required
              className="w-full px-3 py-2 rounded-lg text-sm outline-none"
              style={{
                background: 'rgba(255,255,255,0.03)',
                border: '1px solid rgba(255,255,255,0.08)',
                color: TEXT.primary,
              }}
            />
          </div>

          <div>
            <label className="block text-xs font-medium mb-1.5" style={{ color: TEXT.secondary }}>
              Description
            </label>
            <textarea
              value={form.description}
              onChange={e => setForm({ ...form, description: e.target.value })}
              rows={3}
              className="w-full px-3 py-2 rounded-lg text-sm outline-none resize-none"
              style={{
                background: 'rgba(255,255,255,0.03)',
                border: '1px solid rgba(255,255,255,0.08)',
                color: TEXT.primary,
              }}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: TEXT.secondary }}>
                Role
              </label>
              <select
                value={form.role}
                onChange={e => setForm({ ...form, role: e.target.value as AgentRole })}
                className="w-full px-3 py-2 rounded-lg text-sm outline-none"
                style={{
                  background: 'rgba(255,255,255,0.03)',
                  border: '1px solid rgba(255,255,255,0.08)',
                  color: TEXT.primary,
                }}
              >
                <option value="orchestrator">Orchestrator</option>
                <option value="worker">Worker</option>
                <option value="specialist">Specialist</option>
                <option value="reviewer">Reviewer</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: TEXT.secondary }}>
                Model
              </label>
              <select
                value={form.model}
                onChange={e => setForm({ ...form, model: e.target.value })}
                className="w-full px-3 py-2 rounded-lg text-sm outline-none"
                style={{
                  background: 'rgba(255,255,255,0.03)',
                  border: '1px solid rgba(255,255,255,0.08)',
                  color: TEXT.primary,
                }}
              >
                <option value="gpt-4o">GPT-4o</option>
                <option value="gpt-4o-mini">GPT-4o Mini</option>
                <option value="claude-3-opus">Claude 3 Opus</option>
                <option value="claude-3-sonnet">Claude 3 Sonnet</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium mb-1.5" style={{ color: TEXT.secondary }}>
              Capabilities (comma-separated)
            </label>
            <input
              type="text"
              value={form.capabilities}
              onChange={e => setForm({ ...form, capabilities: e.target.value })}
              placeholder="e.g., code-review, testing, documentation"
              className="w-full px-3 py-2 rounded-lg text-sm outline-none"
              style={{
                background: 'rgba(255,255,255,0.03)',
                border: '1px solid rgba(255,255,255,0.08)',
                color: TEXT.primary,
              }}
            />
          </div>

          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 rounded-xl text-sm font-medium transition-all hover:bg-white/5"
              style={{ background: 'rgba(255,255,255,0.05)', color: TEXT.secondary }}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex-1 py-2.5 rounded-xl text-sm font-medium transition-all hover:opacity-80"
              style={{ background: `${modeColors.accent}20`, color: modeColors.accent }}
            >
              {isEditing ? 'Save Changes' : 'Create Template'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
