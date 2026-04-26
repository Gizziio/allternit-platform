"use client";

import React, { useMemo, useState } from "react";
import { LockSimple, Paperclip, Sparkle, StackSimple, X } from "@phosphor-icons/react";
import type { PendingPermissionRequest, PendingQuestionRequest } from "@/lib/agents";
import { usePermissionActions, useQuestionActions } from "@/lib/agents";
import { QuestionPrompt, type QuestionAnswer, type QuestionConfig } from "@/components/agent-elements/question/question-prompt";
import { ContextWindowCard } from "@/components/ai-elements/ContextWindowCard";

type ComposerPermissionInfoBarProps = {
  request: PendingPermissionRequest;
};

export function ComposerPermissionInfoBar({
  request,
}: ComposerPermissionInfoBarProps) {
  const { replyPermission } = usePermissionActions();

  return (
    <div
      style={{
        minHeight: 36,
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 12,
        padding: "8px 12px",
      }}
    >
      <div style={{ minWidth: 0, display: "flex", alignItems: "center", gap: 8 }}>
        <LockSimple size={14} weight="fill" style={{ color: "var(--accent-chat)", flexShrink: 0 }} />
        <div style={{ minWidth: 0, display: "flex", alignItems: "baseline", gap: 6, flexWrap: "wrap" }}>
          <span style={{ color: "var(--ui-text-primary)", fontSize: 12, fontWeight: 600 }}>
            Permission required
          </span>
          <span
            style={{
              color: "var(--ui-text-secondary)",
              fontSize: 12,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
            title={request.permission}
          >
            {request.permission}
          </span>
        </div>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
        <button
          type="button"
          onClick={() => replyPermission(request.requestId, "reject")}
          style={ghostButtonStyle}
        >
          Deny
        </button>
        <button
          type="button"
          onClick={() => replyPermission(request.requestId, "once")}
          style={ghostButtonStyle}
        >
          Allow once
        </button>
        <button
          type="button"
          onClick={() => replyPermission(request.requestId, "always")}
          style={primaryButtonStyle}
        >
          Always allow
        </button>
      </div>
    </div>
  );
}

type ComposerQuestionBarProps = {
  request: PendingQuestionRequest;
};

export function ComposerQuestionBar({ request }: ComposerQuestionBarProps) {
  const { replyQuestion, rejectQuestion } = useQuestionActions();
  const [questionIndex, setQuestionIndex] = useState(1);
  const [answers, setAnswers] = useState<Record<number, QuestionAnswer>>({});

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
        customPlaceholder: "Type your answer...",
        placeholder: "Type your answer...",
      })),
    [request.questions],
  );

  const totalQuestions = questions.length;

  if (totalQuestions === 0) return null;

  return (
    <div>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 8,
          padding: "8px 12px",
          borderBottom: "1px solid var(--chat-composer-border)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
          <Sparkle size={14} style={{ color: "var(--accent-chat)", flexShrink: 0 }} />
          <span style={{ color: "var(--ui-text-primary)", fontSize: 12, fontWeight: 600 }}>
            Agent question
          </span>
          <span style={{ color: "var(--ui-text-muted)", fontSize: 12 }}>
            {questionIndex}/{totalQuestions}
          </span>
        </div>
        <button
          type="button"
          aria-label="Dismiss question"
          onClick={() => rejectQuestion(request.requestId)}
          style={iconButtonStyle}
        >
          <X size={14} />
        </button>
      </div>

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
        onSubmit={(answer) => {
          if (answer.kind === "skip") {
            rejectQuestion(request.requestId);
            return;
          }

          const nextAnswers = {
            ...answers,
            [questionIndex]: answer,
          };

          setAnswers(nextAnswers);

          if (questionIndex < totalQuestions) {
            setQuestionIndex(questionIndex + 1);
            return;
          }

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
        }}
        className="bg-transparent"
      />
    </div>
  );
}

type ComposerStatusInfoBarProps = {
  modelLabel?: string | null;
  modeLabel: string;
  attachmentCount?: number;
};

export function ComposerStatusInfoBar({
  modelLabel,
  modeLabel,
  attachmentCount,
}: ComposerStatusInfoBarProps) {
  return (
    <div
      style={{
        minHeight: 34,
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 12,
        padding: "7px 12px",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 0, flexWrap: "wrap" }}>
        <ContextWindowCard>
          <button style={{ background: 'transparent', border: 'none', padding: 0, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 12 }}>
            <InfoPill icon={<StackSimple size={12} />} label={`Mode ${modeLabel}`} />
            {modelLabel ? (
              <InfoPill icon={<Sparkle size={12} />} label={modelLabel} />
            ) : null}
          </button>
        </ContextWindowCard>
      </div>
      {typeof attachmentCount === "number" ? (
        <div style={{ display: "flex", alignItems: "center", gap: 6, color: "var(--ui-text-secondary)", fontSize: 12 }}>
          <Paperclip size={12} />
          <span>{attachmentCount === 0 ? "No attachments" : `${attachmentCount} attachment${attachmentCount === 1 ? "" : "s"}`}</span>
        </div>
      ) : null}
    </div>
  );
}

function InfoPill({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <div
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        minWidth: 0,
        color: "var(--ui-text-secondary)",
        fontSize: 12,
      }}
    >
      <span style={{ display: "inline-flex", alignItems: "center", color: "var(--accent-chat)" }}>
        {icon}
      </span>
      <span
        style={{
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
        }}
        title={label}
      >
        {label}
      </span>
    </div>
  );
}

const ghostButtonStyle: React.CSSProperties = {
  height: 26,
  borderRadius: 999,
  border: "1px solid var(--chat-composer-border)",
  background: "transparent",
  color: "var(--ui-text-secondary)",
  fontSize: 12,
  fontWeight: 600,
  padding: "0 10px",
  cursor: "pointer",
};

const primaryButtonStyle: React.CSSProperties = {
  ...ghostButtonStyle,
  border: "1px solid color-mix(in srgb, var(--accent-chat) 36%, transparent)",
  background: "color-mix(in srgb, var(--accent-chat) 14%, transparent)",
  color: "var(--ui-text-primary)",
};

const iconButtonStyle: React.CSSProperties = {
  width: 24,
  height: 24,
  borderRadius: 999,
  border: "none",
  background: "transparent",
  color: "var(--ui-text-muted)",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  cursor: "pointer",
};
