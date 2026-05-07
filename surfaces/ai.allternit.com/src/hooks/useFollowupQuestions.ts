"use client";

import { useMemo } from "react";
import type { QuestionItem } from "@/components/ai-elements/questions-panel";

const GENERIC_QUESTIONS: QuestionItem[] = [
  { id: "more", question: "Tell me more about this" },
  { id: "example", question: "Can you give me a concrete example?" },
  { id: "compare", question: "How does this compare to alternatives?" },
];

function generateQuestionsFromContent(content: string): QuestionItem[] {
  const lower = content.toLowerCase();

  // Code-related content
  if (
    lower.includes("function") ||
    lower.includes("code") ||
    lower.includes("component") ||
    lower.includes("api") ||
    lower.includes("error") ||
    lower.includes("bug") ||
    lower.includes("debug")
  ) {
    return [
      { id: "explain", question: "Can you explain how this works step by step?" },
      { id: "optimize", question: "Can you optimize or refactor this?" },
      { id: "test", question: "Write unit tests for this code" },
      { id: "edge", question: "What edge cases should I handle?" },
    ];
  }

  // Planning / task-related content
  if (
    lower.includes("plan") ||
    lower.includes("schedule") ||
    lower.includes("task") ||
    lower.includes("todo") ||
    lower.includes("strategy")
  ) {
    return [
      { id: "timeline", question: "What should the timeline look like?" },
      { id: "priorities", question: "Which items are highest priority?" },
      { id: "risks", question: "What are the main risks or blockers?" },
      { id: "next", question: "What should I do first?" },
    ];
  }

  // Writing / creative content
  if (
    lower.includes("write") ||
    lower.includes("draft") ||
    lower.includes("email") ||
    lower.includes("blog") ||
    lower.includes("doc")
  ) {
    return [
      { id: "tone", question: "Can you adjust the tone to be more professional?" },
      { id: "shorten", question: "Make this shorter and punchier" },
      { id: "expand", question: "Expand on the key points" },
      { id: "cta", question: "Add a strong call-to-action" },
    ];
  }

  // Data / analysis content
  if (
    lower.includes("data") ||
    lower.includes("analysis") ||
    lower.includes("metric") ||
    lower.includes("chart") ||
    lower.includes("report")
  ) {
    return [
      { id: "summary", question: "Summarize the key takeaways" },
      { id: "action", question: "What actions should I take based on this?" },
      { id: "trend", question: "What trends do you see here?" },
      { id: "visualize", question: "Suggest a better way to visualize this" },
    ];
  }

  // Default / generic
  return GENERIC_QUESTIONS;
}

/**
 * Generates contextual follow-up questions based on the last assistant message.
 */
export function useFollowupQuestions(
  lastAssistantContent: string | undefined
): QuestionItem[] {
  return useMemo(() => {
    if (!lastAssistantContent || lastAssistantContent.trim().length === 0) {
      return [];
    }
    return generateQuestionsFromContent(lastAssistantContent);
  }, [lastAssistantContent]);
}
