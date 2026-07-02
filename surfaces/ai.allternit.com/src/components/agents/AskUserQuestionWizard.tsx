import React, { useCallback, useReducer, useState } from "react";
import {
  Question as HelpCircle,
  CaretRight,
  CaretLeft,
  Check,
  Info,
  Warning,
  Code,
  Sparkle,
  PencilSimple,
  X,
  CheckCircle,
  Image as ImageIcon,
} from '@phosphor-icons/react';
import { cn } from "@/lib/utils";
// ============================================================================
// Types
// ============================================================================

type QuestionInputType = 
  | "text" 
  | "textarea" 
  | "number" 
  | "select" 
  | "multi-select" 
  | "confirm" 
  | "password"
  | "slider"
  | "radio-card";

interface QuestionAnnotation {
  type: "info" | "warning" | "tip" | "example";
  content: string;
  title?: string;
}

interface QuestionOptionPreview {
  type: "image" | "code" | "text" | "component";
  content: string;
  language?: string; // for code
  caption?: string;
}

interface QuestionOption {
  id: string;
  label: string;
  description?: string;
  value: string;
  preview?: QuestionOptionPreview;
  annotations?: QuestionAnnotation[];
  disabled?: boolean;
  disabledReason?: string;
}

interface WizardStep {
  id: string;
  title: string;
  description?: string;
  question: string;
  type: QuestionInputType;
  options?: QuestionOption[];
  placeholder?: string;
  defaultValue?: unknown;
  validation?: {
    required?: boolean;
    minLength?: number;
    maxLength?: number;
    min?: number;
    max?: number;
    pattern?: string;
    customMessage?: string;
  };
  annotations?: QuestionAnnotation[];
  helpText?: string;
  allowSkip?: boolean;
}

interface WizardConfig {
  id: string;
  title: string;
  description?: string;
  steps: WizardStep[];
  allowReview?: boolean;
  accentColor?: string;
  onComplete: (answers: Record<string, unknown>) => void;
  onCancel?: () => void;
  onStepChange?: (stepIndex: number, answers: Record<string, unknown>) => void;
}

interface WizardState {
  currentStepIndex: number;
  answers: Record<string, unknown>;
  isReviewing: boolean;
  isComplete: boolean;
  editingStep: number | null;
}

type WizardAction =
  | { type: 'SET_ANSWER'; stepId: string; value: unknown }
  | { type: 'NEXT_STEP'; isLastStep: boolean; allowReview: boolean }
  | { type: 'PREVIOUS_STEP'; isFirstStep: boolean }
  | { type: 'EDIT_STEP'; index: number }
  | { type: 'SUBMIT' }
  | { type: 'CANCEL_REVIEW' }
  | { type: 'CANCEL_EDIT' };

function wizardReducer(state: WizardState, action: WizardAction): WizardState {
  switch (action.type) {
    case 'SET_ANSWER':
      return {
        ...state,
        answers: { ...state.answers, [action.stepId]: action.value }
      };
    case 'NEXT_STEP':
      if (action.isLastStep) {
        return action.allowReview 
          ? { ...state, isReviewing: true }
          : { ...state, isComplete: true };
      }
      return {
        ...state,
        currentStepIndex: state.currentStepIndex + 1
      };
    case 'PREVIOUS_STEP':
      if (state.isReviewing) return { ...state, isReviewing: false };
      if (state.editingStep !== null) return { ...state, editingStep: null };
      if (!action.isFirstStep) return { ...state, currentStepIndex: state.currentStepIndex - 1 };
      return state;
    case 'EDIT_STEP':
      return {
        ...state,
        editingStep: action.index,
        isReviewing: false,
        currentStepIndex: action.index
      };
    case 'SUBMIT':
      return { ...state, isComplete: true };
    case 'CANCEL_REVIEW':
      return { ...state, isReviewing: false };
    case 'CANCEL_EDIT':
      return { ...state, editingStep: null };
    default:
      return state;
  }
}

// ============================================================================
// Main Wizard Component
// ============================================================================

function AskUserQuestionWizard({
  config,
}: {
  config: WizardConfig;
}) {
  const {
    title,
    description,
    steps,
    allowReview = true,
    accentColor = "#D4956A",
    onComplete,
    onCancel,
    onStepChange,
  } = config;

  const [state, dispatch] = useReducer(wizardReducer, {
    currentStepIndex: 0,
    answers: {},
    isReviewing: false,
    isComplete: false,
    editingStep: null,
  });

  const { currentStepIndex, answers, isReviewing, isComplete, editingStep } = state;

  const currentStep = steps[currentStepIndex];
  const progress = ((currentStepIndex + 1) / steps.length) * 100;
  const isFirstStep = currentStepIndex === 0;
  const isLastStep = currentStepIndex === steps.length - 1;

  const handleAnswer = useCallback((stepId: string, value: unknown) => {
    dispatch({ type: 'SET_ANSWER', stepId, value });
  }, []);

  const handleNext = useCallback(() => {
    dispatch({ type: 'NEXT_STEP', isLastStep, allowReview });
    if (isLastStep && !allowReview) {
      onComplete(answers);
    } else if (!isLastStep) {
      onStepChange?.(currentStepIndex + 1, answers);
    }
  }, [isLastStep, allowReview, currentStepIndex, answers, onComplete, onStepChange]);

  const handleBack = useCallback(() => {
    dispatch({ type: 'PREVIOUS_STEP', isFirstStep });
  }, [isFirstStep]);

  const handleSkip = useCallback(() => {
    handleAnswer(currentStep.id, null);
    handleNext();
  }, [currentStep.id, handleAnswer, handleNext]);

  const handleEditStep = useCallback((index: number) => {
    dispatch({ type: 'EDIT_STEP', index });
  }, []);

  const handleSubmit = useCallback(() => {
    dispatch({ type: 'SUBMIT' });
    onComplete(answers);
  }, [answers, onComplete]);

  if (isComplete) {
    return <CompletionView title={title} accentColor={accentColor} onClose={() => onCancel?.()} />;
  }

  if (isReviewing) {
    return (
      <ReviewView
        steps={steps}
        answers={answers}
        accentColor={accentColor}
        onEdit={handleEditStep}
        onBack={handleBack}
        onSubmit={handleSubmit}
      />
    );
  }

  return (
    <div
      className="w-full max-w-[640px] rounded-[20px] border border-solid overflow-hidden"
      style={{
        borderColor: `${accentColor}4d`, // 30% opacity
        background: "linear-gradient(180deg, #2B2520 0%, #1a1714 100%)",
        boxShadow: `0 28px 100px var(--shell-overlay-backdrop), 0 0 0 1px ${accentColor}33`, // 20% opacity
      }}
    >
      {/* Header */}
      <WizardHeader
        title={title}
        description={description}
        progress={progress}
        stepNumber={currentStepIndex + 1}
        totalSteps={steps.length}
        accentColor={accentColor}
        onClose={onCancel}
      />

      {/* Step Content */}
      <div className="p-5 px-6">
        <StepContent
          step={currentStep}
          value={answers[currentStep.id]}
          onChange={(value) => handleAnswer(currentStep.id, value)}
          accentColor={accentColor}
        />
      </div>

      {/* Footer */}
      <WizardFooter
        isFirstStep={isFirstStep}
        isLastStep={isLastStep}
        canProceed={canProceed(currentStep, answers[currentStep.id])}
        allowSkip={currentStep.allowSkip}
        accentColor={accentColor}
        onBack={handleBack}
        onNext={handleNext}
        onSkip={handleSkip}
      />
    </div>
  );
}

// ============================================================================
// Sub-Components
// ============================================================================

function WizardHeader({
  title,
  description,
  progress,
  stepNumber,
  totalSteps,
  accentColor,
  onClose,
}: {
  title: string;
  description?: string;
  progress: number;
  stepNumber: number;
  totalSteps: number;
  accentColor: string;
  onClose?: () => void;
}) {
  return (
    <div
      className="p-5 px-6 border-b border-solid border-[var(--ui-border-muted)]"
      style={{
        background: `linear-gradient(90deg, ${accentColor}14, transparent)`, // ~8% opacity
      }}
    >
      <div className="flex justify-between items-start">
        <div>
          <div className="text-[12px] font-semibold uppercase tracking-[0.08em] mb-1" style={{ color: accentColor }}>
            Step {stepNumber} of {totalSteps}
          </div>
          <h2 className="m-0 text-[18px] font-semibold text-[#f6eee7]">{title}</h2>
          {description && (
            <p className="m-0 mt-1.5 text-[13px] text-[#a8998c] leading-relaxed">{description}</p>
          )}
        </div>
        {onClose && (
          <button type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg border-none bg-transparent text-[#7a6b5d] cursor-pointer hover:bg-white/5 transition-colors"
          >
            <X size={18} />
          </button>
        )}
      </div>

      {/* Progress Bar */}
      <div className="mt-4 h-1 bg-[var(--ui-border-muted)] rounded-full">
        <div
          className="h-full rounded-full transition-all duration-300"
          style={{
            width: `${progress}%`,
            background: accentColor,
          }}
        />
      </div>
    </div>
  );
}

function StepContent({
  step,
  value,
  onChange,
  accentColor,
}: {
  step: WizardStep;
  value: unknown;
  onChange: (value: unknown) => void;
  accentColor: string;
}) {
  return (
    <div>
      {/* Question */}
      <div className="mb-4">
        <div className="flex items-start gap-2.5 mb-2">
          <div
            className="size-8 rounded-[10px] flex items-center justify-center shrink-0"
            style={{ background: `${accentColor}33` }} // 20% opacity
          >
            <HelpCircle size={16} style={{ color: accentColor }} />
          </div>
          <div>
            <h3 className="m-0 text-[15px] font-semibold text-[#f6eee7] leading-snug">
              {step.question}
            </h3>
            {step.description && (
              <p className="m-0 mt-1.5 text-[13px] text-[#a8998c]">{step.description}</p>
            )}
          </div>
        </div>
      </div>

      {/* Annotations */}
      {step.annotations && step.annotations.length > 0 && (
        <div className="mb-4 flex flex-col gap-2">
          {step.annotations.map((annotation, index) => (
            <Annotation key={`step-ann-${annotation.type}-${index}`} annotation={annotation} />
          ))}
        </div>
      )}

      {/* Input */}
      <div className="mb-4">
        <QuestionInput step={step} value={value} onChange={onChange} accentColor={accentColor} />
      </div>

      {/* Help Text */}
      {step.helpText && (
        <div
          className="flex items-center gap-1.5 p-2.5 rounded-lg bg-[var(--surface-hover)] text-[12px] text-[#7a6b5d]"
        >
          <Info size={14} />
          {step.helpText}
        </div>
      )}
    </div>
  );
}

function QuestionInput({
  step,
  value,
  onChange,
  accentColor,
}: {
  step: WizardStep;
  value: unknown;
  onChange: (value: unknown) => void;
  accentColor: string;
}) {
  const inputBaseClass = "w-full p-[12px_14px] rounded-[10px] border border-solid bg-[var(--surface-panel)] text-[#f6eee7] text-[14px] outline-none transition-colors focus:border-[var(--ui-border-active)]";

  switch (step.type) {
    case "text":
    case "password":
      return (
        <input aria-label="Input" type={step.type}
          value={(value as string) || ""}
          onChange={(e) => onChange(e.target.value)}
          placeholder={step.placeholder}
          className={inputBaseClass}
          style={{ borderColor: `${accentColor}66` }} // 40% opacity
        />
      );

    case "textarea":
      return (
        <textarea aria-label="Text Area" value={(value as string) || ""}
          onChange={(e) => onChange(e.target.value)}
          placeholder={step.placeholder}
          rows={4}
          className={cn(inputBaseClass, "resize-y font-inherit")}
          style={{ borderColor: `${accentColor}66` }} // 40% opacity
        />
      );

    case "number":
      return (
        <input aria-label="Input" type="number"
          value={(value as number) ?? ""}
          onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
          placeholder={step.placeholder}
          min={step.validation?.min}
          max={step.validation?.max}
          className={inputBaseClass}
          style={{ borderColor: `${accentColor}66` }} // 40% opacity
        />
      );

    case "select":
      return (
        <div className="flex flex-col gap-2.5">
          {step.options?.map((option) => (
            <SelectOption
              key={option.id}
              option={option}
              selected={value === option.value}
              onSelect={() => onChange(option.value)}
              accentColor={accentColor}
            />
          ))}
        </div>
      );

    case "multi-select":
      const selectedValues = (value as string[]) || [];
      return (
        <div className="flex flex-col gap-2.5">
          {step.options?.map((option) => (
            <MultiSelectOption
              key={option.id}
              option={option}
              selected={selectedValues.includes(option.value)}
              onToggle={() => {
                if (selectedValues.includes(option.value)) {
                  onChange(selectedValues.filter((v) => v !== option.value));
                } else {
                  onChange([...selectedValues, option.value]);
                }
              }}
              accentColor={accentColor}
            />
          ))}
        </div>
      );

    case "confirm":
      return (
        <div className="flex gap-3">
          <button type="button"
            onClick={() => onChange(true)}
            className={cn(
              "flex-1 flex items-center justify-center gap-2 p-[14px_20px] rounded-[10px] border border-solid text-[14px] font-semibold cursor-pointer transition-all",
              value === true ? "bg-[rgba(121,196,124,0.15)] border-[#79C47C] text-[#79C47C]" : "bg-[var(--surface-hover)] border-[var(--ui-border-default)] text-[#a8998c]"
            )}
          >
            <Check size={18} />
            Yes
          </button>
          <button type="button"
            onClick={() => onChange(false)}
            className={cn(
              "flex-1 flex items-center justify-center gap-2 p-[14px_20px] rounded-[10px] border border-solid text-[14px] font-semibold cursor-pointer transition-all",
              value === false ? "bg-[var(--status-error-bg)] border-[#ef4444] text-[#ef4444]" : "bg-[var(--surface-hover)] border-[var(--ui-border-default)] text-[#a8998c]"
            )}
          >
            <X size={18} />
            No
          </button>
        </div>
      );

    default:
      return null;
  }
}

function SelectOption({
  option,
  selected,
  onSelect,
  accentColor,
}: {
  option: QuestionOption;
  selected: boolean;
  onSelect: () => void;
  accentColor: string;
}) {
  const [showPreview, setShowPreview] = useState(false);

  return (
    <div>
      <button type="button"
        onClick={onSelect}
        disabled={option.disabled}
        className={cn(
          "w-full flex items-start gap-3 p-3.5 rounded-xl border border-solid text-left transition-all",
          selected ? "bg-[var(--accent-glow)] border-[var(--accent-color)]" : option.disabled ? "bg-black/10 border-[var(--surface-hover)] cursor-not-allowed opacity-50" : "bg-[var(--surface-hover)] border-[var(--ui-border-muted)] cursor-pointer"
        )}
        style={{
          '--accent-glow': `${accentColor}1a`, // 10% opacity
          '--accent-color': accentColor,
        } as React.CSSProperties}
      >
        <div
          className="size-5 rounded-full border-2 border-solid flex items-center justify-center shrink-0 mt-0.5 transition-colors"
          style={{
            borderColor: selected ? accentColor : "#666",
            background: selected ? accentColor : "transparent",
          }}
        >
          {selected && <div className="size-2 rounded-full bg-[#1a1714]" />}
        </div>

        <div className="flex-1 min-w-0">
          <div className={cn("text-[14px] font-semibold truncate", selected ? "text-[#f6eee7]" : "text-[#d1c3b4]")}>
            {option.label}
          </div>
          {option.description && (
            <div className="text-[12px] text-[#7a6b5d] mt-0.5 leading-snug">{option.description}</div>
          )}
          {option.disabled && option.disabledReason && (
            <div className="text-[12px] text-[#ef4444] mt-1">{option.disabledReason}</div>
          )}

          {/* Option Annotations */}
          {option.annotations && option.annotations.length > 0 && (
            <div className="mt-2 flex flex-col gap-1.5">
              {option.annotations.map((annotation, index) => (
                <MiniAnnotation key={`opt-ann-${annotation.type}-${index}`} annotation={annotation} />
              ))}
            </div>
          )}
        </div>

        {/* Preview Toggle */}
        {option.preview && (
          <button type="button"
            onClick={(e) => {
              e.stopPropagation();
              setShowPreview(!showPreview);
            }}
            className="flex items-center gap-1 p-1 px-2 rounded-md border-none bg-[var(--surface-hover)] text-[#7a6b5d] text-[12px] cursor-pointer hover:bg-[var(--surface-active)] transition-colors"
          >
            <ImageIcon size={12} />
            {showPreview ? "Hide" : "Preview"}
          </button>
        )}
      </button>

      {/* Preview Panel */}
      {showPreview && option.preview && (
        <OptionPreview preview={option.preview} />
      )}
    </div>
  );
}

function MultiSelectOption({
  option,
  selected,
  onToggle,
  accentColor,
}: {
  option: QuestionOption;
  selected: boolean;
  onToggle: () => void;
  accentColor: string;
}) {
  return (
    <button type="button"
      onClick={onToggle}
      disabled={option.disabled}
      className={cn(
        "w-full flex items-start gap-3 p-3 rounded-[10px] border border-solid text-left transition-all",
        selected ? "bg-[var(--accent-glow)] border-[var(--accent-color)]" : option.disabled ? "bg-black/10 border-[var(--surface-hover)] cursor-not-allowed opacity-50" : "bg-[var(--surface-hover)] border-[var(--ui-border-muted)] cursor-pointer"
      )}
      style={{
        '--accent-glow': `${accentColor}1a`, // 10% opacity
        '--accent-color': accentColor,
      } as React.CSSProperties}
    >
      <div
        className="size-[18px] rounded border-2 border-solid flex items-center justify-center shrink-0 mt-0.5 transition-colors"
        style={{
          borderColor: selected ? accentColor : "#666",
          background: selected ? accentColor : "transparent",
        }}
      >
        {selected && <Check size={12} className="text-[#1a1714]" />}
      </div>

      <div className="flex-1 min-w-0">
        <div className={cn("text-[13px] font-medium truncate", selected ? "text-[#f6eee7]" : "text-[#d1c3b4]")}>
          {option.label}
        </div>
        {option.description && (
          <div className="text-[12px] text-[#7a6b5d] mt-0.5 leading-snug">{option.description}</div>
        )}
      </div>
    </button>
  );
}

function OptionPreview({ preview }: { preview: QuestionOptionPreview }) {
  return (
    <div
      className="mt-2 ml-8 p-3 rounded-[10px] bg-[var(--surface-panel)] border border-solid border-[var(--ui-border-muted)]"
    >
      {preview.type === "code" && (
        <pre
          className="m-0 p-2.5 rounded-md bg-black/40 text-[12px] font-mono text-[#d1c3b4] overflow-auto"
        >
          <code>{preview.content}</code>
        </pre>
      )}

      {preview.type === "text" && (
        <div className="text-[12px] text-[#a8998c] leading-relaxed">{preview.content}</div>
      )}

      {preview.type === "image" && (
        <div>
          <img
            src={preview.content}
            alt={preview.caption || "Preview"}
            className="max-w-full rounded-md block"
          />
          {preview.caption && (
            <div className="mt-2 text-[12px] text-[#7a6b5d] text-center">
              {preview.caption}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function Annotation({ annotation }: { annotation: QuestionAnnotation }) {
  const types = {
    info: { bg: "bg-[rgba(105,168,200,0.1)]", border: "border-[rgba(105,168,200,0.3)]", iconColor: "text-[#69A8C8]", Icon: Info },
    warning: { bg: "bg-[rgba(244,162,97,0.1)]", border: "border-[rgba(244,162,97,0.3)]", iconColor: "text-[#f4a261]", Icon: Warning },
    tip: { bg: "bg-[rgba(121,196,124,0.1)]", border: "border-[rgba(121,196,124,0.3)]", iconColor: "text-[#79C47C]", Icon: Sparkle },
    example: { bg: "bg-[rgba(167,139,250,0.1)]", border: "border-[rgba(167,139,250,0.3)]", iconColor: "text-[#A78BFA]", Icon: Code },
  };

  const { bg, border, iconColor, Icon } = types[annotation.type];

  return (
    <div className={cn("flex gap-2.5 p-3 rounded-[10px] border border-solid", bg, border)}>
      <div className={cn("shrink-0 mt-0.5", iconColor)}>
        <Icon size={16} />
      </div>
      <div>
        {annotation.title && (
          <div className={cn("text-[12px] font-semibold mb-0.5", iconColor)}>
            {annotation.title}
          </div>
        )}
        <div className="text-[12px] text-[#d1c3b4] leading-relaxed">{annotation.content}</div>
      </div>
    </div>
  );
}

function MiniAnnotation({ annotation }: { annotation: QuestionAnnotation }) {
  const colors = {
    info: "text-[#69A8C8]",
    warning: "text-[#f4a261]",
    tip: "text-[#79C47C]",
    example: "text-[#A78BFA]",
  };

  const Icons = { info: Info, warning: Warning, tip: Sparkle, example: Code };
  const Icon = Icons[annotation.type];

  return (
    <div className={cn("flex items-center gap-1.5 text-[12px]", colors[annotation.type])}>
      <Icon size={12} />
      <span>{annotation.content}</span>
    </div>
  );
}

function WizardFooter({
  isFirstStep,
  isLastStep,
  canProceed,
  allowSkip,
  accentColor,
  onBack,
  onNext,
  onSkip,
}: {
  isFirstStep: boolean;
  isLastStep: boolean;
  canProceed: boolean;
  allowSkip?: boolean;
  accentColor: string;
  onBack: () => void;
  onNext: () => void;
  onSkip: () => void;
}) {
  return (
    <div
      className="flex justify-between items-center p-4 px-6 pb-5 border-t border-solid border-[var(--ui-border-muted)]"
    >
      <button type="button"
        onClick={onBack}
        disabled={isFirstStep}
        className={cn(
          "flex items-center gap-1.5 p-2.5 px-4 rounded-[10px] border border-solid border-[var(--ui-border-default)] bg-transparent text-[13px] font-semibold transition-colors",
          isFirstStep ? "text-[#4a4a4a] cursor-not-allowed" : "text-[#d1c3b4] cursor-pointer hover:bg-white/5"
        )}
      >
        <CaretLeft size={16} />
        Back
      </button>

      <div className="flex gap-2.5">
        {allowSkip && (
          <button type="button"
            onClick={onSkip}
            className="p-2.5 px-4 rounded-[10px] border border-solid border-[var(--ui-border-default)] bg-transparent text-[#7a6b5d] text-[13px] font-semibold cursor-pointer hover:bg-white/5 transition-colors"
          >
            Skip
          </button>
        )}

        <button type="button"
          onClick={onNext}
          disabled={!canProceed}
          className={cn(
            "flex items-center gap-1.5 p-2.5 px-5 rounded-[10px] border border-solid text-[#1a1714] text-[13px] font-bold transition-all",
            canProceed ? "cursor-pointer hover:opacity-90" : "cursor-not-allowed opacity-50"
          )}
          style={{ borderColor: accentColor, background: accentColor }}
        >
          {isLastStep ? "Review" : "Next"}
          {!isLastStep && <CaretRight size={16} />}
        </button>
      </div>
    </div>
  );
}

function ReviewView({
  steps,
  answers,
  accentColor,
  onEdit,
  onBack,
  onSubmit,
}: {
  steps: WizardStep[];
  answers: Record<string, unknown>;
  accentColor: string;
  onEdit: (index: number) => void;
  onBack: () => void;
  onSubmit: () => void;
}) {
  return (
    <div
      className="w-full max-w-[640px] rounded-[20px] border border-solid overflow-hidden"
      style={{
        borderColor: `${accentColor}4d`, // 30% opacity
        background: "linear-gradient(180deg, #2B2520 0%, #1a1714 100%)",
        boxShadow: `0 28px 100px var(--shell-overlay-backdrop), 0 0 0 1px ${accentColor}33`, // 20% opacity
      }}
    >
      <div
        className="p-5 px-6 border-b border-solid border-[var(--ui-border-muted)]"
        style={{
          background: `linear-gradient(90deg, ${accentColor}14, transparent)`, // ~8% opacity
        }}
      >
        <div className="text-[12px] font-bold uppercase tracking-[0.08em] mb-1" style={{ color: accentColor }}>
          Review Your Answers
        </div>
        <h2 className="m-0 text-[18px] font-bold text-[#f6eee7]">Almost Done!</h2>
        <p className="m-0 mt-1.5 text-[13px] text-[#a8998c]">Review your answers before submitting</p>
      </div>

      <div className="p-5 px-6 max-h-[400px] overflow-y-auto">
        <div className="flex flex-col gap-4">
          {steps.map((step, index) => (
            <div key={step.id} className="flex gap-3 items-start">
              <div
                className="size-7 rounded-full flex items-center justify-center shrink-0 text-[12px] font-bold"
                style={{ background: `${accentColor}33`, color: accentColor }}
              >
                {index + 1}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-[12px] text-[#7a6b5d] mb-0.5">{step.title}</div>
                <div className="text-[14px] font-medium text-[#f6eee7] mb-1">
                  {step.question}
                </div>
                <div
                  className="p-2 px-3 rounded-lg bg-[var(--surface-panel)] text-[13px] text-[#d1c3b4] leading-normal"
                >
                  {formatAnswer(answers[step.id], step)}
                </div>
              </div>
              <button type="button"
                onClick={() => onEdit(index)}
                className="p-1.5 px-2.5 rounded-md border-none bg-[var(--surface-hover)] text-[#7a6b5d] text-[12px] cursor-pointer flex items-center gap-1 hover:bg-[var(--surface-active)] hover:text-[#a8998c] transition-colors"
              >
                <PencilSimple size={12} />
                Edit
              </button>
            </div>
          ))}
        </div>
      </div>

      <div
        className="flex justify-between p-4 px-6 pb-5 border-t border-solid border-[var(--ui-border-muted)]"
      >
        <button type="button"
          onClick={onBack}
          className="flex items-center gap-1.5 p-2.5 px-4 rounded-[10px] border border-solid border-[var(--ui-border-default)] bg-transparent text-[#d1c3b4] text-[13px] font-semibold cursor-pointer hover:bg-white/5 transition-colors"
        >
          <CaretLeft size={16} />
          Back
        </button>

        <button type="button"
          onClick={onSubmit}
          className="flex items-center gap-1.5 p-2.5 px-6 rounded-[10px] border border-solid text-[#1a1714] text-[13px] font-bold cursor-pointer hover:opacity-90 transition-all"
          style={{ borderColor: accentColor, background: accentColor }}
        >
          <Check size={16} />
          Submit
        </button>
      </div>
    </div>
  );
}

function CompletionView({
  title,
  accentColor,
  onClose,
}: {
  title: string;
  accentColor: string;
  onClose?: () => void;
}) {
  return (
    <div
      className="w-full max-w-[400px] rounded-[20px] border border-solid p-10 text-center"
      style={{
        borderColor: `${accentColor}4d`,
        background: "linear-gradient(180deg, #2B2520 0%, #1a1714 100%)",
      }}
    >
      <div
        className="size-16 rounded-full flex items-center justify-center mx-auto mb-5"
        style={{ background: `${accentColor}33` }}
      >
        <CheckCircle size={32} style={{ color: accentColor }} />
      </div>

      <h2 className="m-0 mb-2 text-[20px] font-bold text-[#f6eee7]">All Set!</h2>
      <p className="m-0 text-[14px] text-[#a8998c] leading-relaxed">
        Your responses for "{title}" have been recorded.
      </p>

      {onClose && (
        <button type="button"
          onClick={onClose}
          className="mt-6 p-3 px-6 rounded-[10px] border border-solid text-[#1a1714] text-[14px] font-bold cursor-pointer hover:opacity-90 transition-all"
          style={{ borderColor: accentColor, background: accentColor }}
        >
          Done
        </button>
      )}
    </div>
  );
}

// ============================================================================
// Helpers
// ============================================================================

function canProceed(step: WizardStep, value: unknown): boolean {
  if (!step.validation?.required) return true;

  if (value === undefined || value === null) return false;
  if (typeof value === "string" && value.trim() === "") return false;
  if (Array.isArray(value) && value.length === 0) return false;

  return true;
}

function formatAnswer(value: unknown, step: WizardStep): string {
  if (value === undefined || value === null) return "Not answered";

  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (typeof value === "string") {
    if (value.length > 100) return value.slice(0, 100) + "…";
    return value;
  }
  if (typeof value === "number") return String(value);

  if (Array.isArray(value)) {
    if (value.length === 0) return "None selected";
    const labels = value
      .map((v) => step.options?.find((o) => o.value === v)?.label || v)
      .join(", ");
    if (labels.length > 100) return labels.slice(0, 100) + "…";
    return labels;
  }

  return String(value);
}

export default AskUserQuestionWizard;
