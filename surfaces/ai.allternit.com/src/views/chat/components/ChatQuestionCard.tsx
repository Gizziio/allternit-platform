"use client";

/**
 * ChatQuestionCard — inline question request rendered inside a chat thread
 *
 * A chat-native alternative to the floating QuestionModal. The card is anchored
 * to the thread and lets the user answer structured questions inline.
 *
 * @module ChatQuestionCard
 */

import React, { memo, useMemo, useState } from "react";
import { Question, X } from "@phosphor-icons/react";
import { GlassSurface } from "@/design/glass/GlassSurface";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  QuestionPrompt,
  type QuestionConfig,
  type QuestionAnswer,
} from "@/components/agent-elements/question/question-prompt";
import {
  useQuestionActions,
  type PendingQuestionRequest,
} from "@/lib/agents/permission-store";

interface ChatQuestionCardProps {
  request: PendingQuestionRequest;
  className?: string;
}

export const ChatQuestionCard = memo(function ChatQuestionCard({
  request,
  className,
}: ChatQuestionCardProps) {
  const { replyQuestion, rejectQuestion } = useQuestionActions();
  const [busy, setBusy] = useState(false);
  const [answers, setAnswers] = useState<Record<number, QuestionAnswer>>({});
  const [questionIndex, setQuestionIndex] = useState(1);

  const questions = useMemo<QuestionConfig[]>(
    () =>
      request.questions.map((question) => ({
        kind:
          question.options.length === 0
            ? "text"
            : question.multiple
              ? "multi"
              : "single",
        title: question.header || question.question,
        description: question.header ? question.question : undefined,
        options: question.options.map((option, idx) => ({
          id: `${idx}-${option.label}`,
          label: option.label,
          description: option.description,
        })),
        allowCustom: question.custom,
        customLabel: "Custom answer",
        customPlaceholder: "Type your answer…",
        placeholder: "Type your answer…",
      })),
    [request.questions]
  );

  const totalQuestions = questions.length;
  if (totalQuestions === 0) return null;

  function handleReject() {
    if (busy) return;
    setBusy(true);
    try {
      rejectQuestion(request.requestId);
    } finally {
      setBusy(false);
    }
  }

  function handleSubmit(answer: QuestionAnswer) {
    if (busy) return;

    if (answer.kind === "skip") {
      handleReject();
      return;
    }

    const nextAnswers = {
      ...answers,
      [questionIndex]: answer,
    };
    setAnswers(nextAnswers);

    if (questionIndex < totalQuestions) {
      setQuestionIndex((current) => current + 1);
      return;
    }

    setBusy(true);
    try {
      const replyPayload = Array.from({ length: totalQuestions }, (_, idx) => {
        const currentAnswer = nextAnswers[idx + 1];
        return {
          questionIndex: idx,
          answer:
            currentAnswer?.kind === "multi"
              ? currentAnswer.selectedIds ?? []
              : currentAnswer?.kind === "single"
                ? currentAnswer.text?.trim() || currentAnswer?.selectedIds?.[0] || ""
                : currentAnswer?.kind === "text"
                  ? currentAnswer.text?.trim() || ""
                  : "",
        };
      });
      replyQuestion(request.requestId, replyPayload);
    } finally {
      setBusy(false);
    }
  }

  return (
    <GlassSurface
      className={cn(
        "w-full max-w-2xl mx-auto overflow-hidden",
        "border-l-4 border-l-[var(--accent-chat)]",
        className
      )}
      variant="default"
      border="subtle"
      blur="md"
      opacity="medium"
      rounded="xl"
      padding="none"
    >
      <div className="px-4 py-3 border-b border-white/5 bg-[var(--accent-chat)]/8">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="size-7 rounded-lg bg-[var(--accent-chat)]/15 flex items-center justify-center shrink-0">
              <Question size={16} className="text-[var(--accent-chat)]" weight="fill" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-[var(--ui-text-primary)] truncate">
                Agent question
              </p>
              <p className="text-xs text-[var(--ui-text-muted)]">
                {questionIndex}/{totalQuestions}
              </p>
            </div>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={handleReject}
            disabled={busy}
            aria-label="Skip question"
          >
            <X size={16} />
          </Button>
        </div>
      </div>

      <div className="px-1 py-1">
        <QuestionPrompt
          questions={questions}
          questionIndex={questionIndex}
          totalQuestions={totalQuestions}
          initialAnswer={answers[questionIndex]}
          submitLabel="Send"
          nextLabel="Next"
          skipLabel="Skip"
          allowSkip
          onPreviousQuestion={() => setQuestionIndex((current) => Math.max(1, current - 1))}
          onNextQuestion={() => setQuestionIndex((current) => Math.min(totalQuestions, current + 1))}
          onSubmit={handleSubmit}
          className="bg-transparent"
        />
      </div>
    </GlassSurface>
  );
});

export default ChatQuestionCard;
