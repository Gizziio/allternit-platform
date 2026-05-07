"use client";

import { useCallback, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { CaretRight, Check, X } from "@phosphor-icons/react";
import { cn } from "@/lib/utils";
import type { QuestionItem, QuestionRequest } from "./session-composer-state";

interface QuestionDockState {
  tab: number;
  answers: string[][];
  customInputs: string[];
  editingCustom: boolean;
}

function buildInitialState(questions: QuestionItem[]): QuestionDockState {
  return {
    tab: 0,
    answers: questions.map(() => []),
    customInputs: questions.map(() => ""),
    editingCustom: false,
  };
}

interface SessionQuestionDockProps {
  request: QuestionRequest;
  onReply: (answers: string[][]) => void;
  onReject: () => void;
}

export function SessionQuestionDock({ request, onReply, onReject }: SessionQuestionDockProps) {
  const { questions } = request;
  const isSingle = questions.length === 1 && questions[0]?.multiple !== true;
  const totalTabs = isSingle ? 1 : questions.length + 1; // +1 for confirm tab

  const [st, setSt] = useState<QuestionDockState>(() => buildInitialState(questions));
  const customTextareaRef = useRef<HTMLTextAreaElement>(null);

  const currentQuestion = questions[st.tab] ?? questions[0]!;
  const isConfirmTab = !isSingle && st.tab === questions.length;
  const options = currentQuestion?.options ?? [];
  const allowCustom = currentQuestion?.custom !== false;
  const isMulti = currentQuestion?.multiple === true;

  const answeredCount = st.answers.filter((a) => a.length > 0).length;
  const allAnswered = answeredCount === questions.length;

  const setTab = useCallback((tab: number) => {
    setSt((prev) => ({ ...prev, tab, editingCustom: false }));
  }, []);

  const pickOption = useCallback(
    (label: string) => {
      setSt((prev) => {
        const answers = prev.answers.map((a, i) => (i === prev.tab ? [label] : a));
        if (isSingle) {
          onReply(answers);
          return prev;
        }
        return { ...prev, answers, tab: prev.tab + 1, editingCustom: false };
      });
    },
    [isSingle, onReply],
  );

  const toggleOption = useCallback((label: string) => {
    setSt((prev) => {
      const existing = prev.answers[prev.tab] ?? [];
      const next = existing.includes(label)
        ? existing.filter((x) => x !== label)
        : [...existing, label];
      const answers = prev.answers.map((a, i) => (i === prev.tab ? next : a));
      return { ...prev, answers };
    });
  }, []);

  const confirmCustom = useCallback(
    (text: string) => {
      const trimmed = text.trim();
      setSt((prev) => {
        const inputs = prev.customInputs.map((v, i) => (i === prev.tab ? trimmed : v));
        if (!trimmed) {
          const answers = prev.answers.map((a, i) =>
            i === prev.tab ? a.filter((x) => x !== prev.customInputs[prev.tab]) : a,
          );
          return { ...prev, customInputs: inputs, answers, editingCustom: false };
        }
        const existing = prev.answers[prev.tab] ?? [];
        const oldCustom = prev.customInputs[prev.tab];
        let next = existing.filter((x) => x !== oldCustom);
        if (isMulti) {
          if (!next.includes(trimmed)) next = [...next, trimmed];
        } else {
          next = [trimmed];
        }
        const answers = prev.answers.map((a, i) => (i === prev.tab ? next : a));
        if (!isMulti && isSingle) {
          onReply(answers);
          return { ...prev, customInputs: inputs, answers, editingCustom: false };
        }
        const nextTab = isSingle ? prev.tab : prev.tab + 1;
        return {
          ...prev,
          customInputs: inputs,
          answers,
          tab: nextTab,
          editingCustom: false,
        };
      });
    },
    [isSingle, isMulti, onReply],
  );

  const submitAnswers = useCallback(() => {
    if (!allAnswered) return;
    onReply(st.answers);
  }, [allAnswered, onReply, st.answers]);

  return (
    <div
      data-component="session-question-dock"
      className="w-full rounded-[16px] bg-[var(--glass-bg-thick)] border border-[var(--border-strong)] shadow-lg overflow-hidden"
      style={{ borderLeft: "3px solid var(--accent-chat)" }}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--border-subtle)]">
        <div className="flex items-center gap-2">
          <span className="text-[12px] font-semibold uppercase tracking-wide text-[var(--accent-chat)]">
            Question
          </span>
          {!isSingle && (
            <span className="text-[11px] text-[var(--text-tertiary)]">
              {answeredCount} / {questions.length} answered
            </span>
          )}
        </div>
        <button
          data-slot="dismiss"
          onClick={onReject}
          className="flex items-center gap-1 text-[11px] text-[var(--text-tertiary)] hover:text-[var(--status-error)] transition-colors"
        >
          <X size={12} />
          dismiss
        </button>
      </div>

      {/* Tabs (multi-question only) */}
      {!isSingle && (
        <div className="flex items-center gap-1 px-3 pt-3 pb-0 overflow-x-auto">
          {questions.map((q, i) => {
            const isActive = st.tab === i;
            const isAnswered = (st.answers[i]?.length ?? 0) > 0;
            return (
              <button
                key={i}
                data-slot={`tab-${i}`}
                onClick={() => setTab(i)}
                className={cn(
                  "shrink-0 px-3 h-7 rounded-[8px] text-[11px] font-medium transition-colors",
                  isActive
                    ? "bg-[var(--accent-chat)] text-white"
                    : isAnswered
                      ? "bg-[var(--bg-active)] text-[var(--text-primary)] hover:bg-[var(--bg-hover)]"
                      : "bg-transparent text-[var(--text-tertiary)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-secondary)]",
                )}
              >
                {q.header}
              </button>
            );
          })}
          <button
            data-slot="tab-confirm"
            onClick={() => setTab(questions.length)}
            className={cn(
              "shrink-0 px-3 h-7 rounded-[8px] text-[11px] font-medium transition-colors",
              isConfirmTab
                ? "bg-[var(--accent-chat)] text-white"
                : "bg-transparent text-[var(--text-tertiary)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-secondary)]",
            )}
          >
            Confirm
          </button>
        </div>
      )}

      {/* Body */}
      <AnimatePresence mode="wait" initial={false}>
        {isConfirmTab ? (
          <motion.div
            key="confirm"
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.13 }}
            className="px-4 py-3 flex flex-col gap-3"
          >
            <p className="text-[13px] text-[var(--text-primary)] font-medium">
              Review your answers
            </p>
            {questions.map((q, i) => {
              const answer = st.answers[i]?.join(", ") ?? "";
              return (
                <div key={i} className="flex flex-col gap-0.5">
                  <span className="text-[11px] text-[var(--text-tertiary)] uppercase tracking-wide">
                    {q.header}
                  </span>
                  <span
                    className={cn(
                      "text-[13px]",
                      answer ? "text-[var(--text-primary)]" : "text-[var(--status-error)]",
                    )}
                  >
                    {answer || "Not answered"}
                  </span>
                </div>
              );
            })}
          </motion.div>
        ) : (
          <motion.div
            key={`question-${st.tab}`}
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.13 }}
            className="px-4 py-3 flex flex-col gap-3"
          >
            <p className="text-[13px] text-[var(--text-primary)] leading-snug">
              {currentQuestion.question}
              {isMulti && (
                <span className="ml-1.5 text-[11px] text-[var(--text-tertiary)]">
                  (select multiple)
                </span>
              )}
            </p>

            <div data-slot="options" className="flex flex-col gap-1">
              {options.map((opt, i) => {
                const isPicked = (st.answers[st.tab] ?? []).includes(opt.label);
                return (
                  <button
                    key={i}
                    data-slot={`option-${i}`}
                    onClick={() => (isMulti ? toggleOption(opt.label) : pickOption(opt.label))}
                    className={cn(
                      "w-full text-left rounded-[10px] px-3 py-2 transition-colors group",
                      isPicked
                        ? "bg-[var(--accent-chat)]/15 border border-[var(--accent-chat)]/40"
                        : "bg-[var(--bg-hover)] border border-transparent hover:border-[var(--border-default)] hover:bg-[var(--bg-active)]",
                    )}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="flex items-center gap-2">
                        <span
                          className={cn(
                            "text-[11px] font-mono shrink-0",
                            isPicked
                              ? "text-[var(--accent-chat)]"
                              : "text-[var(--text-tertiary)]",
                          )}
                        >
                          {i + 1}.
                        </span>
                        <span
                          className={cn(
                            "text-[13px] font-medium",
                            isPicked
                              ? "text-[var(--accent-chat)]"
                              : "text-[var(--text-primary)]",
                          )}
                        >
                          {isMulti ? (
                            <span className="inline-flex items-center gap-1.5">
                              <span
                                className={cn(
                                  "inline-flex items-center justify-center w-3.5 h-3.5 rounded-sm border text-[9px]",
                                  isPicked
                                    ? "bg-[var(--accent-chat)] border-[var(--accent-chat)] text-white"
                                    : "border-[var(--border-strong)] text-transparent",
                                )}
                              >
                                {isPicked && <Check size={8} weight="bold" />}
                              </span>
                              {opt.label}
                            </span>
                          ) : (
                            opt.label
                          )}
                        </span>
                      </span>
                      {!isMulti && isPicked && (
                        <Check size={13} className="text-[var(--accent-chat)] shrink-0" />
                      )}
                    </div>
                    {opt.description && (
                      <p className="mt-0.5 ml-5 text-[11px] text-[var(--text-tertiary)] leading-snug">
                        {opt.description}
                      </p>
                    )}
                  </button>
                );
              })}

              {allowCustom && (
                <div className="rounded-[10px] border border-transparent overflow-hidden">
                  {st.editingCustom ? (
                    <div className="bg-[var(--bg-hover)] border border-[var(--border-default)] rounded-[10px] p-2">
                      <textarea
                        ref={customTextareaRef}
                        autoFocus
                        value={st.customInputs[st.tab] ?? ""}
                        onChange={(e) =>
                          setSt((prev) => {
                            const customInputs = prev.customInputs.map((v, i) =>
                              i === prev.tab ? e.target.value : v,
                            );
                            return { ...prev, customInputs };
                          })
                        }
                        onKeyDown={(e) => {
                          if (e.key === "Enter" && !e.shiftKey) {
                            e.preventDefault();
                            confirmCustom(st.customInputs[st.tab] ?? "");
                          }
                          if (e.key === "Escape") {
                            setSt((prev) => ({ ...prev, editingCustom: false }));
                          }
                        }}
                        placeholder="Type a custom answer…"
                        rows={2}
                        className={cn(
                          "w-full resize-none bg-transparent text-[13px]",
                          "text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)]",
                          "outline-none border-none",
                        )}
                      />
                      <div className="flex justify-end gap-2 mt-1">
                        <button
                          onClick={() => setSt((prev) => ({ ...prev, editingCustom: false }))}
                          className="text-[11px] text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] transition-colors"
                        >
                          cancel
                        </button>
                        <button
                          onClick={() => confirmCustom(st.customInputs[st.tab] ?? "")}
                          className="text-[11px] text-[var(--accent-chat)] font-medium hover:opacity-80 transition-opacity"
                        >
                          confirm
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button
                      data-slot="custom-answer"
                      onClick={() => {
                        setSt((prev) => ({ ...prev, editingCustom: true }));
                        setTimeout(() => customTextareaRef.current?.focus(), 50);
                      }}
                      className={cn(
                        "w-full text-left rounded-[10px] px-3 py-2 transition-colors",
                        "bg-[var(--bg-hover)] border border-transparent hover:border-[var(--border-default)] hover:bg-[var(--bg-active)]",
                      )}
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-[11px] font-mono text-[var(--text-tertiary)]">
                          {options.length + 1}.
                        </span>
                        <span className="text-[13px] text-[var(--text-secondary)] flex items-center gap-1.5">
                          Custom answer
                          <CaretRight size={11} className="opacity-50" />
                        </span>
                        {st.customInputs[st.tab] && (
                          <span className="ml-auto text-[11px] text-[var(--text-tertiary)] font-mono truncate max-w-[120px]">
                            {st.customInputs[st.tab]}
                          </span>
                        )}
                      </div>
                    </button>
                  )}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Footer */}
      {(!isSingle || isMulti) && (
        <div className="flex items-center justify-between px-4 py-3 border-t border-[var(--border-subtle)] bg-[var(--bg-hover)]">
          <div className="flex items-center gap-3 text-[11px] text-[var(--text-tertiary)]">
            {!isSingle && (
              <span>
                <span className="text-[var(--text-primary)]">⇆</span> switch tab
              </span>
            )}
            <span>
              <span className="text-[var(--text-primary)]">enter</span>{" "}
              {isConfirmTab ? "submit" : isMulti ? "toggle" : "select"}
            </span>
          </div>

          {(isConfirmTab || isMulti) && (
            <button
              data-slot="submit"
              onClick={isConfirmTab ? submitAnswers : undefined}
              disabled={isConfirmTab && !allAnswered}
              className={cn(
                "h-8 px-4 text-[12px] font-medium rounded-[10px] transition-colors",
                allAnswered
                  ? "bg-[var(--accent-chat)] text-white hover:opacity-90"
                  : "bg-[var(--bg-hover)] text-[var(--text-tertiary)] border border-[var(--border-default)] cursor-not-allowed opacity-50",
              )}
            >
              Submit
            </button>
          )}
        </div>
      )}
    </div>
  );
}
