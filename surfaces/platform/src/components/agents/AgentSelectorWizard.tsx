/**
 * Agent Selector Wizard
 *
 * AskUserQuestion-style step-by-step wizard for selecting and creating agents.
 * Uses the same interaction pattern as AskUserQuestion for consistency.
 *
 * Flow:
 * 1. Select category
 * 2. Select specialty
 * 3. Review template
 * 4. Confirm creation
 *
 * @module AgentSelectorWizard
 */

import React, { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Robot,
  Code,
  Palette,
  Megaphone,
  ClipboardText,
  TestTube,
  Headphones,
  Target,
  Stack,
  CaretRight,
  CaretLeft,
  Check,
  Sparkle,
} from '@phosphor-icons/react';

import { SAND, MODE_COLORS, GLASS, TEXT, createGlassStyle } from '@/design/allternit.tokens';
import { SPECIALIST_TEMPLATES, getTemplatesByCategory } from '@/lib/agents/agent-templates.specialist';
import type { SpecialistTemplate, AgentCategory } from '@/lib/agents/agent-templates.specialist';
import { Button } from '@/components/ui/button';

// ============================================================================
// Types
// ============================================================================

export interface AgentSelectorWizardProps {
  isOpen: boolean;
  onClose: () => void;
  onComplete: (template: SpecialistTemplate, agentName: string) => void;
  accentColor?: keyof typeof MODE_COLORS;
}

type WizardStep = 'category' | 'template' | 'review' | 'name';

interface StepConfig {
  id: WizardStep;
  title: string;
  description: string;
}

const STEPS: StepConfig[] = [
  { id: 'category', title: 'Choose Category', description: 'What type of agent do you need?' },
  { id: 'template', title: 'Select Template', description: 'Choose a specialist template' },
  { id: 'review', title: 'Review', description: 'Review template details' },
  { id: 'name', title: 'Name Agent', description: 'Give your agent a name' },
];

// ============================================================================
// Category Options
// ============================================================================

const CATEGORIES: { id: AgentCategory; label: string; icon: React.ReactNode; description: string }[] = [
  { id: 'engineering', label: 'Engineering', icon: <Code size={24} />, description: 'Development, DevOps, and technical specialists' },
  { id: 'design', label: 'Design', icon: <Palette size={24} />, description: 'UI/UX, brand, and visual design experts' },
  { id: 'marketing', label: 'Marketing', icon: <Megaphone size={24} />, description: 'Growth, content, and social media specialists' },
  { id: 'product', label: 'Product', icon: <ClipboardText size={24} />, description: 'Product management and research experts' },
  { id: 'testing', label: 'Testing', icon: <TestTube size={24} />, description: 'QA, performance, and accessibility specialists' },
  { id: 'support', label: 'Support', icon: <Headphones size={24} />, description: 'Customer service and operations experts' },
  { id: 'specialized', label: 'Specialized', icon: <Target size={24} />, description: 'Orchestration, data, and identity specialists' },
];

// ============================================================================
// Main Component
// ============================================================================

export function AgentSelectorWizard({
  isOpen,
  onClose,
  onComplete,
  accentColor = 'chat',
}: AgentSelectorWizardProps) {
  const [currentStep, setCurrentStep] = useState<WizardStep>('category');
  const [selectedCategory, setSelectedCategory] = useState<AgentCategory | null>(null);
  const [selectedTemplate, setSelectedTemplate] = useState<SpecialistTemplate | null>(null);
  const [agentName, setAgentName] = useState('');

  const theme = MODE_COLORS[accentColor];

  const handleNext = useCallback(() => {
    const currentIndex = STEPS.findIndex(s => s.id === currentStep);
    if (currentIndex < STEPS.length - 1) {
      setCurrentStep(STEPS[currentIndex + 1].id);
    }
  }, [currentStep]);

  const handleBack = useCallback(() => {
    const currentIndex = STEPS.findIndex(s => s.id === currentStep);
    if (currentIndex > 0) {
      setCurrentStep(STEPS[currentIndex - 1].id);
    }
  }, [currentStep]);

  const handleComplete = useCallback(() => {
    if (selectedTemplate && agentName) {
      onComplete(selectedTemplate, agentName);
      onClose();
      // Reset state
      setCurrentStep('category');
      setSelectedCategory(null);
      setSelectedTemplate(null);
      setAgentName('');
    }
  }, [selectedTemplate, agentName, onComplete, onClose]);

  const handleReset = useCallback(() => {
    setCurrentStep('category');
    setSelectedCategory(null);
    setSelectedTemplate(null);
    setAgentName('');
  }, []);

  if (!isOpen) return null;

  const currentStepIndex = STEPS.findIndex(s => s.id === currentStep);
  const progress = ((currentStepIndex + 1) / STEPS.length) * 100;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="relative w-full max-w-2xl overflow-hidden rounded-2xl"
        style={{
          background: 'rgba(26, 22, 18, 0.95)',
          border: `1px solid ${theme.border}`,
          boxShadow: `0 24px 48px ${theme.shadow}`,
        }}
      >
        {/* Header */}
        <div
          className="px-6 py-4 border-b"
          style={{ borderColor: theme.border }}
        >
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-3">
              <div
                className="p-2 rounded-lg"
                style={{ background: theme.soft }}
              >
                <Robot size={24} style={{ color: theme.accent }} />
              </div>
              <div>
                <h2 className="text-lg font-semibold" style={{ color: TEXT.primary }}>
                  Create Agent
                </h2>
                <p className="text-sm" style={{ color: TEXT.secondary }}>
                  {STEPS.find(s => s.id === currentStep)?.description}
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 rounded-lg transition-colors"
              style={{ color: TEXT.tertiary }}
            >
              <svg size={20} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Progress Bar */}
          <div className="relative h-1 bg-gray-800 rounded-full overflow-hidden">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${progress}%` }}
              className="absolute h-full"
              style={{ background: theme.accent }}
            />
          </div>
        </div>

        {/* Content */}
        <div className="p-6" style={{ minHeight: '400px' }}>
          <AnimatePresence mode="wait">
            {currentStep === 'category' && (
              <CategoryStep
                key="category"
                selectedCategory={selectedCategory}
                onSelect={(category) => {
                  setSelectedCategory(category);
                  handleNext();
                }}
                theme={theme}
              />
            )}

            {currentStep === 'template' && selectedCategory && (
              <TemplateStep
                key="template"
                category={selectedCategory}
                selectedTemplate={selectedTemplate}
                onSelect={(template) => {
                  setSelectedTemplate(template);
                  handleNext();
                }}
                onBack={handleBack}
                theme={theme}
              />
            )}

            {currentStep === 'review' && selectedTemplate && (
              <ReviewStep
                key="review"
                template={selectedTemplate}
                onBack={handleBack}
                onNext={handleNext}
                theme={theme}
              />
            )}

            {currentStep === 'name' && selectedTemplate && (
              <NameStep
                key="name"
                template={selectedTemplate}
                agentName={agentName}
                onNameChange={setAgentName}
                onBack={handleBack}
                onComplete={handleComplete}
                theme={theme}
              />
            )}
          </AnimatePresence>
        </div>

        {/* Footer */}
        <div
          className="px-6 py-4 border-t flex items-center justify-between"
          style={{ borderColor: theme.border }}
        >
          <button
            onClick={handleReset}
            className="text-sm font-medium transition-colors"
            style={{ color: TEXT.tertiary }}
          >
            Start Over
          </button>
          <div className="flex items-center gap-2 text-sm" style={{ color: TEXT.secondary }}>
            <span>Step {currentStepIndex + 1} of {STEPS.length}</span>
          </div>
        </div>
      </motion.div>
    </div>
  );
}

// ============================================================================
// Step Components
// ============================================================================

interface CategoryStepProps {
  selectedCategory: AgentCategory | null;
  onSelect: (category: AgentCategory) => void;
  theme: any;
}

function CategoryStep({ selectedCategory, onSelect, theme }: CategoryStepProps) {
  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className="grid grid-cols-1 md:grid-cols-2 gap-4"
    >
      {CATEGORIES.map(cat => (
        <button
          key={cat.id}
          onClick={() => onSelect(cat.id)}
          className="p-4 rounded-xl border text-left transition-all"
          style={{
            background: selectedCategory === cat.id ? theme.soft : 'rgba(255,255,255,0.02)',
            borderColor: selectedCategory === cat.id ? theme.border : 'rgba(255,255,255,0.08)',
          }}
        >
          <div
            className="w-12 h-12 rounded-lg flex items-center justify-center mb-3"
            style={{ background: `rgba(${hexToRgb(theme.accent)}, 0.15)` }}
          >
            <span style={{ color: theme.accent }}>{cat.icon}</span>
          </div>
          <h3 className="font-semibold mb-1" style={{ color: TEXT.primary }}>
            {cat.label}
          </h3>
          <p className="text-sm" style={{ color: TEXT.secondary }}>
            {cat.description}
          </p>
        </button>
      ))}
    </motion.div>
  );
}

interface TemplateStepProps {
  category: AgentCategory;
  selectedTemplate: SpecialistTemplate | null;
  onSelect: (template: SpecialistTemplate) => void;
  onBack: () => void;
  theme: any;
}

function TemplateStep({ category, selectedTemplate, onSelect, onBack, theme }: TemplateStepProps) {
  const templates = getTemplatesByCategory(category);
  const categoryConfig = CATEGORIES.find(c => c.id === category);

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
    >
      <div className="flex items-center gap-3 mb-4">
        {categoryConfig?.icon}
        <h3 className="text-lg font-semibold" style={{ color: TEXT.primary }}>
          {categoryConfig?.label} Templates
        </h3>
      </div>

      <div className="space-y-3 mb-4">
        {templates.map(template => (
          <button
            key={template.id}
            onClick={() => onSelect(template)}
            className="w-full p-4 rounded-xl border text-left transition-all"
            style={{
              background: selectedTemplate?.id === template.id ? theme.soft : 'rgba(255,255,255,0.02)',
              borderColor: selectedTemplate?.id === template.id ? theme.border : 'rgba(255,255,255,0.08)',
            }}
          >
            <div className="flex items-start justify-between">
              <div>
                <h4 className="font-semibold mb-1" style={{ color: TEXT.primary }}>
                  {template.name}
                </h4>
                <p className="text-sm mb-2" style={{ color: TEXT.secondary }}>
                  {template.description}
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {template.tags.slice(0, 4).map(tag => (
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
              </div>
              {selectedTemplate?.id === template.id && (
                <Check size={20} style={{ color: theme.accent }} />
              )}
            </div>
          </button>
        ))}
      </div>

      <div className="flex justify-start">
        <Button variant="ghost" onClick={onBack} className="gap-2">
          <CaretLeft size={16} />
          Back
        </Button>
      </div>
    </motion.div>
  );
}

interface ReviewStepProps {
  template: SpecialistTemplate;
  onBack: () => void;
  onNext: () => void;
  theme: any;
}

function ReviewStep({ template, onBack, onNext, theme }: ReviewStepProps) {
  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
    >
      <div
        className="p-4 rounded-xl mb-4"
        style={{ background: 'rgba(255,255,255,0.02)', border: `1px solid ${theme.border}` }}
      >
        <div className="flex items-center gap-3 mb-3">
          <div
            className="p-2 rounded-lg"
            style={{ background: theme.soft }}
          >
            <Sparkle size={20} style={{ color: theme.accent }} />
          </div>
          <div>
            <h3 className="font-semibold" style={{ color: TEXT.primary }}>
              {template.name}
            </h3>
            <p className="text-sm" style={{ color: TEXT.secondary }}>
              {template.role}
            </p>
          </div>
        </div>

        <p className="text-sm mb-4" style={{ color: TEXT.secondary }}>
          {template.longDescription}
        </p>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <h4 className="text-xs font-medium mb-2" style={{ color: TEXT.tertiary }}>
              Model
            </h4>
            <p className="text-sm" style={{ color: TEXT.primary }}>
              {template.agentConfig.model}
            </p>
          </div>
          <div>
            <h4 className="text-xs font-medium mb-2" style={{ color: TEXT.tertiary }}>
              Tools
            </h4>
            <p className="text-sm" style={{ color: TEXT.primary }}>
              {template.agentConfig.tools?.length || 0} configured
            </p>
          </div>
        </div>
      </div>

      <div className="flex gap-2">
        <Button variant="ghost" onClick={onBack} className="gap-2">
          <CaretLeft size={16} />
          Back
        </Button>
        <Button variant="default" onClick={onNext} className="flex-1 gap-2" style={{ background: theme.accent, color: '#1A1612' }}>
          Continue
          <CaretRight size={16} />
        </Button>
      </div>
    </motion.div>
  );
}

interface NameStepProps {
  template: SpecialistTemplate;
  agentName: string;
  onNameChange: (name: string) => void;
  onBack: () => void;
  onComplete: () => void;
  theme: any;
}

function NameStep({ template, agentName, onNameChange, onBack, onComplete, theme }: NameStepProps) {
  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
    >
      <div className="mb-4">
        <label className="block text-sm font-medium mb-2" style={{ color: TEXT.primary }}>
          Agent Name
        </label>
        <input
          type="text"
          value={agentName}
          onChange={(e) => onNameChange(e.target.value)}
          placeholder={template.name}
          className="w-full px-4 py-3 rounded-lg border focus:outline-none focus:ring-2"
          style={{
            background: 'rgba(0,0,0,0.3)',
            borderColor: theme.border,
            color: TEXT.primary,
            '--tw-ring-color': theme.accent,
          } as React.CSSProperties}
        />
        <p className="text-xs mt-2" style={{ color: TEXT.tertiary }}>
          This is what you'll call your agent in conversations
        </p>
      </div>

      <div
        className="p-4 rounded-xl mb-4"
        style={{ background: 'rgba(255,255,255,0.02)', border: `1px solid ${theme.border}` }}
      >
        <p className="text-sm" style={{ color: TEXT.secondary }}>
          Creating from template: <span style={{ color: theme.accent }}>{template.name}</span>
        </p>
      </div>

      <div className="flex gap-2">
        <Button variant="ghost" onClick={onBack} className="gap-2">
          <CaretLeft size={16} />
          Back
        </Button>
        <Button
          variant="default"
          onClick={onComplete}
          disabled={!agentName.trim()}
          className="flex-1 gap-2"
          style={{
            background: agentName.trim() ? theme.accent : theme.border,
            color: '#1A1612',
            opacity: !agentName.trim() ? 0.5 : 1,
          }}
        >
          <Check size={16} />
          Create Agent
        </Button>
      </div>
    </motion.div>
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

export default AgentSelectorWizard;
