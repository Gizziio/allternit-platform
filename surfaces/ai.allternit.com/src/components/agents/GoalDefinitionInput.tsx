/**
 * Goal Definition Input - AgentGPT-inspired
 *
 * Production-ready natural language goal definition interface.
 * Allows users to define swarm objectives in plain English.
 */

import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Target,
  Sparkle,
  Lightning,
  Warning,
  CheckCircle,
  X,
  Plus,
  Trash,
  GearSix,
  CaretDown,
  CaretUp,
  Lightbulb,
  Shield,
  Clock,
  CurrencyDollar,
} from '@phosphor-icons/react';

// ============================================================================
// Types
// ============================================================================

export interface GoalDefinition {
  id: string;
  description: string;
  constraints: GoalConstraint[];
  successCriteria: string[];
  examples?: string[];
}

export interface GoalConstraint {
  id: string;
  type: 'budget' | 'time' | 'tools' | 'scope';
  value: string;
  enabled: boolean;
}

export interface GoalDefinitionInputProps {
  value?: GoalDefinition;
  onChange?: (goal: GoalDefinition) => void;
  onSubmit?: (goal: GoalDefinition) => void;
  isLoading?: boolean;
  placeholder?: string;
  suggestions?: string[];
}

// ============================================================================
// Constraint Builder
// ============================================================================

function ConstraintBuilder({
  constraints,
  onChange,
}: {
  constraints: GoalConstraint[];
  onChange: (constraints: GoalConstraint[]) => void;
}) {
  const [isAdding, setIsAdding] = useState(false);
  const [newConstraint, setNewConstraint] = useState<Omit<GoalConstraint, 'id'>>({
    type: 'budget',
    value: '',
    enabled: true,
  });

  const constraintTypes: Array<{ value: GoalConstraint['type']; label: string; icon: any; color: string }> = [
    { value: 'budget', label: 'Budget', icon: CurrencyDollar, color: 'var(--status-success)' },
    { value: 'time', label: 'Time Limit', icon: Clock, color: 'var(--status-info)' },
    { value: 'tools', label: 'Tools', icon: GearSix, color: 'var(--status-warning)' },
    { value: 'scope', label: 'Scope', icon: Shield, color: '#a855f7' },
  ];

  const handleAdd = () => {
    if (newConstraint.value.trim()) {
      onChange([
        ...constraints,
        {
          ...newConstraint,
          id: `constraint_${Date.now()}`,
        },
      ]);
      setNewConstraint({ type: 'budget', value: '', enabled: true });
      setIsAdding(false);
    }
  };

  const handleRemove = (id: string) => {
    onChange(constraints.filter((c) => c.id !== id));
  };

  const handleToggle = (id: string) => {
    onChange(
      constraints.map((c) => (c.id === id ? { ...c, enabled: !c.enabled } : c))
    );
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h4 className="text-xs font-bold uppercase tracking-wider text-white/60">
          Constraints
        </h4>
        <button
          onClick={() => setIsAdding(!isAdding)}
          className="flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300 transition-colors"
        >
          <Plus size={12} />
          Add Constraint
        </button>
      </div>

      {/* Existing Constraints */}
      {constraints.length > 0 && (
        <div className="space-y-2">
          {constraints.map((constraint) => {
            const typeConfig = constraintTypes.find((t) => t.value === constraint.type);
            const TypeIcon = typeConfig?.icon || GearSix;

            return (
              <motion.div
                key={constraint.id}
                layout
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className={`flex items-center gap-3 p-3 rounded-lg border transition-all ${
                  constraint.enabled
                    ? 'bg-white/5 border-white/10'
                    : 'bg-white/[0.02] border-white/5 opacity-50'
                }`}
              >
                <div
                  className="w-8 h-8 rounded flex items-center justify-center flex-shrink-0"
                  style={{
                    background: `${typeConfig?.color}22`,
                    border: `1px solid ${typeConfig?.color}44`,
                  }}
                >
                  <TypeIcon size={14} style={{ color: typeConfig?.color }} />
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-medium text-white/90">
                      {typeConfig?.label}
                    </span>
                    <span className="text-xs text-white/60 truncate">
                      {constraint.value}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-1">
                  <button
                    onClick={() => handleToggle(constraint.id)}
                    className={`p-1.5 rounded transition-colors ${
                      constraint.enabled
                        ? 'text-white/40 hover:text-white/70'
                        : 'text-white/20 hover:text-white/40'
                    }`}
                    title={constraint.enabled ? 'Disable' : 'Enable'}
                  >
                    {constraint.enabled ? (
                      <CheckCircle size={14} />
                    ) : (
                      <Warning size={14} />
                    )}
                  </button>
                  <button
                    onClick={() => handleRemove(constraint.id)}
                    className="p-1.5 hover:bg-white/5 rounded transition-colors text-white/40 hover:text-red-400"
                    title="Remove"
                  >
                    <Trash size={14} />
                  </button>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}

      {/* Add Constraint Form */}
      <AnimatePresence>
        {isAdding && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="p-3 rounded-lg border border-white/10 bg-white/5 space-y-3"
          >
            {/* Type Selector */}
            <div className="grid grid-cols-4 gap-2">
              {constraintTypes.map((type) => {
                const TypeIcon = type.icon;
                return (
                  <button
                    key={type.value}
                    onClick={() =>
                      setNewConstraint({ ...newConstraint, type: type.value })
                    }
                    className={`p-2 rounded-lg border transition-all flex flex-col items-center gap-1 ${
                      newConstraint.type === type.value
                        ? 'bg-white/10 border-white/20'
                        : 'bg-white/[0.02] border-white/5 hover:border-white/10'
                    }`}
                  >
                    <TypeIcon
                      size={14}
                      style={{ color: newConstraint.type === type.value ? type.color : 'var(--ui-text-muted)' }}
                    />
                    <span
                      className={`text-[10px] ${
                        newConstraint.type === type.value ? 'text-white/90' : 'text-white/40'
                      }`}
                    >
                      {type.label}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Value Input */}
            <input
              type="text"
              value={newConstraint.value}
              onChange={(e) =>
                setNewConstraint({ ...newConstraint, value: e.target.value })
              }
              placeholder={
                newConstraint.type === 'budget'
                  ? 'e.g., $5.00 max'
                  : newConstraint.type === 'time'
                  ? 'e.g., 30 minutes'
                  : newConstraint.type === 'tools'
                  ? 'e.g., No file deletion'
                  : 'e.g., Research only'
              }
              className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-white/90 placeholder-white/30 outline-none focus:border-white/20"
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleAdd();
                if (e.key === 'Escape') setIsAdding(false);
              }}
              autoFocus
            />

            {/* Actions */}
            <div className="flex items-center gap-2">
              <button
                onClick={handleAdd}
                disabled={!newConstraint.value.trim()}
                className="flex-1 px-3 py-2 rounded-lg bg-green-500/20 hover:bg-green-500/30 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-green-400 text-sm font-medium"
              >
                Add
              </button>
              <button
                onClick={() => setIsAdding(false)}
                className="px-3 py-2 rounded-lg bg-white/5 hover:bg-white/10 transition-colors text-white/40 text-sm"
              >
                Cancel
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ============================================================================
// Success Criteria Builder
// ============================================================================

function SuccessCriteriaBuilder({
  criteria,
  onChange,
}: {
  criteria: string[];
  onChange: (criteria: string[]) => void;
}) {
  const [newCriterion, setNewCriterion] = useState('');

  const handleAdd = () => {
    if (newCriterion.trim()) {
      onChange([...criteria, newCriterion.trim()]);
      setNewCriterion('');
    }
  };

  const handleRemove = (index: number) => {
    onChange(criteria.filter((_, i) => i !== index));
  };

  return (
    <div className="space-y-3">
      <h4 className="text-xs font-bold uppercase tracking-wider text-white/60">
        Success Criteria
      </h4>

      {/* Criteria List */}
      {criteria.length > 0 && (
        <div className="space-y-2">
          {criteria.map((criterion, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -10 }}
              className="flex items-center gap-3 p-3 rounded-lg bg-white/5 border border-white/5"
            >
              <div className="w-6 h-6 rounded-full bg-green-500/20 flex items-center justify-center flex-shrink-0">
                <CheckCircle size={12} className="text-green-400" />
              </div>
              <span className="text-sm text-white/80 flex-1">{criterion}</span>
              <button
                onClick={() => handleRemove(index)}
                className="p-1.5 hover:bg-white/5 rounded transition-colors text-white/40 hover:text-red-400"
              >
                <X size={14} />
              </button>
            </motion.div>
          ))}
        </div>
      )}

      {/* Add Input */}
      <div className="flex items-center gap-2">
        <input
          type="text"
          value={newCriterion}
          onChange={(e) => setNewCriterion(e.target.value)}
          placeholder="Define what success looks like..."
          className="flex-1 px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-white/90 placeholder-white/30 outline-none focus:border-white/20"
          onKeyDown={(e) => {
            if (e.key === 'Enter') handleAdd();
          }}
        />
        <button
          onClick={handleAdd}
          disabled={!newCriterion.trim()}
          className="p-2 rounded-lg bg-blue-500/20 hover:bg-blue-500/30 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-blue-400"
        >
          <Plus size={16} />
        </button>
      </div>

      {/* Examples */}
      {criteria.length === 0 && (
        <div className="p-3 rounded-lg bg-blue-500/10 border border-blue-500/20">
          <div className="flex items-start gap-2">
            <Lightbulb size={14} className="text-blue-400 mt-0.5 flex-shrink-0" />
            <div className="text-xs text-blue-300">
              <p className="font-medium mb-1">Examples of success criteria:</p>
              <ul className="space-y-1 text-blue-400/80">
                <li>• "Generate a working React component"</li>
                <li>• "All tests pass with 90% coverage"</li>
                <li>• "Documentation is complete and clear"</li>
                <li>• "No security vulnerabilities detected"</li>
              </ul>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Main Goal Definition Input Component
// ============================================================================

export function GoalDefinitionInput({
  value,
  onChange,
  onSubmit,
  isLoading = false,
  placeholder = "Describe what you want to accomplish...",
  suggestions = [],
}: GoalDefinitionInputProps) {
  const [description, setDescription] = useState(value?.description || '');
  const [constraints, setConstraints] = useState<GoalConstraint[]>(
    value?.constraints || []
  );
  const [successCriteria, setSuccessCriteria] = useState<string[]>(
    value?.successCriteria || []
  );
  const [isExpanded, setIsExpanded] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 200)}px`;
    }
  }, [description]);

  // Notify parent of changes
  useEffect(() => {
    if (onChange) {
      onChange({
        id: value?.id || `goal_${Date.now()}`,
        description,
        constraints,
        successCriteria,
      });
    }
  }, [description, constraints, successCriteria, onChange, value?.id]);

  const handleSubmit = () => {
    if (description.trim() && onSubmit) {
      onSubmit({
        id: value?.id || `goal_${Date.now()}`,
        description: description.trim(),
        constraints,
        successCriteria,
      });
    }
  };

  const handleSuggestionClick = (suggestion: string) => {
    setDescription(suggestion);
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-blue-500/20 to-purple-500/20 flex items-center justify-center border border-blue-500/30">
          <Target size={20} className="text-blue-400" />
        </div>
        <div>
          <h3 className="text-sm font-bold text-white/90">Define Your Goal</h3>
          <p className="text-xs text-white/40">Describe what you want to accomplish</p>
        </div>
      </div>

      {/* Goal Input */}
      <div className="relative">
        <textarea
          ref={textareaRef}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder={placeholder}
          rows={1}
          className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-sm text-white/90 placeholder-white/30 outline-none focus:border-blue-500/50 focus:ring-2 focus:ring-blue-500/20 transition-all resize-none"
          style={{ minHeight: '48px', maxHeight: '200px' }}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              handleSubmit();
            }
          }}
        />

        {/* Submit Button */}
        <button
          onClick={handleSubmit}
          disabled={!description.trim() || isLoading}
          className="absolute right-2 bottom-2 p-2 rounded-lg bg-blue-500/20 hover:bg-blue-500/30 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-blue-400"
        >
          {isLoading ? (
            <Lightning size={16} className="animate-pulse" />
          ) : (
            <Sparkle size={16} />
          )}
        </button>
      </div>

      {/* Suggestions */}
      {suggestions.length > 0 && description.length === 0 && (
        <div className="space-y-2">
          <p className="text-xs text-white/40">Quick start with a template:</p>
          <div className="flex flex-wrap gap-2">
            {suggestions.map((suggestion, index) => (
              <button
                key={index}
                onClick={() => handleSuggestionClick(suggestion)}
                className="px-3 py-1.5 rounded-full bg-white/5 hover:bg-white/10 border border-white/5 hover:border-white/10 transition-colors text-xs text-white/60 hover:text-white/80"
              >
                {suggestion}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Advanced Options Toggle */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="flex items-center gap-2 text-xs text-white/40 hover:text-white/60 transition-colors"
      >
        {isExpanded ? (
          <CaretUp size={14} />
        ) : (
          <CaretDown size={14} />
        )}
        {isExpanded ? 'Hide' : 'Show'} advanced options
      </button>

      {/* Advanced Options */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="space-y-4 p-4 rounded-xl border border-white/5 bg-white/[0.02]"
          >
            <ConstraintBuilder constraints={constraints} onChange={setConstraints} />
            <SuccessCriteriaBuilder
              criteria={successCriteria}
              onChange={setSuccessCriteria}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Help Text */}
      <p className="text-xs text-white/30">
        Press Enter to submit, Shift+Enter for new line
      </p>
    </div>
  );
}

export default GoalDefinitionInput;
