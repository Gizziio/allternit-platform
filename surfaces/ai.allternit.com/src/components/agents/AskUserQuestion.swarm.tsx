/**
 * Ask User Question - Meta-Swarm Integration
 * 
 * Extended version of AskUserQuestion that detects swarm intent in user answers
 * and triggers the Meta-Swarm system automatically.
 * 
 * Usage:
 * ```tsx
 * <SwarmAwareAskUserQuestion
 *   id="implementation"
 *   question="What would you like to implement?"
 *   type="text"
 *   onSubmit={handleSubmit}
 *   onSwarmTrigger={(task, mode) => metaSwarm.submitTask(task, mode)}
 * />
 * ```
 */

import React, { useCallback, useState } from 'react';
import {
  Robot,
  Lightning,
  ArrowsClockwise,
  Sparkle,
  CaretRight,
  Users,
} from '@phosphor-icons/react';
import {
  AskUserQuestion,
  AskUserQuestionProps,
  QuestionWizard,
  QuestionWizardProps,
} from './AskUserQuestion';
import {
  detectSwarmTrigger,
  SwarmTriggerResult,
  formatSwarmTask,
} from '../../hooks/useSwarmTrigger';

// ============================================================================
// Types
// ============================================================================

export interface SwarmAwareQuestionProps extends AskUserQuestionProps {
  /** Called when swarm trigger is detected in user answer */
  onSwarmTrigger?: (task: string, mode: string, confidence: number) => void;
  /** Minimum confidence threshold to show swarm suggestion (0-1) */
  swarmThreshold?: number;
  /** Show swarm suggestion UI even if not triggered */
  showSwarmOption?: boolean;
  /** Suggested swarm mode for this question context */
  suggestedSwarmMode?: 'swarm_agentic' | 'claude_swarm' | 'closed_loop' | 'hybrid' | 'auto';
}

export interface SwarmWizardProps extends QuestionWizardProps {
  /** Called when any answer triggers swarm mode */
  onSwarmTrigger?: (stepIndex: number, task: string, mode: string) => void;
  /** Check each answer for swarm intent */
  detectSwarmInAnswers?: boolean;
}

export interface SwarmSuggestion {
  task: string;
  mode: string;
  confidence: number;
  description: string;
  icon: React.ReactNode;
}

// ============================================================================
// Swarm-Aware Question Component
// ============================================================================

export function SwarmAwareAskUserQuestion({
  onSubmit,
  onSwarmTrigger,
  swarmThreshold = 0.6,
  showSwarmOption = true,
  suggestedSwarmMode = 'auto',
  ...props
}: SwarmAwareQuestionProps) {
  const [swarmSuggestion, setSwarmSuggestion] = useState<SwarmSuggestion | null>(null);
  const [isSwarmMode, setIsSwarmMode] = useState(false);

  // Analyze answer for swarm triggers
  const analyzeForSwarm = useCallback((value: string | string[] | boolean | number): SwarmTriggerResult => {
    if (typeof value !== 'string') {
      return { isSwarmTrigger: false, task: '', confidence: 0 };
    }
    return detectSwarmTrigger(value);
  }, []);

  // Handle submit with swarm detection
  const handleSubmit = useCallback((value: string | string[] | boolean | number) => {
    const trigger = analyzeForSwarm(value);

    if (trigger.isSwarmTrigger && trigger.confidence >= swarmThreshold) {
      // Auto-trigger swarm
      const mode = trigger.suggestedMode || suggestedSwarmMode;
      onSwarmTrigger?.(trigger.task, mode, trigger.confidence);
      
      // Still submit the original value
      onSubmit(value);
    } else if (trigger.isSwarmTrigger && trigger.confidence >= 0.4) {
      // Show suggestion but don't auto-trigger
      const mode = trigger.suggestedMode || suggestedSwarmMode;
      setSwarmSuggestion({
        task: trigger.task,
        mode,
        confidence: trigger.confidence,
        description: getModeDescription(mode),
        icon: getModeIcon(mode),
      });
      // Don't submit yet - wait for user to confirm swarm or regular
    } else {
      // Regular submit
      onSubmit(value);
    }
  }, [analyzeForSwarm, onSubmit, onSwarmTrigger, swarmThreshold, suggestedSwarmMode]);

  // Accept swarm suggestion
  const acceptSwarm = useCallback(() => {
    if (swarmSuggestion) {
      onSwarmTrigger?.(swarmSuggestion.task, swarmSuggestion.mode, swarmSuggestion.confidence);
      setIsSwarmMode(true);
      setSwarmSuggestion(null);
    }
  }, [swarmSuggestion, onSwarmTrigger]);

  // Decline swarm, submit normally
  const declineSwarm = useCallback(() => {
    setSwarmSuggestion(null);
    // Need to resubmit with original value - we'll use a ref in real implementation
  }, []);

  // If showing swarm suggestion
  if (swarmSuggestion) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <SwarmSuggestionCard
          suggestion={swarmSuggestion}
          onAccept={acceptSwarm}
          onDecline={declineSwarm}
        />
      </div>
    );
  }

  // Show the regular question with optional swarm option
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <AskUserQuestion {...props} onSubmit={handleSubmit} />
      
      {showSwarmOption && !isSwarmMode && (
        <SwarmQuickAction
          mode={suggestedSwarmMode}
          onClick={() => setIsSwarmMode(true)}
        />
      )}
    </div>
  );
}

// ============================================================================
// Swarm Suggestion Card
// ============================================================================

function SwarmSuggestionCard({
  suggestion,
  onAccept,
  onDecline,
}: {
  suggestion: SwarmSuggestion;
  onAccept: () => void;
  onDecline: () => void;
}) {
  return (
    <div
      style={{
        borderRadius: 16,
        border: '1px solid rgba(212,149,106,0.3)',
        background: 'linear-gradient(135deg, color-mix(in srgb, var(--accent-primary) 10%, transparent), rgba(121,196,124,0.05))',
        padding: 20,
      }}
    >
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
        <div
          style={{
            width: 40,
            height: 40,
            borderRadius: 12,
            background: 'rgba(212,149,106,0.2)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {suggestion.icon}
        </div>
        <div>
          <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--ui-text-primary)' }}>
            Use Swarm Mode?
          </div>
          <div style={{ fontSize: 12, color: 'var(--ui-text-secondary)' }}>
            Detected {Math.round(suggestion.confidence * 100)}% match for parallel execution
          </div>
        </div>
      </div>

      {/* Task Preview */}
      <div
        style={{
          padding: 12,
          borderRadius: 10,
          background: 'var(--surface-panel)',
          marginBottom: 16,
        }}
      >
        <div style={{ fontSize: 11, color: 'var(--ui-text-muted)', marginBottom: 4 }}>TASK</div>
        <div style={{ fontSize: 14, color: 'var(--ui-text-primary)', lineHeight: 1.5 }}>
          {suggestion.task}
        </div>
      </div>

      {/* Mode Description */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '8px 12px',
          borderRadius: 8,
          background: 'rgba(121,196,124,0.1)',
          marginBottom: 16,
        }}
      >
        <Sparkle size={14} style={{ color: '#79C47C' }} />
        <span style={{ fontSize: 12, color: '#79C47C' }}>{suggestion.description}</span>
      </div>

      {/* Actions */}
      <div style={{ display: 'flex', gap: 10 }}>
        <button
          onClick={onDecline}
          style={{
            flex: 1,
            padding: '10px 16px',
            borderRadius: 8,
            border: '1px solid var(--ui-border-default)',
            background: 'transparent',
            color: 'var(--ui-text-secondary)',
            fontSize: 13,
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          Regular Mode
        </button>
        <button
          onClick={onAccept}
          style={{
            flex: 2,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
            padding: '10px 16px',
            borderRadius: 8,
            border: '1px solid #D4956A',
            background: 'var(--accent-primary)',
            color: 'var(--ui-text-inverse)',
            fontSize: 13,
            fontWeight: 700,
            cursor: 'pointer',
          }}
        >
          <Users size={16} />
          Execute with Swarm
          <CaretRight size={14} />
        </button>
      </div>
    </div>
  );
}

// ============================================================================
// Swarm Quick Action Button
// ============================================================================

function SwarmQuickAction({
  mode,
  onClick,
}: {
  mode: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        padding: '8px 12px',
        borderRadius: 8,
        border: '1px dashed rgba(212,149,106,0.3)',
        background: 'transparent',
        color: 'var(--accent-primary)',
        fontSize: 12,
        cursor: 'pointer',
        alignSelf: 'flex-start',
      }}
    >
      <Robot size={14} />
      <span>Or use Swarm Mode</span>
    </button>
  );
}

// ============================================================================
// Swarm-Aware Wizard
// ============================================================================

export function SwarmAwareWizard({
  questions,
  onComplete,
  onSwarmTrigger,
  detectSwarmInAnswers = true,
  ...props
}: SwarmWizardProps) {
  const [answers, setAnswers] = useState<Record<string, unknown>>({});
  const [swarmTriggers, setSwarmTriggers] = useState<Array<{ step: number; task: string; mode: string }>>([]);

  const handleStepComplete = useCallback((stepIndex: number, answer: unknown) => {
    const newAnswers = { ...answers, [questions[stepIndex].id]: answer };
    setAnswers(newAnswers);

    // Check for swarm trigger in this answer
    if (detectSwarmInAnswers && typeof answer === 'string') {
      const trigger = detectSwarmTrigger(answer);
      if (trigger.isSwarmTrigger && trigger.confidence >= 0.6) {
        const mode = trigger.suggestedMode || 'auto';
        setSwarmTriggers(prev => [...prev, { step: stepIndex, task: trigger.task, mode }]);
        onSwarmTrigger?.(stepIndex, trigger.task, mode);
      }
    }

    // If last step, complete the wizard
    if (stepIndex === questions.length - 1) {
      onComplete(newAnswers);
    }
  }, [answers, questions, onComplete, onSwarmTrigger, detectSwarmInAnswers]);

  // Transform questions to use swarm-aware versions
  const swarmAwareQuestions = questions.map((q, index) => ({
    ...q,
    onSubmit: (value: unknown) => handleStepComplete(index, value),
  }));

  return (
    <div>
      {/* Show active swarm triggers */}
      {swarmTriggers.length > 0 && (
        <div
          style={{
            marginBottom: 16,
            padding: 12,
            borderRadius: 10,
            background: 'rgba(121,196,124,0.1)',
            border: '1px solid rgba(121,196,124,0.2)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
            <Lightning size={14} style={{ color: '#79C47C' }} />
            <span style={{ fontSize: 12, fontWeight: 600, color: '#79C47C' }}>
              Swarm Mode Active
            </span>
          </div>
          {swarmTriggers.map((trigger, i) => (
            <div key={i} style={{ fontSize: 11, color: 'var(--ui-text-secondary)' }}>
              Step {trigger.step + 1}: {trigger.mode} mode
            </div>
          ))}
        </div>
      )}

      <QuestionWizard {...props} questions={swarmAwareQuestions} onComplete={onComplete} />
    </div>
  );
}

// ============================================================================
// Helpers
// ============================================================================

function getModeDescription(mode: string): string {
  switch (mode) {
    case 'swarm_agentic':
      return 'Auto-architect optimal agent teams via PSO evolution';
    case 'claude_swarm':
      return 'Execute subtasks in parallel waves with shared context';
    case 'closed_loop':
      return 'Full 5-step: Brainstorm → Plan → Work → Review → Compound';
    case 'hybrid':
      return 'Multi-phase execution combining multiple modes';
    default:
      return 'Auto-detect optimal swarm mode based on task analysis';
  }
}

function getModeIcon(mode: string): React.ReactNode {
  const iconProps = { size: 20, style: { color: 'var(--accent-primary)' } };
  
  switch (mode) {
    case 'swarm_agentic':
      return <Sparkle {...iconProps} />;
    case 'claude_swarm':
      return <Lightning {...iconProps} />;
    case 'closed_loop':
      return <ArrowsClockwise {...iconProps} />;
    case 'hybrid':
      return <Robot {...iconProps} />;
    default:
      return <Users {...iconProps} />;
  }
}

// ============================================================================
// Hook for using swarm-aware questions
// ============================================================================

export function useSwarmAwareQuestion() {
  const [lastSwarmTrigger, setLastSwarmTrigger] = useState<{
    task: string;
    mode: string;
    confidence: number;
  } | null>(null);

  const checkAnswer = useCallback((answer: unknown): SwarmTriggerResult => {
    if (typeof answer !== 'string') {
      return { isSwarmTrigger: false, task: '', confidence: 0 };
    }

    const result = detectSwarmTrigger(answer);
    
    if (result.isSwarmTrigger) {
      setLastSwarmTrigger({
        task: result.task,
        mode: result.suggestedMode || 'auto',
        confidence: result.confidence,
      });
    }

    return result;
  }, []);

  const shouldUseSwarm = useCallback((answer: unknown, threshold = 0.6): boolean => {
    const result = checkAnswer(answer);
    return result.isSwarmTrigger && result.confidence >= threshold;
  }, [checkAnswer]);

  return {
    checkAnswer,
    shouldUseSwarm,
    lastSwarmTrigger,
    formatTask: formatSwarmTask,
  };
}

export default SwarmAwareAskUserQuestion;
