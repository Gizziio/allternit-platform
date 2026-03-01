/**
 * Ask User Tool - Native Agent Tool Implementation
 * 
 * This tool allows the AI agent to ask the user questions and wait for responses
 * during execution. It's a bridge between the kernel tool execution system and
 * the UI components.
 * 
 * Usage:
 * - Kernel registers this tool
 * - Agent calls `ask_user` with question config
 * - Tool displays UI prompt to user
 * - User response is returned to agent
 * 
 * @module ask-user-tool
 */

import { create } from "zustand";
import { immer } from "zustand/middleware/immer";

// ============================================================================
// Types
// ============================================================================

export type QuestionType = "text" | "number" | "select" | "multi-select" | "confirm" | "password";

export interface QuestionOption {
  label: string;
  value: string;
  description?: string;
}

export interface ValidationRule {
  required?: boolean;
  minLength?: number;
  maxLength?: number;
  min?: number;
  max?: number;
  pattern?: string;
  customMessage?: string;
}

export interface QuestionConfig {
  id: string;
  question: string;
  type: QuestionType;
  description?: string;
  options?: QuestionOption[];
  placeholder?: string;
  defaultValue?: unknown;
  validation?: ValidationRule;
  timeout?: number; // seconds
}

export interface PendingQuestion {
  id: string;
  sessionId: string;
  toolCallId: string;
  config: QuestionConfig;
  status: "pending" | "answered" | "timeout" | "cancelled";
  answer?: unknown;
  answeredAt?: string;
  timeoutAt?: string;
}

export interface QuestionResponse {
  questionId: string;
  answer: unknown;
  timestamp: string;
}

export interface AskUserToolState {
  pendingQuestions: Record<string, PendingQuestion>; // keyed by questionId
  currentQuestionId: string | null;
  questionHistory: QuestionResponse[];
}

export interface AskUserToolActions {
  // Tool Interface (called by kernel/agent)
  askQuestion: (sessionId: string, toolCallId: string, config: Omit<QuestionConfig, "id">) => Promise<unknown>;
  
  // UI Interface (called by components)
  submitAnswer: (questionId: string, answer: unknown) => void;
  cancelQuestion: (questionId: string) => void;
  dismissQuestion: (questionId: string) => void;
  clearHistory: () => void;
  
  // Query
  getPendingQuestion: (questionId: string) => PendingQuestion | undefined;
  getCurrentQuestion: () => PendingQuestion | null;
  getQuestionsForSession: (sessionId: string) => PendingQuestion[];
  hasPendingQuestions: (sessionId: string) => boolean;
}

// ============================================================================
// Promise Resolvers Store (for async/await interface)
// ============================================================================

interface PendingResolver {
  resolve: (value: unknown) => void;
  reject: (reason: Error) => void;
  timeoutId: ReturnType<typeof setTimeout> | null;
}

const pendingResolvers = new Map<string, PendingResolver>();

// ============================================================================
// Store Implementation
// ============================================================================

export const useAskUserToolStore = create<AskUserToolState & AskUserToolActions>()(
  immer((set, get) => ({
    // State
    pendingQuestions: {},
    currentQuestionId: null,
    questionHistory: [],

    // -------------------------------------------------------------------------
    // Tool Interface (called by kernel/agent)
    // -------------------------------------------------------------------------

    askQuestion: async (sessionId, toolCallId, config) => {
      const questionId = `question-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
      const now = new Date();
      const timeoutAt = config.timeout 
        ? new Date(now.getTime() + config.timeout * 1000).toISOString()
        : undefined;

      const pendingQuestion: PendingQuestion = {
        id: questionId,
        sessionId,
        toolCallId,
        config: { ...config, id: questionId },
        status: "pending",
        timeoutAt,
      };

      set((state) => {
        state.pendingQuestions[questionId] = pendingQuestion;
        state.currentQuestionId = questionId;
      });

      // Return a promise that resolves when the user answers
      return new Promise<unknown>((resolve, reject) => {
        let timeoutId: ReturnType<typeof setTimeout> | null = null;

        // Set up timeout if specified
        if (config.timeout) {
          timeoutId = setTimeout(() => {
            const resolver = pendingResolvers.get(questionId);
            if (resolver) {
              pendingResolvers.delete(questionId);
              
              set((state) => {
                const q = state.pendingQuestions[questionId];
                if (q) {
                  q.status = "timeout";
                }
              });

              reject(new Error(`Question timed out after ${config.timeout} seconds`));
            }
          }, config.timeout * 1000);
        }

        pendingResolvers.set(questionId, { resolve, reject, timeoutId });
      });
    },

    // -------------------------------------------------------------------------
    // UI Interface (called by components)
    // -------------------------------------------------------------------------

    submitAnswer: (questionId, answer) => {
      const resolver = pendingResolvers.get(questionId);
      
      if (resolver) {
        // Clear timeout if exists
        if (resolver.timeoutId) {
          clearTimeout(resolver.timeoutId);
        }
        
        // Resolve the promise
        resolver.resolve(answer);
        pendingResolvers.delete(questionId);
      }

      set((state) => {
        const question = state.pendingQuestions[questionId];
        if (question) {
          question.status = "answered";
          question.answer = answer;
          question.answeredAt = new Date().toISOString();
        }

        // Update current question if this was it
        if (state.currentQuestionId === questionId) {
          state.currentQuestionId = null;
        }

        // Add to history
        state.questionHistory.push({
          questionId,
          answer,
          timestamp: new Date().toISOString(),
        });
      });
    },

    cancelQuestion: (questionId) => {
      const resolver = pendingResolvers.get(questionId);
      
      if (resolver) {
        if (resolver.timeoutId) {
          clearTimeout(resolver.timeoutId);
        }
        
        resolver.reject(new Error("Question was cancelled by the user"));
        pendingResolvers.delete(questionId);
      }

      set((state) => {
        const question = state.pendingQuestions[questionId];
        if (question) {
          question.status = "cancelled";
        }

        if (state.currentQuestionId === questionId) {
          state.currentQuestionId = null;
        }
      });
    },

    dismissQuestion: (questionId) => {
      set((state) => {
        delete state.pendingQuestions[questionId];
        
        if (state.currentQuestionId === questionId) {
          state.currentQuestionId = null;
        }
      });
    },

    clearHistory: () => {
      set((state) => {
        state.questionHistory = [];
      });
    },

    // -------------------------------------------------------------------------
    // Query Methods
    // -------------------------------------------------------------------------

    getPendingQuestion: (questionId) => {
      return get().pendingQuestions[questionId];
    },

    getCurrentQuestion: () => {
      const { currentQuestionId, pendingQuestions } = get();
      return currentQuestionId ? pendingQuestions[currentQuestionId] || null : null;
    },

    getQuestionsForSession: (sessionId) => {
      return Object.values(get().pendingQuestions).filter(
        (q) => q.sessionId === sessionId
      );
    },

    hasPendingQuestions: (sessionId) => {
      return Object.values(get().pendingQuestions).some(
        (q) => q.sessionId === sessionId && q.status === "pending"
      );
    },
  }))
);

// ============================================================================
// Tool Definition (for registration with kernel)
// ============================================================================

export const ASK_USER_TOOL_DEFINITION = {
  name: "ask_user",
  description: `Ask the user a question and wait for their response.

Use this tool when you need clarification, confirmation, or additional information from the user to proceed with a task.

Examples:
- "What is the target directory for this operation?"
- "Should I proceed with deleting these files?"
- "Select the framework you want to use:" (with options)

The tool will display a UI prompt to the user and return their response.
If the user doesn't respond within the timeout, the tool will return an error.`,
  parameters: {
    type: "object",
    properties: {
      question: {
        type: "string",
        description: "The question to ask the user",
      },
      type: {
        type: "string",
        enum: ["text", "number", "select", "multi-select", "confirm", "password"],
        description: "The type of input expected from the user",
        default: "text",
      },
      description: {
        type: "string",
        description: "Additional context or explanation for the question",
      },
      options: {
        type: "array",
        description: "Options for select/multi-select type questions",
        items: {
          type: "object",
          properties: {
            label: { type: "string" },
            value: { type: "string" },
            description: { type: "string" },
          },
          required: ["label", "value"],
        },
      },
      placeholder: {
        type: "string",
        description: "Placeholder text for text/password inputs",
      },
      default_value: {
        description: "Default value for the question",
      },
      validation: {
        type: "object",
        description: "Validation rules for the answer",
        properties: {
          required: { type: "boolean" },
          min_length: { type: "number" },
          max_length: { type: "number" },
          min: { type: "number" },
          max: { type: "number" },
          pattern: { type: "string" },
          custom_message: { type: "string" },
        },
      },
      timeout: {
        type: "number",
        description: "Timeout in seconds (default: 300 = 5 minutes)",
        default: 300,
      },
    },
    required: ["question"],
  },
} as const;

// ============================================================================
// Execution Handler (called by kernel when tool is invoked)
// ============================================================================

export async function executeAskUserTool(
  sessionId: string,
  toolCallId: string,
  parameters: Record<string, unknown>
): Promise<{ result: unknown; error?: string }> {
  const store = useAskUserToolStore.getState();

  // Transform snake_case to camelCase
  const config: Omit<QuestionConfig, "id"> = {
    question: parameters.question as string,
    type: (parameters.type as QuestionType) || "text",
    description: parameters.description as string | undefined,
    options: parameters.options as QuestionOption[] | undefined,
    placeholder: parameters.placeholder as string | undefined,
    defaultValue: parameters.default_value,
    validation: parameters.validation
      ? {
          required: (parameters.validation as Record<string, unknown>).required as boolean | undefined,
          minLength: (parameters.validation as Record<string, unknown>).min_length as number | undefined,
          maxLength: (parameters.validation as Record<string, unknown>).max_length as number | undefined,
          min: (parameters.validation as Record<string, unknown>).min as number | undefined,
          max: (parameters.validation as Record<string, unknown>).max as number | undefined,
          pattern: (parameters.validation as Record<string, unknown>).pattern as string | undefined,
          customMessage: (parameters.validation as Record<string, unknown>).custom_message as string | undefined,
        }
      : undefined,
    timeout: (parameters.timeout as number) || 300,
  };

  try {
    const answer = await store.askQuestion(sessionId, toolCallId, config);
    return { result: answer };
  } catch (error) {
    return {
      result: null,
      error: error instanceof Error ? error.message : "Question was not answered",
    };
  }
}

// ============================================================================
// Validation Helper
// ============================================================================

export function validateAnswer(
  value: unknown,
  type: QuestionType,
  validation?: ValidationRule
): { valid: boolean; error?: string } {
  // Required check
  if (validation?.required) {
    const isEmpty =
      value === undefined ||
      value === null ||
      (typeof value === "string" && value.trim() === "") ||
      (Array.isArray(value) && value.length === 0);

    if (isEmpty) {
      return { valid: false, error: validation.customMessage || "This field is required" };
    }
  }

  // Type-specific validation
  switch (type) {
    case "text":
    case "password": {
      const strValue = String(value || "");
      
      if (validation?.minLength !== undefined && strValue.length < validation.minLength) {
        return { valid: false, error: `Minimum ${validation.minLength} characters required` };
      }
      
      if (validation?.maxLength !== undefined && strValue.length > validation.maxLength) {
        return { valid: false, error: `Maximum ${validation.maxLength} characters allowed` };
      }
      
      if (validation?.pattern && !new RegExp(validation.pattern).test(strValue)) {
        return { valid: false, error: validation.customMessage || "Invalid format" };
      }
      break;
    }

    case "number": {
      const numValue = typeof value === "string" ? parseFloat(value) : Number(value);
      
      if (isNaN(numValue)) {
        return { valid: false, error: "Please enter a valid number" };
      }
      
      if (validation?.min !== undefined && numValue < validation.min) {
        return { valid: false, error: `Minimum value is ${validation.min}` };
      }
      
      if (validation?.max !== undefined && numValue > validation.max) {
        return { valid: false, error: `Maximum value is ${validation.max}` };
      }
      break;
    }

    case "select": {
      if (value === undefined || value === null) {
        return { valid: false, error: "Please select an option" };
      }
      break;
    }

    case "multi-select": {
      const arrValue = Array.isArray(value) ? value : [value];
      if (validation?.required && arrValue.length === 0) {
        return { valid: false, error: "Please select at least one option" };
      }
      break;
    }

    case "confirm": {
      if (typeof value !== "boolean") {
        return { valid: false, error: "Please confirm or cancel" };
      }
      break;
    }
  }

  return { valid: true };
}

// ============================================================================
// Helpers
// ============================================================================

export function formatQuestionForDisplay(config: QuestionConfig): {
  title: string;
  subtitle?: string;
  inputType: "text" | "number" | "select" | "multi" | "confirm" | "password";
  options?: QuestionOption[];
  placeholder?: string;
  defaultValue?: unknown;
  validation?: ValidationRule;
} {
  return {
    title: config.question,
    subtitle: config.description,
    inputType: config.type === "multi-select" ? "multi" : 
               config.type === "select" ? "select" :
               config.type === "confirm" ? "confirm" :
               config.type === "password" ? "password" :
               config.type === "number" ? "number" : "text",
    options: config.options,
    placeholder: config.placeholder,
    defaultValue: config.defaultValue,
    validation: config.validation,
  };
}

export default useAskUserToolStore;
