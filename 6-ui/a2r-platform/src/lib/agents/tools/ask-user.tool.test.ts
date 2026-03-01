/**
 * Ask User Tool Tests
 * 
 * Tests for:
 * - Question asking and answering flow
 * - Store state management
 * - Timeout handling
 * - Session-based queries
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  useAskUserToolStore,
  type QuestionConfig,
  type ValidationRule,
} from "./ask-user.tool";

describe("Ask User Tool Store", () => {
  beforeEach(() => {
    const store = useAskUserToolStore.getState();
    // Clear pending questions
    Object.keys(store.pendingQuestions).forEach((id) => {
      store.dismissQuestion(id);
    });
    // Clear history
    store.clearHistory();
  });

  describe("Question Management", () => {
    it("should ask a question and add it to pending", async () => {
      const store = useAskUserToolStore.getState();
      const config: Omit<QuestionConfig, "id"> = {
        question: "What is your name?",
        type: "text",
      };

      // Don't await - we need to submit answer while promise is pending
      const promise = store.askQuestion("session-1", "call-1", config);

      // Check question was added
      expect(store.currentQuestionId).not.toBeNull();
      const current = store.getCurrentQuestion();
      expect(current?.config.question).toBe("What is your name?");

      // Clean up
      if (store.currentQuestionId) {
        store.cancelQuestion(store.currentQuestionId);
      }
      await expect(promise).rejects.toThrow();
    });

    it("should submit an answer and resolve the promise", async () => {
      const store = useAskUserToolStore.getState();
      const config: Omit<QuestionConfig, "id"> = {
        question: "What is your name?",
        type: "text",
      };

      const promise = store.askQuestion("session-1", "call-1", config);
      const questionId = store.currentQuestionId!;

      store.submitAnswer(questionId, "John");

      const result = await promise;
      expect(result).toBe("John");
    });

    it("should update question status after answer", async () => {
      const store = useAskUserToolStore.getState();
      const config: Omit<QuestionConfig, "id"> = {
        question: "What is your name?",
        type: "text",
      };

      store.askQuestion("session-1", "call-1", config);
      const questionId = store.currentQuestionId!;

      expect(store.getPendingQuestion(questionId)?.status).toBe("pending");

      store.submitAnswer(questionId, "John");

      expect(store.getPendingQuestion(questionId)?.status).toBe("answered");
      expect(store.getPendingQuestion(questionId)?.answer).toBe("John");
    });

    it("should cancel a question and reject the promise", async () => {
      const store = useAskUserToolStore.getState();
      const config: Omit<QuestionConfig, "id"> = {
        question: "What is your name?",
        type: "text",
      };

      const promise = store.askQuestion("session-1", "call-1", config);
      const questionId = store.currentQuestionId!;

      store.cancelQuestion(questionId);

      await expect(promise).rejects.toThrow("Question was cancelled by the user");
      expect(store.getPendingQuestion(questionId)?.status).toBe("cancelled");
    });

    it("should dismiss a question", async () => {
      const store = useAskUserToolStore.getState();
      const config: Omit<QuestionConfig, "id"> = {
        question: "What is your name?",
        type: "text",
      };

      store.askQuestion("session-1", "call-1", config);
      const questionId = store.currentQuestionId!;

      expect(store.getPendingQuestion(questionId)).toBeDefined();

      store.dismissQuestion(questionId);

      expect(store.getPendingQuestion(questionId)).toBeUndefined();
      expect(store.currentQuestionId).toBeNull();
    });
  });

  describe("Question Timeout", () => {
    it("should timeout after specified duration", async () => {
      const store = useAskUserToolStore.getState();
      const config: Omit<QuestionConfig, "id"> = {
        question: "Quick question?",
        type: "text",
        timeout: 0.1, // 100ms timeout
      };

      const promise = store.askQuestion("session-1", "call-1", config);

      await expect(promise).rejects.toThrow("Question timed out after 0.1 seconds");
      
      const questionId = Object.keys(store.pendingQuestions)[0];
      expect(store.getPendingQuestion(questionId)?.status).toBe("timeout");
    });

    it("should not timeout if timeout is not specified", async () => {
      const store = useAskUserToolStore.getState();
      const config: Omit<QuestionConfig, "id"> = {
        question: "What is your name?",
        type: "text",
        // No timeout
      };

      const promise = store.askQuestion("session-1", "call-1", config);
      const questionId = store.currentQuestionId!;

      // Should not have timeoutAt
      expect(store.getPendingQuestion(questionId)?.timeoutAt).toBeUndefined();

      // Clean up
      store.cancelQuestion(questionId);
      await expect(promise).rejects.toThrow();
    });
  });

  describe("Session-based Queries", () => {
    it("should get questions for a session", async () => {
      const store = useAskUserToolStore.getState();

      const config1: Omit<QuestionConfig, "id"> = {
        question: "Q1?",
        type: "text",
      };

      const config2: Omit<QuestionConfig, "id"> = {
        question: "Q2?",
        type: "text",
      };

      store.askQuestion("session-1", "call-1", config1);
      store.askQuestion("session-2", "call-2", config2);

      const session1Questions = store.getQuestionsForSession("session-1");
      expect(session1Questions.length).toBe(1);
      expect(session1Questions[0].config.question).toBe("Q1?");

      // Clean up
      Object.keys(store.pendingQuestions).forEach((id) => {
        store.cancelQuestion(id);
      });
    });

    it("should check if session has pending questions", async () => {
      const store = useAskUserToolStore.getState();

      const config: Omit<QuestionConfig, "id"> = {
        question: "Q1?",
        type: "text",
      };

      expect(store.hasPendingQuestions("session-1")).toBe(false);

      store.askQuestion("session-1", "call-1", config);

      expect(store.hasPendingQuestions("session-1")).toBe(true);

      // Clean up
      const id = Object.keys(store.pendingQuestions)[0];
      store.cancelQuestion(id);
    });

    it("should not count answered questions as pending", async () => {
      const store = useAskUserToolStore.getState();

      const config: Omit<QuestionConfig, "id"> = {
        question: "Q1?",
        type: "text",
      };

      store.askQuestion("session-1", "call-1", config);
      const questionId = store.currentQuestionId!;

      expect(store.hasPendingQuestions("session-1")).toBe(true);

      store.submitAnswer(questionId, "Answer");

      expect(store.hasPendingQuestions("session-1")).toBe(false);
    });
  });

  describe("Question History", () => {
    it("should add answered questions to history", async () => {
      const store = useAskUserToolStore.getState();

      const config: Omit<QuestionConfig, "id"> = {
        question: "What is your name?",
        type: "text",
      };

      const promise = store.askQuestion("session-1", "call-1", config);
      const questionId = store.currentQuestionId!;

      expect(store.questionHistory.length).toBe(0);

      store.submitAnswer(questionId, "John");
      await promise;

      expect(store.questionHistory.length).toBe(1);
      expect(store.questionHistory[0].answer).toBe("John");
    });
  });

  describe("Current Question Management", () => {
    it("should track current question", async () => {
      const store = useAskUserToolStore.getState();

      const config: Omit<QuestionConfig, "id"> = {
        question: "Q1?",
        type: "text",
      };

      // Start asking but don't await yet
      const promise = store.askQuestion("session-track", "call-1", config);
      
      // Wait for state to update
      await new Promise(resolve => setTimeout(resolve, 10));
      
      const questionId = store.currentQuestionId;
      expect(questionId).not.toBeNull();

      const current = store.getCurrentQuestion();
      expect(current?.id).toBe(questionId);

      // Clean up
      if (questionId) {
        store.cancelQuestion(questionId);
      }
      await expect(promise).rejects.toThrow();
    });

    it("should clear current question after answer", async () => {
      const store = useAskUserToolStore.getState();

      const config: Omit<QuestionConfig, "id"> = {
        question: "Q1?",
        type: "text",
      };

      const promise = store.askQuestion("session-answer", "call-1", config);
      
      // Wait for state to update
      await new Promise(resolve => setTimeout(resolve, 10));
      
      const questionId = store.currentQuestionId!;
      expect(questionId).not.toBeNull();

      store.submitAnswer(questionId, "Answer");

      expect(store.currentQuestionId).toBeNull();
      
      // Clean up promise
      await promise;
    });
  });
});

describe("Validation Rules", () => {
  // Note: The actual validation is done in the UI components
  // These tests document the validation structure

  it("should support required validation", () => {
    const rule: ValidationRule = {
      required: true,
    };

    expect(rule.required).toBe(true);
  });

  it("should support length validation", () => {
    const rule: ValidationRule = {
      minLength: 3,
      maxLength: 50,
    };

    expect(rule.minLength).toBe(3);
    expect(rule.maxLength).toBe(50);
  });

  it("should support numeric range validation", () => {
    const rule: ValidationRule = {
      min: 0,
      max: 100,
    };

    expect(rule.min).toBe(0);
    expect(rule.max).toBe(100);
  });

  it("should support pattern validation", () => {
    const rule: ValidationRule = {
      pattern: "^\\d+$",
      customMessage: "Please enter numbers only",
    };

    expect(rule.pattern).toBe("^\\d+$");
    expect(rule.customMessage).toBe("Please enter numbers only");
  });
});

describe("Tool Definition", () => {
  it("should have correct tool name", async () => {
    const { ASK_USER_TOOL_DEFINITION } = await import("./ask-user.tool");
    expect(ASK_USER_TOOL_DEFINITION.name).toBe("ask_user");
  });

  it("should support all question types", async () => {
    const { ASK_USER_TOOL_DEFINITION } = await import("./ask-user.tool");
    const types = ASK_USER_TOOL_DEFINITION.parameters.properties.type.enum;
    
    expect(types).toContain("text");
    expect(types).toContain("number");
    expect(types).toContain("select");
    expect(types).toContain("multi-select");
    expect(types).toContain("confirm");
    expect(types).toContain("password");
  });
});
