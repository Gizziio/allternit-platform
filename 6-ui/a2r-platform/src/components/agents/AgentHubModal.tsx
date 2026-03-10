/**
 * Agent Hub Modal
 *
 * Template selection modal for AgentCreationWizard.
 * Allows users to browse specialist templates before creating an agent.
 *
 * @module AgentHubModal
 */

import React, { useState, useMemo } from 'react';
import {
  Bot,
  Search,
  X,
  ChevronRight,
  Sparkles,
  Code,
  Palette,
  Megaphone,
  ClipboardList,
  TestTube,
  Headphones,
  Boxes,
  Target,
  Check,
} from 'lucide-react';

import { SAND, MODE_COLORS, GLASS, TEXT } from '@/design/a2r.tokens';
import type { SpecialistTemplate, AgentCategory } from '@/lib/agents/agent-templates.specialist';
import { SPECIALIST_TEMPLATES, getTemplatesByCategory } from '@/lib/agents/agent-templates.specialist';

// ============================================================================
// Types
// ============================================================================

export interface AgentHubModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectTemplate: (template: SpecialistTemplate) => void;
  accentColor?: keyof typeof MODE_COLORS;
}

// ============================================================================
// Category Configuration
// ============================================================================

const CATEGORIES: { id: AgentCategory | 'all'; label: string; icon: React.ReactNode; count: number }[] = [
  { id: 'all', label: 'All', icon: <Boxes size={16} />, count: SPECIALIST_TEMPLATES.length },
  { id: 'engineering', label: 'Engineering', icon: <Code size={16} />, count: getTemplatesByCategory('engineering').length },
  { id: 'design', label: 'Design', icon: <Palette size={16} />, count: getTemplatesByCategory('design').length },
  { id: 'marketing', label: 'Marketing', icon: <Megaphone size={16} />, count: getTemplatesByCategory('marketing').length },
  { id: 'product', label: 'Product', icon: <ClipboardList size={16} />, count: getTemplatesByCategory('product').length },
  { id: 'testing', label: 'Testing', icon: <TestTube size={16} />, count: getTemplatesByCategory('testing').length },
  { id: 'support', label: 'Support', icon: <Headphones size={16} />, count: getTemplatesByCategory('support').length },
  { id: 'specialized', label: 'Specialized', icon: <Target size={16} />, count: getTemplatesByCategory('specialized').length },
];

// ============================================================================
// Main Component
// ============================================================================

export function AgentHubModal({
  isOpen,
  onClose,
  onSelectTemplate,
  accentColor = 'chat',
}: AgentHubModalProps) {
  const [selectedCategory, setSelectedCategory] = useState<AgentCategory | 'all'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTemplate, setSelectedTemplate] = useState<SpecialistTemplate | null>(null);

  const theme = MODE_COLORS[accentColor];

  // Filter templates
  const filteredTemplates = useMemo(() => {
    let templates = SPECIALIST_TEMPLATES;

    if (selectedCategory !== 'all') {
      templates = templates.filter(t => t.category === selectedCategory);
    }

    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      templates = templates.filter(
        t =>
          t.name.toLowerCase().includes(query) ||
          t.description.toLowerCase().includes(query) ||
          t.tags.some(tag => tag.toLowerCase().includes(query))
      );
    }

    return templates;
  }, [selectedCategory, searchQuery]);

  const handleConfirm = () => {
    if (selectedTemplate) {
      onSelectTemplate(selectedTemplate);
      onClose();
      setSelectedTemplate(null);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div
        className="relative w-full max-w-6xl max-h-[90vh] overflow-hidden rounded-2xl"
        style={{
          background: 'rgba(26, 22, 18, 0.95)',
          border: `1px solid ${theme.border}`,
          boxShadow: `0 24px 48px ${theme.shadow}`,
        }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-6 py-4 border-b"
          style={{ borderColor: theme.border }}
        >
          <div className="flex items-center gap-3">
            <div
              className="p-2 rounded-lg"
              style={{ background: theme.soft }}
            >
              <Bot size={24} style={{ color: theme.accent }} />
            </div>
            <div>
              <h2 className="text-xl font-semibold" style={{ color: TEXT.primary }}>
                Agent Hub
              </h2>
              <p className="text-sm" style={{ color: TEXT.secondary }}>
                Choose a specialist template to get started
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg transition-colors"
            style={{ color: TEXT.tertiary }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="flex" style={{ height: 'calc(90vh - 88px)' }}>
          {/* Sidebar - Categories */}
          <div
            className="w-56 border-r p-4 overflow-y-auto flex-shrink-0"
            style={{ borderColor: theme.border }}
          >
            <div className="space-y-1">
              {CATEGORIES.map(cat => (
                <button
                  key={cat.id}
                  onClick={() => setSelectedCategory(cat.id)}
                  className="w-full flex items-center justify-between px-3 py-2.5 rounded-lg transition-all"
                  style={{
                    background: selectedCategory === cat.id ? theme.soft : 'transparent',
                    border: selectedCategory === cat.id ? `1px solid ${theme.border}` : '1px solid transparent',
                  }}
                >
                  <div className="flex items-center gap-2">
                    <span style={{ color: selectedCategory === cat.id ? theme.accent : TEXT.secondary }}>
                      {cat.icon}
                    </span>
                    <span
                      className="text-sm font-medium"
                      style={{ color: selectedCategory === cat.id ? TEXT.primary : TEXT.secondary }}
                    >
                      {cat.label}
                    </span>
                  </div>
                  <span
                    className="text-xs px-2 py-0.5 rounded-full"
                    style={{
                      background: selectedCategory === cat.id ? theme.accent : 'rgba(255,255,255,0.1)',
                      color: selectedCategory === cat.id ? '#1A1612' : TEXT.tertiary,
                    }}
                  >
                    {cat.count}
                  </span>
                </button>
              ))}
            </div>

            {/* Search */}
            <div className="mt-6">
              <div className="relative">
                <Search
                  size={16}
                  className="absolute left-3 top-1/2 -translate-y-1/2"
                  style={{ color: TEXT.tertiary }}
                />
                <input
                  type="text"
                  placeholder="Search templates..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 rounded-lg text-sm border focus:outline-none focus:ring-2"
                  style={{
                    background: 'rgba(0,0,0,0.3)',
                    borderColor: theme.border,
                    color: TEXT.primary,
                  } as React.CSSProperties}
                />
              </div>
            </div>
          </div>

          {/* Main - Template Grid */}
          <div className="flex-1 p-6 overflow-y-auto">
            {filteredTemplates.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-center">
                <Bot size={48} style={{ color: TEXT.tertiary }} />
                <p className="mt-4 text-lg font-medium" style={{ color: TEXT.primary }}>
                  No templates found
                </p>
                <p className="mt-2 text-sm" style={{ color: TEXT.secondary }}>
                  Try adjusting your search or filter
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredTemplates.map(template => (
                  <TemplateCard
                    key={template.id}
                    template={template}
                    isSelected={selectedTemplate?.id === template.id}
                    onSelect={() => setSelectedTemplate(template)}
                    accentColor={theme.accent}
                  />
                ))}
              </div>
            )}
          </div>

          {/* Preview Panel */}
          {selectedTemplate && (
            <div
              className="w-96 border-l p-6 overflow-y-auto flex-shrink-0"
              style={{ borderColor: theme.border }}
            >
              <div className="flex items-center gap-3 mb-4">
                <div
                  className="p-3 rounded-xl"
                  style={{ background: theme.soft }}
                >
                  <Sparkles size={24} style={{ color: theme.accent }} />
                </div>
                <div>
                  <h3 className="text-lg font-semibold" style={{ color: TEXT.primary }}>
                    {selectedTemplate.name}
                  </h3>
                  <p className="text-sm" style={{ color: TEXT.secondary }}>
                    {selectedTemplate.role}
                  </p>
                </div>
              </div>

              <p className="text-sm mb-4" style={{ color: TEXT.secondary }}>
                {selectedTemplate.longDescription}
              </p>

              {/* Tags */}
              <div className="flex flex-wrap gap-2 mb-4">
                {selectedTemplate.tags.map(tag => (
                  <span
                    key={tag}
                    className="text-xs px-2 py-1 rounded"
                    style={{
                      background: 'rgba(255,255,255,0.05)',
                      color: TEXT.secondary,
                      border: `1px solid ${theme.border}`,
                    }}
                  >
                    {tag}
                  </span>
                ))}
              </div>

              {/* Success Metrics */}
              <div className="mb-4">
                <h4 className="text-sm font-medium mb-2" style={{ color: TEXT.primary }}>
                  Success Metrics
                </h4>
                <div className="space-y-2">
                  {selectedTemplate.successMetrics.slice(0, 2).map(metric => (
                    <div key={metric.id} className="text-sm">
                      <div className="flex items-center gap-2">
                        <Check size={14} style={{ color: theme.accent }} />
                        <span style={{ color: TEXT.primary }}>{metric.name}</span>
                      </div>
                      <p className="text-xs mt-1" style={{ color: TEXT.tertiary }}>
                        Target: {metric.target}
                      </p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Example Invocation */}
              <div className="mb-6">
                <h4 className="text-sm font-medium mb-2" style={{ color: TEXT.primary }}>
                  Example Usage
                </h4>
                <div
                  className="p-3 rounded-lg text-sm italic"
                  style={{
                    background: 'rgba(0,0,0,0.3)',
                    border: `1px solid ${theme.border}`,
                    color: TEXT.secondary,
                  }}
                >
                  "{selectedTemplate.exampleInvocation}"
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-2">
                <button
                  onClick={handleConfirm}
                  className="flex-1 py-2.5 rounded-lg font-medium transition-colors"
                  style={{
                    background: theme.accent,
                    color: '#1A1612',
                  }}
                >
                  Use This Template
                </button>
                <button
                  onClick={() => setSelectedTemplate(null)}
                  className="px-4 py-2.5 rounded-lg font-medium transition-colors"
                  style={{
                    background: 'transparent',
                    border: `1px solid ${theme.border}`,
                    color: TEXT.secondary,
                  }}
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// Template Card Component
// ============================================================================

interface TemplateCardProps {
  template: SpecialistTemplate;
  isSelected: boolean;
  onSelect: () => void;
  accentColor: string;
}

function TemplateCard({ template, isSelected, onSelect, accentColor }: TemplateCardProps) {
  return (
    <div
      onClick={onSelect}
      className="p-4 rounded-xl border cursor-pointer transition-all"
      style={{
        background: isSelected ? 'rgba(255,255,255,0.04)' : 'rgba(255,255,255,0.02)',
        borderColor: isSelected ? accentColor : 'rgba(255,255,255,0.08)',
        borderWidth: isSelected ? 2 : 1,
      }}
    >
      {/* Header */}
      <div className="flex items-start gap-3 mb-3">
        <div
          className="p-2 rounded-lg"
          style={{ background: `rgba(${hexToRgb(accentColor)}, 0.15)` }}
        >
          <Bot size={20} style={{ color: accentColor }} />
        </div>
        <div className="flex-1">
          <h3 className="font-semibold" style={{ color: TEXT.primary }}>
            {template.name}
          </h3>
          <p className="text-xs mt-0.5" style={{ color: TEXT.tertiary }}>
            {template.category}
          </p>
        </div>
        {isSelected && (
          <div
            className="p-1 rounded-full"
            style={{ background: accentColor }}
          >
            <Check size={14} style={{ color: '#1A1612' }} />
          </div>
        )}
      </div>

      {/* Description */}
      <p className="text-sm mb-3 line-clamp-2" style={{ color: TEXT.secondary }}>
        {template.description}
      </p>

      {/* Tags */}
      <div className="flex flex-wrap gap-1.5">
        {template.tags.slice(0, 3).map(tag => (
          <span
            key={tag}
            className="text-xs px-2 py-0.5 rounded"
            style={{
              background: 'rgba(255,255,255,0.05)',
              color: TEXT.tertiary,
            }}
          >
            {tag}
          </span>
        ))}
      </div>

      {/* Preview Link */}
      <div className="flex items-center gap-1 mt-3 text-xs" style={{ color: accentColor }}>
        <span>Preview details</span>
        <ChevronRight size={14} />
      </div>
    </div>
  );
}

// ============================================================================
// Helpers
// ============================================================================

function hexToRgb(hex: string): string {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result
    ? `${parseInt(result[1], 16)}, ${parseInt(result[2], 16)}, ${parseInt(result[3], 16)}`
    : '212, 176, 140';
}

export default AgentHubModal;
