/**
 * Agent Creation Wizard - Help Components
 * 
 * Reusable help UI components including:
 * - HelpPanel: Slide-out help panel with step-specific content
 * - HelpButton: Contextual help button with tooltip
 * - OnboardingTour: First-time user walkthrough
 * - SmartSuggestions: Contextual recommendations
 * - ValidationFeedback: Real-time validation messages
 * - FieldHint: Inline field descriptions
 * 
 * @module wizard-help-components
 * @version 1.0.0
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Question as HelpCircle,
  X,
  CaretRight,
  CaretLeft,
  Lightbulb,
  BookOpen,
  ArrowSquareOut,
  CheckCircle,
  Warning,
  Info,
  Sparkle,
  ArrowCounterClockwise,
  SkipForward,
  Chat,
  MagnifyingGlass,
  Star,
  Lightning,
  Target,
  ArrowRight,
  ArrowsOut,
  ArrowsIn,
} from '@phosphor-icons/react';

import {
  STEP_HELP_CONTENT,
  FIELD_TOOLTIPS,
  getModelSuggestions,
  getToolSuggestions,
  getSystemPromptSuggestions,
  validateAgentName,
  validateDescription,
  validateHardBans,
  validateTools,
  validateTemperature,
  ONBOARDING_TOUR_STEPS,
  getRandomTip,
  type StepHelpContent,
  type FieldTooltip,
  type SmartSuggestion,
  type ValidationResult,
  type OnboardingStep,
} from '@/lib/agents/wizard-help.constants';

import {
  SAND,
  MODE_COLORS,
  TEXT,
  RADIUS,
  SPACE,
  SHADOW,
} from '@/design/allternit.tokens';

// ============================================================================
// Types
// ============================================================================

export interface HelpPanelProps {
  isOpen: boolean;
  onClose: () => void;
  currentStepId: string;
  modeColors: typeof MODE_COLORS.chat;
}

export interface HelpButtonProps {
  fieldId: string;
  stepId: string;
  modeColors: typeof MODE_COLORS.chat;
  size?: 'sm' | 'md' | 'lg';
}

export interface OnboardingTourProps {
  isOpen: boolean;
  onComplete: () => void;
  onSkip: () => void;
  currentStep: number;
  totalSteps: number;
  modeColors: typeof MODE_COLORS.chat;
}

export interface SmartSuggestionsProps {
  suggestions: SmartSuggestion[];
  onApplySuggestion: (suggestion: SmartSuggestion) => void;
  modeColors: typeof MODE_COLORS.chat;
}

export interface ValidationFeedbackProps {
  validations: ValidationResult[];
  modeColors: typeof MODE_COLORS.chat;
}

export interface FieldHintProps {
  stepId: string;
  fieldId: string;
  modeColors: typeof MODE_COLORS.chat;
}

export interface QuickTipProps {
  modeColors: typeof MODE_COLORS.chat;
}

// ============================================================================
// Help Panel Component
// ============================================================================

export function HelpPanel({ isOpen, onClose, currentStepId, modeColors }: HelpPanelProps) {
  const helpContent = STEP_HELP_CONTENT[currentStepId];

  if (!helpContent) {
    return null;
  }

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/50 z-40"
          />

          {/* Panel */}
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            className="fixed right-0 top-0 bottom-0 w-full max-w-md z-50 overflow-hidden flex flex-col"
            style={{ background: '#1A1612' }}
          >
            {/* Header */}
            <div
              className="px-6 py-4 border-b flex items-center justify-between flex-shrink-0"
              style={{ borderColor: modeColors.border }}
            >
              <div className="flex items-center gap-3">
                <div
                  className="w-10 h-10 rounded-lg flex items-center justify-center"
                  style={{ background: modeColors.soft }}
                >
                  <HelpCircle size={20} style={{ color: modeColors.accent }} />
                </div>
                <div>
                  <h2 className="text-lg font-semibold" style={{ color: TEXT.primary }}>
                    Need Help?
                  </h2>
                  <p className="text-sm" style={{ color: TEXT.secondary }}>
                    {helpContent.title}
                  </p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="p-2 rounded-lg hover:bg-white/5 transition-colors"
              >
                <X size={20} style={{ color: TEXT.tertiary }} />
              </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {/* Introduction */}
              <div>
                <p className="text-sm leading-relaxed" style={{ color: TEXT.secondary }}>
                  {helpContent.introduction}
                </p>
              </div>

              {/* What You'll Do */}
              <div>
                <h3 className="text-sm font-semibold mb-3 flex items-center gap-2" style={{ color: TEXT.primary }}>
                  <Target size={16} style={{ color: modeColors.accent }} />
                  What You'll Do
                </h3>
                <ul className="space-y-2">
                  {helpContent.whatYouLlDo.map((item, idx) => (
                    <li key={idx} className="flex items-start gap-2 text-sm" style={{ color: TEXT.secondary }}>
                      <CaretRight size={16} style={{ color: modeColors.accent }} className="flex-shrink-0 mt-0.5" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Best Practices */}
              <div
                className="p-4 rounded-xl"
                style={{ background: 'rgba(16, 185, 129, 0.1)', border: `1px solid rgba(16, 185, 129, 0.3)` }}
              >
                <h3 className="text-sm font-semibold mb-3 flex items-center gap-2" style={{ color: '#10B981' }}>
                  <Star size={16} />
                  Best Practices
                </h3>
                <ul className="space-y-2">
                  {helpContent.bestPractices.map((item, idx) => (
                    <li key={idx} className="flex items-start gap-2 text-sm" style={{ color: TEXT.secondary }}>
                      <CheckCircle size={16} className="flex-shrink-0 mt-0.5 text-emerald-500" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Tips */}
              <div
                className="p-4 rounded-xl"
                style={{ background: 'rgba(245, 158, 11, 0.1)', border: `1px solid rgba(245, 158, 11, 0.3)` }}
              >
                <h3 className="text-sm font-semibold mb-3 flex items-center gap-2" style={{ color: '#F59E0B' }}>
                  <Lightbulb size={16} />
                  Pro Tips
                </h3>
                <ul className="space-y-2">
                  {helpContent.tips.map((item, idx) => (
                    <li key={idx} className="flex items-start gap-2 text-sm" style={{ color: TEXT.secondary }}>
                      <Lightbulb size={16} className="flex-shrink-0 mt-0.5 text-amber-500" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Common Questions */}
              <div>
                <h3 className="text-sm font-semibold mb-3 flex items-center gap-2" style={{ color: TEXT.primary }}>
                  <Chat size={16} style={{ color: modeColors.accent }} />
                  Common Questions
                </h3>
                <div className="space-y-3">
                  {helpContent.commonQuestions.map((qa, idx) => (
                    <div
                      key={idx}
                      className="p-3 rounded-lg"
                      style={{ background: 'rgba(255,255,255,0.03)' }}
                    >
                      <p className="text-sm font-medium mb-1" style={{ color: TEXT.primary }}>
                        {qa.question}
                      </p>
                      <p className="text-sm" style={{ color: TEXT.secondary }}>
                        {qa.answer}
                      </p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Documentation Links */}
              {helpContent.documentationLinks && helpContent.documentationLinks.length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold mb-3 flex items-center gap-2" style={{ color: TEXT.primary }}>
                    <BookOpen size={16} style={{ color: modeColors.accent }} />
                    Documentation
                  </h3>
                  <div className="space-y-2">
                    {helpContent.documentationLinks.map((link, idx) => (
                      <a
                        key={idx}
                        href={link.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center justify-between p-3 rounded-lg transition-colors group"
                        style={{ background: 'rgba(255,255,255,0.03)' }}
                      >
                        <span className="text-sm" style={{ color: TEXT.secondary }}>
                          {link.label}
                        </span>
                        <ArrowSquareOut size={14} style={{ color: TEXT.tertiary }} className="group-hover:text-primary transition-colors" />
                      </a>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

// ============================================================================
// Help Button Component
// ============================================================================

export function HelpButton({ fieldId, stepId, modeColors, size = 'md' }: HelpButtonProps) {
  const [showTooltip, setShowTooltip] = useState(false);
  
  const stepTooltips = FIELD_TOOLTIPS[stepId];
  const tooltip = stepTooltips?.[fieldId];

  if (!tooltip) {
    return null;
  }

  const sizeClasses = {
    sm: 'w-4 h-4',
    md: 'w-5 h-5',
    lg: 'w-6 h-6',
  };

  return (
    <div className="relative inline-block">
      <button
        onMouseEnter={() => setShowTooltip(true)}
        onMouseLeave={() => setShowTooltip(false)}
        onFocus={() => setShowTooltip(true)}
        onBlur={() => setShowTooltip(false)}
        className="inline-flex items-center justify-center rounded-full hover:bg-white/5 transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-[#0D0B09] focus:ring-blue-500"
        aria-label={`Help for ${tooltip.label}`}
      >
        <HelpCircle className={sizeClasses[size]} style={{ color: TEXT.tertiary }} />
      </button>

      <AnimatePresence>
        {showTooltip && (
          <motion.div
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 4 }}
            className="absolute z-50 mt-2 w-72 p-3 rounded-lg shadow-lg"
            style={{
              background: '#1A1612',
              border: `1px solid ${modeColors.border}`,
              left: '50%',
              transform: 'translateX(-50%)',
            }}
          >
            <div className="text-sm font-medium mb-1" style={{ color: TEXT.primary }}>
              {tooltip.label}
            </div>
            <div className="text-xs leading-relaxed" style={{ color: TEXT.secondary }}>
              {tooltip.content}
            </div>
            {tooltip.example && (
              <div className="mt-2 text-xs" style={{ color: TEXT.tertiary }}>
                <span className="font-medium">Example: </span>
                {tooltip.example}
              </div>
            )}
            {tooltip.warning && (
              <div
                className="mt-2 text-xs flex items-start gap-1"
                style={{ color: '#F59E0B' }}
              >
                <Warning size={12} className="flex-shrink-0 mt-0.5" />
                <span>{tooltip.warning}</span>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ============================================================================
// Onboarding Tour Component
// ============================================================================

export function OnboardingTour({
  isOpen,
  onComplete,
  onSkip,
  currentStep,
  totalSteps,
  modeColors,
}: OnboardingTourProps) {
  const [tourStepIndex, setTourStepIndex] = useState(0);
  const currentTourStep = ONBOARDING_TOUR_STEPS[tourStepIndex];

  useEffect(() => {
    // Reset tour when wizard step changes
    const relevantSteps = ONBOARDING_TOUR_STEPS.filter(s => 
      s.id.startsWith('identity') || 
      s.id.startsWith('character') ||
      s.id.startsWith('role') ||
      s.id.startsWith('voice') ||
      s.id.startsWith('tools') ||
      s.id.startsWith('plugins') ||
      s.id.startsWith('workspace') ||
      s.id.startsWith('review')
    );
    
    // Find first step matching current wizard step
    const stepPrefix = ['identity', 'character', 'avatar', 'role', 'voice', 'advanced', 'tools', 'plugins', 'workspace', 'review'][currentStep];
    const matchingIndex = ONBOARDING_TOUR_STEPS.findIndex(s => s.id.startsWith(stepPrefix || ''));
    
    if (matchingIndex !== -1 && matchingIndex !== tourStepIndex) {
      setTourStepIndex(matchingIndex);
    }
  }, [currentStep]);

  const handleNext = () => {
    if (tourStepIndex < ONBOARDING_TOUR_STEPS.length - 1) {
      setTourStepIndex(prev => prev + 1);
    } else {
      onComplete();
    }
  };

  const handlePrev = () => {
    if (tourStepIndex > 0) {
      setTourStepIndex(prev => prev - 1);
    }
  };

  if (!isOpen || !currentTourStep) {
    return null;
  }

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 20 }}
        className="fixed bottom-24 right-6 z-50 w-full max-w-sm"
      >
        <div
          className="rounded-xl shadow-2xl overflow-hidden"
          style={{
            background: '#1A1612',
            border: `2px solid ${modeColors.border}`,
          }}
        >
          {/* Header */}
          <div
            className="px-4 py-3 flex items-center justify-between"
            style={{ background: modeColors.soft }}
          >
            <div className="flex items-center gap-2">
              <Sparkle size={18} style={{ color: modeColors.accent }} />
              <span className="text-sm font-semibold" style={{ color: modeColors.accent }}>
                Quick Tour
              </span>
            </div>
            <div className="flex items-center gap-1">
              <span className="text-xs" style={{ color: TEXT.tertiary }}>
                {tourStepIndex + 1} of {ONBOARDING_TOUR_STEPS.length}
              </span>
              <button
                onClick={onSkip}
                className="p-1 rounded hover:bg-white/5 transition-colors"
                aria-label="Skip tour"
              >
                <X size={14} style={{ color: TEXT.tertiary }} />
              </button>
            </div>
          </div>

          {/* Content */}
          <div className="p-4">
            <h3 className="text-base font-semibold mb-2" style={{ color: TEXT.primary }}>
              {currentTourStep.title}
            </h3>
            <p className="text-sm leading-relaxed mb-3" style={{ color: TEXT.secondary }}>
              {currentTourStep.content}
            </p>
            {currentTourStep.tip && (
              <div
                className="p-2 rounded-lg flex items-start gap-2"
                style={{ background: 'rgba(245, 158, 11, 0.1)' }}
              >
                <Lightbulb size={14} className="flex-shrink-0 mt-0.5" style={{ color: '#F59E0B' }} />
                <p className="text-xs" style={{ color: TEXT.secondary }}>
                  {currentTourStep.tip}
                </p>
              </div>
            )}
          </div>

          {/* Footer */}
          <div
            className="px-4 py-3 flex items-center justify-between"
            style={{ borderTop: `1px solid ${modeColors.border}` }}
          >
            <button
              onClick={handlePrev}
              disabled={tourStepIndex === 0}
              className="px-3 py-1.5 rounded-lg text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              style={{ color: TEXT.secondary }}
            >
              <div className="flex items-center gap-1">
                <CaretLeft size={16} />
                Back
              </div>
            </button>

            <div className="flex items-center gap-2">
              <button
                onClick={onSkip}
                className="px-3 py-1.5 rounded-lg text-sm font-medium transition-colors flex items-center gap-1"
                style={{ color: TEXT.tertiary }}
              >
                <SkipForward size={14} />
                Skip
              </button>
              <button
                onClick={handleNext}
                className="px-4 py-1.5 rounded-lg text-sm font-semibold transition-colors flex items-center gap-1"
                style={{
                  background: modeColors.accent,
                  color: '#1A1612',
                }}
              >
                {tourStepIndex === ONBOARDING_TOUR_STEPS.length - 1 ? 'Finish' : 'Next'}
                {tourStepIndex !== ONBOARDING_TOUR_STEPS.length - 1 && <CaretRight size={16} />}
              </button>
            </div>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}

// ============================================================================
// Smart Suggestions Component
// ============================================================================

export function SmartSuggestions({ suggestions, onApplySuggestion, modeColors }: SmartSuggestionsProps) {
  if (suggestions.length === 0) {
    return null;
  }

  const getIcon = (type: string) => {
    switch (type) {
      case 'model':
        return Zap;
      case 'tool':
        return Target;
      case 'capability':
        return Sparkle;
      case 'prompt':
        return Chat;
      case 'setting':
        return RotateCcw;
      default:
        return Info;
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high':
        return { bg: 'rgba(239, 68, 68, 0.1)', border: 'rgba(239, 68, 68, 0.3)', text: '#EF4444' };
      case 'medium':
        return { bg: 'rgba(245, 158, 11, 0.1)', border: 'rgba(245, 158, 11, 0.3)', text: '#F59E0B' };
      case 'low':
        return { bg: 'rgba(59, 130, 246, 0.1)', border: 'rgba(59, 130, 246, 0.3)', text: '#3B82F6' };
      default:
        return { bg: 'rgba(255,255,255,0.05)', border: modeColors.border, text: TEXT.secondary };
    }
  };

  return (
    <div className="space-y-2">
      {suggestions.map((suggestion) => {
        const Icon = getIcon(suggestion.type);
        const colors = getPriorityColor(suggestion.priority);

        return (
          <div
            key={suggestion.id}
            className="p-3 rounded-lg transition-colors"
            style={{
              background: colors.bg,
              border: `1px solid ${colors.border}`,
            }}
          >
            <div className="flex items-start gap-3">
              <div
                className="w-8 h-8 rounded flex items-center justify-center flex-shrink-0"
                style={{ background: 'rgba(255,255,255,0.05)' }}
              >
                <Icon size={16} style={{ color: colors.text }} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-sm font-semibold" style={{ color: TEXT.primary }}>
                    {suggestion.title}
                  </span>
                  <span
                    className="text-[10px] px-1.5 py-0.5 rounded uppercase font-medium"
                    style={{ background: colors.bg, color: colors.text }}
                  >
                    {suggestion.priority}
                  </span>
                </div>
                <p className="text-xs mb-2" style={{ color: TEXT.secondary }}>
                  {suggestion.description}
                </p>
                <p className="text-xs" style={{ color: TEXT.tertiary }}>
                  <span className="font-medium">Why: </span>
                  {suggestion.reason}
                </p>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ============================================================================
// Validation Feedback Component
// ============================================================================

export function ValidationFeedback({ validations, modeColors }: ValidationFeedbackProps) {
  if (validations.length === 0) {
    return null;
  }

  const getIcon = (severity: string) => {
    switch (severity) {
      case 'error':
        return Warning;
      case 'warning':
        return Warning;
      case 'info':
        return Info;
      default:
        return Info;
    }
  };

  const getColor = (severity: string) => {
    switch (severity) {
      case 'error':
        return { bg: 'rgba(239, 68, 68, 0.1)', border: 'rgba(239, 68, 68, 0.3)', text: '#EF4444' };
      case 'warning':
        return { bg: 'rgba(245, 158, 11, 0.1)', border: 'rgba(245, 158, 11, 0.3)', text: '#F59E0B' };
      case 'info':
        return { bg: 'rgba(59, 130, 246, 0.1)', border: 'rgba(59, 130, 246, 0.3)', text: '#3B82F6' };
      default:
        return { bg: 'rgba(255,255,255,0.05)', border: modeColors.border, text: TEXT.secondary };
    }
  };

  return (
    <div className="space-y-2">
      {validations.map((validation, idx) => {
        const Icon = getIcon(validation.severity);
        const colors = getColor(validation.severity);

        return (
          <div
            key={idx}
            className="p-3 rounded-lg flex items-start gap-3"
            style={{
              background: colors.bg,
              border: `1px solid ${colors.border}`,
            }}
          >
            <Icon size={16} className="flex-shrink-0 mt-0.5" style={{ color: colors.text }} />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium" style={{ color: colors.text }}>
                {validation.message}
              </p>
              {validation.suggestion && (
                <p className="text-xs mt-1" style={{ color: TEXT.secondary }}>
                  <span className="font-medium">Suggestion: </span>
                  {validation.suggestion}
                </p>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ============================================================================
// Field Hint Component
// ============================================================================

export function FieldHint({ stepId, fieldId, modeColors }: FieldHintProps) {
  const stepTooltips = FIELD_TOOLTIPS[stepId];
  const tooltip = stepTooltips?.[fieldId];

  if (!tooltip) {
    return null;
  }

  return (
    <div className="mt-2 flex items-start gap-2">
      <Info size={14} className="flex-shrink-0 mt-0.5" style={{ color: TEXT.tertiary }} />
      <div className="text-xs leading-relaxed" style={{ color: TEXT.tertiary }}>
        {tooltip.content}
        {tooltip.example && (
          <span className="block mt-1">
            <span className="font-medium">Example: </span>
            {tooltip.example}
          </span>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// Quick Tip Component
// ============================================================================

export function QuickTip({ modeColors }: QuickTipProps) {
  const [tip, setTip] = useState(getRandomTip());

  const refreshTip = () => {
    setTip(getRandomTip());
  };

  return (
    <div
      className="p-3 rounded-lg flex items-start gap-3"
      style={{
        background: 'rgba(245, 158, 11, 0.1)',
        border: `1px solid rgba(245, 158, 11, 0.3)`,
      }}
    >
      <Lightbulb size={16} className="flex-shrink-0 mt-0.5" style={{ color: '#F59E0B' }} />
      <p className="text-xs flex-1" style={{ color: TEXT.secondary }}>
        {tip}
      </p>
      <button
        onClick={refreshTip}
        className="p-1 rounded hover:bg-white/5 transition-colors"
        aria-label="Show another tip"
      >
        <ArrowCounterClockwise size={12} style={{ color: TEXT.tertiary }} />
      </button>
    </div>
  );
}

// ============================================================================
// Step Introduction Component
// ============================================================================

export interface StepIntroductionProps {
  stepId: string;
  modeColors: typeof MODE_COLORS.chat;
}

export function StepIntroduction({ stepId, modeColors }: StepIntroductionProps) {
  const helpContent = STEP_HELP_CONTENT[stepId];

  if (!helpContent) {
    return null;
  }

  return (
    <div className="mb-8">
      <div className="flex items-start justify-between mb-2">
        <h2 className="text-2xl font-semibold" style={{ color: TEXT.primary }}>
          {helpContent.title}
        </h2>
      </div>
      <p className="text-sm leading-relaxed" style={{ color: TEXT.secondary }}>
        {helpContent.introduction}
      </p>
    </div>
  );
}

// ============================================================================
// Help Context Provider
// ============================================================================

export interface HelpContextType {
  showOnboarding: boolean;
  setShowOnboarding: (show: boolean) => void;
  hasCompletedOnboarding: boolean;
  setHasCompletedOnboarding: (completed: boolean) => void;
  showHelpPanel: boolean;
  setShowHelpPanel: (show: boolean) => void;
  currentHelpStep: string;
  setCurrentHelpStep: (step: string) => void;
}

const HelpContext = React.createContext<HelpContextType | undefined>(undefined);

export function HelpProvider({ children }: { children: React.ReactNode }) {
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [hasCompletedOnboarding, setHasCompletedOnboarding] = useState(false);
  const [showHelpPanel, setShowHelpPanel] = useState(false);
  const [currentHelpStep, setCurrentHelpStep] = useState('');

  // Check if user has completed onboarding before
  useEffect(() => {
    const completed = localStorage.getItem('agent-wizard-onboarding-completed');
    if (completed === 'true') {
      setHasCompletedOnboarding(true);
    } else {
      // First time user - show onboarding
      setShowOnboarding(true);
    }
  }, []);

  const handleCompleteOnboarding = () => {
    setShowOnboarding(false);
    setHasCompletedOnboarding(true);
    localStorage.setItem('agent-wizard-onboarding-completed', 'true');
  };

  return (
    <HelpContext.Provider
      value={{
        showOnboarding,
        setShowOnboarding,
        hasCompletedOnboarding,
        setHasCompletedOnboarding,
        showHelpPanel,
        setShowHelpPanel,
        currentHelpStep,
        setCurrentHelpStep,
      }}
    >
      {children}
    </HelpContext.Provider>
  );
}

export function useHelpContext() {
  const context = React.useContext(HelpContext);
  if (context === undefined) {
    throw new Error('useHelpContext must be used within a HelpProvider');
  }
  return context;
}
