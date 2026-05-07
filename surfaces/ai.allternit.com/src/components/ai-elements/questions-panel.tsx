"use client";

import { memo, useCallback } from "react";
import { motion } from "framer-motion";
import { IconArrowRight, IconHelpCircle } from "@tabler/icons-react";
import { cn } from "@/lib/utils";

export type QuestionItem = {
  id: string;
  question: string;
  context?: string;
};

export type QuestionsPanelProps = {
  questions: QuestionItem[];
  onSelect: (item: QuestionItem) => void;
  title?: string;
  orientation?: "horizontal" | "vertical";
  className?: string;
  disabled?: boolean;
};

export const QuestionsPanel = memo(function QuestionsPanel({
  questions,
  onSelect,
  title = "Follow-up questions",
  orientation = "horizontal",
  className,
  disabled,
}: QuestionsPanelProps) {
  const handleSelect = useCallback(
    (item: QuestionItem) => {
      if (!disabled) onSelect(item);
    },
    [disabled, onSelect]
  );

  if (questions.length === 0) return null;

  const isVertical = orientation === "vertical";

  return (
    <div className={cn("w-full", className)}>
      <div className="flex items-center gap-2 mb-2">
        <IconHelpCircle className="w-3.5 h-3.5 text-muted-foreground" />
        <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
          {title}
        </span>
      </div>

      <div
        className={cn(
          "flex gap-2",
          isVertical ? "flex-col" : "flex-row flex-wrap"
        )}
      >
        {questions.map((item, index) => (
          <motion.button
            key={item.id}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.05, duration: 0.2 }}
            onClick={() => handleSelect(item)}
            disabled={disabled}
            className={cn(
              "group relative text-left transition-all duration-150",
              "border border-border bg-transparent hover:bg-muted/50 hover:border-muted-foreground/30",
              "text-sm text-foreground/80 hover:text-foreground",
              "disabled:opacity-50 disabled:pointer-events-none",
              isVertical
                ? "w-full px-3 py-2.5 rounded-lg"
                : "flex-1 min-w-[180px] max-w-[280px] px-3 py-2.5 rounded-xl"
            )}
          >
            <div className="flex items-start justify-between gap-2">
              <span className="line-clamp-2 leading-snug">{item.question}</span>
              <IconArrowRight
                className={cn(
                  "shrink-0 w-4 h-4 text-muted-foreground/50 transition-all duration-150",
                  "group-hover:text-muted-foreground group-hover:translate-x-0.5",
                  isVertical ? "mt-0.5" : "mt-0.5"
                )}
              />
            </div>
            {item.context && (
              <span className="block mt-1 text-[11px] text-muted-foreground line-clamp-1">
                {item.context}
              </span>
            )}
          </motion.button>
        ))}
      </div>
    </div>
  );
});

export type InlineQuestionsProps = {
  questions: QuestionItem[];
  onSelect: (item: QuestionItem) => void;
  className?: string;
};

/**
 * Compact inline variant for use directly after an AI message.
 * Styled like Cursor's question chips below assistant responses.
 */
export const InlineQuestions = memo(function InlineQuestions({
  questions,
  onSelect,
  className,
}: InlineQuestionsProps) {
  if (questions.length === 0) return null;

  return (
    <div className={cn("flex flex-wrap gap-1.5 mt-3", className)}>
      {questions.map((item, index) => (
        <motion.button
          key={item.id}
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: index * 0.04, duration: 0.15 }}
          onClick={() => onSelect(item)}
          className={cn(
            "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[13px]",
            "border border-border/80 bg-secondary/40 hover:bg-secondary/80 hover:border-border",
            "text-secondary-foreground transition-colors duration-150"
          )}
        >
          <span className="truncate max-w-[240px]">{item.question}</span>
          <IconArrowRight className="w-3 h-3 shrink-0 opacity-50" />
        </motion.button>
      ))}
    </div>
  );
});
