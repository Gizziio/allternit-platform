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
              <button type="button"
                key={opt.label}
                className={`question-option${active ? ' question-option-active' : ''}`}
                onClick={() => toggleOption(opt.label)}
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
        <textarea aria-label="Type a custom answer…" className="question-custom"
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
        <button type="button"
          className="question-card-dismiss"
          onClick={handleReject}
          disabled={busy}
          title="Skip question"
        >
          <X className="size-3.5 " />
        </button>
      </div>

      {/* Questions */}
      <div className="question-card-body">
        {request.questions.map((q, i) => (
          <QuestionBlock
            key={`questionmodal-${i}`}
            question={q}
            index={i}
            value={answers[i] ?? ''}
            onChange={handleChange}
          />
        ))}
      </div>

      {/* Submit */}
      <div className="question-card-footer">
        <button type="button"
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
  background: var(--surface-floating, #1a1714);
  border: 1px solid rgba(200, 169, 110, 0.22);
  border-radius: 12px;
  overflow: hidden;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.5), 0 0 0 1px rgba(200,169,110,0.05);
}

.question-card-header {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 14px;
  background: rgba(200, 169, 110, 0.06);
  border-bottom: 1px solid rgba(200, 169, 110, 0.10);
}

.question-card-icon {
  width: 16px;
  height: 16px;
  font-size: 13px;
  font-weight: 700;
  color: var(--accent-cowork, #c8a96e);
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
}

.question-card-title {
  font-size: 11px;
  font-weight: 700;
  color: var(--accent-cowork, #c8a96e);
  text-transform: uppercase;
  letter-spacing: 0.07em;
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
  color: rgba(255, 255, 255, 0.28);
  cursor: pointer;
  padding: 0;
  transition: background 0.13s, color 0.13s;
}

.question-card-dismiss:hover:not(:disabled) {
  background: rgba(255, 255, 255, 0.07);
  color: rgba(255, 255, 255, 0.6);
}

.question-card-body {
  padding: 14px 14px 10px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.question-card-footer {
  padding: 10px 14px 12px;
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
  font-weight: 700;
  color: rgba(200, 169, 110, 0.45);
  text-transform: uppercase;
  letter-spacing: 0.07em;
  margin: 0;
}

.question-text {
  font-size: 13px;
  color: rgba(236, 236, 236, 0.82);
  margin: 0;
  line-height: 1.55;
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
  border: 1px solid rgba(255, 255, 255, 0.07);
  background: rgba(255, 255, 255, 0.025);
  cursor: pointer;
  transition: background 0.13s, border-color 0.13s;
  text-align: left;
  width: 100%;
}

.question-option:hover {
  background: rgba(200, 169, 110, 0.06);
  border-color: rgba(200, 169, 110, 0.18);
}

.question-option-active {
  background: rgba(200, 169, 110, 0.10) !important;
  border-color: rgba(200, 169, 110, 0.32) !important;
}

.question-option-label {
  font-size: 12px;
  font-weight: 500;
  color: rgba(236, 236, 236, 0.75);
}

.question-option-active .question-option-label {
  color: var(--accent-cowork, #c8a96e);
}

.question-option-desc {
  font-size: 11px;
  color: rgba(255, 255, 255, 0.32);
  line-height: 1.4;
}

.question-custom {
  width: 100%;
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid rgba(255, 255, 255, 0.09);
  border-radius: 7px;
  color: rgba(236, 236, 236, 0.78);
  font-size: 12px;
  padding: 8px 10px;
  resize: none;
  font-family: inherit;
  outline: none;
  transition: border-color 0.13s;
  box-sizing: border-box;
}

.question-custom:focus {
  border-color: rgba(200, 169, 110, 0.32);
}

.question-submit {
  padding: 7px 18px;
  border-radius: 7px;
  font-size: 12px;
  font-weight: 600;
  color: rgba(236, 236, 236, 0.9);
  background: rgba(200, 169, 110, 0.14);
  border: 1px solid rgba(200, 169, 110, 0.3);
  cursor: pointer;
  transition: background 0.13s, border-color 0.13s;
}

.question-submit:hover:not(:disabled) {
  background: rgba(200, 169, 110, 0.22);
  border-color: rgba(200, 169, 110, 0.45);
}

.question-submit:disabled {
  opacity: 0.38;
  cursor: not-allowed;
}
`;
