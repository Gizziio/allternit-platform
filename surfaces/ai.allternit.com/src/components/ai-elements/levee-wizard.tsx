"use client";

import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';
import { CaretLeft, CaretRight, Check } from '@phosphor-icons/react';
import { cn } from '@/lib/utils';

// ─── Context ──────────────────────────────────────────────────────────────────

interface LeveeWizardContextValue {
  step: number;
  totalSteps: number;
  setStep: (step: number) => void;
  answers: Record<number, unknown>;
  setAnswer: (step: number, value: unknown) => void;
  progress: number;
}

const LeveeWizardContext = createContext<LeveeWizardContextValue | null>(null);

const useLeveeWizard = () => {
  const ctx = useContext(LeveeWizardContext);
  if (!ctx) throw new Error('LeveeWizard context not found');
  return ctx;
};

// ─── Types ────────────────────────────────────────────────────────────────────

export interface LeveeWizardStepOption {
  id: string;
  label: string;
  description?: string;
}

export interface LeveeWizardStep {
  id: string;
  title: string;
  description?: string;
  type: 'text' | 'choice' | 'multi-choice' | 'rating' | 'confirm';
  options?: LeveeWizardStepOption[];
  placeholder?: string;
}

export interface LeveeWizardProps {
  title?: string;
  subtitle?: string;
  steps: LeveeWizardStep[];
  onComplete?: (answers: Record<number, unknown>) => void;
  className?: string;
}

// ─── Root ─────────────────────────────────────────────────────────────────────

export function LeveeWizard({
  title = 'Research Interview',
  subtitle,
  steps,
  onComplete,
  className,
}: LeveeWizardProps) {
  const [step, setStepRaw] = useState(0);
  const [answers, setAnswers] = useState<Record<number, unknown>>({});
  const [complete, setComplete] = useState(false);

  const setStep = useCallback(
    (s: number) => setStepRaw(Math.max(0, Math.min(steps.length - 1, s))),
    [steps.length]
  );

  const setAnswer = useCallback((s: number, value: unknown) => {
    setAnswers(prev => ({ ...prev, [s]: value }));
  }, []);

  const progress = steps.length > 0 ? ((step + 1) / steps.length) * 100 : 100;

  const ctx = useMemo<LeveeWizardContextValue>(
    () => ({ step, totalSteps: steps.length, setStep, answers, setAnswer, progress }),
    [step, steps.length, setStep, answers, setAnswer, progress]
  );

  const handleComplete = useCallback(() => {
    setComplete(true);
    onComplete?.(answers);
  }, [answers, onComplete]);

  return (
    <LeveeWizardContext.Provider value={ctx}>
      <div className={cn("rounded-xl border border-border bg-card overflow-hidden max-w-lg", className)}>
        {/* Header */}
        <div className="px-6 pt-6 pb-4">
          <div className="flex items-center justify-between mb-1">
            <h3 className="text-base font-semibold text-foreground">{title}</h3>
            <span className="text-xs text-muted-foreground tabular-nums">
              {step + 1} / {steps.length}
            </span>
          </div>
          {subtitle && <p className="text-sm text-muted-foreground">{subtitle}</p>}
        </div>

        {/* Progress */}
        <div className="h-0.5 bg-muted mx-6 rounded-full overflow-hidden mb-6">
          <div
            className="h-full bg-primary rounded-full transition-all duration-500"
            style={{ width: `${progress}%` }}
          />
        </div>

        {complete ? (
          <div className="px-6 pb-8 flex flex-col items-center gap-3 text-center">
            <div className="size-12  rounded-full bg-green-500/10 border border-green-500/20 flex items-center justify-center">
              <Check className="size-6  text-green-500" />
            </div>
            <h4 className="text-sm font-semibold">Interview Complete</h4>
            <p className="text-xs text-muted-foreground">Thank you for your responses.</p>
          </div>
        ) : (
          <>
            <LeveeStepRenderer step={steps[step]!} stepIndex={step} />
            <LeveeNavigation onComplete={handleComplete} />
          </>
        )}
      </div>
    </LeveeWizardContext.Provider>
  );
}

// ─── Step ─────────────────────────────────────────────────────────────────────

function LeveeStepRenderer({ step, stepIndex }: { step: LeveeWizardStep; stepIndex: number }) {
  const { answers, setAnswer } = useLeveeWizard();
  const current = answers[stepIndex];

  return (
    <div className="px-6 pb-4 space-y-4">
      <div>
        <h4 className="text-sm font-semibold text-foreground">{step.title}</h4>
        {step.description && (
          <p className="text-xs text-muted-foreground mt-1">{step.description}</p>
        )}
      </div>

      {step.type === 'text' && (
        <textarea
          value={typeof current === 'string' ? current : ''}
          onChange={e => setAnswer(stepIndex, e.target.value)}
          placeholder={step.placeholder ?? 'Your answer...'}
          rows={3}
          className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm resize-none focus:outline-none focus:border-primary/60 text-foreground placeholder:text-muted-foreground"
        />
      )}

      {(step.type === 'choice' || step.type === 'multi-choice') && step.options && (
        <div className="space-y-2">
          {step.options.map((opt) => {
            const isSelected = step.type === 'multi-choice'
              ? Array.isArray(current) && (current as string[]).includes(opt.id)
              : current === opt.id;
            return (
              <button
                key={opt.id}
                type="button"
                onClick={() => {
                  if (step.type === 'multi-choice') {
                    const prev = (Array.isArray(current) ? current : []) as string[];
                    setAnswer(stepIndex, isSelected
                      ? prev.filter(id => id !== opt.id)
                      : [...prev, opt.id]);
                  } else {
                    setAnswer(stepIndex, opt.id);
                  }
                }}
                className={cn(
                  "w-full text-left rounded-lg border px-3 py-2.5 text-sm transition-all",
                  isSelected
                    ? "border-primary/60 bg-primary/10 text-foreground"
                    : "border-border bg-background text-foreground hover:border-primary/30 hover:bg-muted/50"
                )}
              >
                <div className="font-medium">{opt.label}</div>
                {opt.description && (
                  <div className="text-xs text-muted-foreground mt-0.5">{opt.description}</div>
                )}
              </button>
            );
          })}
        </div>
      )}

      {step.type === 'rating' && (
        <div className="flex items-center gap-2">
          {[1, 2, 3, 4, 5].map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => setAnswer(stepIndex, n)}
              className={cn(
                "size-10  rounded-lg border text-sm font-medium transition-all",
                current === n
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border bg-background text-foreground hover:border-primary/40"
              )}
            >
              {n}
            </button>
          ))}
          <span className="text-xs text-muted-foreground ml-1">/ 5</span>
        </div>
      )}

      {step.type === 'confirm' && (
        <div className="flex gap-2">
          {(['Yes', 'No'] as const).map((label) => (
            <button
              key={label}
              type="button"
              onClick={() => setAnswer(stepIndex, label === 'Yes')}
              className={cn(
                "flex-1 rounded-lg border py-2.5 text-sm font-medium transition-all",
                current === (label === 'Yes')
                  ? "border-primary/60 bg-primary/10 text-foreground"
                  : "border-border bg-background text-foreground hover:border-primary/30"
              )}
            >
              {label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Navigation ───────────────────────────────────────────────────────────────

function LeveeNavigation({ onComplete }: { onComplete: () => void }) {
  const { step, totalSteps, setStep } = useLeveeWizard();
  const isLast = step === totalSteps - 1;

  return (
    <div className="flex items-center justify-between px-6 py-4 border-t border-border bg-muted/20">
      <button
        type="button"
        disabled={step === 0}
        onClick={() => setStep(step - 1)}
        className="inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-xs font-medium text-muted-foreground hover:bg-muted disabled:opacity-30 transition-colors"
      >
        <CaretLeft className="size-3 " />
        Back
      </button>
      <button
        type="button"
        onClick={() => (isLast ? onComplete() : setStep(step + 1))}
        className="inline-flex items-center gap-1.5 rounded-full bg-primary px-4 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
      >
        {isLast ? (
          <>Submit <Check className="size-3 " /></>
        ) : (
          <>Next <CaretRight className="size-3 " /></>
        )}
      </button>
    </div>
  );
}
