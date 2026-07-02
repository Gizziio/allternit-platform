"use client";

import { useState } from "react";
import {
  QuestionForm,
  FormQuestion,
  DirectionCard,
  formatFormAnswers,
} from "../../lib/openui/question-form-parser";
import { cn } from "@/lib/utils";

interface Props {
  form: QuestionForm;
  onSubmit: (text: string) => void;
}

interface CardProps {
  card: DirectionCard;
  selected: boolean;
  onClick: () => void;
}

function DirectionCardItem({ card, selected, onClick }: CardProps) {
  return (
    <button type="button"
      onClick={onClick}
      className={cn(
        "w-full p-3 rounded-lg border border-solid text-left cursor-pointer transition-all duration-150",
        selected 
          ? "bg-[var(--accent-primary,#6366f1)]/10 border-[var(--accent-primary,#6366f1)]" 
          : "bg-[var(--surface-panel,rgba(255,255,255,0.04))] border-[var(--border-default,rgba(255,255,255,0.1))] hover:bg-white/5"
      )}
    >
      <div className="flex gap-1.5 mb-2">
        {card.palette.slice(0, 5).map((hex, i) => (
          <div
            key={`questionformview-${i}`}
            className="size-4 rounded-full border border-solid border-white/10 shrink-0"
            style={{ background: hex }}
          />
        ))}
      </div>
      <div
        className="text-[12px] font-semibold text-[var(--text-primary,#e8e0d8)] mb-0.5"
        style={{ fontFamily: card.font }}
      >
        {card.label}
      </div>
      <div className="text-[11px] text-[var(--text-secondary,rgba(255,255,255,0.5))] leading-relaxed">
        {card.mood}
      </div>
      {card.references.length > 0 && (
        <div className="mt-1.5 text-[10px] text-[var(--text-secondary,rgba(255,255,255,0.4))] opacity-70">
          Refs: {card.references.slice(0, 3).join(", ")}
        </div>
      )}
    </button>
  );
}

interface QuestionFieldProps {
  question: FormQuestion;
  value: string | string[];
  onChange: (v: string | string[]) => void;
}

function QuestionField({ question, value, onChange }: QuestionFieldProps) {
  const strVal = Array.isArray(value) ? '' : value;
  const arrVal = Array.isArray(value) ? value : [];

  switch (question.type) {
    case 'radio':
      return (
        <div>
          <div className="text-[12px] font-semibold text-[var(--text-primary,#e8e0d8)] mb-1">{question.label}{question.required && ' *'}</div>
          {question.description && <div className="text-[11px] text-[var(--text-secondary,rgba(255,255,255,0.5))] mb-2 leading-relaxed">{question.description}</div>}
          <div className="flex flex-col gap-1.5">
            {(question.options ?? []).map((opt) => (
              <label
                key={opt.value}
                className="flex items-start gap-2 cursor-pointer group"
              >
                <input aria-label="Radio" type="radio"
                  name={question.id}
                  value={opt.value}
                  checked={strVal === opt.value}
                  onChange={() => onChange(opt.value)}
                  className="mt-0.5 accent-[var(--accent-primary,#6366f1)] shrink-0"
                />
                <div>
                  <div className="text-[12px] text-[var(--text-primary,#e8e0d8)] group-hover:text-white transition-colors">{opt.label}</div>
                  {opt.description && (
                    <div className="text-[11px] text-[var(--text-secondary,rgba(255,255,255,0.5))] mt-px">
                      {opt.description}
                    </div>
                  )}
                </div>
              </label>
            ))}
          </div>
        </div>
      );

    case 'checkbox':
      return (
        <div>
          <div className="text-[12px] font-semibold text-[var(--text-primary,#e8e0d8)] mb-1">{question.label}{question.required && ' *'}</div>
          {question.description && <div className="text-[11px] text-[var(--text-secondary,rgba(255,255,255,0.5))] mb-2 leading-relaxed">{question.description}</div>}
          <div className="flex flex-col gap-1.5">
            {(question.options ?? []).map((opt) => (
              <label
                key={opt.value}
                className="flex items-start gap-2 cursor-pointer group"
              >
                <input aria-label="Checkbox" type="checkbox"
                  value={opt.value}
                  checked={arrVal.includes(opt.value)}
                  onChange={(e) => {
                    const next = e.target.checked
                      ? [...arrVal, opt.value]
                      : arrVal.filter((v) => v !== opt.value);
                    onChange(next);
                  }}
                  className="mt-0.5 accent-[var(--accent-primary,#6366f1)] shrink-0"
                />
                <div>
                  <div className="text-[12px] text-[var(--text-primary,#e8e0d8)] group-hover:text-white transition-colors">{opt.label}</div>
                  {opt.description && (
                    <div className="text-[11px] text-[var(--text-secondary,rgba(255,255,255,0.5))] mt-px">
                      {opt.description}
                    </div>
                  )}
                </div>
              </label>
            ))}
          </div>
        </div>
      );

    case 'select':
      return (
        <div>
          <div className="text-[12px] font-semibold text-[var(--text-primary,#e8e0d8)] mb-1">{question.label}{question.required && ' *'}</div>
          {question.description && <div className="text-[11px] text-[var(--text-secondary,rgba(255,255,255,0.5))] mb-2 leading-relaxed">{question.description}</div>}
          <select aria-label="Selection" value={strVal}
            onChange={(e) => onChange(e.target.value)}
            className="w-full p-[8px_10px] rounded-md border border-solid border-[var(--border-default,rgba(255,255,255,0.1))] bg-[var(--surface-panel,rgba(255,255,255,0.04))] text-[var(--text-primary,#e8e0d8)] text-[13px] outline-none appearance-none cursor-pointer focus:border-[var(--accent-primary,#6366f1)] transition-colors"
          >
            <option value="">Select…</option>
            {(question.options ?? []).map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </div>
      );

    case 'text':
      return (
        <div>
          <div className="text-[12px] font-semibold text-[var(--text-primary,#e8e0d8)] mb-1">{question.label}{question.required && ' *'}</div>
          {question.description && <div className="text-[11px] text-[var(--text-secondary,rgba(255,255,255,0.5))] mb-2 leading-relaxed">{question.description}</div>}
          <input aria-label={question.placeholder ?? ''} type="text"
            value={strVal}
            placeholder={question.placeholder ?? ''}
            onChange={(e) => onChange(e.target.value)}
            className="w-full p-[8px_10px] rounded-md border border-solid border-[var(--border-default,rgba(255,255,255,0.1))] bg-[var(--surface-panel,rgba(255,255,255,0.04))] text-[var(--text-primary,#e8e0d8)] text-[13px] outline-none focus:border-[var(--accent-primary,#6366f1)] transition-colors"
          />
        </div>
      );

    case 'textarea':
      return (
        <div>
          <div className="text-[12px] font-semibold text-[var(--text-primary,#e8e0d8)] mb-1">{question.label}{question.required && ' *'}</div>
          {question.description && <div className="text-[11px] text-[var(--text-secondary,rgba(255,255,255,0.5))] mb-2 leading-relaxed">{question.description}</div>}
          <textarea aria-label={question.placeholder ?? ''} value={strVal}
            placeholder={question.placeholder ?? ''}
            onChange={(e) => onChange(e.target.value)}
            rows={4}
            className="w-full p-[8px_10px] rounded-md border border-solid border-[var(--border-default,rgba(255,255,255,0.1))] bg-[var(--surface-panel,rgba(255,255,255,0.04))] text-[var(--text-primary,#e8e0d8)] text-[13px] outline-none resize-y focus:border-[var(--accent-primary,#6366f1)] transition-colors"
          />
        </div>
      );

    case 'direction-cards':
      return (
        <div>
          <div className="text-[12px] font-semibold text-[var(--text-primary,#e8e0d8)] mb-1">{question.label}{question.required && ' *'}</div>
          {question.description && <div className="text-[11px] text-[var(--text-secondary,rgba(255,255,255,0.5))] mb-2 leading-relaxed">{question.description}</div>}
          <div className="grid grid-cols-[repeat(auto-fill,minmax(180px,1fr))] gap-2">
            {(question.cards ?? []).map((card) => (
              <DirectionCardItem
                key={card.id}
                card={card}
                selected={strVal === card.id}
                onClick={() => onChange(card.id)}
              />
            ))}
          </div>
        </div>
      );

    default:
      return null;
  }
}

export function QuestionFormView({ form, onSubmit }: Props) {
  const [answers, setAnswers] = useState<Record<string, string | string[]>>({});
  const [submitted, setSubmitted] = useState(false);

  function setAnswer(id: string, value: string | string[]) {
    setAnswers((prev) => ({ ...prev, [id]: value }));
  }

  function handleSubmit() {
    const text = formatFormAnswers(form, answers);
    onSubmit(text);
    setSubmitted(true);
  }

  const allRequired = form.questions
    .filter((q) => q.required)
    .every((q) => {
      const v = answers[q.id];
      return v !== undefined && v !== '' && !(Array.isArray(v) && v.length === 0);
    });

  if (submitted) {
    return (
      <div className="p-[12px_16px] rounded-lg border border-solid border-[var(--border-default,rgba(255,255,255,0.1))] bg-[var(--surface-panel,rgba(255,255,255,0.04))] flex items-center gap-2 text-[12px] text-[var(--text-secondary,rgba(255,255,255,0.5))]">
        <span className="text-[var(--accent-primary,#6366f1)] font-semibold">✓ Answered</span>
        {form.title && <span>— {form.title}</span>}
      </div>
    );
  }

  return (
    <div className="p-4 rounded-lg border border-solid border-[var(--border-default,rgba(255,255,255,0.1))] bg-[var(--surface-panel,rgba(255,255,255,0.04))]">
      {form.title && (
        <div className="text-[13px] font-semibold text-[var(--text-primary,#e8e0d8)] mb-1">
          {form.title}
        </div>
      )}
      {form.description && (
        <div className="text-[12px] text-[var(--text-secondary,rgba(255,255,255,0.5))] mb-3 leading-relaxed">
          {form.description}
        </div>
      )}
      <div className="flex flex-col gap-4">
        {form.questions.map((q) => (
          <QuestionField
            key={q.id}
            question={q}
            value={answers[q.id] ?? (q.type === 'checkbox' ? [] : '')}
            onChange={(v) => setAnswer(q.id, v)}
          />
        ))}
      </div>
      <button type="button"
        onClick={handleSubmit}
        disabled={!allRequired}
        className={cn(
          "mt-4 px-4 py-2 rounded-md border-none text-[12px] font-semibold transition-all duration-150",
          allRequired 
            ? "bg-[var(--accent-primary,#6366f1)] text-white cursor-pointer hover:opacity-90" 
            : "bg-[var(--accent-primary,#6366f1)]/50 text-white/50 cursor-not-allowed"
        )}
      >
        Submit
      </button>
    </div>
  );
}
