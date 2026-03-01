/**
 * Ask User Question Wizard
 * 
 * An enhanced multi-step question system with:
 * - Visual previews of options
 * - Annotations and explanations
 * - Step-by-step guided flows
 * - Rich media support (images, code samples)
 * - Progress tracking
 * - Review and edit before submit
 */

import React, { useState, useCallback } from "react";
import {
  HelpCircle,
  ChevronRight,
  ChevronLeft,
  Check,
  Info,
  AlertCircle,
  Image as ImageIcon,
  Code,
  FileText,
  Sparkles,
  Edit3,
  X,
  CheckCircle2,
  RotateCcw,
} from "lucide-react";

// ============================================================================
// Types
// ============================================================================

export type QuestionInputType = 
  | "text" 
  | "textarea" 
  | "number" 
  | "select" 
  | "multi-select" 
  | "confirm" 
  | "password"
  | "slider"
  | "radio-card";

export interface QuestionAnnotation {
  type: "info" | "warning" | "tip" | "example";
  content: string;
  title?: string;
}

export interface QuestionOptionPreview {
  type: "image" | "code" | "text" | "component";
  content: string;
  language?: string; // for code
  caption?: string;
}

export interface QuestionOption {
  id: string;
  label: string;
  description?: string;
  value: string;
  preview?: QuestionOptionPreview;
  annotations?: QuestionAnnotation[];
  disabled?: boolean;
  disabledReason?: string;
}

export interface WizardStep {
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

export interface WizardConfig {
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

// ============================================================================
// Main Wizard Component
// ============================================================================

export function AskUserQuestionWizard({
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

  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, unknown>>({});
  const [isReviewing, setIsReviewing] = useState(false);
  const [isComplete, setIsComplete] = useState(false);
  const [editingStep, setEditingStep] = useState<number | null>(null);

  const currentStep = steps[currentStepIndex];
  const progress = ((currentStepIndex + 1) / steps.length) * 100;
  const isFirstStep = currentStepIndex === 0;
  const isLastStep = currentStepIndex === steps.length - 1;

  const handleAnswer = useCallback((stepId: string, value: unknown) => {
    setAnswers((prev) => ({ ...prev, [stepId]: value }));
  }, []);

  const handleNext = useCallback(() => {
    if (isLastStep) {
      if (allowReview) {
        setIsReviewing(true);
      } else {
        setIsComplete(true);
        onComplete(answers);
      }
    } else {
      const nextIndex = currentStepIndex + 1;
      setCurrentStepIndex(nextIndex);
      onStepChange?.(nextIndex, answers);
    }
  }, [isLastStep, allowReview, currentStepIndex, answers, onComplete, onStepChange]);

  const handleBack = useCallback(() => {
    if (isReviewing) {
      setIsReviewing(false);
    } else if (editingStep !== null) {
      setEditingStep(null);
    } else if (!isFirstStep) {
      setCurrentStepIndex(currentStepIndex - 1);
    }
  }, [isReviewing, editingStep, isFirstStep, currentStepIndex]);

  const handleSkip = useCallback(() => {
    handleAnswer(currentStep.id, null);
    handleNext();
  }, [currentStep.id, handleAnswer, handleNext]);

  const handleEditStep = useCallback((index: number) => {
    setEditingStep(index);
    setIsReviewing(false);
    setCurrentStepIndex(index);
  }, []);

  const handleSubmit = useCallback(() => {
    setIsComplete(true);
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
      style={{
        borderRadius: 20,
        border: `1px solid ${accentColor}30`,
        background: "linear-gradient(180deg, #2B2520 0%, #1a1714 100%)",
        overflow: "hidden",
        boxShadow: `0 28px 100px rgba(0,0,0,0.5), 0 0 0 1px ${accentColor}20`,
        maxWidth: 640,
        width: "100%",
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
      <div style={{ padding: "20px 24px" }}>
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
      style={{
        padding: "20px 24px",
        borderBottom: "1px solid rgba(255,255,255,0.06)",
        background: `linear-gradient(90deg, ${accentColor}08, transparent)`,
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div>
          <div style={{ fontSize: 11, color: accentColor, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 4 }}>
            Step {stepNumber} of {totalSteps}
          </div>
          <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: "#f6eee7" }}>{title}</h2>
          {description && (
            <p style={{ margin: "6px 0 0", fontSize: 13, color: "#a8998c", lineHeight: 1.5 }}>{description}</p>
          )}
        </div>
        {onClose && (
          <button
            onClick={onClose}
            style={{
              padding: 6,
              borderRadius: 8,
              border: "none",
              background: "transparent",
              color: "#7a6b5d",
              cursor: "pointer",
            }}
          >
            <X size={18} />
          </button>
        )}
      </div>

      {/* Progress Bar */}
      <div style={{ marginTop: 16, height: 4, background: "rgba(255,255,255,0.06)", borderRadius: 2 }}>
        <div
          style={{
            height: "100%",
            width: `${progress}%`,
            background: accentColor,
            borderRadius: 2,
            transition: "width 0.3s ease",
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
      <div style={{ marginBottom: 16 }}>
        <div style={{ display: "flex", alignItems: "flex-start", gap: 10, marginBottom: 8 }}>
          <div
            style={{
              width: 32,
              height: 32,
              borderRadius: 10,
              background: `${accentColor}20`,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: accentColor,
              flexShrink: 0,
            }}
          >
            <HelpCircle size={16} />
          </div>
          <div>
            <h3 style={{ margin: 0, fontSize: 15, fontWeight: 600, color: "#f6eee7", lineHeight: 1.4 }}>
              {step.question}
            </h3>
            {step.description && (
              <p style={{ margin: "6px 0 0", fontSize: 13, color: "#a8998c" }}>{step.description}</p>
            )}
          </div>
        </div>
      </div>

      {/* Annotations */}
      {step.annotations && step.annotations.length > 0 && (
        <div style={{ marginBottom: 16, display: "flex", flexDirection: "column", gap: 8 }}>
          {step.annotations.map((annotation, index) => (
            <Annotation key={index} annotation={annotation} />
          ))}
        </div>
      )}

      {/* Input */}
      <div style={{ marginBottom: 16 }}>
        <QuestionInput step={step} value={value} onChange={onChange} accentColor={accentColor} />
      </div>

      {/* Help Text */}
      {step.helpText && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            padding: 10,
            borderRadius: 8,
            background: "rgba(255,255,255,0.03)",
            fontSize: 12,
            color: "#7a6b5d",
          }}
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
  switch (step.type) {
    case "text":
    case "password":
      return (
        <input
          type={step.type}
          value={(value as string) || ""}
          onChange={(e) => onChange(e.target.value)}
          placeholder={step.placeholder}
          style={{
            width: "100%",
            padding: "12px 14px",
            borderRadius: 10,
            border: `1px solid ${accentColor}40`,
            background: "rgba(0,0,0,0.3)",
            color: "#f6eee7",
            fontSize: 14,
            outline: "none",
          }}
        />
      );

    case "textarea":
      return (
        <textarea
          value={(value as string) || ""}
          onChange={(e) => onChange(e.target.value)}
          placeholder={step.placeholder}
          rows={4}
          style={{
            width: "100%",
            padding: "12px 14px",
            borderRadius: 10,
            border: `1px solid ${accentColor}40`,
            background: "rgba(0,0,0,0.3)",
            color: "#f6eee7",
            fontSize: 14,
            outline: "none",
            resize: "vertical",
            fontFamily: "inherit",
          }}
        />
      );

    case "number":
      return (
        <input
          type="number"
          value={(value as number) ?? ""}
          onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
          placeholder={step.placeholder}
          min={step.validation?.min}
          max={step.validation?.max}
          style={{
            width: "100%",
            padding: "12px 14px",
            borderRadius: 10,
            border: `1px solid ${accentColor}40`,
            background: "rgba(0,0,0,0.3)",
            color: "#f6eee7",
            fontSize: 14,
            outline: "none",
          }}
        />
      );

    case "select":
      return (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
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
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
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
        <div style={{ display: "flex", gap: 12 }}>
          <button
            onClick={() => onChange(true)}
            style={{
              flex: 1,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
              padding: "14px 20px",
              borderRadius: 10,
              border: `1px solid ${value === true ? "#79C47C" : "rgba(255,255,255,0.1)"}`,
              background: value === true ? "rgba(121,196,124,0.15)" : "rgba(0,0,0,0.2)",
              color: value === true ? "#79C47C" : "#a8998c",
              fontSize: 14,
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            <Check size={18} />
            Yes
          </button>
          <button
            onClick={() => onChange(false)}
            style={{
              flex: 1,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
              padding: "14px 20px",
              borderRadius: 10,
              border: `1px solid ${value === false ? "#ef4444" : "rgba(255,255,255,0.1)"}`,
              background: value === false ? "rgba(239,68,68,0.15)" : "rgba(0,0,0,0.2)",
              color: value === false ? "#ef4444" : "#a8998c",
              fontSize: 14,
              fontWeight: 600,
              cursor: "pointer",
            }}
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
      <button
        onClick={onSelect}
        disabled={option.disabled}
        style={{
          width: "100%",
          display: "flex",
          alignItems: "flex-start",
          gap: 12,
          padding: 14,
          borderRadius: 12,
          border: `1px solid ${selected ? accentColor : option.disabled ? "rgba(255,255,255,0.05)" : "rgba(255,255,255,0.08)"}`,
          background: selected ? `${accentColor}10` : option.disabled ? "rgba(0,0,0,0.1)" : "rgba(0,0,0,0.2)",
          opacity: option.disabled ? 0.5 : 1,
          cursor: option.disabled ? "not-allowed" : "pointer",
          textAlign: "left",
        }}
      >
        <div
          style={{
            width: 20,
            height: 20,
            borderRadius: "50%",
            border: `2px solid ${selected ? accentColor : "#666"}`,
            background: selected ? accentColor : "transparent",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
            marginTop: 2,
          }}
        >
          {selected && <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#1a1714" }} />}
        </div>

        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: selected ? "#f6eee7" : "#d1c3b4" }}>
            {option.label}
          </div>
          {option.description && (
            <div style={{ fontSize: 12, color: "#7a6b5d", marginTop: 2 }}>{option.description}</div>
          )}
          {option.disabled && option.disabledReason && (
            <div style={{ fontSize: 11, color: "#ef4444", marginTop: 4 }}>{option.disabledReason}</div>
          )}

          {/* Option Annotations */}
          {option.annotations && option.annotations.length > 0 && (
            <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 6 }}>
              {option.annotations.map((annotation, index) => (
                <MiniAnnotation key={index} annotation={annotation} />
              ))}
            </div>
          )}
        </div>

        {/* Preview Toggle */}
        {option.preview && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              setShowPreview(!showPreview);
            }}
            style={{
              padding: "4px 8px",
              borderRadius: 6,
              border: "none",
              background: "rgba(255,255,255,0.05)",
              color: "#7a6b5d",
              fontSize: 11,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: 4,
            }}
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
    <button
      onClick={onToggle}
      disabled={option.disabled}
      style={{
        width: "100%",
        display: "flex",
        alignItems: "flex-start",
        gap: 12,
        padding: 12,
        borderRadius: 10,
        border: `1px solid ${selected ? accentColor : option.disabled ? "rgba(255,255,255,0.05)" : "rgba(255,255,255,0.08)"}`,
        background: selected ? `${accentColor}10` : option.disabled ? "rgba(0,0,0,0.1)" : "rgba(0,0,0,0.2)",
        opacity: option.disabled ? 0.5 : 1,
        cursor: option.disabled ? "not-allowed" : "pointer",
        textAlign: "left",
      }}
    >
      <div
        style={{
          width: 18,
          height: 18,
          borderRadius: 4,
          border: `2px solid ${selected ? accentColor : "#666"}`,
          background: selected ? accentColor : "transparent",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
          marginTop: 2,
        }}
      >
        {selected && <Check size={12} style={{ color: "#1a1714" }} />}
      </div>

      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 13, fontWeight: 500, color: selected ? "#f6eee7" : "#d1c3b4" }}>
          {option.label}
        </div>
        {option.description && (
          <div style={{ fontSize: 11, color: "#7a6b5d", marginTop: 1 }}>{option.description}</div>
        )}
      </div>
    </button>
  );
}

function OptionPreview({ preview }: { preview: QuestionOptionPreview }) {
  return (
    <div
      style={{
        marginTop: 8,
        marginLeft: 32,
        padding: 12,
        borderRadius: 10,
        background: "rgba(0,0,0,0.3)",
        border: "1px solid rgba(255,255,255,0.06)",
      }}
    >
      {preview.type === "code" && (
        <pre
          style={{
            margin: 0,
            padding: 10,
            borderRadius: 6,
            background: "rgba(0,0,0,0.4)",
            fontSize: 11,
            fontFamily: "monospace",
            color: "#d1c3b4",
            overflow: "auto",
          }}
        >
          <code>{preview.content}</code>
        </pre>
      )}

      {preview.type === "text" && (
        <div style={{ fontSize: 12, color: "#a8998c", lineHeight: 1.5 }}>{preview.content}</div>
      )}

      {preview.type === "image" && (
        <div>
          <img
            src={preview.content}
            alt={preview.caption || "Preview"}
            style={{
              maxWidth: "100%",
              borderRadius: 6,
              display: "block",
            }}
          />
          {preview.caption && (
            <div style={{ marginTop: 8, fontSize: 11, color: "#7a6b5d", textAlign: "center" }}>
              {preview.caption}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function Annotation({ annotation }: { annotation: QuestionAnnotation }) {
  const colors = {
    info: { bg: "rgba(105,168,200,0.1)", border: "rgba(105,168,200,0.3)", icon: "#69A8C8" },
    warning: { bg: "rgba(244,162,97,0.1)", border: "rgba(244,162,97,0.3)", icon: "#f4a261" },
    tip: { bg: "rgba(121,196,124,0.1)", border: "rgba(121,196,124,0.3)", icon: "#79C47C" },
    example: { bg: "rgba(167,139,250,0.1)", border: "rgba(167,139,250,0.3)", icon: "#A78BFA" },
  };

  const color = colors[annotation.type];

  return (
    <div
      style={{
        display: "flex",
        gap: 10,
        padding: 12,
        borderRadius: 10,
        background: color.bg,
        border: `1px solid ${color.border}`,
      }}
    >
      <div style={{ color: color.icon, flexShrink: 0, marginTop: 2 }}>
        {annotation.type === "info" && <Info size={16} />}
        {annotation.type === "warning" && <AlertCircle size={16} />}
        {annotation.type === "tip" && <Sparkles size={16} />}
        {annotation.type === "example" && <Code size={16} />}
      </div>
      <div>
        {annotation.title && (
          <div style={{ fontSize: 12, fontWeight: 600, color: color.icon, marginBottom: 2 }}>
            {annotation.title}
          </div>
        )}
        <div style={{ fontSize: 12, color: "#d1c3b4", lineHeight: 1.5 }}>{annotation.content}</div>
      </div>
    </div>
  );
}

function MiniAnnotation({ annotation }: { annotation: QuestionAnnotation }) {
  const colors = {
    info: "#69A8C8",
    warning: "#f4a261",
    tip: "#79C47C",
    example: "#A78BFA",
  };

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, color: colors[annotation.type] }}>
      {annotation.type === "info" && <Info size={12} />}
      {annotation.type === "warning" && <AlertCircle size={12} />}
      {annotation.type === "tip" && <Sparkles size={12} />}
      {annotation.type === "example" && <Code size={12} />}
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
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        padding: "16px 24px 20px",
        borderTop: "1px solid rgba(255,255,255,0.06)",
      }}
    >
      <button
        onClick={onBack}
        disabled={isFirstStep}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 6,
          padding: "10px 16px",
          borderRadius: 10,
          border: "1px solid rgba(255,255,255,0.1)",
          background: "transparent",
          color: isFirstStep ? "#4a4a4a" : "#d1c3b4",
          fontSize: 13,
          fontWeight: 600,
          cursor: isFirstStep ? "not-allowed" : "pointer",
        }}
      >
        <ChevronLeft size={16} />
        Back
      </button>

      <div style={{ display: "flex", gap: 10 }}>
        {allowSkip && (
          <button
            onClick={onSkip}
            style={{
              padding: "10px 16px",
              borderRadius: 10,
              border: "1px solid rgba(255,255,255,0.1)",
              background: "transparent",
              color: "#7a6b5d",
              fontSize: 13,
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            Skip
          </button>
        )}

        <button
          onClick={onNext}
          disabled={!canProceed}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            padding: "10px 20px",
            borderRadius: 10,
            border: `1px solid ${accentColor}`,
            background: accentColor,
            color: "#1a1714",
            fontSize: 13,
            fontWeight: 700,
            cursor: canProceed ? "pointer" : "not-allowed",
            opacity: canProceed ? 1 : 0.5,
          }}
        >
          {isLastStep ? "Review" : "Next"}
          {!isLastStep && <ChevronRight size={16} />}
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
      style={{
        borderRadius: 20,
        border: `1px solid ${accentColor}30`,
        background: "linear-gradient(180deg, #2B2520 0%, #1a1714 100%)",
        overflow: "hidden",
        boxShadow: `0 28px 100px rgba(0,0,0,0.5), 0 0 0 1px ${accentColor}20`,
        maxWidth: 640,
        width: "100%",
      }}
    >
      <div
        style={{
          padding: "20px 24px",
          borderBottom: "1px solid rgba(255,255,255,0.06)",
          background: `linear-gradient(90deg, ${accentColor}08, transparent)`,
        }}
      >
        <div style={{ fontSize: 11, color: accentColor, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 4 }}>
          Review Your Answers
        </div>
        <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: "#f6eee7" }}>Almost Done!</h2>
        <p style={{ margin: "6px 0 0", fontSize: 13, color: "#a8998c" }}>Review your answers before submitting</p>
      </div>

      <div style={{ padding: "20px 24px", maxHeight: 400, overflow: "auto" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {steps.map((step, index) => (
            <div key={step.id} style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
              <div
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: "50%",
                  background: `${accentColor}20`,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: accentColor,
                  fontSize: 12,
                  fontWeight: 700,
                  flexShrink: 0,
                }}
              >
                {index + 1}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 12, color: "#7a6b5d", marginBottom: 2 }}>{step.title}</div>
                <div style={{ fontSize: 14, fontWeight: 500, color: "#f6eee7", marginBottom: 4 }}>
                  {step.question}
                </div>
                <div
                  style={{
                    padding: "8px 12px",
                    borderRadius: 8,
                    background: "rgba(0,0,0,0.3)",
                    fontSize: 13,
                    color: "#d1c3b4",
                  }}
                >
                  {formatAnswer(answers[step.id], step)}
                </div>
              </div>
              <button
                onClick={() => onEdit(index)}
                style={{
                  padding: "6px 10px",
                  borderRadius: 6,
                  border: "none",
                  background: "rgba(255,255,255,0.05)",
                  color: "#7a6b5d",
                  fontSize: 11,
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: 4,
                }}
              >
                <Edit3 size={12} />
                Edit
              </button>
            </div>
          ))}
        </div>
      </div>

      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          padding: "16px 24px 20px",
          borderTop: "1px solid rgba(255,255,255,0.06)",
        }}
      >
        <button
          onClick={onBack}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            padding: "10px 16px",
            borderRadius: 10,
            border: "1px solid rgba(255,255,255,0.1)",
            background: "transparent",
            color: "#d1c3b4",
            fontSize: 13,
            fontWeight: 600,
            cursor: "pointer",
          }}
        >
          <ChevronLeft size={16} />
          Back
        </button>

        <button
          onClick={onSubmit}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            padding: "10px 24px",
            borderRadius: 10,
            border: `1px solid ${accentColor}`,
            background: accentColor,
            color: "#1a1714",
            fontSize: 13,
            fontWeight: 700,
            cursor: "pointer",
          }}
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
      style={{
        borderRadius: 20,
        border: `1px solid ${accentColor}30`,
        background: "linear-gradient(180deg, #2B2520 0%, #1a1714 100%)",
        padding: 40,
        textAlign: "center",
        maxWidth: 400,
        width: "100%",
      }}
    >
      <div
        style={{
          width: 64,
          height: 64,
          borderRadius: "50%",
          background: `${accentColor}20`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          margin: "0 auto 20px",
        }}
      >
        <CheckCircle2 size={32} style={{ color: accentColor }} />
      </div>

      <h2 style={{ margin: "0 0 8px", fontSize: 20, fontWeight: 700, color: "#f6eee7" }}>All Set!</h2>
      <p style={{ margin: 0, fontSize: 14, color: "#a8998c" }}>
        Your responses for "{title}" have been recorded.
      </p>

      {onClose && (
        <button
          onClick={onClose}
          style={{
            marginTop: 24,
            padding: "12px 24px",
            borderRadius: 10,
            border: `1px solid ${accentColor}`,
            background: accentColor,
            color: "#1a1714",
            fontSize: 14,
            fontWeight: 700,
            cursor: "pointer",
          }}
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
    if (value.length > 100) return value.slice(0, 100) + "...";
    return value;
  }
  if (typeof value === "number") return String(value);

  if (Array.isArray(value)) {
    if (value.length === 0) return "None selected";
    const labels = value
      .map((v) => step.options?.find((o) => o.value === v)?.label || v)
      .join(", ");
    if (labels.length > 100) return labels.slice(0, 100) + "...";
    return labels;
  }

  return String(value);
}

export default AskUserQuestionWizard;
