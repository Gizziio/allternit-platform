/**
 * QuestionModal — renders question requests from agents
 *
 * The agent may ask the user structured questions with predefined options
 * (single or multi-select) or a free-text custom answer.
 */

import React, { memo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { X } from '@phosphor-icons/react';
import { useQuestionStore, usePendingQuestions, type Question, type PendingQuestionRequest } from '@/lib/agents/permission-store';

// ============================================================================
// Single question block
// ============================================================================

interface QuestionBlockProps {
  question: Question;
  index: number;
  value: string | string[];
  onChange: (index: number, value: string | string[]) => void;
}

const QuestionBlock = memo(function QuestionBlock({
  question,
  index,
  value,
  onChange,
}: QuestionBlockProps) {
  const [customText, setCustomText] = useState('');
  const selected = Array.isArray(value) ? value : value ? [value] : [];

  function toggleOption(label: string) {
    if (question.multiple) {
      const next = selected.includes(label)
        ? selected.filter((v) => v !== label)
        : [...selected, label];
      onChange(index, next);
    } else {
      onChange(index, label);
    }
  }

  return (
    <div className="question-block">
      {question.header && (
        <p className="question-header">{question.header}</p>
      )}
      <p className="question-text">{question.question}</p>

      {question.options.length > 0 && (
        <div className="question-options">
          {question.options.map((opt) => {
            const active = selected.includes(opt.label);
            return (
              <button
                key={opt.label}
                className={`question-option${active ? ' question-option-active' : ''}`}
                onClick={() => toggleOption(opt.label)}
                type="button"
              >
                <span className="question-option-label">{opt.label}</span>
                {opt.description && (
                  <span className="question-option-desc">{opt.description}</span>
                )}
              </button>
            );
          })}
        </div>
      )}

      {question.custom && (
        <textarea
          className="question-custom"
          placeholder="Type a custom answer…"
          value={customText}
          rows={2}
          onChange={(e) => {
            setCustomText(e.target.value);
            onChange(index, e.target.value);
          }}
        />
      )}
    </div>
  );
});

// ============================================================================
// Single question request card
// ============================================================================

interface QuestionCardProps {
  request: PendingQuestionRequest;
}

const QuestionCard = memo(function QuestionCard({ request }: QuestionCardProps) {
  const replyQuestion = useQuestionStore((s) => s.replyQuestion);
  const rejectQuestion = useQuestionStore((s) => s.rejectQuestion);

  const [answers, setAnswers] = useState<Array<string | string[]>>(
    request.questions.map(() => ''),
  );
  const [busy, setBusy] = useState(false);

  function handleChange(index: number, value: string | string[]) {
    setAnswers((prev) => {
      const next = [...prev];
      next[index] = value;
      return next;
    });
  }

  async function handleSubmit() {
    if (busy) return;
    setBusy(true);
    try {
      replyQuestion(
        request.requestId,
        answers.map((answer, questionIndex) => ({ questionIndex, answer })),
      );
    } finally {
      setBusy(false);
    }
  }

  async function handleReject() {
    if (busy) return;
    setBusy(true);
    try {
      rejectQuestion(request.requestId);
    } finally {
      setBusy(false);
    }
  }

  const hasAnswers = answers.some((a) =>
    Array.isArray(a) ? a.length > 0 : a.length > 0,
  );

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      className="question-card"
    >
      {/* Header */}
      <div className="question-card-header">
        <span className="question-card-icon" aria-hidden="true">?</span>
        <span className="question-card-title">Agent Question</span>
        <button
          className="question-card-dismiss"
          onClick={handleReject}
          disabled={busy}
          title="Skip question"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Questions */}
      <div className="question-card-body">
        {request.questions.map((q, i) => (
          <QuestionBlock
            key={i}
            question={q}
            index={i}
            value={answers[i] ?? ''}
            onChange={handleChange}
          />
        ))}
      </div>

      {/* Submit */}
      <div className="question-card-footer">
        <button
          className="question-submit"
          onClick={handleSubmit}
          disabled={busy || !hasAnswers}
        >
          {busy ? 'Submitting…' : 'Submit'}
        </button>
      </div>
    </motion.div>
  );
});

// ============================================================================
// QuestionModal — renders all pending question requests for a session
// ============================================================================

interface QuestionModalProps {
  sessionId: string;
}

export const QuestionModal = memo(function QuestionModal({ sessionId }: QuestionModalProps) {
  const requests = usePendingQuestions(sessionId);

  if (requests.length === 0) return null;

  return (
    <>
      <style>{styles}</style>
      <AnimatePresence mode="popLayout">
        {requests.map((req) => (
          <QuestionCard key={req.requestId} request={req} />
        ))}
      </AnimatePresence>
    </>
  );
});

// ============================================================================
// Styles
// ============================================================================

const styles = `
.question-card {
  background: #1e1e1e;
  border: 1px solid rgba(147, 197, 253, 0.2);
  border-radius: 12px;
  overflow: hidden;
  box-shadow: 0 4px 24px rgba(0, 0, 0, 0.4);
}

.question-card-header {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 14px;
  background: rgba(147, 197, 253, 0.06);
  border-bottom: 1px solid rgba(147, 197, 253, 0.1);
}

.question-card-icon {
  width: 14px;
  height: 14px;
  color: #93c5fd;
  flex-shrink: 0;
}

.question-card-title {
  font-size: 11px;
  font-weight: 600;
  color: #93c5fd;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  flex: 1;
}

.question-card-dismiss {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 22px;
  height: 22px;
  border-radius: 4px;
  background: transparent;
  border: none;
  color: rgba(255, 255, 255, 0.3);
  cursor: pointer;
  padding: 0;
  transition: background 0.15s;
}

.question-card-dismiss:hover:not(:disabled) {
  background: rgba(255, 255, 255, 0.08);
  color: rgba(255, 255, 255, 0.6);
}

.question-card-body {
  padding: 12px 14px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.question-card-footer {
  padding: 10px 14px;
  border-top: 1px solid rgba(255, 255, 255, 0.05);
  display: flex;
  justify-content: flex-end;
}

.question-block {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.question-header {
  font-size: 10px;
  font-weight: 600;
  color: rgba(255, 255, 255, 0.35);
  text-transform: uppercase;
  letter-spacing: 0.06em;
  margin: 0;
}

.question-text {
  font-size: 13px;
  color: rgba(255, 255, 255, 0.8);
  margin: 0;
  line-height: 1.5;
}

.question-options {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.question-option {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 2px;
  padding: 8px 10px;
  border-radius: 7px;
  border: 1px solid rgba(255, 255, 255, 0.08);
  background: rgba(255, 255, 255, 0.03);
  cursor: pointer;
  transition: background 0.15s, border-color 0.15s;
  text-align: left;
}

.question-option:hover {
  background: rgba(255, 255, 255, 0.06);
  border-color: rgba(255, 255, 255, 0.14);
}

.question-option-active {
  background: rgba(147, 197, 253, 0.08) !important;
  border-color: rgba(147, 197, 253, 0.3) !important;
}

.question-option-label {
  font-size: 12px;
  font-weight: 500;
  color: rgba(255, 255, 255, 0.75);
}

.question-option-active .question-option-label {
  color: #93c5fd;
}

.question-option-desc {
  font-size: 11px;
  color: rgba(255, 255, 255, 0.35);
}

.question-custom {
  width: 100%;
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 7px;
  color: rgba(255, 255, 255, 0.75);
  font-size: 12px;
  padding: 8px 10px;
  resize: none;
  font-family: inherit;
  outline: none;
  transition: border-color 0.15s;
  box-sizing: border-box;
}

.question-custom:focus {
  border-color: rgba(147, 197, 253, 0.3);
}

.question-submit {
  padding: 6px 16px;
  border-radius: 6px;
  font-size: 12px;
  font-weight: 500;
  color: #fff;
  background: rgba(147, 197, 253, 0.15);
  border: 1px solid rgba(147, 197, 253, 0.3);
  cursor: pointer;
  transition: background 0.15s;
}

.question-submit:hover:not(:disabled) {
  background: rgba(147, 197, 253, 0.22);
}

.question-submit:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}
`;
