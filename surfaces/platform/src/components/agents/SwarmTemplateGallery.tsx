/**
 * Swarm Template Gallery - CrewAI-inspired
 *
 * Production-ready template gallery for quick swarm setup.
 * Displays pre-configured swarm templates with filtering and search.
 */

import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Search,
  Filter,
  Grid3X3,
  List,
  Sparkles,
  Code2,
  Bug,
  FileText,
  TestTube,
  Rocket,
  Shield,
  Zap,
  Users,
  Check,
  X,
} from 'lucide-react';
import {
  PREDEFINED_AGENT_TEMPLATES,
  type AgentTemplate,
} from '@/lib/agents';

// ============================================================================
// Template Categories
// ============================================================================

const CATEGORY_CONFIG: Record<string, {
  label: string;
  icon: React.ComponentType<{ size?: number | string }>;
  color: string;
}> = {
  Development: {
    label: 'Development',
    icon: Code2,
    color: '#60a5fa',
  },
  Testing: {
    label: 'Testing',
    icon: TestTube,
    color: '#4ade80',
  },
  Documentation: {
    label: 'Documentation',
    icon: FileText,
    color: '#fb923c',
  },
  Security: {
    label: 'Security',
    icon: Shield,
    color: '#a78bfa',
  },
  Deployment: {
    label: 'Deployment',
    icon: Rocket,
    color: '#f472b6',
  },
  Optimization: {
    label: 'Optimization',
    icon: Zap,
    color: '#2dd4bf',
  },
};

// ============================================================================
// Types
// ============================================================================

export interface SwarmTemplateGalleryProps {
  onSelectTemplate?: (template: AgentTemplate) => void;
  selectedTemplateId?: string;
  showPreview?: boolean;
  compact?: boolean;
}

// ============================================================================
// Template Card Component
// ============================================================================

function TemplateCard({
  template,
  isSelected,
  onSelect,
  compact = false,
}: {
  template: AgentTemplate;
  isSelected: boolean;
  onSelect: (template: AgentTemplate) => void;
  compact?: boolean;
}) {
  const categoryConfig = CATEGORY_CONFIG[template.category] || CATEGORY_CONFIG.Development;
  const CategoryIcon = categoryConfig.icon;

  return (
    <motion.button
      layout
      onClick={() => onSelect(template)}
      whileHover={{ scale: 1.02, y: -2 }}
      whileTap={{ scale: 0.98 }}
      className={`
        relative w-full text-left rounded-xl border transition-all overflow-hidden
        ${isSelected ? 'ring-2' : ''}
      `}
      style={{
        background: isSelected
          ? `linear-gradient(135deg, ${categoryConfig.color}22 0%, rgba(255,255,255,0.03) 100%)`
          : 'rgba(255,255,255,0.02)',
        borderColor: isSelected ? categoryConfig.color : 'rgba(255,255,255,0.08)',
      }}
    >
      {/* Selection Indicator */}
      {isSelected && (
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          className="absolute top-3 right-3 w-6 h-6 rounded-full flex items-center justify-center"
          style={{
            background: categoryConfig.color,
            boxShadow: `0 0 20px ${categoryConfig.color}66`,
          }}
        >
          <Check size={14} strokeWidth={3} className="text-white" />
        </motion.div>
      )}

      {/* Content */}
      <div className="p-4">
        {/* Header */}
        <div className="flex items-start gap-3 mb-3">
          {/* Icon */}
          <div
            className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0"
            style={{
              background: `${categoryConfig.color}22`,
              border: `1px solid ${categoryConfig.color}44`,
              color: categoryConfig.color,
            }}
          >
            <CategoryIcon size={20} />
          </div>

          {/* Title & Category */}
          <div className="flex-1 min-w-0">
            <h3 className="text-sm font-bold text-white/90 truncate mb-1">
              {template.name}
            </h3>
            <div className="flex items-center gap-2">
              <span
                className="text-[10px] px-1.5 py-0.5 rounded font-medium"
                style={{
                  background: `${categoryConfig.color}22`,
                  color: categoryConfig.color,
                }}
              >
                {template.category}
              </span>
              {template.tags.length > 0 && (
                <span className="text-[10px] text-white/40">
                  {template.tags.length} tag{template.tags.length !== 1 ? 's' : ''}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Description */}
        {!compact && (
          <p className="text-xs text-white/50 leading-relaxed mb-3 line-clamp-2">
            {template.description}
          </p>
        )}

        {/* Tags */}
        {!compact && template.tags.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {template.tags.slice(0, 4).map((tag, idx) => (
              <span
                key={idx}
                className="text-[10px] px-2 py-1 rounded-full bg-white/5 text-white/40 border border-white/5"
              >
                {tag}
              </span>
            ))}
          </div>
        )}
      </div>
    </motion.button>
  );
}

// ============================================================================
// Main Gallery Component
// ============================================================================

export function SwarmTemplateGallery({
  onSelectTemplate,
  selectedTemplateId,
  showPreview = true,
  compact = false,
}: SwarmTemplateGalleryProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');

  // Filter templates
  const filteredTemplates = useMemo(() => {
    return PREDEFINED_AGENT_TEMPLATES.filter((template) => {
      const matchesSearch =
        template.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        template.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
        template.tags.some((tag) => tag.toLowerCase().includes(searchQuery.toLowerCase()));

      const matchesCategory = !selectedCategory || template.category === selectedCategory;

      return matchesSearch && matchesCategory;
    });
  }, [searchQuery, selectedCategory]);

  // Get categories with counts
  const categories = useMemo(() => {
    const counts: Record<string, number> = {};
    PREDEFINED_AGENT_TEMPLATES.forEach((template) => {
      counts[template.category] = (counts[template.category] || 0) + 1;
    });
    return counts;
  }, []);

  const handleSelect = (template: AgentTemplate) => {
    onSelectTemplate?.(template);
  };

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="p-4 border-b border-white/5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-sm font-bold text-white/90 flex items-center gap-2">
              <Sparkles size={16} className="text-yellow-400" />
              Swarm Templates
            </h2>
            <p className="text-xs text-white/40 mt-0.5">
              Pre-configured swarms for common workflows
            </p>
          </div>

          {/* View Mode Toggle */}
          <div className="flex items-center gap-1 p-1 rounded-lg bg-white/5 border border-white/5">
            <button
              onClick={() => setViewMode('grid')}
              className={`p-1.5 rounded transition-colors ${
                viewMode === 'grid' ? 'bg-white/10 text-white/90' : 'text-white/40 hover:text-white/60'
              }`}
            >
              <Grid3X3 size={14} />
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`p-1.5 rounded transition-colors ${
                viewMode === 'list' ? 'bg-white/10 text-white/90' : 'text-white/40 hover:text-white/60'
              }`}
            >
              <List size={14} />
            </button>
          </div>
        </div>

        {/* Search */}
        <div className="relative mb-3">
          <Search
            size={14}
            className="absolute left-3 top-1/2 -translate-y-1/2"
            style={{ color: 'rgba(255,255,255,0.3)' }}
          />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search templates..."
            className="w-full pl-9 pr-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-white/90 placeholder-white/30 outline-none focus:border-white/20 transition-colors"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2"
            >
              <X size={14} className="text-white/30 hover:text-white/50" />
            </button>
          )}
        </div>

        {/* Category Filters */}
        <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-hide">
          <button
            onClick={() => setSelectedCategory(null)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors ${
              selectedCategory === null
                ? 'bg-white/10 text-white/90 border border-white/20'
                : 'bg-white/5 text-white/40 border border-white/5 hover:border-white/10'
            }`}
          >
            All ({PREDEFINED_AGENT_TEMPLATES.length})
          </button>
          {Object.entries(categories).map(([category, count]) => {
            const config = CATEGORY_CONFIG[category] || CATEGORY_CONFIG.Development;
            return (
              <button
                key={category}
                onClick={() => setSelectedCategory(category)}
                className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors flex items-center gap-1.5 ${
                  selectedCategory === category
                    ? 'bg-white/10 text-white/90 border border-white/20'
                    : 'bg-white/5 text-white/40 border border-white/5 hover:border-white/10'
                }`}
              >
                <config.icon size={10} />
                {config.label} ({count})
              </button>
            );
          })}
        </div>
      </div>

      {/* Template Grid */}
      <div className="flex-1 overflow-y-auto p-4">
        {filteredTemplates.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center">
            <div
              className="w-16 h-16 rounded-full flex items-center justify-center mb-4"
              style={{
                background: 'rgba(255,255,255,0.05)',
                border: '1px solid rgba(255,255,255,0.1)',
              }}
            >
              <Search size={32} className="text-white/20" />
            </div>
            <p className="text-sm font-medium text-white/60 mb-1">No templates found</p>
            <p className="text-xs text-white/40">Try adjusting your search or filters</p>
          </div>
        ) : (
          <div
            className={`grid gap-3 ${
              viewMode === 'grid'
                ? 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3'
                : 'grid-cols-1'
            }`}
          >
            <AnimatePresence mode="popLayout">
              {filteredTemplates.map((template) => (
                <TemplateCard
                  key={template.id}
                  template={template}
                  isSelected={template.id === selectedTemplateId}
                  onSelect={handleSelect}
                  compact={compact || viewMode === 'list'}
                />
              ))}
            </AnimatePresence>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="p-3 border-t border-white/5 text-center">
        <p className="text-[10px] text-white/30">
          {filteredTemplates.length} of {PREDEFINED_AGENT_TEMPLATES.length} templates
        </p>
      </div>
    </div>
  );
}

export default SwarmTemplateGallery;
