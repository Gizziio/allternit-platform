/**
 * Ask User Question Tool
 * 
 * Interactive question component that can be used inline in chat or standalone.
 * Supports multiple question types: text, select, confirm, multi-select.
 * Used by agents to walk users through step-by-step workflows.
 * 
 * Enhanced with tool store integration for native agent tool execution.
 */

import React, { useState, useCallback } from "react";
import {
  ChatCircle,
  Check,
  X,
  CaretRight,
  CircleNotch,
  Question as HelpCircle,
} from '@phosphor-icons/react';
import {
  useAskUserToolStore,
  type QuestionConfig,
  type QuestionType,
  type QuestionOption,
  validateAnswer,
} from "../../lib/agents/tools/ask-user.tool";

// ============================================================================
// Types
// ============================================================================

export { QuestionType, QuestionOption, QuestionConfig };

export interface AskUserQuestionOption extends QuestionOption {
  icon?: React.ReactNode;
}

export interface AskUserQuestionProps {
  id: string;
  question: string;
  type: QuestionType;
  options?: AskUserQuestionOption[];
  placeholder?: string;
  defaultValue?: string | string[] | boolean | number;
  required?: boolean;
  validation?: {
    minLength?: number;
    maxLength?: number;
    pattern?: RegExp;
    min?: number;
    max?: number;
  };
  onSubmit: (value: string | string[] | boolean | number) => void;
  onCancel?: () => void;
  accentColor?: string;
  isLoading?: boolean;
}

export interface QuestionWizardProps {
  questions: Omit<AskUserQuestionProps, "onSubmit" | "onCancel">[];
  onComplete: (answers: Record<string, unknown>) => void;
  onCancel?: () => void;
  accentColor?: string;
  title?: string;
}

export interface ToolQuestionDisplayProps {
  sessionId: string;
  accentColor?: string;
  onAnswer?: (questionId: string, answer: unknown) => void;
}

// ============================================================================
// Single Question Component
// ============================================================================

export function AskUserQuestion({
  id,
  question,
  type,
  options = [],
  placeholder,
  defaultValue,
  required = true,
  validation,
  onSubmit,
  onCancel,
  accentColor = "#D4956A",
  isLoading = false,
}: AskUserQuestionProps) {
  const [value, setValue] = useState<string | string[] | boolean | number>(
    defaultValue ?? (type === "multi-select" ? [] : type === "confirm" ? false : "")
  );
  const [error, setError] = useState<string | null>(null);

  const validate = useCallback(
    (val: typeof value): boolean => {
      if (required) {
        if (type === "text" && !val) return false;
        if (type === "number" && (val === "" || val === undefined)) return false;
        if (type === "select" && !val) return false;
        if (type === "multi-select" && Array.isArray(val) && val.length === 0) return false;
      }

      if (validation && type === "text" && typeof val === "string") {
        if (validation.minLength && val.length < validation.minLength) {
          setError(`Minimum ${validation.minLength} characters required`);
          return false;
        }
        if (validation.maxLength && val.length > validation.maxLength) {
          setError(`Maximum ${validation.maxLength} characters allowed`);
          return false;
        }
        if (validation.pattern && !validation.pattern.test(val)) {
          setError("Invalid format");
          return false;
        }
      }

      if (validation && type === "number" && typeof val === "number") {
        if (validation.min !== undefined && val < validation.min) {
          setError(`Minimum value is ${validation.min}`);
          return false;
        }
        if (validation.max !== undefined && val > validation.max) {
          setError(`Maximum value is ${validation.max}`);
          return false;
        }
      }

      setError(null);
      return true;
    },
    [required, type, validation]
  );

  const handleSubmit = () => {
    if (validate(value)) {
      onSubmit(value);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && type !== "multi-select") {
      handleSubmit();
    }
  };

  return (
    <div
      style={{
        borderRadius: 16,
        border: `1px solid ${accentColor}30`,
        background: `linear-gradient(135deg, ${accentColor}08, transparent)`,
        padding: 16,
        marginTop: 12,
      }}
    >
      {/* Header */}
      <div style={{ display: "flex", alignItems: "flex-start", gap: 10, marginBottom: 14 }}>
        <div
          style={{
            width: 32,
            height: 32,
            borderRadius: 10,
            background: `${accentColor}20`,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
          }}
        >
          <HelpCircle size={16} style={{ color: accentColor }} />
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: "#f6eee7", lineHeight: 1.4 }}>
            {question}
            {required && <span style={{ color: "#ef4444", marginLeft: 4 }}>*</span>}
          </div>
          <div style={{ fontSize: 11, color: "#7a6b5d", marginTop: 2 }}>
            {type === "text" && "Type your answer"}
            {type === "number" && "Enter a number"}
            {type === "select" && "Select one option"}
            {type === "multi-select" && "Select one or more options"}
            {type === "confirm" && "Yes or No"}
            {type === "password" && "Enter password (hidden)"}
          </div>
        </div>
      </div>

      {/* Input Area */}
      <div style={{ marginBottom: 12 }}>
        {type === "text" && (
          <TextInput
            value={value as string}
            onChange={(v) => setValue(v)}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            accentColor={accentColor}
          />
        )}

        {type === "password" && (
          <TextInput
            value={value as string}
            onChange={(v) => setValue(v)}
            onKeyDown={handleKeyDown}
            placeholder={placeholder || "Enter password..."}
            accentColor={accentColor}
            type="password"
          />
        )}

        {type === "number" && (
          <NumberInput
            value={value as number}
            onChange={(v) => setValue(v)}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            min={validation?.min}
            max={validation?.max}
            accentColor={accentColor}
          />
        )}

        {type === "select" && (
          <SelectInput
            options={options}
            value={value as string}
            onChange={(v) => setValue(v)}
            accentColor={accentColor}
          />
        )}

        {type === "multi-select" && (
          <MultiSelectInput
            options={options}
            value={value as string[]}
            onChange={(v) => setValue(v)}
            accentColor={accentColor}
          />
        )}

        {type === "confirm" && (
          <ConfirmInput
            value={value as boolean}
            onChange={(v) => setValue(v)}
            accentColor={accentColor}
          />
        )}
      </div>

      {/* Error */}
      {error && (
        <div
          style={{
            padding: "8px 12px",
            borderRadius: 8,
            background: "rgba(239,68,68,0.1)",
            color: "#ef4444",
            fontSize: 12,
            marginBottom: 12,
          }}
        >
          {error}
        </div>
      )}

      {/* Actions */}
      <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
        {onCancel && (
          <button
            onClick={onCancel}
            disabled={isLoading}
            style={{
              padding: "8px 14px",
              borderRadius: 8,
              border: "1px solid rgba(255,255,255,0.1)",
              background: "transparent",
              color: "#a8998c",
              fontSize: 12,
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            Skip
          </button>
        )}
        <button
          onClick={handleSubmit}
          disabled={isLoading}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            padding: "8px 16px",
            borderRadius: 8,
            border: `1px solid ${accentColor}`,
            background: accentColor,
            color: "#1a1714",
            fontSize: 12,
            fontWeight: 700,
            cursor: isLoading ? "wait" : "pointer",
            opacity: isLoading ? 0.7 : 1,
          }}
        >
          {isLoading ? (
            <CircleNotch size={14} style={{ animation: "spin 1s linear infinite" }} />
          ) : (
            <>
              Submit
              <CaretRight size={14} />
            </>
          )}
        </button>
      </div>
    </div>
  );
}

// ============================================================================
// Input Components
// ============================================================================

function TextInput({
  value,
  onChange,
  onKeyDown,
  placeholder,
  accentColor,
  type = "text",
}: {
  value: string;
  onChange: (v: string) => void;
  onKeyDown: (e: React.KeyboardEvent) => void;
  placeholder?: string;
  accentColor: string;
  type?: "text" | "password";
}) {
  return (
    <input
      type={type}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      onKeyDown={onKeyDown}
      placeholder={placeholder || "Type your answer..."}
      autoFocus
      style={{
        width: "100%",
        padding: "10px 12px",
        borderRadius: 10,
        border: `1px solid ${accentColor}40`,
        background: "rgba(0,0,0,0.3)",
        color: "#f6eee7",
        fontSize: 14,
        outline: "none",
      }}
    />
  );
}

function NumberInput({
  value,
  onChange,
  onKeyDown,
  placeholder,
  min,
  max,
  accentColor,
}: {
  value: number;
  onChange: (v: number) => void;
  onKeyDown: (e: React.KeyboardEvent) => void;
  placeholder?: string;
  min?: number;
  max?: number;
  accentColor: string;
}) {
  return (
    <input
      type="number"
      value={value}
      onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
      onKeyDown={onKeyDown}
      placeholder={placeholder || "Enter a number..."}
      min={min}
      max={max}
      autoFocus
      style={{
        width: "100%",
        padding: "10px 12px",
        borderRadius: 10,
        border: `1px solid ${accentColor}40`,
        background: "rgba(0,0,0,0.3)",
        color: "#f6eee7",
        fontSize: 14,
        outline: "none",
      }}
    />
  );
}

function SelectInput({
  options,
  value,
  onChange,
  accentColor,
}: {
  options: AskUserQuestionOption[];
  value: string;
  onChange: (v: string) => void;
  accentColor: string;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      {options.map((option) => (
        <button
          key={option.value}
          onClick={() => onChange(option.value)}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            padding: "10px 12px",
            borderRadius: 10,
            border: `1px solid ${value === option.value ? accentColor : "rgba(255,255,255,0.08)"}`,
            background: value === option.value ? `${accentColor}15` : "rgba(0,0,0,0.2)",
            cursor: "pointer",
            textAlign: "left",
          }}
        >
          {option.icon && (
            <span style={{ color: value === option.value ? accentColor : "#7a6b5d" }}>
              {option.icon}
            </span>
          )}
          <div style={{ flex: 1 }}>
            <div
              style={{
                fontSize: 13,
                fontWeight: 500,
                color: value === option.value ? "#f6eee7" : "#d1c3b4",
              }}
            >
              {option.label}
            </div>
            {option.description && (
              <div style={{ fontSize: 11, color: "#7a6b5d", marginTop: 1 }}>
                {option.description}
              </div>
            )}
          </div>
          {value === option.value && <Check size={16} style={{ color: accentColor }} />}
        </button>
      ))}
    </div>
  );
}

function MultiSelectInput({
  options,
  value,
  onChange,
  accentColor,
}: {
  options: AskUserQuestionOption[];
  value: string[];
  onChange: (v: string[]) => void;
  accentColor: string;
}) {
  const toggleOption = (id: string) => {
    if (value.includes(id)) {
      onChange(value.filter((v) => v !== id));
    } else {
      onChange([...value, id]);
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      {options.map((option) => {
        const isSelected = value.includes(option.value);
        return (
          <button
            key={option.value}
            onClick={() => toggleOption(option.value)}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              padding: "10px 12px",
              borderRadius: 10,
              border: `1px solid ${isSelected ? accentColor : "rgba(255,255,255,0.08)"}`,
              background: isSelected ? `${accentColor}15` : "rgba(0,0,0,0.2)",
              cursor: "pointer",
              textAlign: "left",
            }}
          >
            <div
              style={{
                width: 18,
                height: 18,
                borderRadius: 4,
                border: `2px solid ${isSelected ? accentColor : "#7a6b5d"}`,
                background: isSelected ? accentColor : "transparent",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              {isSelected && <Check size={12} style={{ color: "#1a1714" }} />}
            </div>
            {option.icon && (
              <span style={{ color: isSelected ? accentColor : "#7a6b5d" }}>{option.icon}</span>
            )}
            <div style={{ flex: 1 }}>
              <div
                style={{
                  fontSize: 13,
                  fontWeight: 500,
                  color: isSelected ? "#f6eee7" : "#d1c3b4",
                }}
              >
                {option.label}
              </div>
              {option.description && (
                <div style={{ fontSize: 11, color: "#7a6b5d", marginTop: 1 }}>
                  {option.description}
                </div>
              )}
            </div>
          </button>
        );
      })}
    </div>
  );
}

function ConfirmInput({
  value,
  onChange,
  accentColor,
}: {
  value: boolean;
  onChange: (v: boolean) => void;
  accentColor: string;
}) {
  return (
    <div style={{ display: "flex", gap: 10 }}>
      <button
        onClick={() => onChange(true)}
        style={{
          flex: 1,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 8,
          padding: "12px 16px",
          borderRadius: 10,
          border: `1px solid ${value === true ? "#79C47C" : "rgba(255,255,255,0.08)"}`,
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
          padding: "12px 16px",
          borderRadius: 10,
          border: `1px solid ${value === false ? "#ef4444" : "rgba(255,255,255,0.08)"}`,
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
}

// ============================================================================
// Question Wizard (Multi-step)
// ============================================================================

export function QuestionWizard({
  questions,
  onComplete,
  onCancel,
  accentColor = "#D4956A",
  title = "Setup Wizard",
}: QuestionWizardProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, unknown>>({});
  const [isComplete, setIsComplete] = useState(false);

  const currentQuestion = questions[currentIndex];
  const progress = ((currentIndex + 1) / questions.length) * 100;

  const handleAnswer = (value: unknown) => {
    const newAnswers = { ...answers, [currentQuestion.id]: value };
    setAnswers(newAnswers);

    if (currentIndex < questions.length - 1) {
      setCurrentIndex(currentIndex + 1);
    } else {
      setIsComplete(true);
      onComplete(newAnswers);
    }
  };

  const handleBack = () => {
    if (currentIndex > 0) {
      setCurrentIndex(currentIndex - 1);
    }
  };

  if (isComplete) {
    return (
      <div
        style={{
          borderRadius: 16,
          border: `1px solid ${accentColor}30`,
          background: `${accentColor}08`,
          padding: 24,
          textAlign: "center",
        }}
      >
        <div
          style={{
            width: 48,
            height: 48,
            borderRadius: "50%",
            background: `${accentColor}20`,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            margin: "0 auto 16px",
          }}
        >
          <Check size={24} style={{ color: accentColor }} />
        </div>
        <div style={{ fontSize: 16, fontWeight: 700, color: "#f6eee7" }}>All Set!</div>
        <div style={{ fontSize: 13, color: "#a8998c", marginTop: 4 }}>
          Your responses have been recorded.
        </div>
      </div>
    );
  }

  return (
    <div
      style={{
        borderRadius: 16,
        border: `1px solid ${accentColor}20`,
        background: "rgba(0,0,0,0.2)",
        overflow: "hidden",
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: "12px 16px",
          borderBottom: `1px solid ${accentColor}20`,
          background: `${accentColor}08`,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
          <ChatCircle size={16} style={{ color: accentColor }} />
          <span style={{ fontSize: 13, fontWeight: 700, color: "#f6eee7" }}>{title}</span>
          <span style={{ fontSize: 11, color: "#7a6b5d", marginLeft: "auto" }}>
            Step {currentIndex + 1} of {questions.length}
          </span>
        </div>
        <div style={{ height: 3, background: "rgba(255,255,255,0.1)", borderRadius: 2 }}>
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

      {/* Question */}
      <div style={{ padding: 16 }}>
        <AskUserQuestion
          {...currentQuestion}
          onSubmit={handleAnswer}
          onCancel={currentIndex > 0 ? handleBack : onCancel}
          accentColor={accentColor}
        />
      </div>
    </div>
  );
}

// ============================================================================
// Tool Question Display - Renders pending questions from the tool store
// ============================================================================

export function ToolQuestionDisplay({
  sessionId,
  accentColor = "#D4956A",
  onAnswer,
}: ToolQuestionDisplayProps) {
  const { getQuestionsForSession, submitAnswer, cancelQuestion } = useAskUserToolStore();
  
  const pendingQuestions = getQuestionsForSession(sessionId).filter(
    (q) => q.status === "pending"
  );

  if (pendingQuestions.length === 0) {
    return null;
  }

  // Show the first pending question
  const currentQuestion = pendingQuestions[0];
  const config = currentQuestion.config;

  // Transform QuestionConfig to AskUserQuestionProps
  const questionProps: AskUserQuestionProps = {
    id: config.id,
    question: config.question,
    type: config.type,
    options: config.options,
    placeholder: config.placeholder,
    defaultValue: config.defaultValue as string | string[] | boolean | number,
    required: config.validation?.required ?? true,
    validation: config.validation
      ? {
          minLength: config.validation.minLength,
          maxLength: config.validation.maxLength,
          pattern: config.validation.pattern ? new RegExp(config.validation.pattern) : undefined,
          min: config.validation.min,
          max: config.validation.max,
        }
      : undefined,
    onSubmit: (value) => {
      submitAnswer(config.id, value);
      onAnswer?.(config.id, value);
    },
    onCancel: () => {
      cancelQuestion(config.id);
    },
    accentColor,
    isLoading: false,
  };

  return (
    <div style={{ marginTop: 12 }}>
      <AskUserQuestion {...questionProps} />
    </div>
  );
}

// ============================================================================
// Hook for using questions in chat
// ============================================================================

export function useAskUserQuestion() {
  const [activeQuestion, setActiveQuestion] = useState<AskUserQuestionProps | null>(null);
  const [pendingQuestions, setPendingQuestions] = useState<AskUserQuestionProps[]>([]);

  const askQuestion = useCallback(
    (question: Omit<AskUserQuestionProps, "onSubmit" | "onCancel">): Promise<unknown> => {
      return new Promise((resolve, reject) => {
        const fullQuestion: AskUserQuestionProps = {
          ...question,
          onSubmit: (value) => {
            setActiveQuestion(null);
            resolve(value);
          },
          onCancel: () => {
            setActiveQuestion(null);
            reject(new Error("User cancelled"));
          },
        };

        if (activeQuestion) {
          setPendingQuestions((prev) => [...prev, fullQuestion]);
        } else {
          setActiveQuestion(fullQuestion);
        }
      });
    },
    [activeQuestion]
  );

  const askMultiple = useCallback(
    async (questions: Omit<AskUserQuestionProps, "onSubmit" | "onCancel">[]): Promise<Record<string, unknown>> => {
      const answers: Record<string, unknown> = {};
      
      for (const question of questions) {
        try {
          const answer = await askQuestion(question);
          answers[question.id] = answer;
        } catch {
          // User cancelled, stop the sequence
          break;
        }
      }
      
      return answers;
    },
    [askQuestion]
  );

  return {
    activeQuestion,
    pendingQuestions,
    askQuestion,
    askMultiple,
    clearPending: () => setPendingQuestions([]),
  };
}

// ============================================================================
// Hook for using the tool store
// ============================================================================

export function useToolQuestions(sessionId?: string) {
  const store = useAskUserToolStore();
  
  return {
    // Current pending question for the session
    currentQuestion: sessionId ? store.getCurrentQuestion() : null,
    
    // All pending questions for the session
    pendingQuestions: sessionId ? store.getQuestionsForSession(sessionId) : [],
    
    // Actions
    submitAnswer: store.submitAnswer,
    cancelQuestion: store.cancelQuestion,
    dismissQuestion: store.dismissQuestion,
    hasPendingQuestions: sessionId ? store.hasPendingQuestions(sessionId) : false,
  };
}

export default AskUserQuestion;
