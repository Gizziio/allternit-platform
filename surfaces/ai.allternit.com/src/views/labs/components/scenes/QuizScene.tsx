'use client';

import React, { useState, useCallback } from 'react';
import { CheckCircle, XCircle, ArrowRight, RotateCcw, Eye } from 'lucide-react';
import { GlassCardInteractive } from '@/design/glass/GlassCard';
import { GlassSurfaceBase, GlassSurfaceThin } from '@/design/glass/GlassSurface';
import { Text } from '@/components/typography/Text';

const ACCENT = 'var(--accent-primary)';
const TEXT_PRIMARY = 'var(--ui-text-primary)';
const TEXT_SECONDARY = 'var(--ui-text-secondary)';
const TEXT_MUTED = 'var(--ui-text-muted)';
const STATUS_SUCCESS = 'var(--status-success)';
const STATUS_ERROR = 'var(--status-error)';
const BORDER_SUBTLE = 'var(--ui-border-muted)';

interface QuizQuestion {
  question: string;
  options: string[];
  correctIndex: number;
  explanation: string;
}

interface QuizSceneProps {
  title: string;
  questions: QuizQuestion[];
  onComplete?: (score: number) => void;
}

export function QuizScene({ title, questions, onComplete }: QuizSceneProps) {
  const [currentQ, setCurrentQ] = useState(0);
  const [answers, setAnswers] = useState<(number | null)[]>(() =>
    Array(questions.length).fill(null)
  );
  const [revealed, setRevealed] = useState<Set<number>>(new Set());
  const [finished, setFinished] = useState(false);
  const [attemptCount, setAttemptCount] = useState(1);

  const q = questions[currentQ];
  const selected = answers[currentQ];
  const isRevealed = revealed.has(currentQ);
  const isCorrect = selected === q.correctIndex;
  const correctCount = answers.filter((a, i) => a === questions[i].correctIndex).length;

  const handleSelect = useCallback((idx: number) => {
    if (isRevealed) return;
    setAnswers(prev => {
      const next = [...prev];
      next[currentQ] = idx;
      return next;
    });
    setRevealed(prev => new Set(prev).add(currentQ));
    if (idx === q.correctIndex) {
      // correct answer tracking is now derived from answers array
    }
  }, [currentQ, isRevealed, q.correctIndex]);

  const handleNext = useCallback(() => {
    if (currentQ + 1 < questions.length) {
      setCurrentQ(c => c + 1);
    } else {
      const finalScore = Math.round((correctCount / questions.length) * 100);
      setFinished(true);
      onComplete?.(finalScore);
    }
  }, [currentQ, questions.length, correctCount, onComplete]);

  const handleRestart = useCallback(() => {
    setCurrentQ(0);
    setAnswers(Array(questions.length).fill(null));
    setRevealed(new Set());
    setFinished(false);
    setAttemptCount(c => c + 1);
  }, [questions.length]);

  const handleReview = useCallback(() => {
    // Keep answers, keep revealed state, just go back to first question
    setCurrentQ(0);
    setFinished(false);
    setAttemptCount(c => c + 1);
  }, []);

  const goToQuestion = useCallback((idx: number) => {
    setCurrentQ(idx);
    setFinished(false);
  }, []);

  if (finished) {
    const score = Math.round((correctCount / questions.length) * 100);
    return (
      <GlassSurfaceBase
        blur="md"
        border="subtle"
        style={{ maxWidth: 640, margin: '0 auto', padding: '48px 40px', textAlign: 'center' }}
      >
        <div style={{
          width: 64, height: 64, borderRadius: '50%',
          background: score >= 70 ? `${STATUS_SUCCESS}20` : `${STATUS_ERROR}20`,
          border: `2px solid ${score >= 70 ? STATUS_SUCCESS : STATUS_ERROR}`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          margin: '0 auto 20px',
        }}>
          {score >= 70 ? <CheckCircle size={32} color={STATUS_SUCCESS} /> : <XCircle size={32} color={STATUS_ERROR} />}
        </div>
        <Text variant="heading" style={{ fontSize: 28, fontWeight: 700, margin: '0 0 8px', color: TEXT_PRIMARY }}>
          {score >= 70 ? 'Great Job!' : 'Keep Learning'}
        </Text>
        <Text variant="body" style={{ fontSize: 15, color: TEXT_SECONDARY, margin: '0 0 8px' }}>
          You scored <strong style={{ color: score >= 70 ? STATUS_SUCCESS : STATUS_ERROR }}>{score}%</strong> ({correctCount} / {questions.length} correct)
        </Text>
        {attemptCount > 1 && (
          <Text variant="caption" style={{ fontSize: 12, color: TEXT_MUTED, margin: '0 0 20px' }}>
            Attempt {attemptCount}
          </Text>
        )}

        {/* Question review dots */}
        <div style={{ display: 'flex', justifyContent: 'center', gap: 8, marginBottom: 24, flexWrap: 'wrap' }}>
          {questions.map((_, idx) => {
            const a = answers[idx];
            const correct = a === questions[idx].correctIndex;
            return (
              <button
                key={idx}
                onClick={() => goToQuestion(idx)}
                title={`Question ${idx + 1}`}
                style={{
                  width: 32, height: 32, borderRadius: 8,
                  background: correct ? `${STATUS_SUCCESS}20` : a !== null ? `${STATUS_ERROR}20` : 'rgba(255,255,255,0.04)',
                  border: `1.5px solid ${correct ? STATUS_SUCCESS : a !== null ? STATUS_ERROR : BORDER_SUBTLE}`,
                  color: correct ? STATUS_SUCCESS : a !== null ? STATUS_ERROR : TEXT_MUTED,
                  fontSize: 12, fontWeight: 700,
                  cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  transition: 'all .15s',
                }}
              >
                {idx + 1}
              </button>
            );
          })}
        </div>

        <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
          <button
            onClick={handleReview}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 8,
              padding: '10px 20px', background: 'rgba(255,255,255,.06)',
              border: `1px solid ${BORDER_SUBTLE}`, borderRadius: 10,
              color: TEXT_PRIMARY, fontWeight: 600, fontSize: 14,
              cursor: 'pointer', transition: 'all .18s',
            }}
            onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,.1)'; }}
            onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,.06)'; }}
          >
            <Eye size={14} /> Review Answers
          </button>
          <button
            onClick={handleRestart}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 8,
              padding: '10px 20px', background: ACCENT,
              border: 'none', borderRadius: 10,
              color: 'var(--surface-canvas)', fontWeight: 600,
              fontSize: 14, cursor: 'pointer', transition: 'all .18s',
            }}
          >
            <RotateCcw size={14} /> Retake Quiz
          </button>
        </div>
      </GlassSurfaceBase>
    );
  }

  return (
    <GlassSurfaceBase
      blur="md"
      border="subtle"
      style={{ maxWidth: 640, margin: '0 auto', padding: '32px 40px' }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <Text variant="subheading" style={{ fontSize: 14, fontWeight: 700, color: ACCENT, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
          Knowledge Check
        </Text>
        <Text variant="caption" style={{ fontSize: 12, color: TEXT_MUTED }}>
          Question {currentQ + 1} of {questions.length}
        </Text>
      </div>

      <Text variant="heading" as="h3" style={{ fontSize: 20, fontWeight: 600, margin: '0 0 24px', color: TEXT_PRIMARY, lineHeight: 1.4 }}>
        {q.question}
      </Text>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 20 }}>
        {q.options.map((opt, idx) => {
          const isSelected = selected === idx;
          const isCorrectAnswer = idx === q.correctIndex;
          let borderColor = BORDER_SUBTLE;
          let bg = 'transparent';

          if (isRevealed) {
            if (isCorrectAnswer) {
              borderColor = STATUS_SUCCESS;
              bg = `${STATUS_SUCCESS}12`;
            } else if (isSelected && !isCorrectAnswer) {
              borderColor = STATUS_ERROR;
              bg = `${STATUS_ERROR}12`;
            }
          } else if (isSelected) {
            borderColor = ACCENT;
            bg = `${ACCENT}15`;
          }

          return (
            <button
              key={idx}
              onClick={() => handleSelect(idx)}
              disabled={isRevealed}
              style={{
                display: 'flex', alignItems: 'center', gap: 12,
                padding: '14px 16px',
                background: bg,
                border: `1.5px solid ${borderColor}`,
                borderRadius: 10,
                color: TEXT_PRIMARY,
                fontSize: 14,
                fontWeight: 500,
                textAlign: 'left',
                cursor: isRevealed ? 'default' : 'pointer',
                transition: 'all .15s ease',
                width: '100%',
              }}
              onMouseEnter={e => {
                if (!isRevealed) e.currentTarget.style.borderColor = ACCENT;
              }}
              onMouseLeave={e => {
                if (!isRevealed && !isSelected) e.currentTarget.style.borderColor = BORDER_SUBTLE;
              }}
            >
              <span style={{
                width: 24, height: 24, borderRadius: '50%',
                border: `1.5px solid ${isRevealed && isCorrectAnswer ? STATUS_SUCCESS : isRevealed && isSelected ? STATUS_ERROR : isSelected ? ACCENT : BORDER_SUBTLE}`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 11, fontWeight: 700,
                color: isRevealed && isCorrectAnswer ? STATUS_SUCCESS : isRevealed && isSelected ? STATUS_ERROR : isSelected ? ACCENT : TEXT_MUTED,
                flexShrink: 0,
                background: isRevealed && isCorrectAnswer ? `${STATUS_SUCCESS}20` : isRevealed && isSelected ? `${STATUS_ERROR}20` : isSelected ? `${ACCENT}15` : 'transparent',
              }}>
                {String.fromCharCode(65 + idx)}
              </span>
              <span style={{ flex: 1 }}>{opt}</span>
              {isRevealed && isCorrectAnswer && <CheckCircle size={16} color={STATUS_SUCCESS} />}
              {isRevealed && isSelected && !isCorrectAnswer && <XCircle size={16} color={STATUS_ERROR} />}
            </button>
          );
        })}
      </div>

      {isRevealed && (
        <GlassSurfaceThin style={{ padding: '14px 16px', marginBottom: 20, background: isCorrect ? `${STATUS_SUCCESS}10` : `${STATUS_ERROR}10`, border: `1px solid ${isCorrect ? `${STATUS_SUCCESS}30` : `${STATUS_ERROR}30`}` }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
            {isCorrect ? <CheckCircle size={16} color={STATUS_SUCCESS} /> : <XCircle size={16} color={STATUS_ERROR} />}
            <Text variant="label" style={{ fontSize: 12, fontWeight: 700, color: isCorrect ? STATUS_SUCCESS : STATUS_ERROR, textTransform: 'uppercase' }}>
              {isCorrect ? 'Correct' : 'Incorrect'}
            </Text>
          </div>
          <Text variant="body" style={{ fontSize: 13, color: TEXT_SECONDARY, lineHeight: 1.6 }}>{q.explanation}</Text>
        </GlassSurfaceThin>
      )}

      {isRevealed && (
        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <button
            onClick={handleNext}
            style={{
              display: 'flex', alignItems: 'center', gap: 8,
              padding: '10px 20px', background: ACCENT,
              border: 'none', borderRadius: 10,
              color: 'var(--surface-canvas)', fontWeight: 600,
              fontSize: 14, cursor: 'pointer',
              transition: 'all .18s',
            }}
            onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-1px)'; }}
            onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; }}
          >
            {currentQ + 1 < questions.length ? 'Next Question' : 'See Results'}
            <ArrowRight size={14} />
          </button>
        </div>
      )}

      {/* Progress bar */}
      <div style={{ marginTop: 24, height: 3, background: 'var(--surface-active)', borderRadius: 2, overflow: 'hidden' }}>
        <div style={{
          height: '100%',
          width: `${((currentQ + (isRevealed ? 1 : 0)) / questions.length) * 100}%`,
          background: `linear-gradient(90deg, ${ACCENT}, rgba(212,176,140,0.6))`,
          borderRadius: 2,
          transition: 'width 0.3s ease',
        }} />
      </div>
    </GlassSurfaceBase>
  );
}
